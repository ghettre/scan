const fs = require('fs');

let content = fs.readFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', 'utf-8');

const oldUpsert = `  const upsertCurrentSheetTemplate = (
    nextSpreadsheetId: string,
    nextSpreadsheetUrl: string,
    nextSheetName: string,
    templateName = "قالب Google Sheets الحالي",
    nextFieldsConfig = getActiveFieldsSnapshot(),
    makeActive = true
  ) => {
    const now = new Date().toISOString();
    const existing = connectedSheets.find(
      (template) =>
        template.spreadsheetId === nextSpreadsheetId &&
        template.sheetName === nextSheetName
    );
    const nextTemplate: ConnectedSheet = {
      id: existing?.id || crypto.randomUUID(),
      name: templateName || existing?.name || "قالب Google Sheets الحالي",
      spreadsheetId: nextSpreadsheetId,
      spreadsheetUrl: nextSpreadsheetUrl,
      sheetName: nextSheetName,
      fieldsConfig: nextFieldsConfig.map((field) => ({ ...field })),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };`;

const newUpsert = `  const upsertCurrentSheetTemplate = (
    nextSpreadsheetId: string,
    nextSpreadsheetUrl: string,
    nextSheetName: string,
    templateName = "قالب Google Sheets الحالي",
    nextFieldsConfig = getActiveFieldsSnapshot(),
    makeActive = true,
    basedOnTemplateId?: string
  ) => {
    const now = new Date().toISOString();
    const existing = connectedSheets.find(
      (template) =>
        template.spreadsheetId === nextSpreadsheetId &&
        template.sheetName === nextSheetName
    );
    const nextTemplate: ConnectedSheet = {
      id: existing?.id || crypto.randomUUID(),
      name: templateName || existing?.name || "قالب Google Sheets الحالي",
      spreadsheetId: nextSpreadsheetId,
      spreadsheetUrl: nextSpreadsheetUrl,
      sheetName: nextSheetName,
      fieldsConfig: nextFieldsConfig.map((field) => ({ ...field })),
      basedOnTemplateId: basedOnTemplateId || existing?.basedOnTemplateId,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };`;

content = content.replace(oldUpsert, newUpsert);

const oldCreate = `      setIsCreatingSheet(false);
      addSyncLog(\`تم إنشاء الشيت ومزامنة أعمدته تلقائياً: "\${sheetTitle}"\`, true, "1.2 كب");`;

const newCreate = `      // Automatically save it to connectedSheets (formerly quick access) with its template tracking
      upsertCurrentSheetTemplate(
        sheet.id,
        sheet.url,
        "قائمة الفواتير",
        sheetTitle,
        fieldsForNewSheet,
        true,
        options?.templateId
      );

      setIsCreatingSheet(false);
      addSyncLog(\`تم إنشاء الشيت ومزامنة أعمدته تلقائياً: "\${sheetTitle}"\`, true, "1.2 كب");`;

content = content.replace(oldCreate, newCreate);

fs.writeFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', content, 'utf-8');
console.log('App.tsx patched for basedOnTemplateId');
