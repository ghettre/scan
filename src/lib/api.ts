import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabaseAuth";
import {
  createGoogleSpreadsheet,
  ensureSheetInitialized,
  appendRowToSpreadsheet,
  mapInvoiceToRow,
  syncGoogleSheetHeaders
} from "./googleSheets";

// Helper to create a mock Response object for intercepting REST API calls
const createMockResponse = (data: any, status = 200, statusText = "OK") => {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" }
  });
};

const normalizeFieldText = (field: any) =>
  `${field?.id || ""} ${field?.label || ""}`.toLowerCase();

const isNumericInvoiceField = (field: any) => {
  const text = normalizeFieldText(field);
  return [
    "amount", "total", "tax", "vat", "tva", "taux", "ttc", "ht",
    "montant", "prix", "subtotal", "rate", "percentage", "percent",
    "مبلغ", "إجمالي", "اجمالي", "ضريبة", "نسبة", "المجموع", "السعر"
  ].some((keyword) => text.includes(keyword));
};

const customFieldDescription = (field: any) => {
  const text = normalizeFieldText(field);
  const label = field?.label || field?.id;

  if (/\b(taux|rate|percentage|percent)\b/.test(text) || text.includes("نسبة")) {
    return `Extract only the tax/VAT percentage rate requested by the user column "${label}". Return the numeric rate only, for example 20 for 20%. Do not return the VAT cash amount unless this exact column asks for an amount.`;
  }
  if (/\bttc\b/.test(text) || text.includes("شامل")) {
    return `Extract the TTC / total amount including tax for the user column "${label}". Return only the numeric amount.`;
  }
  if (/\bht\b/.test(text) || text.includes("قبل الضريبة") || text.includes("بدون ضريبة")) {
    return `Extract the HT / subtotal before tax for the user column "${label}". Return only the numeric amount.`;
  }
  if (/\b(tva|vat)\b/.test(text) || text.includes("ضريبة")) {
    return `Extract the exact VAT/tax value requested by the user column "${label}". If the column asks for a rate/taux, return the rate only. If it asks for an amount/montant, return the cash amount only.`;
  }

  return `Extract the value for this user-defined invoice column: "${label}". Search the invoice text, header, footer, totals section, QR/tax block, and line metadata. If it does not appear or cannot be confidently inferred, return an empty string.`;
};

const mockCustomFieldValue = (field: any, totalAmount = 120, taxAmount = 18) => {
  const text = normalizeFieldText(field);
  if (/\b(taux|rate|percentage|percent)\b/.test(text) || text.includes("نسبة")) return 15;
  if (/\bttc\b/.test(text) || text.includes("شامل")) return totalAmount;
  if (/\bht\b/.test(text) || text.includes("قبل الضريبة") || text.includes("بدون ضريبة")) {
    return parseFloat((totalAmount - taxAmount).toFixed(2));
  }
  if (/\b(tva|vat)\b/.test(text) || text.includes("ضريبة")) return taxAmount;
  if (isNumericInvoiceField(field)) return totalAmount;
  return `قيمة افتراضية لـ ${field.label}`;
};

export const apiUrl = (path: string) => {
  return path;
};

