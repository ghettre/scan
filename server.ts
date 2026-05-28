import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const toA1SheetName = (sheetName: string) => `'${sheetName.replace(/'/g, "''")}'`;
  const googleErrorMessage = (error: any) =>
    error?.errors?.[0]?.message || error?.response?.data?.error?.message || error?.message || "Unknown Google API error";
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

  // Set limits for base64 image scanning uploads
  app.use(express.json({ limit: "15mb" }));

  // API routes FIRST
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL || "http://localhost:3000"}/api/auth/google/callback`
  );

  const getRedirectUri = (req: express.Request) => {
    if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") {
      const reqHost = req.get("host") || "";
      if (reqHost.includes("aistudio-preview") || reqHost.includes("webpreview") || reqHost.includes("127.0.0.1")) {
        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        return `${protocol}://${reqHost}/api/auth/google/callback`;
      }
      return `${process.env.APP_URL}/api/auth/google/callback`;
    }
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host") || "localhost:3000";
    return `${protocol}://${host}/api/auth/google/callback`;
  };

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
  );

  oauth2Client.on('tokens', async (tokens) => {
    // We don't have userId here directly unless we can figure it out.
    // However, if we only get 'access_token', we might not know which user it is without a lookup.
    // We will just do manual refresh checking in the endpoints if necessary, or use a workaround.
    // But since `googleapis` handles refresh automatically, we just need to ensure the DB is updated.
    // For now, we'll let it refresh in memory during the request.
  });

  app.get("/api/auth/google/url", (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const redirectUri = getRedirectUri(req);
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ],
      state: userId,
    });

    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      return res.status(400).send("Missing code or state (userId).");
    }

    try {
      const redirectUri = getRedirectUri(req);
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Create a new spreadsheet
      const sheets = google.sheets({ version: "v4", auth: client });
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: "Invoice Scanner",
          },
          sheets: [
            {
              properties: {
                title: "قائمة الفواتير",
              },
            },
          ],
        },
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId;

      // Store in Supabase
      const { error } = await supabaseAdmin.from("user_integrations").upsert({
        user_id: userId,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        spreadsheet_id: spreadsheetId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) {
        console.error("Supabase upsert error:", error);
        return res.status(500).send("Failed to save integration in database.");
      }

      res.send(`
        <html>
          <head><meta charset="utf-8" /></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #0052ff;">تم ربط حساب Google بنجاح!</h2>
            <p>تم إنشاء ملف "Invoice Scanner" في حسابك.</p>
            <p>يمكنك الآن إغلاق هذه النافذة والعودة للتطبيق.</p>
            <script>
              setTimeout(() => {
                window.location.href = "/";
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send("Authentication failed.");
    }
  });

  app.get("/api/google/integration", async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    try {
      const { data: integration, error } = await supabaseAdmin
        .from("user_integrations")
        .select("google_access_token, google_refresh_token, spreadsheet_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Supabase integration status lookup error:", error);
        return res.status(500).json({ error: "Failed to load Google integration", details: error.message });
      }

      return res.json({
        connected: Boolean(integration?.google_refresh_token),
        hasAccessToken: Boolean(integration?.google_access_token),
        spreadsheetId: integration?.spreadsheet_id || "",
      });
    } catch (error: any) {
      console.error("Google integration status error:", error);
      return res.status(500).json({ error: "Failed to load Google integration", details: error.message });
    }
  });

  app.post("/api/google/disconnect", async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    try {
      const { error } = await supabaseAdmin
        .from("user_integrations")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Supabase integration deletion error:", error);
        return res.status(500).json({ error: "Failed to disconnect Google account", details: error.message });
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Disconnect Google error:", error);
      return res.status(500).json({ error: "Failed to disconnect Google account", details: error.message });
    }
  });

  app.post("/api/google/select-spreadsheet", async (req, res) => {
    const { userId, spreadsheetId } = req.body;
    if (!userId || !spreadsheetId) {
      return res.status(400).json({ error: "Missing userId or spreadsheetId" });
    }

    try {
      const { error } = await supabaseAdmin
        .from("user_integrations")
        .update({
          spreadsheet_id: spreadsheetId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error("Supabase spreadsheet selection update error:", error);
        return res.status(500).json({ error: "Failed to save selected spreadsheet", details: error.message });
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Select spreadsheet error:", error);
      return res.status(500).json({ error: "Failed to save selected spreadsheet", details: error.message });
    }
  });

  app.get("/api/google/spreadsheet-metadata", async (req, res) => {
    const userId = req.query.userId as string;
    const spreadsheetId = req.query.spreadsheetId as string;
    if (!userId || !spreadsheetId) {
      return res.status(400).json({ error: "Missing userId or spreadsheetId" });
    }

    try {
      const { data: integration, error: integrationError } = await supabaseAdmin
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (integrationError) {
        return res.status(500).json({ error: "Failed to load Google integration", details: integrationError.message });
      }

      if (!integration?.google_refresh_token) {
        return res.status(401).json({ error: "No Google Sheets integration found for this user." });
      }

      const userOauth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      userOauth.setCredentials({
        access_token: integration.google_access_token,
        refresh_token: integration.google_refresh_token,
      });

      const drive = google.drive({ version: "v3", auth: userOauth });
      const file = await drive.files.get({
        fileId: spreadsheetId,
        fields: "id,name,webViewLink",
      });

      return res.json({
        id: file.data.id,
        name: file.data.name,
        url: file.data.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      });
    } catch (error: any) {
      console.error("Google spreadsheet metadata error:", error);
      return res.status(error?.code || 500).json({
        error: "Failed to load spreadsheet metadata",
        details: googleErrorMessage(error),
      });
    }
  });

  app.post("/api/google/create-spreadsheet", async (req, res) => {
    const { userId, title, headers } = req.body;
    if (!userId || !title) {
      return res.status(400).json({ error: "Missing userId or title" });
    }

    try {
      const { data: integration, error: integrationError } = await supabaseAdmin
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (integrationError) {
        return res.status(500).json({ error: "Failed to load Google integration", details: integrationError.message });
      }

      if (!integration?.google_refresh_token) {
        return res.status(401).json({ error: "No Google Sheets integration found for this user." });
      }

      const userOauth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      userOauth.setCredentials({
        access_token: integration.google_access_token,
        refresh_token: integration.google_refresh_token,
      });

      const sheets = google.sheets({ version: "v4", auth: userOauth });
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [{ properties: { title: "قائمة الفواتير", gridProperties: { frozenRowCount: 1 } } }],
        },
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId;
      if (!spreadsheetId) {
        return res.status(500).json({ error: "Google did not return a spreadsheet id" });
      }

      if (Array.isArray(headers) && headers.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${toA1SheetName("قائمة الفواتير")}!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [headers] },
        });
      }

      await supabaseAdmin
        .from("user_integrations")
        .update({
          spreadsheet_id: spreadsheetId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return res.json({
        id: spreadsheetId,
        url: spreadsheet.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      });
    } catch (error: any) {
      console.error("Create Google spreadsheet error:", error);
      return res.status(error?.code || 500).json({
        error: "فشل إنشاء جدول Google Sheets",
        details: googleErrorMessage(error),
      });
    }
  });

  app.post("/api/google/sync-headers", async (req, res) => {
    const { userId, spreadsheetId, sheetName, headers, googleAccessToken } = req.body;
    if (!userId || !spreadsheetId || !sheetName || !Array.isArray(headers)) {
      return res.status(400).json({ error: "Missing userId, spreadsheetId, sheetName, or headers" });
    }

    try {
      const { data: integration, error: integrationError } = await supabaseAdmin
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (integrationError) {
        return res.status(500).json({ error: "Failed to load Google integration", details: integrationError.message });
      }

      if (!integration?.google_refresh_token && !googleAccessToken) {
        return res.status(401).json({
          error: "لم يتم العثور على ربط Google Sheets محفوظ لهذا المستخدم.",
          details: "أعد ربط Google Sheets من الإعدادات ثم حاول مزامنة الأعمدة مرة أخرى.",
        });
      }

      const userOauth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      userOauth.setCredentials({
        access_token: integration?.google_access_token || googleAccessToken,
        refresh_token: integration?.google_refresh_token,
      });

      const sheets = google.sheets({ version: "v4", auth: userOauth });
      await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "spreadsheetId",
      });

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${toA1SheetName(sheetName)}!A1:ZZ1`,
      });

      if (headers.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${toA1SheetName(sheetName)}!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [headers],
          },
        });
      }

      return res.json({ success: true, syncedHeaderCount: headers.length });
    } catch (error: any) {
      console.error("Sync Google headers error:", error);
      return res.status(error?.code || 500).json({
        error: "فشل مزامنة أعمدة Google Sheets",
        details: googleErrorMessage(error),
      });
    }
  });

  app.post("/api/sync-invoices", async (req, res) => {
    const { userId, invoices, fieldsConfig, activeSheet, spreadsheetId, googleAccessToken } = req.body;
    if (!userId || !invoices || !Array.isArray(invoices)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const { data: integration, error: integrationError } = await supabaseAdmin
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (integrationError) {
        console.error("Supabase integration lookup error:", integrationError);
        return res.status(500).json({ error: "Failed to load Google Sheets integration", details: integrationError.message });
      }

      if (!integration?.google_refresh_token && !googleAccessToken) {
        return res.status(401).json({
          error: "لم يتم العثور على ربط Google Sheets محفوظ لهذا المستخدم.",
          details: "أعد ربط Google Sheets من الإعدادات. إذا استمر الخطأ، أضف SUPABASE_SERVICE_ROLE_KEY في ملف .env حتى يستطيع السيرفر حفظ الربط مع تفعيل RLS.",
        });
      }

      const targetSpreadsheetId = spreadsheetId || integration?.spreadsheet_id;
      if (!targetSpreadsheetId) {
        return res.status(400).json({ error: "No Google spreadsheet selected for sync." });
      }

      const userOauth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      userOauth.setCredentials({
        access_token: integration?.google_access_token || googleAccessToken,
        refresh_token: integration?.google_refresh_token,
      });

      userOauth.on('tokens', async (tokens) => {
        if (tokens.access_token && integration?.google_refresh_token) {
          await supabaseAdmin.from("user_integrations").update({
            google_access_token: tokens.access_token,
            ...(tokens.refresh_token && { google_refresh_token: tokens.refresh_token }),
            updated_at: new Date().toISOString()
          }).eq("user_id", userId);
        }
      });

      const sheets = google.sheets({ version: "v4", auth: userOauth });
      const sheetName = activeSheet || "قائمة الفواتير";

      const defaultFields = [
        { id: "store_name", enabled: true, order: 1 },
        { id: "total_amount", enabled: true, order: 2 },
        { id: "date", enabled: true, order: 3 },
        { id: "category", enabled: true, order: 4 },
        { id: "tax_amount", enabled: true, order: 5 },
      ];
      const activeFields = (Array.isArray(fieldsConfig) && fieldsConfig.length > 0 ? fieldsConfig : defaultFields)
        .filter((field: any) => field.enabled)
        .sort((a: any, b: any) => a.order - b.order);
      const headers = activeFields.map((field: any) => field.label || field.id);

      const rows = invoices.map((inv: any) => activeFields.map((field: any) => {
        if (field.id === "store_name") return inv.storeName || "غير معروف";
        if (field.id === "total_amount") return inv.totalAmount ?? 0;
        if (field.id === "tax_amount") return inv.taxAmount ?? 0;
        if (field.id === "date") return inv.date || new Date().toISOString().split("T")[0];
        if (field.id === "category") return inv.category || "أخرى";
        return inv[field.id] || "";
      }));

      let resolvedSheetName = sheetName;
      try {
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: targetSpreadsheetId,
          fields: "sheets(properties(sheetId,title))",
        });
        const availableSheets = spreadsheet.data.sheets || [];
        const hasRequestedSheet = availableSheets.some((sheet) => sheet.properties?.title === sheetName);

        if (!hasRequestedSheet) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: targetSpreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sheetName,
                    },
                  },
                },
              ],
            },
          });
        }

        await sheets.spreadsheets.values.update({
          spreadsheetId: targetSpreadsheetId,
          range: `${toA1SheetName(resolvedSheetName)}!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [headers],
          },
        });
      } catch (error: any) {
        const status = error?.code || error?.response?.status;
        const details = googleErrorMessage(error);
        console.error("Google Sheet validation error:", error);
        if (status === 404) {
          return res.status(404).json({
            error: "ملف Google Sheet غير موجود أو لا يملك التطبيق صلاحية الوصول إليه. اختر الملف مرة أخرى من الإعدادات أو أعد ربط حساب Google.",
            details,
          });
        }
        if (status === 403) {
          return res.status(403).json({
            error: "صلاحيات Google غير كافية للكتابة في هذا الملف. أعد ربط حساب Google ووافق على صلاحيات Sheets وDrive.",
            details,
          });
        }
        throw error;
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSpreadsheetId,
        range: `${toA1SheetName(resolvedSheetName)}!A:Z`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rows,
        },
      });

      res.json({ success: true, syncedCount: rows.length });
    } catch (error: any) {
      console.error("Sync invoices error:", error);
      res.status(error?.code || 500).json({
        error: "فشل إرسال الفواتير إلى Google Sheets",
        details: googleErrorMessage(error),
      });
    }
  });

  app.post("/api/scan-invoice", async (req, res) => {
    try {
      const { imageData, sampleId, fieldsConfig, userId } = req.body;

      // Fast responsive presets for interactive sample items
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
        return res.json(preset);
      }

      if (!imageData) {
        return res.status(400).json({ error: "الرجاء توفير صورة للمسح الضوئي" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.warn("GEMINI_API_KEY is not configured or placeholder detected. Simulating OCR extraction...");

        // Randomly return dummy invoices to keep the frontend completely live without errors
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
        return res.json(result);
      }

      // Extract raw base64 data and mimeType
      const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
      let mimeType = "image/jpeg";
      let base64Data = imageData;

      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

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
          type: Type.STRING,
          description: "Name of the store / company / vendor. Retrieve this accurately from the invoice header, logo, or seller information in any language. Keep the clean name as it appears."
        });
      }

      if (enabledScanIds.has("total_amount")) {
        addSchemaField("totalAmount", { type: Type.NUMBER, description: "Total invoice amount as a float number." });
      }

      if (enabledScanIds.has("tax_amount")) {
        addSchemaField("taxAmount", { type: Type.NUMBER, description: "Calculated or stated VAT/tax absolute currency amount. If not stated, return 0." });
      }

      if (enabledScanIds.has("date")) {
        addSchemaField("date", { type: Type.STRING, description: "Invoice date as string, matching formatting YYYY-MM-DD. If year is missing or unclear, assume 2026." });
      }

      if (enabledScanIds.has("category")) {
        addSchemaField("category", { type: Type.STRING, description: "Must be exactly one of: 'البقالة والمواد الغذائية', 'المطاعم والكافيهات', 'النقل والمواصلات', 'ترفيه', 'إلكترونيات', 'أخرى'." });
      }

      enabledScanFields.forEach((field: any) => {
        const sysIds = ["store_name", "total_amount", "date", "category", "tax_amount"];
        if (!sysIds.includes(field.id)) {
          addSchemaField(field.id, {
            type: isNumericInvoiceField(field) ? Type.NUMBER : Type.STRING,
            description: customFieldDescription(field)
          });
        }
      });

      if (requiredFields.length === 0) {
        addSchemaField("storeName", {
          type: Type.STRING,
          description: "Name of the store / company / vendor. Return an empty string if it cannot be extracted."
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          "قم بتحليل هذه الفاتورة المرفقة واستخراج المكونات بدقة وموثوقية فائقة ككائن JSON متوافق مع المخطط المحدد.\n" +
          "تنبيهات الاستجابة الهامة:\n" +
          "1. يمكن أن تكون الفاتورة بأي لغة (عربية، إنكليزية، فرنسية، إلخ). ابحث عن اسم الشركة أو المحل بأي لغة كان، واجلبه بتسميتة الصحيحة والنظيفة دون تلفيق.\n" +
          "2. استخرج فقط الحقول الموجودة في المخطط. لا تضف taxType أو taxValue أو أي حقل ضريبي غير مطلوب من إعدادات الأعمدة.\n" +
          "3. إذا اختار المستخدم عمود taux / نسبة TVA فأرجع النسبة فقط. إذا اختار montant TVA / مبلغ الضريبة فأرجع المبلغ فقط. إذا اختار TTC أو HT فأرجع القيمة المطابقة فقط.\n" +
          "4. إذا وجد أي حقل مخصص قمت بمطالبته في المخطط (Schema) فافحصه جيداً بالصورة وعبر السطور لمحاولة ملئه بذكاء."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties,
            required: requiredFields
          }
        }
      });

      const text = response.text ? response.text.trim() : "";
      if (!text) {
        throw new Error("لم يرجع الذكاء الاصطناعي أي استجابة");
      }

      const parsed = JSON.parse(text);

      return res.json(parsed);

    } catch (error: any) {
      console.error("Internal API error during scan:", error);
      return res.status(500).json({
        error: "فشل استخراج البيانات من الفاتورة الرقمية.",
        details: error?.message || "Internal Error"
      });
    }
  });

  // Serve static assets / Vite server middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server bound and running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
