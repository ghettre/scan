import { createClient } from "@supabase/supabase-js";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { ConnectedSheet, Invoice, Template } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const nativeRedirectUrl = "com.yass.invoicescanner://auth-callback";
const googleScopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
].join(" ");

const requireSupabaseCredentials = () => {
  if (!isSupabaseConfigured) {
    throw new Error("Missing Supabase credentials in .env");
  }
};

const isNative = Capacitor.isNativePlatform();

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce"
  }
  }
);

/* =========================================================
   ACCESS TOKEN CACHE
========================================================= */
let cachedAccessToken: string | null = localStorage.getItem("billflow_google_provider_token");

const toAppUser = (session: any) => ({
  id: session.user.id,
  email: session.user.email || "anonymous@billflow.app",
  displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "مستخدم مجهول",
  photoURL: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture
});

const cacheProviderTokens = (session: any) => {
  if (session?.provider_token) {
    cachedAccessToken = session.provider_token;
    localStorage.setItem("billflow_google_provider_token", session.provider_token);
  }

  if (session?.provider_refresh_token) {
    localStorage.setItem("billflow_google_provider_refresh_token", session.provider_refresh_token);
  }

  return cachedAccessToken || "";
};

const persistGoogleIntegration = async (session: any) => {
  const accessToken = session?.provider_token;
  const refreshToken =
    session?.provider_refresh_token ||
    localStorage.getItem("billflow_google_provider_refresh_token");

  if (!session?.user?.id || !accessToken) return;

  const payload: Record<string, any> = {
    user_id: session.user.id,
    google_access_token: accessToken,
    updated_at: new Date().toISOString()
  };

  if (refreshToken) {
    payload.google_refresh_token = refreshToken;
  }

  const { error } = await supabase
    .from("user_integrations")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.warn("Could not persist Google integration tokens:", error.message);
  }
};

export const getValidGoogleAccessToken = async () => {
  requireSupabaseCredentials();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session) throw new Error("No session");

  const token = cacheProviderTokens(session);
  await persistGoogleIntegration(session);

  if (!token) {
    throw new Error("No Google provider token");
  }

  return token;
};

export const signOutForExpiredSession = async () => {
  requireSupabaseCredentials();

  await supabase.auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("billflow_google_provider_token");
  localStorage.removeItem("billflow_google_provider_refresh_token");
  localStorage.removeItem("billflow_logged_in");
  window.location.href = "/login";
};

const paramsFromOAuthUrl = (url: string) => {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;

  if (hash) {
    new URLSearchParams(hash).forEach((value, key) => params.set(key, value));
  }

  return params;
};

/* =========================================================
   AUTH INIT
========================================================= */
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!isSupabaseConfigured) {
    console.error("Missing Supabase credentials in .env");
    onAuthFailure?.();
    return () => undefined;
  }

  const handleSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    console.log("session:", session);

    if (session) {
      const token = cacheProviderTokens(session);
      await persistGoogleIntegration(session);
      onAuthSuccess?.(toAppUser(session), token);
    } else {
      const { data } = await supabase.auth.signInAnonymously();

      if (data?.session) {
        onAuthSuccess?.(
          {
            id: data.session.user.id,
            email: "anonymous@billflow.app",
            displayName: "مستخدم مجهول",
          },
          ""
        );
      } else {
        onAuthFailure?.();
      }
    }
  };

  handleSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    console.log("EVENT:", _event);
    if (session) {
      const token = cacheProviderTokens(session);
      setTimeout(() => {
        persistGoogleIntegration(session);
      }, 0);
      onAuthSuccess?.(toAppUser(session), token);
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("billflow_google_provider_token");
      localStorage.removeItem("billflow_google_provider_refresh_token");
      onAuthFailure?.();
    }
  });

  return () => subscription.unsubscribe();
};

