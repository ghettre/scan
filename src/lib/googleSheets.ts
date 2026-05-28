import { Invoice, FieldConfig } from "../types";

const throwGoogleError = async (response: Response, fallbackMessage: string) => {
  const errorData = await readGoogleResponse(response, fallbackMessage);
  const error: any = new Error(`${fallbackMessage}: ${JSON.stringify(errorData)}`);
  error.status = response.status;
  error.details = errorData;
  throw error;
};

const readGoogleResponse = async (response: Response, fallbackMessage: string) => {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${fallbackMessage}: expected JSON but received ${contentType || "an empty content-type"}. ${text.slice(0, 160)}`
    );
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${fallbackMessage}: تعذر قراءة رد Google كـ JSON.`);
  }
};

const assertGoogleAccessToken = (accessToken: string) => {
  if (!accessToken || accessToken === "connected") {
    throw new Error("لا يوجد Google access token مباشر. أعد ربط Google أو استخدم مسار السيرفر المحفوظ.");
  }
};

/**
 * Creates a brand new Google Sheets Spreadsheet inside Google Drive
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  title: string,
  headers: string[]
): Promise<{ id: string; url: string }> {
  assertGoogleAccessToken(accessToken);

  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: {
        title: title
      },
      sheets: [
        {
          properties: {
            title: "قائمة الفواتير",
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!response.ok) {
    await throwGoogleError(response, "فشل إنشاء جدول بيانات Google");
  }

  const data = await readGoogleResponse(response, "فشل إنشاء جدول بيانات Google");
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write headers immediately as row 1
  if (headers && headers.length > 0) {
    await appendRowToSpreadsheet(accessToken, spreadsheetId, "قائمة الفواتير!A1", headers);
  }

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Appends a row of values to a given Range inside Google Sheets
 */
export async function appendRowToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rowValues: any[]
): Promise<any> {
  assertGoogleAccessToken(accessToken);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    }
  );

  if (!response.ok) {
    await throwGoogleError(response, "فشل إرسال السطر إلى جداول البيانات");
  }

  return await readGoogleResponse(response, "فشل إرسال السطر إلى جداول البيانات");
}

/**
 * Maps an invoice object into a tabular cell array based on custom user labels
 */
export function mapInvoiceToRow(invoice: Invoice, fieldsConfig: FieldConfig[]): any[] {
  const sortedFields = [...fieldsConfig]
    .filter((f) => f.enabled)
    .sort((a, b) => a.order - b.order);

  return sortedFields.map((col) => {
    if (col.id === "store_name") return invoice.storeName;
    if (col.id === "total_amount") return invoice.totalAmount;
    if (col.id === "tax_amount") return invoice.taxAmount;
    if (col.id === "date") return invoice.date;
    if (col.id === "category") return invoice.category;
    return invoice[col.id] || "";
  });
}

/**
 * Fetches the list of existing spreadsheets from the user's Google Drive
 */
export async function listUserSpreadsheets(accessToken: string): Promise<Array<{ id: string; name: string; url: string; modifiedTime: string }>> {
  assertGoogleAccessToken(accessToken);

  try {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'+and+trashed%3Dfalse&fields=files(id%2Cname%2CwebViewLink%2CmodifiedTime)&orderBy=modifiedTime+desc&pageSize=50",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      await throwGoogleError(response, "فشل استرجاع ملفات الجداول الخاصة بك");
    }

    const data = await readGoogleResponse(response, "فشل استرجاع ملفات الجداول الخاصة بك");
    return (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
      modifiedTime: file.modifiedTime
    }));
  } catch (error) {
    console.error("Error in listUserSpreadsheets:", error);
    throw error;
  }
}

/**
 * Checks if a target sheet exists in the spreadsheet. If not, it attempts to rename
 * any default empty sheet to "قائمة الفواتير", or falls back to using the first tab.
 * Returns the resolved sheet title that should be used for data operations.
 */
export async function ensureSheetInitialized(
  accessToken: string,
  spreadsheetId: string,
  headers: string[]
): Promise<string> {
  assertGoogleAccessToken(accessToken);

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    await throwGoogleError(response, "فشل التحقق من هيكل ملف Google Sheet");
  }

  const data = await readGoogleResponse(response, "فشل التحقق من هيكل ملف Google Sheet");
  const sheets = data.sheets || [];
  if (sheets.length === 0) {
    throw new Error("ملف Google Sheet لا يحتوي على أي صفحات ورقية.");
  }

  const hasTargetSheet = sheets.some((s: any) => s.properties?.title === "قائمة الفواتير");

  if (hasTargetSheet) {
    return "قائمة الفواتير";
  }

  // If "قائمة الفواتير" doesn't exist, check the first worksheet's title
  const firstSheet = sheets[0];
  const firstSheetTitle = firstSheet.properties?.title || "Sheet1";
  const firstSheetId = firstSheet.properties?.sheetId;
  const isDefaultName = ["sheet1", "sheet 1", "ورقة 1", "ورقة1", "ورقة_1"].includes(firstSheetTitle.toLowerCase().trim());

  if (isDefaultName && firstSheetId !== undefined) {
    try {
      // Attempt to rename the default empty sheet to "قائمة الفواتير" so they find it instantly as the active tab
      const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: firstSheetId,
                  title: "قائمة الفواتير"
                },
                fields: "title"
              }
            }
          ]
        })
      });

      if (updateResponse.ok) {
        // Since we renamed it and it was empty, write headers to it
        if (headers && headers.length > 0) {
          await appendRowToSpreadsheet(accessToken, spreadsheetId, "قائمة الفواتير!A1", headers);
        }
        return "قائمة الفواتير";
      }
    } catch (e) {
      console.warn("Failed to rename default sheet, falling back to using it as is:", e);
    }
  }

  // If it's a custom-named sheet or we failed to rename it, use the first sheet tab title as target
  try {
    if (headers && headers.length > 0) {
      // Check if it's empty by looking for content in A1:Z1 first, to avoid stomping headers
      const checkResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheetTitle)}!A1:Z1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      if (checkResponse.ok) {
        const valData = await readGoogleResponse(checkResponse, "فشل فحص صف العناوين في Google Sheet");
        if (!valData.values || valData.values.length === 0) {
          // Sheet is empty, write headers
          await appendRowToSpreadsheet(accessToken, spreadsheetId, `${firstSheetTitle}!A1`, headers);
        }
      } else {
        // Fallback write
        await appendRowToSpreadsheet(accessToken, spreadsheetId, `${firstSheetTitle}!A1`, headers);
      }
    }
  } catch (err) {
    console.warn("Failed to check or append headers, proceeding using the sheet as is:", err);
  }

  return firstSheetTitle;
}

/**
 * Synchronizes the headers of a specific sheet in a Google Spreadsheet by clearing and rewriting them.
 */
export async function syncGoogleSheetHeaders(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<any> {
  assertGoogleAccessToken(accessToken);

  // 1. Clear existing headers in A1:ZZ1 range
  const clearResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      sheetName
    )}!A1:ZZ1:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!clearResponse.ok) {
    await throwGoogleError(clearResponse, "فشل مسح عناوين الأعمدة في جداول البيانات");
  }

  // 2. Update new headers in A1 range
  if (headers && headers.length > 0) {
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        sheetName
      )}!A1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [headers]
        })
      }
    );

    if (!updateResponse.ok) {
      await throwGoogleError(updateResponse, "فشل تحديث عناوين الأعمدة في جداول البيانات");
    }

    return await readGoogleResponse(updateResponse, "فشل تحديث عناوين الأعمدة في جداول البيانات");
  }
}