// Client-side implementation of receipt scanning using Gemini direct REST calls
export const scanInvoiceClientSide = async (
  imageData: string,
  fieldsConfig?: any[]
) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || "";
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // Fallback simulation if no API key is specified
    const names = ["العثيم", "أسواق التميمي", "مكتبة جرير", "ساكو", "بارنيز كافيه"];
    const categories = ["البقالة والمواد الغذائية", "البقالة والمواد الغذائية", "أخرى", "أخرى", "المطاعم والكافيهات"];
    const randomIndex = Math.floor(Math.random() * names.length);
    const randAmount = parseFloat((Math.random() * 200 + 45).toFixed(2));
    const randTax = parseFloat((randAmount * 0.15).toFixed(2));
    const todayStr = new Date().toISOString().split("T")[0];

    const result: any = {
      storeName: names[randomIndex],
      totalAmount: randAmount,
      taxAmount: randTax,
      date: todayStr,
      category: categories[randomIndex]
    };

    if (fieldsConfig && Array.isArray(fieldsConfig)) {
      fieldsConfig.forEach((field: any) => {
        if (field.enabled && !["store_name", "total_amount", "date", "category", "tax_amount"].includes(field.id)) {
          result[field.id] = mockCustomFieldValue(field, randAmount, randTax);
        }
      });
    }
    return result;
  }

  // Extract base64 details
  const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
  let mimeType = "image/jpeg";
  let base64Data = imageData;

  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const enabledScanFields = Array.isArray(fieldsConfig)
    ? fieldsConfig.filter((field: any) => field.enabled)
    : [
      { id: "store_name", label: "اسم المتجر" },
      { id: "total_amount", label: "المبلغ الإجمالي" },
      { id: "date", label: "تاريخ الفاتورة" },
      { id: "category", label: "التصنيف" },
      { id: "tax_amount", label: "مبلغ الضريبة" }
    ];
  const enabledScanIds = new Set(enabledScanFields.map((field: any) => field.id));
  const properties: Record<string, any> = {};
  const requiredFields: string[] = [];
  const addSchemaField = (key: string, schema: any) => {
    properties[key] = schema;
    requiredFields.push(key);
  };

  if (enabledScanIds.has("store_name")) {
    addSchemaField("storeName", {
      type: "STRING",
      description: "Name of the store / company / vendor. Retrieve this accurately from the invoice header, logo, or seller information in any language. Keep the clean name as it appears."
    });
  }

  if (enabledScanIds.has("total_amount")) {
    addSchemaField("totalAmount", { type: "NUMBER", description: "Total invoice amount as a float number." });
  }

  if (enabledScanIds.has("tax_amount")) {
    addSchemaField("taxAmount", { type: "NUMBER", description: "Calculated or stated VAT/tax absolute currency amount. If not stated, return 0." });
  }

  if (enabledScanIds.has("date")) {
    addSchemaField("date", { type: "STRING", description: "Invoice date as string, matching formatting YYYY-MM-DD. If year is missing or unclear, assume 2026." });
  }

  if (enabledScanIds.has("category")) {
    addSchemaField("category", { type: "STRING", description: "Must be exactly one of: 'البقالة والمواد الغذائية', 'المطاعم والكافيهات', 'النقل والمواصلات', 'ترفيه', 'إلكترونيات', 'أخرى'." });
  }

  enabledScanFields.forEach((field: any) => {
    const sysIds = ["store_name", "total_amount", "date", "category", "tax_amount"];
    if (!sysIds.includes(field.id)) {
      addSchemaField(field.id, {
        type: isNumericInvoiceField(field) ? "NUMBER" : "STRING",
        description: customFieldDescription(field)
      });
    }
  });

  if (requiredFields.length === 0) {
    addSchemaField("storeName", {
      type: "STRING",
      description: "Name of the store / company / vendor."
    });
  }

  const promptText = "قم بتحليل هذه الفاتورة المرفقة واستخراج المكونات بدقة وموثوقية فائقة ككائن JSON متوافق مع المخطط المحدد.\n" +
    "تنبيهات الاستجابة الهامة:\n" +
    "1. يمكن أن تكون الفاتورة بأي لغة (عربية، إنكليزية، فرنسية، إلخ). ابحث عن اسم الشركة أو المحل بأي لغة كان، واجلبه بتسميتة الصحيحة والنظيفة دون تلفيق.\n" +
    "2. استخرج فقط الحقول الموجودة في المخطط. لا تضف taxType أو taxValue أو أي حقل ضريبي غير مطلوب من إعدادات الأعمدة.\n" +
    "3. إذا اختار المستخدم عمود taux / نسبة TVA فأرجع النسبة فقط. إذا اختار montant TVA / مبلغ الضريبة فأرجع المبلغ فقط. إذا اختار TTC أو HT فأرجع القيمة المطابقة فقط.\n" +
    "4. إذا وجد أي حقل مخصص قمت بمطالبته في المخطط (Schema) فافحصه جيداً بالصورة وعبر السطور لمحاولة ملئه بذكاء.";

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties,
        required: requiredFields
      }
    }
  };

  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`فشل استدعاء Gemini API: ${errorText}`);
  }

  const resJson = await response.json();
  const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("لم يتم استرجاع أي استجابة من الذكاء الاصطناعي.");
  }

  return JSON.parse(text.trim());
};