/* =========================================================
   GOOGLE OAUTH (FIXED FOR MOBILE)
========================================================= */
export const signInWithGoogleOAuth = async (params?: {
  scopes?: string;
}) => {
  requireSupabaseCredentials();

  const redirectTo = isNative ? nativeRedirectUrl : `${window.location.origin}/auth-callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: params?.scopes || googleScopes,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned");

  if (isNative) {
    await Browser.open({ url: data.url });
    return;
  }

  window.location.assign(data.url);
};

export const nativeGoogleSignIn = signInWithGoogleOAuth;
export const googleSignIn = signInWithGoogleOAuth;

/* =========================================================
   DEEP LINK HANDLER (FIXED)
========================================================= */
export const completeOAuthRedirect = async (url: string) => {
  requireSupabaseCredentials();

  if (!url.startsWith(nativeRedirectUrl) && !url.startsWith(`${window.location.origin}/auth-callback`)) {
    return null;
  }

  const params = paramsFromOAuthUrl(url);
  const errorDescription = params.get("error_description") || params.get("error");

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = params.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    cacheProviderTokens(data.session);
    await persistGoogleIntegration(data.session);
    return data.session;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) throw error;
    cacheProviderTokens(data.session);
    await persistGoogleIntegration(data.session);
    return data.session;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  cacheProviderTokens(session);
  return session;
};

export const handleDeepLinkCallback = () => {
  const handleUrl = async (url: string) => {
    if (!url.startsWith(nativeRedirectUrl)) return;

    try {
      await completeOAuthRedirect(url);
    } finally {
      await Browser.close().catch(() => undefined);
    }
  };

  App.getLaunchUrl().then((launchUrl) => {
    if (launchUrl?.url) {
      handleUrl(launchUrl.url);
    }
  });

  if (!isNative) {
    completeOAuthRedirect(window.location.href).catch((error) => {
      console.warn("Failed to complete OAuth redirect:", error);
    });
  }

  const listener = App.addListener("appUrlOpen", async (event) => {
    const url = event.url;

    await handleUrl(url);
  });

  return () => listener.then((l) => l.remove());
};

/* =========================================================
   HELPERS
========================================================= */
export const getAccessToken = () => cachedAccessToken;

export const logoutGoogle = async () => {
  requireSupabaseCredentials();

  await supabase.auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("billflow_google_provider_token");
  localStorage.removeItem("billflow_google_provider_refresh_token");
};

export const saveInvoiceToSupabase = async (invoice: Invoice) => {
  requireSupabaseCredentials();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated Supabase user");

  const fixedKeys = new Set([
    "id",
    "storeName",
    "totalAmount",
    "taxAmount",
    "date",
    "category",
    "status"
  ]);
  const customFields = Object.fromEntries(
    Object.entries(invoice).filter(([key]) => !fixedKeys.has(key))
  );

  const { data, error } = await supabase
    .from("invoices")
    .upsert(
      {
        id: invoice.id,
        user_id: user.id,
        store_name: invoice.storeName,
        total_amount: invoice.totalAmount,
        tax_amount: invoice.taxAmount,
        date: invoice.date,
        category: invoice.category,
        status: invoice.status,
        custom_fields: customFields,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getInvoicesFromSupabase = async (): Promise<Invoice[]> => {
  requireSupabaseCredentials();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    storeName: row.store_name || "",
    totalAmount: Number(row.total_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    date: row.date || "",
    category: row.category || "",
    status: row.status || "pending",
    createdAt: row.created_at,
    ...(row.custom_fields || {})
  }));
};

export const getTemplates = async (userId: string): Promise<Template[]> => {
  requireSupabaseCredentials();

  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    fieldsConfig: row.fields_config || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const upsertTemplate = async (userId: string, template: Template) => {
  requireSupabaseCredentials();

  const { data, error } = await supabase
    .from("templates")
    .upsert(
      {
        id: template.id,
        user_id: userId,
        name: template.name,
        fields_config: template.fieldsConfig,
        created_at: template.createdAt,
        updated_at: template.updatedAt || new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getSheetConfigs = async (userId: string): Promise<ConnectedSheet[]> => {
  requireSupabaseCredentials();

  const { data, error } = await supabase
    .from("sheet_configs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    spreadsheetId: row.spreadsheet_id,
    spreadsheetUrl: row.spreadsheet_url || `https://docs.google.com/spreadsheets/d/${row.spreadsheet_id}/edit`,
    name: row.name || "Google Sheet",
    sheetName: row.sheet_name,
    fieldsConfig: row.fields_config || [],
    basedOnTemplateId: row.based_on_template_id || undefined,
    isShortcut: row.is_shortcut || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const upsertSheetConfig = async (userId: string, sheet: ConnectedSheet) => {
  requireSupabaseCredentials();

  const { data, error } = await supabase
    .from("sheet_configs")
    .upsert(
      {
        id: sheet.id,
        user_id: userId,
        spreadsheet_id: sheet.spreadsheetId,
        spreadsheet_url: sheet.spreadsheetUrl || null,
        sheet_name: sheet.sheetName,
        name: sheet.name,
        based_on_template_id: sheet.basedOnTemplateId || null,
        is_shortcut: sheet.isShortcut || false,
        fields_config: sheet.fieldsConfig,
        created_at: sheet.createdAt,
        updated_at: sheet.updatedAt || new Date().toISOString()
      },
      { onConflict: "user_id,spreadsheet_id,sheet_name" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteSheetConfig = async (userId: string, sheetConfigId: string) => {
  requireSupabaseCredentials();

  const { error } = await supabase
    .from("sheet_configs")
    .delete()
    .eq("user_id", userId)
    .eq("id", sheetConfigId);

  if (error) throw error;
};

/* =========================================================
   EMAIL AUTH
========================================================= */
export const signInWithEmail = async (email: string, password: string) => {
  requireSupabaseCredentials();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName: string
) => {
  requireSupabaseCredentials();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) throw error;
  return data;
};

export const resetPasswordForEmail = async (email: string) => {
  requireSupabaseCredentials();

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });

  if (error) throw error;
  return data;
};
