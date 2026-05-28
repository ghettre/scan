import React, { useState, useEffect } from "react";
import { Home, TrendingUp, History, Settings as SettingsIcon, RefreshCw, BookTemplate } from "lucide-react";

import { Invoice, FieldConfig, ConnectedSheet, Template, InvoiceSyncTarget } from "./types";
import { initialInvoices, defaultFieldsConfig } from "./initialData";

import { initAuth, googleSignIn, logoutGoogle, saveInvoiceToSupabase, getInvoicesFromSupabase, supabase, getTemplates, upsertTemplate, getSheetConfigs, upsertSheetConfig, deleteSheetConfig, signInWithGoogleOAuth, handleDeepLinkCallback, getValidGoogleAccessToken, signOutForExpiredSession } from "./lib/supabaseAuth";
import { createGoogleSpreadsheet, appendRowToSpreadsheet, listUserSpreadsheets, mapInvoiceToRow } from "./lib/googleSheets";
import { apiFetch } from "./lib/api";

import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Analytics from "./components/Analytics";
import InvoiceHistory from "./components/InvoiceHistory";
import Settings from "./components/Settings";
import ScannerContainer from "./components/ScannerContainer";
import InvoiceReview from "./components/InvoiceReview";
import FieldCustomizer from "./components/FieldCustomizer";
import SpreadsheetSelector from "./components/SpreadsheetSelector";
import TemplatesPage from "./components/TemplatesPage";
import InitialSetup from "./components/InitialSetup";
import AppLogo from "./components/AppLogo";
import LegalPage from "./components/LegalPage";

interface SyncLogItem {
  id: string;
  title: string;
  time: string;
  size: string;
  success: boolean;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`رد الخادم غير صالح (${response.status}): ${text.slice(0, 200)}`);
  }
}

async function fetchGoogleIntegrationStatus(userId: string) {
  const response = await apiFetch(`/api/google/integration?userId=${encodeURIComponent(userId)}`);
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error([data.error, data.details].filter(Boolean).join(": ") || "فشل التحقق من ربط Google Sheets");
  }

  return data as { connected: boolean; hasAccessToken: boolean; spreadsheetId: string };
}

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};
const cloneSortedFields = (fields: unknown, fallback: FieldConfig[] = []) =>
  (Array.isArray(fields) ? fields : fallback)
    .map((field) => ({ ...field }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

const sortInvoicesDesc = (list: Invoice[]): Invoice[] => {
  return [...list].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date || 0).getTime();
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date || 0).getTime();
    return timeB - timeA;
  });
};

