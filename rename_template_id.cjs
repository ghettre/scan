const fs = require('fs');

const renameInFile = (file) => {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replaceAll('columnTemplateId', 'templateId');
  content = content.replaceAll('activeColumnTemplateId', 'editingTemplateId');
  fs.writeFileSync(file, content, 'utf-8');
};

renameInFile('d:/smart-invoice-scanner (2)/src/App.tsx');
renameInFile('d:/smart-invoice-scanner (2)/src/components/SpreadsheetSelector.tsx');
renameInFile('d:/smart-invoice-scanner (2)/src/components/FieldCustomizer.tsx');
renameInFile('d:/smart-invoice-scanner (2)/src/components/Settings.tsx');

console.log('Renamed columnTemplateId to templateId in all files.');