// Main API Fetch Interceptor
export const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const cleanPath = path.replace(/^\/api/, "/api");

  // 1. Scan Invoice
  if (cleanPath.startsWith("/api/scan-invoice")) {
    try {
      const body = JSON.parse(init?.body as string || "{}");
      const { imageData, sampleId, fieldsConfig } = body;

      if (sampleId) {
        let preset: any = {};
        if (sampleId === "panda") {
          preset = {
            storeName: "هايبر ماركت بنده",
            totalAmount: 450.50,
            taxAmount: 67.58,
            date: "2023-10-24",
            category: "البقالة والمواد الغذائية"
          };
        } else if (sampleId === "petromin") {
          preset = {
            storeName: "محطة بترومين",
            totalAmount: 120.00,
            taxAmount: 15.65,
            date: "2024-05-23",
            category: "النقل والمواصلات"
          };
        } else if (sampleId === "nozomi") {
          preset = {
            storeName: "مطعم نوزومي",
            totalAmount: 890.50,
            taxAmount: 116.15,
            date: "2024-05-22",
            category: "المطاعم والكافيهات"
          };
        }
        if (fieldsConfig && Array.isArray(fieldsConfig)) {
          fieldsConfig.forEach((field: any) => {
            if (field.enabled && !["store_name", "total_amount", "date", "category", "tax_amount"].includes(field.id)) {
              preset[field.id] = mockCustomFieldValue(field, preset.totalAmount, preset.taxAmount);
            }
          });
        }
        return createMockResponse(preset);
      }

      const result = await scanInvoiceClientSide(imageData, fieldsConfig);
      return createMockResponse(result);
    } catch (err: any) {
      return createMockResponse({
        error: "فشل استخراج البيانات من الفاتورة الرقمية.",
        details: err?.message || "Internal Error"
      }, 500);
    }
  }

  // 2. Google Integration status
  if (cleanPath.startsWith("/api/google/integration")) {
    try {
      const url = new URL(path, "http://localhost");
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return createMockResponse({ error: "Missing userId" }, 400);
      }

      const { data: integration, error } = await supabase
        .from("user_integrations")
        .select("google_access_token, google_refresh_token, spreadsheet_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        return createMockResponse({ error: "Failed to load Google integration", details: error.message }, 500);
      }

      return createMockResponse({
        connected: Boolean(integration?.google_refresh_token),
        hasAccessToken: Boolean(integration?.google_access_token),
        spreadsheetId: integration?.spreadsheet_id || "",
      });
    } catch (err: any) {
      return createMockResponse({ error: "Failed to load Google integration", details: err.message }, 500);
    }
  }

  // 3. Disconnect Google
  if (cleanPath.startsWith("/api/google/disconnect")) {
    try {
      const body = JSON.parse(init?.body as string || "{}");
      const { userId } = body;
      if (!userId) {
        return createMockResponse({ error: "Missing userId" }, 400);
      }

      const { error } = await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", userId);

      if (error) {
        return createMockResponse({ error: "Failed to disconnect Google account", details: error.message }, 500);
      }

      return createMockResponse({ success: true });
    } catch (err: any) {
      return createMockResponse({ error: "Failed to disconnect Google account", details: err.message }, 500);
    }
  }

  // 4. Select Spreadsheet
  if (cleanPath.startsWith("/api/google/select-spreadsheet")) {
    try {
      const body = JSON.parse(init?.body as string || "{}");
      const { userId, spreadsheetId } = body;
      if (!userId || !spreadsheetId) {
        return createMockResponse({ error: "Missing userId or spreadsheetId" }, 400);
      }

      const { error } = await supabase
        .from("user_integrations")
        .update({
          spreadsheet_id: spreadsheetId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        return createMockResponse({ error: "Failed to save selected spreadsheet", details: error.message }, 500);
      }

      return createMockResponse({ success: true });
    } catch (err: any) {
      return createMockResponse({ error: "Failed to save selected spreadsheet", details: err.message }, 500);
    }
  }

  // 5. Create Spreadsheet
  if (cleanPath.startsWith("/api/google/create-spreadsheet")) {
    try {
      const body = JSON.parse(init?.body as string || "{}");
      const { userId, title, headers, googleAccessToken } = body;
      if (!userId || !title) {
        return createMockResponse({ error: "Missing userId or title" }, 400);
      }

      const { data: integration, error: integrationError } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const accessToken = googleAccessToken || integration?.google_access_token;
      if (integrationError || !accessToken) {
        return createMockResponse({ error: "No Google Sheets integration found." }, 401);
      }

      const sheet = await createGoogleSpreadsheet(accessToken, title, headers || []);

      await supabase
        .from("user_integrations")
        .update({
          spreadsheet_id: sheet.id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return createMockResponse({ id: sheet.id, url: sheet.url });
    } catch (err: any) {
      return createMockResponse({ error: "فشل إنشاء جدول Google Sheets", details: err.message }, err?.status || 500);
    }
  }

  // 6. Sync Headers
  if (cleanPath.startsWith("/api/google/sync-headers")) {
    try {
      const body = JSON.parse(init?.body as string || "{}");
      const { userId, spreadsheetId, sheetName, headers, googleAccessToken } = body;
      if (!userId || !spreadsheetId || !sheetName || !Array.isArray(headers)) {
        return createMockResponse({ error: "Missing required fields" }, 400);
      }

      const { data: integration, error: integrationError } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const accessToken = googleAccessToken || integration?.google_access_token;
      if (integrationError || !accessToken) {
        return createMockResponse({ error: "No Google Sheets integration found." }, 401);
      }

      const resolvedSheetName = await ensureSheetInitialized(accessToken, spreadsheetId, headers);
      await syncGoogleSheetHeaders(accessToken, spreadsheetId, resolvedSheetName, headers);
      return createMockResponse({ success: true, syncedHeaderCount: headers.length });
    } catch (err: any) {
      return createMockResponse({ error: "فشل مزامنة أعمدة Google Sheets", details: err.message }, err?.status || 500);
    }
  }

  // 7. Sync Invoices
  if (cleanPath.startsWith("/api/sync-invoices")) {
    try {
      const body = JSON.parse(init?.body as string || "{}");
      const { userId, invoices, fieldsConfig, activeSheet, spreadsheetId, googleAccessToken } = body;
      if (!userId || !invoices || !Array.isArray(invoices)) {
        return createMockResponse({ error: "Missing required fields" }, 400);
      }

      const { data: integration, error: integrationError } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const accessToken = googleAccessToken || integration?.google_access_token;
      if (integrationError || !accessToken) {
        return createMockResponse({ error: "No Google Sheets integration found." }, 401);
      }

      const targetSpreadsheetId = spreadsheetId || integration.spreadsheet_id;
      if (!targetSpreadsheetId) {
        return createMockResponse({ error: "No spreadsheet selected" }, 400);
      }

      const activeFields = (fieldsConfig || [])
        .filter((field: any) => field.enabled)
        .sort((a: any, b: any) => a.order - b.order);
      const headers = activeFields.map((field: any) => field.label || field.id);

      const resolvedSheetName = await ensureSheetInitialized(accessToken, targetSpreadsheetId, headers);

      for (const inv of invoices) {
        const rowValues = mapInvoiceToRow(inv, fieldsConfig || []);
        await appendRowToSpreadsheet(accessToken, targetSpreadsheetId, `${resolvedSheetName}!A:Z`, rowValues);
      }

      return createMockResponse({ success: true, syncedCount: invoices.length });
    } catch (err: any) {
      return createMockResponse({ error: "فشل إرسال الفواتير إلى Google Sheets", details: err.message }, err?.status || 500);
    }
  }

  // Fallback to native fetch if no routes matched
  return fetch(apiUrl(path), init);
};