export default function App() {
  const [legalPage, setLegalPage] = useState<"privacy" | "terms" | null>(null);

  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("billflow_logged_in") === "true";
  });
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem("billflow_user_email") || "ahmed.m@example.com";
  });
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem("billflow_user_name") || "أحمد محمد";
  });
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem("billflow_user_id") || "";
  });
  const [isNewUser, setIsNewUser] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Google OAuth states
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState(() => {
    return localStorage.getItem("billflow_spreadsheet_id") || "";
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(() => {
    return localStorage.getItem("billflow_spreadsheet_url") || "";
  });
  const [spreadsheetName, setSpreadsheetName] = useState(() => {
    return localStorage.getItem("billflow_spreadsheet_name") || "";
  });
  const [spreadsheetSheetName, setSpreadsheetSheetName] = useState(() => {
    return localStorage.getItem("billflow_spreadsheet_sheet_name") || "قائمة الفواتير";
  });
  const [activeTemplateId, setActiveTemplateId] = useState(() => {
    return localStorage.getItem("billflow_active_template_id") || "";
  });
  const [connectedSheets, setConnectedSheets] = useState<ConnectedSheet[]>(() => {
    const saved = localStorage.getItem("billflow_connected_sheets");
    return saved ? JSON.parse(saved) : [];
  });
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem("billflow_templates");
    return saved ? JSON.parse(saved) : [];
  });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const activeConnectedSheet = connectedSheets.find(
    (sheet) => sheet.spreadsheetId === spreadsheetId && sheet.sheetName === spreadsheetSheetName
  );
  const currentSpreadsheetName = spreadsheetName || activeConnectedSheet?.name || "";

  // State flags
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingColumns, setIsSyncingColumns] = useState(false);

  // Sync logs timeline data
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>(() => {
    const saved = localStorage.getItem("billflow_sync_logs");
    if (saved) return JSON.parse(saved);
    return [
      {
        id: "log_1",
        title: "تم تهيئة محاذاة الفواتير السحابية",
        time: "اليوم، 12:00 صباحاً",
        size: "0 كب",
        success: true
      }
    ];
  });

  // Main application data stored in localStorage
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem("billflow_invoices");
    const loaded = saved ? JSON.parse(saved) : initialInvoices;
    return sortInvoicesDesc(loaded);
  });

  const [fieldsConfig, setFieldsConfig] = useState<FieldConfig[]>(() => {
    const saved = localStorage.getItem("billflow_fields_config");
    return saved ? JSON.parse(saved) : defaultFieldsConfig;
  });

  // Navigation and view tabs
  const [activeTab, setActiveTab] = useState<"home" | "analytics" | "history" | "settings" | "templates">("home");
  const [darkMode, setDarkMode] = useState(false);

  // Workflow states: scanning, reviewing, customizer
  const [showScanner, setShowScanner] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [isSettingUpNewSheetColumns, setIsSettingUpNewSheetColumns] = useState(false);
  const [pendingNewSheetTitle, setPendingNewSheetTitle] = useState("");

  const [scannedData, setScannedData] = useState<any>(null);
  const [scannedImageUrl, setScannedImageUrl] = useState("");
  const [isDirectScanning, setIsDirectScanning] = useState(false);
  const [directScanText, setDirectScanText] = useState("");

  const isUnauthorizedError = (error: any) =>
    error?.status === 401 || String(error?.message || "").includes("401");

  const handleExpiredGoogleSession = async () => {
    alert("انتهت صلاحية اتصال Google. يرجى تسجيل الدخول من جديد.");
    await signOutForExpiredSession();
  };

  const getCurrentGoogleAccessToken = async () => {
    try {
      const token = await getValidGoogleAccessToken();
      setGoogleToken(token);
      return token;
    } catch (error) {
      console.warn("Unable to refresh Google provider token from Supabase session:", error);
      return googleToken && googleToken !== "connected" ? googleToken : null;
    }
  };

  // Synchronise localStorage persistence
  useEffect(() => {
    localStorage.setItem("billflow_invoices", JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem("billflow_fields_config", JSON.stringify(fieldsConfig));
  }, [fieldsConfig]);

  useEffect(() => {
    localStorage.setItem("billflow_spreadsheet_name", spreadsheetName);
  }, [spreadsheetName]);

  useEffect(() => {
    localStorage.setItem("billflow_connected_sheets", JSON.stringify(connectedSheets));
  }, [connectedSheets]);

  useEffect(() => {
    localStorage.setItem("billflow_templates", JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem("billflow_active_template_id", activeTemplateId);
  }, [activeTemplateId]);



  useEffect(() => {
    localStorage.setItem("billflow_sync_logs", JSON.stringify(syncLogs));
  }, [syncLogs]);

  useEffect(() => {
    if (!spreadsheetId || !currentSpreadsheetName) return;

    setConnectedSheets((prev) =>
      prev.map((template) =>
        template.spreadsheetId === spreadsheetId && template.name !== currentSpreadsheetName
          ? { ...template, name: currentSpreadsheetName, updatedAt: new Date().toISOString() }
          : template
      )
    );
  }, [spreadsheetId, currentSpreadsheetName]);

  useEffect(() => {
    if (!spreadsheetId || !googleToken) return;

    let cancelled = false;
    const syncSpreadsheetName = async () => {
      try {
        let found: { id: string; name: string; url: string } | undefined;

        if (googleToken !== "connected") {
          const token = await getCurrentGoogleAccessToken();
          if (!token) return;
          const sheets = await listUserSpreadsheets(token);
          found = sheets.find((sheet) => sheet.id === spreadsheetId);
        } else if (googleUser?.id) {
          const response = await apiFetch(
            `/api/google/spreadsheet-metadata?userId=${encodeURIComponent(googleUser.id)}&spreadsheetId=${encodeURIComponent(spreadsheetId)}`
          );
          const result = await readJsonResponse(response);
          if (response.ok && result?.id) {
            found = result;
          }
        }

        if (!cancelled && found?.name) {
          setSpreadsheetName(found.name);
          if (found.url) {
            setSpreadsheetUrl(found.url);
            localStorage.setItem("billflow_spreadsheet_url", found.url);
          }
        }
      } catch (error) {
        console.warn("Failed to sync spreadsheet name:", error);
      }
    };

    syncSpreadsheetName();
    return () => {
      cancelled = true;
    };
  }, [spreadsheetId, googleToken, googleUser?.id]);

  // Sync Dark mode setup dynamic toggling on HTML element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Register deep-link listener for OAuth callback (com.yass.invoicescanner://auth-callback)
  useEffect(() => {
    const cleanup = handleDeepLinkCallback();
    return cleanup;
  }, []);

  // Load / initialize Google OAuth and restore user state
  useEffect(() => {
    // First, check if there's an existing session from localStorage
    const checkExistingSession = async () => {
      const loggedIn = localStorage.getItem("billflow_logged_in") === "true";
      if (loggedIn) {
        // User was previously logged in, keep them logged in while we verify session
        setIsAuthInitializing(true);
      }
    };
    checkExistingSession();

    const unsubscribe = initAuth(
      async (unsubUser, token) => {
        setGoogleUser(unsubUser);

        // Check integration status from Supabase
        if (unsubUser?.id) {
          const integration = await fetchGoogleIntegrationStatus(unsubUser.id).catch((err) => {
            console.warn("Failed to load Google integration status", err);
            return null;
          });

          if (integration?.connected) {
            setGoogleToken(token || "connected");
            if (integration.spreadsheetId) {
              setSpreadsheetId(integration.spreadsheetId);
              setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}/edit`);
            }
          } else if (token) {
            setGoogleToken(token);
          } else {
            setGoogleToken(null);
            setSpreadsheetId("");
            setSpreadsheetUrl("");
            setSpreadsheetName("");
          }

          try {
            const supInvoices = await getInvoicesFromSupabase();
            if (supInvoices && supInvoices.length > 0) {
              setInvoices((prev) => {
                const localPending = prev.filter(p => p.status === 'pending');
                const cloudIds = new Set(supInvoices.map((s: any) => s.id));
                const localUnique = localPending.filter(p => !cloudIds.has(p.id));
                return sortInvoicesDesc([...localUnique, ...supInvoices]);
              });
            }
          } catch (e) {
            console.error('Failed to load invoices from Supabase', e);
          }
        } else {
          setGoogleToken(null);
        }

        // Also log into standard app if they prefer Google Auth login
        handleLoginSuccess(unsubUser.email || "user@gmail.com", unsubUser.displayName || "مستخدم Google");

        // Mark auth as initialized and check complete
        setIsAuthInitializing(false);
        setAuthCheckComplete(true);
      },
      () => {
        // No connected Google Auth
        setGoogleToken(null);
        setIsAuthInitializing(false);
        setAuthCheckComplete(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const addSyncLog = (title: string, success: boolean, size: string) => {
    const now = new Date();
    const timeFormatted = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newLog: SyncLogItem = {
      id: Math.random().toString(),
      title,
      time: `اليوم، ${timeFormatted}`,
      size,
      success
    };
    setSyncLogs((prev) => [newLog, ...prev]);
  };

  const getActiveFieldsSnapshot = () => cloneSortedFields(fieldsConfig);

  const getFieldsSnapshotForNewSheet = (templateId = editingTemplateId) => {
    const columnTemplate = templates.find((template) => template.id === templateId);
    return cloneSortedFields(columnTemplate?.fieldsConfig, fieldsConfig);
  };

  const upsertCurrentSheetTemplate = (
    nextSpreadsheetId: string,
    nextSpreadsheetUrl: string,
    nextSheetName: string,
    templateName = "قالب Google Sheets الحالي",
    nextFieldsConfig: any[] = fieldsConfig,
    makeActive = true,
    basedOnTemplateId?: string,
    isShortcut?: boolean
  ) => {
    const now = new Date().toISOString();
    const existing = connectedSheets.find(
      (template) =>
        template.spreadsheetId === nextSpreadsheetId &&
        template.sheetName === nextSheetName
    );
    const nextTemplate: ConnectedSheet = {
      id: existing?.id || createId(),
      name: templateName || existing?.name || "قالب Google Sheets الحالي",
      spreadsheetId: nextSpreadsheetId,
      spreadsheetUrl: nextSpreadsheetUrl,
      sheetName: nextSheetName,
      fieldsConfig: cloneSortedFields(nextFieldsConfig),
      basedOnTemplateId: basedOnTemplateId || existing?.basedOnTemplateId,
      // Preserve existing shortcut flag unless explicitly set; new sheets default to false
      isShortcut: isShortcut !== undefined ? isShortcut : (existing?.isShortcut ?? false),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    setConnectedSheets((prev) => {
      const exists = prev.some((template) => template.id === nextTemplate.id);
      return exists
        ? prev.map((template) => template.id === nextTemplate.id ? nextTemplate : template)
        : [nextTemplate, ...prev];
    });
    if (makeActive) {
      setActiveTemplateId(nextTemplate.id);
    }
    // Persist to Supabase if logged in
    if (userId) {
      upsertSheetConfig(userId, nextTemplate).catch(console.error);
    }
    return nextTemplate;
  };

  const saveColumnTemplate = (name: string, makeActive = true) => {
    const now = new Date().toISOString();
    const nextTemplate: Template = {
      id: makeActive && editingTemplateId ? editingTemplateId : createId(),
      name,
      fieldsConfig: cloneSortedFields(fieldsConfig),
      createdAt: makeActive ? templates.find((t) => t.id === editingTemplateId)?.createdAt || now : now,
      updatedAt: now
    };

    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === nextTemplate.id);
      return exists ? prev.map((t) => (t.id === nextTemplate.id ? nextTemplate : t)) : [nextTemplate, ...prev];
    });
    if (makeActive) {
      setEditingTemplateId(nextTemplate.id);
    }
    addSyncLog(`تم حفظ قالب الأعمدة: ${name}`, true, "—");
    // Persist to Supabase if userId is available
    if (userId) {
      upsertTemplate(userId, nextTemplate).catch(console.error);
    }
    return nextTemplate;
  };

  const handleSaveColumnTemplate = () => {
    const defaultName = templates.find((template) => template.id === editingTemplateId)?.name || "قالب أعمدة جديد";
    const name = window.prompt("اسم قالب الأعمدة:", defaultName)?.trim();
    if (!name) return false;

    saveColumnTemplate(name, false); // Don't make it active globally, it's just a template
    return true;
  };

  const handleSelectColumnTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    setEditingTemplateId(template.id);
    setFieldsConfig(cloneSortedFields(template.fieldsConfig, fieldsConfig));
    addSyncLog(`تم تطبيق قالب الأعمدة: ${template.name}`, true, "—");
  };

  const handleDeleteColumnTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`حذف قالب الأعمدة "${template.name}"؟`)) return;

    setTemplates((prev) => prev.filter((item) => item.id !== templateId));
    if (editingTemplateId === templateId) {
      setEditingTemplateId(null);
    }
    addSyncLog(`تم حذف قالب الأعمدة: ${template.name}`, true, "—");
  };

  const buildCurrentSyncTarget = (): InvoiceSyncTarget | undefined => {
    if (!spreadsheetId) return undefined;

    const template =
      connectedSheets.find(
        (item) =>
          item.id === activeTemplateId &&
          item.spreadsheetId === spreadsheetId &&
          item.sheetName === spreadsheetSheetName
      ) ||
      connectedSheets.find((item) => item.spreadsheetId === spreadsheetId && item.sheetName === spreadsheetSheetName);
    const fieldsSnapshot = cloneSortedFields(template?.fieldsConfig, getActiveFieldsSnapshot());

    return {
      templateId: template?.id || activeTemplateId || `sheet_${spreadsheetId}_${spreadsheetSheetName}`,
      templateName: template?.name || "قالب Google Sheets الحالي",
      spreadsheetId,
      spreadsheetUrl,
      sheetName: spreadsheetSheetName || "قائمة الفواتير",
      fieldsConfig: fieldsSnapshot,
      assignedAt: new Date().toISOString()
    };
  };

  // Persist userId to localStorage
  useEffect(() => {
    if (userId) {
      localStorage.setItem("billflow_user_id", userId);
    }
  }, [userId]);

  const handleLoginSuccess = (email: string, name: string) => {
    setUserEmail(email);
    setUserName(name);
    setIsLoggedIn(true);
    localStorage.setItem("billflow_logged_in", "true");
    localStorage.setItem("billflow_user_email", email);
    localStorage.setItem("billflow_user_name", name);

    // Retrieve user ID from Supabase and load user data
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const newUserId = user.id;
        setUserId(newUserId);
        localStorage.setItem("billflow_user_id", newUserId);

        // Load templates from Supabase
        getTemplates(newUserId).then((dbTemplates) => {
          if (dbTemplates && dbTemplates.length > 0) {
            setTemplates(dbTemplates);
          }
        }).catch(console.error);

        // Load sheet configs from Supabase and merge with local state
        getSheetConfigs(newUserId).then((configs) => {
          setConnectedSheets((prev) => {
            // Start with Supabase configs (source of truth)
            const merged = [...configs];

            // Merge any local configs that are not in Supabase
            prev.forEach((localSheet) => {
              const existsInSupabase = configs.some(
                c => c.spreadsheetId === localSheet.spreadsheetId && c.sheetName === localSheet.sheetName
              );
              if (!existsInSupabase) {
                merged.push(localSheet);
                // Upload local sheet to Supabase
                upsertSheetConfig(newUserId, localSheet).catch(console.error);
              }
            });

            return merged;
          });
        }).catch(console.error);

        // Check if this is a new user (no templates and no sheet configs)
        Promise.all([
          getTemplates(newUserId).catch(() => []),
          getSheetConfigs(newUserId).catch(() => [])
        ]).then(([dbTemplates, dbConfigs]) => {
          const hasExistingData = (dbTemplates && dbTemplates.length > 0) || (dbConfigs && dbConfigs.length > 0);
          setIsNewUser(!hasExistingData);
        }).catch(() => {
          // If we can't check, assume not new user
          setIsNewUser(false);
        });
      }
    });
  };
  const handleLogout = async () => {
    setIsLoggedIn(false);
    setUserEmail("");
    setUserName("");
    setUserId("");
    setGoogleUser(null);
    setGoogleToken(null);
    setSpreadsheetId("");
    setSpreadsheetUrl("");
    setSpreadsheetName("");
    setSpreadsheetSheetName("قائمة الفواتير");
    setActiveTemplateId("");
    setConnectedSheets([]);
    setTemplates([]);
    setEditingTemplateId(null);
    setSyncLogs([
      {
        id: "log_1",
        title: "تم تهيئة محاذاة الفواتير السحابية",
        time: "اليوم، 12:00 صباحاً",
        size: "0 كب",
        success: true
      }
    ]);
    setInvoices(initialInvoices);
    setFieldsConfig(defaultFieldsConfig);

    // Clear all localStorage keys for user data
    localStorage.removeItem("billflow_logged_in");
    localStorage.removeItem("billflow_user_email");
    localStorage.removeItem("billflow_user_name");
    localStorage.removeItem("billflow_google_provider_token");
    localStorage.removeItem("billflow_google_provider_refresh_token");
    localStorage.removeItem("billflow_spreadsheet_id");
    localStorage.removeItem("billflow_spreadsheet_url");
    localStorage.removeItem("billflow_spreadsheet_name");
    localStorage.removeItem("billflow_spreadsheet_sheet_name");
    localStorage.removeItem("billflow_active_template_id");
    localStorage.removeItem("billflow_connected_sheets");
    localStorage.removeItem("billflow_templates");
    localStorage.removeItem("billflow_sync_logs");
    localStorage.removeItem("billflow_invoices");
    localStorage.removeItem("billflow_fields_config");

    await supabase.auth.signOut();
  };

  // Google OAuth connector triggers
  const handleConnectGoogle = async () => {
    try {
      // Use Supabase OAuth with Chrome Custom Tab + deep link redirect.
      // This replaces the server-side /api/auth/google/url call which doesn't work on Android.
      await signInWithGoogleOAuth();
    } catch (err: any) {
      console.error(err);
      alert(`فشل في فتح تسجيل الدخول بـ Google: ${err.message || err}`);
    }
  };

  const handleDisconnectGoogle = async () => {
    const targetUserId = googleUser?.id || userId;
    if (targetUserId) {
      try {
        const res = await apiFetch("/api/google/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: targetUserId }),
        });
        if (!res.ok) {
          const data = await readJsonResponse(res);
          throw new Error(data.error || "Failed server-side delete");
        }
      } catch (err) {
        console.warn("Failed server disconnect, falling back to client-side delete:", err);
        await supabase.from("user_integrations").delete().eq("user_id", targetUserId);
      }
    }
    setGoogleToken(null);
    setSpreadsheetId("");
    setSpreadsheetUrl("");
    setSpreadsheetName("");
    localStorage.removeItem("billflow_spreadsheet_id");
    localStorage.removeItem("billflow_spreadsheet_url");
    localStorage.removeItem("billflow_spreadsheet_name");
    addSyncLog("تم فصل حساب Google بنجاح", true, "—");
  };

  // Create a brand new Spreadsheet in Google Sheets
  const handleCreateNewSheet = async (options?: { templateId?: string; title?: string }) => {
    if (!googleToken) {
      throw new Error("الرجاء ربط حساب Google أولاً.");
    }

    try {
      setIsCreatingSheet(true);

      // Extract current active columns configured by the user to use as Excel titles
      const fieldsForNewSheet = getFieldsSnapshotForNewSheet(options?.templateId || "");
      setFieldsConfig(fieldsForNewSheet.map((field) => ({ ...field })));

      const activeHeaders = fieldsForNewSheet
        .filter((f) => f.enabled)
        .map((f) => f.label);

      if (activeHeaders.length === 0) {
        throw new Error("الرجاء تمكين عمود واحد على الأقل لتتمكن من إنشاء الجدول.");
      }

      const defaultTitle = `فواتير smart scan - ${new Date().toISOString().split("T")[0]}`;
      const sheetTitle = options?.title?.trim() || pendingNewSheetTitle.trim() || defaultTitle;
      let sheet: { id: string; url: string };
      const currentGoogleAccessToken = await getCurrentGoogleAccessToken();
      if (currentGoogleAccessToken) {
        sheet = await createGoogleSpreadsheet(currentGoogleAccessToken, sheetTitle, activeHeaders);
      } else if (googleUser?.id) {
        const response = await apiFetch("/api/google/create-spreadsheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: googleUser.id,
            title: sheetTitle,
            headers: activeHeaders,
            googleAccessToken: currentGoogleAccessToken || undefined
          })
        });
        const result = await readJsonResponse(response);
        if (response.status === 401) {
          await handleExpiredGoogleSession();
          return;
        }
        if (!response.ok) {
          throw new Error([result.error, result.details].filter(Boolean).join(": ") || "فشل إنشاء جدول البيانات");
        }
        sheet = result;
      } else {
        throw new Error("لم يتم العثور على مستخدم Google نشط.");
      }

      setSpreadsheetId(sheet.id);
      setSpreadsheetUrl(sheet.url);
      setSpreadsheetName(sheetTitle);
      setSpreadsheetSheetName("قائمة الفواتير");

      const sheetConfig = upsertCurrentSheetTemplate(
        sheet.id,
        sheet.url,
        "قائمة الفواتير",
        sheetTitle,
        fieldsForNewSheet,
        true, // makeActive
        options?.templateId
      );

      localStorage.setItem("billflow_spreadsheet_id", sheet.id);
      localStorage.setItem("billflow_spreadsheet_url", sheet.url);
      localStorage.setItem("billflow_spreadsheet_name", sheetTitle);
      localStorage.setItem("billflow_spreadsheet_sheet_name", "قائمة الفواتير");
      if (googleUser?.id) {
        await apiFetch("/api/google/select-spreadsheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: googleUser.id, spreadsheetId: sheet.id })
        });
      }

      localStorage.setItem("billflow_active_template_id", sheetConfig.id);

      setIsCreatingSheet(false);
      addSyncLog(`تم إنشاء الشيت ومزامنة أعمدته تلقائياً: "${sheetTitle}"`, true, "1.2 كب");
      return {
        id: sheet.id,
        name: sheetTitle,
        url: sheet.url,
        sheetName: "قائمة الفواتير"
      };
    } catch (err: any) {
      setIsCreatingSheet(false);
      console.error(err);
      // Re-throw so callers (SpreadsheetSelector, FieldCustomizer) can show error in UI
      throw err;
    }
  };

  const handleStartNewSheetColumnSetup = (title?: string) => {
    setPendingNewSheetTitle(title?.trim() || "");
    setShowSheetSelector(false);
    setIsSettingUpNewSheetColumns(true);
    setShowCustomizer(true);
  };

  const handleCreateSheetFromCustomizer = async (options: { saveAsColumnTemplate: boolean; templateName?: string; sheetTitle?: string }) => {
    let templateId: string | undefined;
    if (options.saveAsColumnTemplate) {
      const newTemplate = saveColumnTemplate(options.templateName?.trim() || "قالب أعمدة جديد", false);
      templateId = newTemplate.id;
    }

    await handleCreateNewSheet({ title: options.sheetTitle, templateId });
    setPendingNewSheetTitle("");
    setIsSettingUpNewSheetColumns(false);
    setShowCustomizer(false);
    setActiveTab("home");
  };

  const handleUpdateTemplateFromSheet = () => {
    const targetTemplateId = activeConnectedSheet?.basedOnTemplateId || activeTemplateId;
    if (targetTemplateId) {
      const updatedAt = new Date().toISOString();
      // Use current fieldsConfig directly (not a snapshot function)
      const currentFields = fieldsConfig;
      setTemplates(prev => prev.map(t =>
        t.id === targetTemplateId
          ? { ...t, fieldsConfig: currentFields, updatedAt }
          : t
      ));
      // Find the template, merge with current fields, then upsert
      const t = templates.find(x => x.id === targetTemplateId);
      if (t && userId) {
        upsertTemplate(userId, { ...t, fieldsConfig: currentFields, updatedAt }).catch(console.error);
      }
      if (activeConnectedSheet) {
        const nextSheet = { ...activeConnectedSheet, fieldsConfig: currentFields };
        setConnectedSheets(prev => prev.map(s =>
          s.spreadsheetId === spreadsheetId && s.sheetName === spreadsheetSheetName
            ? nextSheet
            : s
        ));
        if (userId) upsertSheetConfig(userId, nextSheet).catch(console.error);
      } else if (spreadsheetId) {
        upsertCurrentSheetTemplate(
          spreadsheetId,
          spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          spreadsheetSheetName || "قائمة الفواتير",
          spreadsheetName || "شيت Google الحالي",
          currentFields,
          true,
          targetTemplateId
        );
      }
      addSyncLog("تم تحديث القالب المرتبط بنجاح", true, "—");
    }
    setShowCustomizer(false);
    setActiveTab("home");
  };

  const handleSaveFieldSettings = () => {
    const currentFields = fieldsConfig;
    if (activeTab === "templates") {
      if (editingTemplateId) {
        const updatedAt = new Date().toISOString();
        setTemplates(prev => prev.map(t =>
          t.id === editingTemplateId
            ? { ...t, fieldsConfig: currentFields, updatedAt }
            : t
        ));
        const t = templates.find(x => x.id === editingTemplateId);
        if (t && userId) {
          upsertTemplate(userId, { ...t, fieldsConfig: currentFields, updatedAt }).catch(console.error);
        }
        addSyncLog("تم تحديث القالب بنجاح", true, "—");
        setShowCustomizer(false);
      } else {
        const saved = handleSaveColumnTemplate();
        if (saved) setShowCustomizer(false);
      }
    } else {
      // "Save only in this sheet" — persist fieldsConfig to localStorage
      localStorage.setItem("billflow_fields_config", JSON.stringify(currentFields));
      if (activeConnectedSheet) {
        const nextSheet = { ...activeConnectedSheet, fieldsConfig: currentFields };
        setConnectedSheets(prev => prev.map(s =>
          s.spreadsheetId === spreadsheetId && s.sheetName === spreadsheetSheetName
            ? nextSheet
            : s
        ));
        if (userId) upsertSheetConfig(userId, nextSheet).catch(console.error);
      } else if (spreadsheetId) {
        upsertCurrentSheetTemplate(
          spreadsheetId,
          spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          spreadsheetSheetName || "قائمة الفواتير",
          spreadsheetName || "شيت Google الحالي",
          currentFields,
          true,
          undefined // Not based on template
        );
      }
      addSyncLog("تم حفظ إعدادات الأعمدة الحالية في هذا الشيت", true, "—");
      setShowCustomizer(false);
      setActiveTab("home");
    }
  };

  const handleSaveAsNewTemplate = (templateName: string) => {
    const newTemplate = saveColumnTemplate(templateName, false);
    // Link the current sheet to this new template
    if (activeConnectedSheet) {
      const nextSheet = { ...activeConnectedSheet, basedOnTemplateId: newTemplate.id, fieldsConfig: fieldsConfig };
      setConnectedSheets(prev => prev.map(s =>
        s.spreadsheetId === spreadsheetId && s.sheetName === spreadsheetSheetName
          ? nextSheet
          : s
      ));
      if (userId) {
        upsertSheetConfig(userId, nextSheet).catch(console.error);
      }
    } else if (spreadsheetId) {
      upsertCurrentSheetTemplate(
        spreadsheetId,
        spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        spreadsheetSheetName || "قائمة الفواتير",
        spreadsheetName || "شيت Google الحالي",
        fieldsConfig,
        true,
        newTemplate.id
      );
    }
    addSyncLog(`تم حفظ القالب وربطه بهذا الشيت: ${templateName}`, true, "—");
    setShowCustomizer(false);
    setActiveTab("home");
  };

  const handleSaveSpreadsheetShortcut = (
    id: string,
    name: string,
    url: string,
    sheetName: string
  ) => {
    upsertCurrentSheetTemplate(id, url, sheetName, name, fieldsConfig, false, undefined, true);
    addSyncLog(`تمت إضافة الشيت إلى الوصول السريع: ${name}`, true, "—");
  };

  const handleSaveCurrentSpreadsheetShortcut = () => {
    if (!spreadsheetId) return;
    // Check if it's already marked as shortcut
    const existing = connectedSheets.find((template) => template.spreadsheetId === spreadsheetId && template.isShortcut);
    if (existing) return;
    handleSaveSpreadsheetShortcut(
      spreadsheetId,
      currentSpreadsheetName || "شيت Google الحالي",
      spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      spreadsheetSheetName || "قائمة الفواتير"
    );
  };

  const handleDeleteSpreadsheetShortcut = (templateId: string) => {
    const template = connectedSheets.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`إزالة "${template.name}" من الوصول السريع؟`)) return;

    setConnectedSheets((prev) => prev.filter((item) => item.id !== templateId));
    if (activeTemplateId === templateId) {
      setActiveTemplateId("");
    }
    if (userId) {
      deleteSheetConfig(userId, template.id).catch(console.error);
    }
    addSyncLog(`تم حذف الشيت من الوصول السريع: ${template.name}`, true, "—");
  };

  // Update existing Spreadsheet ID inside options
  const handleSetSpreadsheetId = (id: string) => {
    setSpreadsheetId(id);
    const customUrl = `https://docs.google.com/spreadsheets/d/${id}/edit`;
    setSpreadsheetUrl(customUrl);
    setSpreadsheetName("جدول مربوط يدوياً");
    setSpreadsheetSheetName("قائمة الفواتير");
    localStorage.setItem("billflow_spreadsheet_id", id);
    localStorage.setItem("billflow_spreadsheet_url", customUrl);
    localStorage.setItem("billflow_spreadsheet_name", "جدول مربوط يدوياً");
    localStorage.setItem("billflow_spreadsheet_sheet_name", "قائمة الفواتير");
    setActiveTemplateId("");
    if (googleUser?.id) {
      apiFetch("/api/google/select-spreadsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: googleUser.id, spreadsheetId: id })
      }).catch((err) => console.warn("Failed to persist spreadsheet selection:", err));
    }
    addSyncLog(`تم ربط معرف جدول البيانات يدويًا: ${id}`, true, "—");
  };

  const handleSelectSpreadsheet = (id: string, name: string, url: string, sheetName: string) => {
    setSpreadsheetId(id);
    setSpreadsheetUrl(url);
    setSpreadsheetName(name);
    setSpreadsheetSheetName(sheetName);
    localStorage.setItem("billflow_spreadsheet_id", id);
    localStorage.setItem("billflow_spreadsheet_url", url);
    localStorage.setItem("billflow_spreadsheet_name", name);
    localStorage.setItem("billflow_spreadsheet_sheet_name", sheetName);
    const existingTemplate = connectedSheets.find(
      (template) => template.spreadsheetId === id && template.sheetName === sheetName
    );
    if (existingTemplate) {
      setActiveTemplateId(existingTemplate.id);
      setFieldsConfig(cloneSortedFields(existingTemplate.fieldsConfig, defaultFieldsConfig));
    } else {
      setActiveTemplateId("");
      setFieldsConfig([...defaultFieldsConfig]); // Reset to default if no config is found
    }
    if (googleUser?.id) {
      apiFetch("/api/google/select-spreadsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: googleUser.id, spreadsheetId: id })
      }).catch((err) => console.warn("Failed to persist spreadsheet selection:", err));
    }
    addSyncLog(`تم تعيين شيت المزامنة بنجاح: "${name}" ورقة [${sheetName}]`, true, "—");
  };

  const handleSaveFieldTemplate = () => {
    if (spreadsheetId) {
      const defaultName = connectedSheets.find((template) => template.id === activeTemplateId)?.name || "قالب Google Sheets الحالي";
      const name = window.prompt("اسم قالب الشيت:", defaultName)?.trim();
      if (!name) return;

      upsertCurrentSheetTemplate(
        spreadsheetId,
        spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        spreadsheetSheetName || "قائمة الفواتير",
        name
      );
      addSyncLog("تم حفظ قالب أعمدة الشيت الحالي", true, "—");
    } else {
      handleSaveColumnTemplate();
    }
    setShowCustomizer(false);
    setActiveTab("home");
  };

  const handleSyncFieldTemplateColumns = async () => {
    const activeHeaders = cloneSortedFields(fieldsConfig)
      .filter((field) => field.enabled)
      .map((field) => field.label || field.id);

    if (!spreadsheetId) {
      alert("اختر أو أنشئ ملف Google Sheet أولاً قبل مزامنة الأعمدة.");
      setShowSheetSelector(true);
      return;
    }

    if (!googleUser?.id) {
      alert("لم يتم العثور على المستخدم الحالي. حدّث الصفحة ثم حاول مرة أخرى.");
      return;
    }

    try {
      setIsSyncingColumns(true);
      const template = upsertCurrentSheetTemplate(
        spreadsheetId,
        spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        spreadsheetSheetName || "قائمة الفواتير",
        connectedSheets.find((item) => item.id === activeTemplateId)?.name || "قالب Google Sheets الحالي"
      );

      const response = await apiFetch("/api/google/sync-headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: googleUser.id,
          spreadsheetId: template.spreadsheetId,
          sheetName: template.sheetName,
          headers: activeHeaders,
          googleAccessToken: await getCurrentGoogleAccessToken() || undefined
        })
      });
      const result = await readJsonResponse(response);

      if (response.status === 401) {
        await handleExpiredGoogleSession();
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error([result.error, result.details].filter(Boolean).join(": ") || "فشل مزامنة الأعمدة");
      }

      addSyncLog(`تمت مزامنة ${activeHeaders.length} أعمدة مع Google Sheets`, true, "—");
      alert("تم حفظ القالب ومزامنة أعمدة Google Sheets بنجاح.");
      setShowCustomizer(false);
      setActiveTab("home");
    } catch (err: any) {
      console.error(err);
      addSyncLog("فشل مزامنة أعمدة Google Sheets", false, "—");
      alert(`حدث خطأ أثناء مزامنة الأعمدة: ${err.message || err}`);
    } finally {
      setIsSyncingColumns(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = connectedSheets.find((item) => item.id === templateId);
    if (!template) return;

    setActiveTemplateId(template.id);
    setSpreadsheetId(template.spreadsheetId);
    setSpreadsheetUrl(template.spreadsheetUrl);
    setSpreadsheetName(template.name);
    setSpreadsheetSheetName(template.sheetName);
    setFieldsConfig(cloneSortedFields(template.fieldsConfig, defaultFieldsConfig));
    localStorage.setItem("billflow_spreadsheet_id", template.spreadsheetId);
    localStorage.setItem("billflow_spreadsheet_url", template.spreadsheetUrl);
    localStorage.setItem("billflow_spreadsheet_name", template.name);
    localStorage.setItem("billflow_spreadsheet_sheet_name", template.sheetName);
    addSyncLog(`تم الرجوع إلى قالب الشيت: ${template.name}`, true, "—");
  };

  const invoiceMatchesSyncTarget = (
    invoice: Invoice,
    target?: { spreadsheetId: string; sheetName: string; templateId?: string }
  ) => {
    if (!target) return true;
    return (
      invoice.syncTarget?.spreadsheetId === target.spreadsheetId &&
      invoice.syncTarget?.sheetName === target.sheetName &&
      (!target.templateId || invoice.syncTarget?.templateId === target.templateId)
    );
  };

  // Sync all pending/failed "pending" status invoices
  const handleSyncPendingInvoices = async (
    target?: { spreadsheetId: string; sheetName: string; templateId?: string }
  ) => {
    if (!navigator.onLine) {
      alert("الرجاء التأكد من اتصالك بالإنترنت لمحاولة المزامنة.");
      return;
    }

    const pendingList = invoices.filter((i) => i.status === "pending" && invoiceMatchesSyncTarget(i, target));
    if (pendingList.length === 0) {
      alert(target ? "لا توجد فواتير غير محفوظة لهذا الشيت." : "كل الفواتير محفوظة في الشيتات.");
      return;
    }

    setIsSyncing(true);
    let syncedCount = 0;

    try {
      let targetSpreadsheetId = spreadsheetId;

      if (googleUser?.id) {
        const integration = await fetchGoogleIntegrationStatus(googleUser.id);
        if (integration.connected) {
          setGoogleToken((prev) => prev || "connected");
        }
        if (integration.spreadsheetId) {
          targetSpreadsheetId = integration.spreadsheetId;
          setSpreadsheetId(integration.spreadsheetId);
          setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}/edit`);
          localStorage.setItem("billflow_spreadsheet_id", integration.spreadsheetId);
          localStorage.setItem("billflow_spreadsheet_url", `https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}/edit`);
        }
      }

      // 1. First sync to Supabase
      if (googleUser?.id) {
        for (const inv of pendingList) {
          try {
            await saveInvoiceToSupabase(inv);
          } catch (e) {
            console.error("Failed to sync to Supabase", e);
          }
        }
      }

      // 2. Then sync each invoice only to the sheet/template assigned at save time.
      const syncableList = pendingList.filter((invoice) => invoice.syncTarget?.spreadsheetId);
      const skippedCount = pendingList.length - syncableList.length;

      if (googleUser?.id && syncableList.length > 0) {
        const groups = new Map<string, Invoice[]>();
        syncableList.forEach((invoice) => {
          const target = invoice.syncTarget!;
          const key = `${target.spreadsheetId}::${target.sheetName}::${target.templateId}`;
          groups.set(key, [...(groups.get(key) || []), invoice]);
        });

        const syncedIds = new Set<string>();
        for (const groupInvoices of groups.values()) {
          const target = groupInvoices[0].syncTarget!;
          const response = await apiFetch("/api/sync-invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: googleUser.id,
              invoices: groupInvoices,
              fieldsConfig: target.fieldsConfig,
              activeSheet: target.sheetName,
              spreadsheetId: target.spreadsheetId,
              googleAccessToken: await getCurrentGoogleAccessToken() || undefined
            })
          });

          const result = await readJsonResponse(response);

          if (response.status === 401) {
            await handleExpiredGoogleSession();
            return;
          }

          if (!response.ok || !result.success) {
            throw new Error([result.error, result.details].filter(Boolean).join(": ") || "فشل المزامنة مع Google Sheets");
          }

          groupInvoices.forEach((invoice) => syncedIds.add(invoice.id));
          syncedCount += groupInvoices.length;
        }

        const updatedList = syncableList
          .filter((invoice) => syncedIds.has(invoice.id))
          .map((invoice) => ({ ...invoice, status: "synced" as const }));
        for (const inv of updatedList) {
          await saveInvoiceToSupabase(inv).catch(() => null);
        }
        setInvoices((prev) =>
          prev.map((inv) => syncedIds.has(inv.id) ? { ...inv, status: "synced" } : inv)
        );
        addSyncLog(`تمت مزامنة ${syncedCount} فواتير حسب قوالبها الأصلية`, true, `${(syncedCount * 0.25).toFixed(2)} كب`);
        alert(
          skippedCount > 0
            ? `تم مزامنة ${syncedCount} فواتير. بقيت ${skippedCount} فواتير قديمة بدون شيت محدد ولن تُرسل للشيت الحالي.`
            : `تم مزامنة ${syncedCount} فواتير بنجاح!`
        );
      } else {
        alert("تم رفع الفواتير لسحابة التطبيق. لا توجد فواتير مرتبطة بقالب Google Sheets محدد للمزامنة.");
      }
    } catch (err: any) {
      console.error(err);
      addSyncLog(`فشل المزامنة: يرجى التحقق من الاتصال`, false, "—");
      alert(`حدث خطأ أثناء المزامنة: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Triggered manually from header sync button
  const handleGlobalSyncTrigger = async () => {
    if (!googleUser?.id) {
      alert("لم يتم العثور على هوية المستخدم. يرجى تحديث الصفحة ثم المحاولة مرة أخرى.");
      return;
    }

    const integration = await fetchGoogleIntegrationStatus(googleUser.id).catch((err) => {
      console.warn("Failed to check Google integration before sync:", err);
      return null;
    });

    const hasDirectGoogleToken = Boolean(googleToken && googleToken !== "connected");

    if (!integration?.connected && !hasDirectGoogleToken) {
      alert("يرجى ربط حساب Google Sheets أولاً في صفحة الإعدادات لتتمكن من المزامنة التلقائية.");
      setActiveTab("settings");
      return;
    }

    if (integration?.connected) {
      setGoogleToken((prev) => prev || "connected");
    }
    if (integration?.spreadsheetId) {
      setSpreadsheetId(integration.spreadsheetId);
      setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}/edit`);
      localStorage.setItem("billflow_spreadsheet_id", integration.spreadsheetId);
      localStorage.setItem("billflow_spreadsheet_url", `https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}/edit`);
    }

    if (!integration?.spreadsheetId && !spreadsheetId) {
      setShowSheetSelector(true);
      return;
    }
    await handleSyncPendingInvoices();
  };

  const ensureSheetReadyForScan = () => {
    if (!navigator.onLine) {
      alert("السكانر يحتاج اتصال إنترنت حتى يقرأ الفاتورة ويزامنها مباشرة مع الشيت.");
      return false;
    }

    if (!googleUser?.id || !spreadsheetId || !spreadsheetSheetName) {
      alert("قبل تشغيل السكانر يجب ربط أو اختيار Google Sheet أولاً.");
      setActiveTab("settings");
      setShowSheetSelector(true);
      return false;
    }

    return true;
  };

  const handleStartScanner = () => {
    if (!ensureSheetReadyForScan()) return;
    setShowScanner(true);
  };

  // Process a direct file image uploaded from local device without camera sensor
  const handleScanDirectImage = async (base64Image: string) => {
    if (!ensureSheetReadyForScan()) return;

    try {
      setIsDirectScanning(true);
      setDirectScanText("جاري استلام الصورة وبدء التحليل...");

      const messages = [
        "جاري قراءة الفاتورة...",
        "جاري تحليل الحسابات والضرائب...",
        "نقوم باستخراج البيانات بذكاء وفحص الأعمدة وبنيتها..."
      ];
      let msgIndex = 0;
      const interval = setInterval(() => {
        if (msgIndex < messages.length) {
          setDirectScanText(messages[msgIndex]);
          msgIndex++;
        }
      }, 900);

      const response = await apiFetch("/api/scan-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Image, fieldsConfig, userId: googleUser?.id })
      });

      clearInterval(interval);
      const data = await readJsonResponse(response);

      if (response.ok && data) {
        handleScanComplete(data, base64Image);
      } else {
        throw new Error(data.error || "فشل مسح الفاتورة الذكي");
      }
    } catch (err: any) {
      console.error("Direct picture scan failed:", err);
      alert(err?.message || "فشل قراءة الملف؛ يرجى المحاولة بصورة أخرى أو ملف أوضح.");
    } finally {
      setIsDirectScanning(false);
    }
  };

  // Launch scan state Complete handler
  const handleScanComplete = (result: any, imageUrl: string) => {
    setScannedData(result);
    setScannedImageUrl(imageUrl);
    setShowScanner(false);
    setShowReview(true);
  };

  // Saving reviewed invoice
  // Under offline-first: we try to append directly to Google Sheets.
  // If we can write, we save with status 'synced'.
  // If we don't have a spreadsheet, are not connected, or the request fails, we save as 'pending' (pending sync).
  const handleSaveInvoice = async (newInvoice: Invoice) => {
    const syncTarget = buildCurrentSyncTarget();
    let activeInvoice: Invoice = {
      ...newInvoice,
      status: "pending" as const,
      syncTarget
    };

    // 1. Try to save to Supabase if online
    if (navigator.onLine && googleUser?.id) {
      try {
        await saveInvoiceToSupabase(activeInvoice);
      } catch (err) {
        console.warn("Could not save to Supabase", err);
      }
    }

    // 2. Try to sync to Google Sheets if connected
    if (googleUser?.id && navigator.onLine && syncTarget) {
      try {
        let targetSpreadsheetId = syncTarget.spreadsheetId;
        const integration = await fetchGoogleIntegrationStatus(googleUser.id);
        if (!integration.connected) {
          throw new Error("حساب Google Sheets غير مربوط بعد");
        }
        if (integration.spreadsheetId) {
          setGoogleToken((prev) => prev || "connected");
          setSpreadsheetId(integration.spreadsheetId);
          setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}/edit`);
        }
        if (!targetSpreadsheetId) {
          throw new Error("لا يوجد ملف Google Sheets محدد للمزامنة");
        }

        const activeSheet = syncTarget.sheetName;
        const response = await apiFetch("/api/sync-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: googleUser.id,
            invoices: [activeInvoice],
            fieldsConfig: syncTarget.fieldsConfig,
            activeSheet,
            spreadsheetId: targetSpreadsheetId,
            googleAccessToken: await getCurrentGoogleAccessToken() || undefined
          })
        });

        const result = await readJsonResponse(response);

        if (response.status === 401) {
          await handleExpiredGoogleSession();
          return;
        }

        if (response.ok && result.success !== false) {
          activeInvoice.status = "synced";
          await saveInvoiceToSupabase(activeInvoice).catch(() => null);
          addSyncLog(`مزامنة تلقائية ناجحة: ${newInvoice.storeName}`, true, "0.2 كب");
        } else {
          throw new Error(result.error || "فشل الرد من الخادم");
        }
      } catch (sheetsError: any) {
        if (isUnauthorizedError(sheetsError)) {
          await handleExpiredGoogleSession();
          return;
        }
        console.warn("Unable to sync immediately, saving locally as pending:", sheetsError);
        addSyncLog(`تعذر حفظ الفاتورة في الشيت: ${newInvoice.storeName}`, false, "—");
      }
    } else {
      addSyncLog(`تعذر حفظ الفاتورة في الشيت: ${newInvoice.storeName}`, false, "—");
    }

    setInvoices((prev) => sortInvoicesDesc([activeInvoice, ...prev]));
    setShowReview(false);
    setScannedData(null);
    setScannedImageUrl("");
    setActiveTab("home");
  };

  const handleClearSyncLogs = () => {
    setSyncLogs([]);
  };

  // Show InitialSetup for new users who have no existing data
  // This page helps new users set up their first Google Sheet connection
  if (legalPage) {
    return <LegalPage page={legalPage} onBack={() => setLegalPage(null)} />;
  }

  if (isLoggedIn && isNewUser && !spreadsheetId && connectedSheets.length === 0) {
    return (
      <InitialSetup
        googleToken={googleToken}
        onConnectGoogle={handleConnectGoogle}
        onCreateNewSheet={handleCreateNewSheet}
        onSetSpreadsheetId={handleSetSpreadsheetId}
        isCreatingSheet={isCreatingSheet}
        onComplete={() => setIsNewUser(false)}
        userName={userName}
      />
    );
  }

  // Show splash screen while verifying authentication session
  if (isAuthInitializing && !isLoggedIn) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f4f7fa] dark:bg-slate-950">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <AppLogo size="lg" className="animate-pulse" />
          {/* Loading spinner */}
          <div className="w-12 h-12 rounded-full border-4 border-[#0052ff]/20 border-t-[#0052ff] animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} onOpenLegal={setLegalPage} />;
  }

  return (
    <div className={`min-h-screen pb-32 flex flex-col justify-between ${darkMode ? "bg-slate-950 text-slate-100" : "bg-[#F4F7FA] text-[#191c1e]"
      }`}>
      {/* Top Header Appbar */}
      <header className="sticky top-0 left-0 w-full z-30 flex justify-between items-center px-6 h-16 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border-b border-neutral-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center overflow-hidden">
            {googleUser?.photoURL ? (
              <img
                alt="Profile avatar"
                className="w-full h-full object-cover"
                src={googleUser.photoURL}
                referrerPolicy="no-referrer"
              />
            ) : (
              <img
                alt="Standard Ahmed Profile"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbFXKMq7XpsnH6odnKh3vGuxwsN1COmWHDPcHHnxbNrsu9h57cEu-3UR1HAzz9e1uM3RgQY2pmlZW6LsnA3_1a1q1RsQ3uRbAnIyshpXN5YDFx7kvcW4m0kvWVJenrYAh5HDr305rXo3uhyoSZ4hzS73iNDKxw-f61mQ07ZRt2LLynpwP3WCqQmE05jIIJYGDNCMeL5eaWVCUaNnbfVkDpmqx7xpEQsn5U7T8GF4dQP274Xweqm30LEsg7bIA_9-sHpRv1gT1nNh4"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          <AppLogo size="sm" />
          <span className="text-lg font-extrabold text-[#0052ff] dark:text-[#adc6ff] tracking-tight">
            smart scan
          </span>
          {(() => {
            const linkedTemplateId = activeConnectedSheet?.basedOnTemplateId || activeTemplateId;
            const linkedTemplate = linkedTemplateId
              ? templates.find(t => t.id === linkedTemplateId)
              : null;
            if (!linkedTemplate) return null;
            return (
              <span
                title={`هذا الشيت مبني على قالب: ${linkedTemplate.name}`}
                className="hidden sm:flex text-[10px] font-bold px-2.5 py-1 bg-[#d0e1fb]/70 dark:bg-blue-950/60 text-[#0052ff] dark:text-[#adc6ff] rounded-lg items-center gap-1.5 border border-blue-200 dark:border-blue-800 select-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <span>القالب: {linkedTemplate.name}</span>
              </span>
            );
          })()}
        </div>
      </header>

      {/* Main Container routes panels switch content */}
      <div className="flex-grow">
        {showCustomizer ? (
          <FieldCustomizer
            fields={fieldsConfig}
            setFields={setFieldsConfig}
            onSave={handleSaveFieldSettings}
            onUpdateTemplate={handleUpdateTemplateFromSheet}
            onSaveAsNewTemplate={handleSaveAsNewTemplate}
            mode={isSettingUpNewSheetColumns ? "newSheet" : (activeTab === "templates" ? "editTemplate" : "normal")}
            isBasedOnTemplate={!!activeConnectedSheet?.basedOnTemplateId && templates.some(t => t.id === activeConnectedSheet.basedOnTemplateId)}
            onCreateSheet={handleCreateSheetFromCustomizer}
            initialSheetTitle={pendingNewSheetTitle}
            onSyncColumns={handleSyncFieldTemplateColumns}
            onCancel={() => {
              setShowCustomizer(false);
              setIsSettingUpNewSheetColumns(false);
              setPendingNewSheetTitle("");
            }}
            isSyncingColumns={isSyncingColumns}
            isCreatingSheet={isCreatingSheet}
          />
        ) : showReview ? (
          <InvoiceReview
            initialData={scannedData}
            imageSrc={scannedImageUrl}
            onSave={handleSaveInvoice}
            onCancel={() => {
              setShowReview(false);
              setScannedData(null);
            }}
            onRescan={() => {
              setShowReview(false);
              handleStartScanner();
            }}
            fieldsConfig={fieldsConfig}
            onSaveTemplate={(name) => saveColumnTemplate(name)}
          />
        ) : (
          <>
            {activeTab === "home" && (
              <Dashboard
                invoices={invoices}
                onTriggerScan={handleStartScanner}
                onNavigateToHistory={() => setActiveTab("history")}
                onNavigateToAnalytics={() => setActiveTab("analytics")}
                onScanDirectImage={handleScanDirectImage}
                onOpenLegal={setLegalPage}
              />
            )}
            {activeTab === "analytics" && (
              <Analytics
                invoices={invoices}
                onNavigateToHome={() => setActiveTab("home")}
              />
            )}
            {activeTab === "history" && (
              <InvoiceHistory
                invoices={invoices}
                fieldsConfig={fieldsConfig}
                onNavigateToCustomizer={() => setShowCustomizer(true)}
              />
            )}
            {activeTab === "templates" && (
              <TemplatesPage
                templates={templates}
                onCreateTemplate={() => {
                  setEditingTemplateId(null);
                  setFieldsConfig([...defaultFieldsConfig]); // Reset to default when creating
                  setShowCustomizer(true);
                }}
                onEditTemplate={(id) => {
                  setEditingTemplateId(id);
                  const t = templates.find((x) => x.id === id);
                  if (t) {
                    setFieldsConfig(cloneSortedFields(t.fieldsConfig, defaultFieldsConfig));
                    setShowCustomizer(true);
                  }
                }}
                onDeleteTemplate={(id) => {
                  setTemplates(prev => prev.filter(t => t.id !== id));
                }}
              />
            )}
            {activeTab === "settings" && (
              <Settings
                onLogout={handleLogout}
                onNavigateToCustomizer={() => setShowCustomizer(true)}
                darkMode={darkMode}
                setDarkMode={setDarkMode}

                // Google OAuth & Sheets Integration Props
                googleUser={googleUser}
                googleToken={googleToken}
                onConnectGoogle={handleConnectGoogle}
                onDisconnectGoogle={handleDisconnectGoogle}
                spreadsheetId={spreadsheetId}
                spreadsheetUrl={spreadsheetUrl}
                spreadsheetName={currentSpreadsheetName}
                onSetSpreadsheetId={handleSetSpreadsheetId}
                onCreateNewSheet={handleCreateNewSheet}
                isCreatingSheet={isCreatingSheet}
                syncLogs={syncLogs}
                onClearSyncLogs={handleClearSyncLogs}
                onOpenSheetSelector={() => setShowSheetSelector(true)}
                connectedSheets={connectedSheets}
                activeTemplateId={activeTemplateId}
                onSelectTemplate={handleSelectTemplate}
                onDeleteTemplate={handleDeleteSpreadsheetShortcut}
                onSaveCurrentShortcut={handleSaveCurrentSpreadsheetShortcut}
              />
            )}
          </>
        )}
      </div>

      {/* Floating Glassmorphism Bottom navigation links bar */}
      {!showScanner && !showReview && (
        <nav className="fixed bottom-4 left-4 right-4 z-40 flex justify-around items-center h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-neutral-100 dark:border-slate-800 rounded-full shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("home");
            }}
            className={`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer ${activeTab === "home" && !showCustomizer
              ? "text-[#0052ff] scale-105"
              : "text-neutral-400 hover:text-neutral-600"
              }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">الرئيسية</span>
          </button>

          <button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("analytics");
            }}
            className={`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer ${activeTab === "analytics" && !showCustomizer
              ? "text-[#0052ff] scale-105"
              : "text-neutral-400 hover:text-neutral-600"
              }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">التحليلات</span>
          </button>

          <button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("history");
            }}
            className={`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer ${activeTab === "history" || showCustomizer
              ? "text-[#0052ff] scale-105"
              : "text-neutral-400 hover:text-neutral-600"
              }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">السجل</span>
          </button>

          <button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("templates");
            }}
            className={`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer ${activeTab === "templates" && !showCustomizer
              ? "text-[#0052ff] scale-105"
              : "text-neutral-400 hover:text-neutral-600"
              }`}
          >
            <BookTemplate className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">القوالب</span>
          </button>

          <button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("settings");
            }}
            className={`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer ${activeTab === "settings" && !showCustomizer
              ? "text-[#0052ff] scale-105"
              : "text-neutral-400 hover:text-neutral-600"
              }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">الإعدادات</span>
          </button>
        </nav>
      )}

      {/* Overlay cameras viewfinder container scanner components */}
      {showScanner && (
        <ScannerContainer
          onClose={() => setShowScanner(false)}
          onScanComplete={handleScanComplete}
          fieldsConfig={fieldsConfig}
          userId={googleUser?.id}
        />
      )}

      {/* Direct local image scanning progress loader overlay */}
      {isDirectScanning && (
        <div className="fixed inset-0 bg-[#031427]/95 backdrop-blur-xl z-[150] flex flex-col items-center justify-center text-center p-6">
          <div className="relative w-28 h-28 mb-6">
            <div className="w-full h-full rounded-full border-4 border-[#0052ff]/10 border-t-[#0052ff] animate-spin flex items-center justify-center" />
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-[#0052ff] animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">جاري قراءة وتحليل صورة الفاتورة...</h3>
          <p className="text-neutral-400 text-sm">{directScanText}</p>
        </div>
      )}

      {showSheetSelector && (
        <SpreadsheetSelector
          googleToken={googleToken}
          currentSelectedId={spreadsheetId}
          onClose={() => setShowSheetSelector(false)}
          onSelectSpreadsheet={handleSelectSpreadsheet}
          onCreateNewSheet={handleCreateNewSheet}
          onStartNewColumnSetup={handleStartNewSheetColumnSetup}
          onSaveSpreadsheetShortcut={handleSaveSpreadsheetShortcut}
          isCreatingSheet={isCreatingSheet}
          activeHeaders={getFieldsSnapshotForNewSheet().filter((f) => f.enabled).map((f) => f.label)}
          connectedSheets={connectedSheets}
          templates={templates}
          onDisconnectGoogle={handleDisconnectGoogle}
          onConnectGoogle={handleConnectGoogle}
        />
      )}
    </div>
  );
}
export { };
