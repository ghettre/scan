const fs = require('fs');

let content = fs.readFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', 'utf-8');

// 1. Calculate activeConnectedSheet
const activeSheetLogic = `
  const currentSpreadsheetName =
    spreadsheetName ||
    connectedSheets.find(
      (template) => template.spreadsheetId === spreadsheetId && template.sheetName === spreadsheetSheetName
    )?.name || "";
`;

const newActiveSheetLogic = `
  const activeConnectedSheet = connectedSheets.find(
    (sheet) => sheet.spreadsheetId === spreadsheetId && sheet.sheetName === spreadsheetSheetName
  );
  const currentSpreadsheetName = spreadsheetName || activeConnectedSheet?.name || "";
`;

content = content.replace(activeSheetLogic, newActiveSheetLogic);

// 2. Add handleUpdateTemplateFromSheet
const handleSaveFieldSettings = `
  const handleSaveFieldSettings = () => {
    addSyncLog("تم حفظ إعدادات الأعمدة الحالية", true, "—");
`;

const newHandleSaveFieldSettings = `
  const handleUpdateTemplateFromSheet = () => {
    if (activeConnectedSheet?.basedOnTemplateId) {
      setTemplates(prev => prev.map(t => 
        t.id === activeConnectedSheet.basedOnTemplateId
          ? { ...t, fieldsConfig: getActiveFieldsSnapshot(), updatedAt: new Date().toISOString() }
          : t
      ));
      addSyncLog("تم تحديث القالب المرتبط بنجاح", true, "—");
    }
    // Also save in this sheet
    handleSaveFieldSettings();
  };

  const handleSaveFieldSettings = () => {
    if (editingTemplateId) {
      setTemplates(prev => prev.map(t => 
        t.id === editingTemplateId
          ? { ...t, fieldsConfig: getActiveFieldsSnapshot(), updatedAt: new Date().toISOString() }
          : t
      ));
      addSyncLog("تم حفظ القالب بنجاح", true, "—");
    } else {
      addSyncLog("تم حفظ إعدادات الأعمدة الحالية في هذا الشيت", true, "—");
    }
`;

content = content.replace(handleSaveFieldSettings, newHandleSaveFieldSettings);

// 3. Fix FieldCustomizer Props
const oldFieldCustomizer = `          <FieldCustomizer
            fields={fieldsConfig}
            setFields={setFieldsConfig}
            onSave={handleSaveFieldSettings}
            onSaveColumnTemplate={handleSaveColumnTemplate}
            templates={templates}
            activeColumnTemplateId={editingTemplateId}
            onSelectColumnTemplate={handleSelectColumnTemplate}
            onDeleteColumnTemplate={handleDeleteColumnTemplate}
            mode={isSettingUpNewSheetColumns ? "newSheet" : "normal"}
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
          />`;

const newFieldCustomizer = `          <FieldCustomizer
            fields={fieldsConfig}
            setFields={setFieldsConfig}
            onSave={handleSaveFieldSettings}
            onUpdateTemplate={handleUpdateTemplateFromSheet}
            mode={isSettingUpNewSheetColumns ? "newSheet" : (editingTemplateId ? "editTemplate" : "normal")}
            isBasedOnTemplate={!!activeConnectedSheet?.basedOnTemplateId}
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
          />`;

// Use regex to catch slight spacing differences
content = content.replace(/<FieldCustomizer[\s\S]*?\/>/, newFieldCustomizer);

fs.writeFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', content, 'utf-8');
console.log('App.tsx patched for FieldCustomizer');
