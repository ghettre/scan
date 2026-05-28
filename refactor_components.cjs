const fs = require('fs');

// 1. Settings.tsx
let settingsContent = fs.readFileSync('d:/smart-invoice-scanner (2)/src/components/Settings.tsx', 'utf-8');
settingsContent = settingsContent.replace(/import \{ SheetTemplate \} from "\.\.\/types";/g, 'import { ConnectedSheet } from "../types";');
settingsContent = settingsContent.replaceAll('sheetTemplates?: SheetTemplate[];', 'connectedSheets?: ConnectedSheet[];');
settingsContent = settingsContent.replaceAll('sheetTemplates = []', 'connectedSheets = []');
settingsContent = settingsContent.replaceAll('sheetTemplates.some', 'connectedSheets.some');
settingsContent = settingsContent.replaceAll('sheetTemplates.map', 'connectedSheets.map');
settingsContent = settingsContent.replaceAll('sheetTemplates.length', 'connectedSheets.length');
fs.writeFileSync('d:/smart-invoice-scanner (2)/src/components/Settings.tsx', settingsContent, 'utf-8');

// 2. SpreadsheetSelector.tsx
let ssContent = fs.readFileSync('d:/smart-invoice-scanner (2)/src/components/SpreadsheetSelector.tsx', 'utf-8');
ssContent = ssContent.replace(/import \{ ColumnTemplate \} from "\.\.\/types";/g, 'import { Template } from "../types";');
ssContent = ssContent.replaceAll('sheetTemplates?: Array<{ spreadsheetId: string; sheetName: string }>;', 'connectedSheets?: Array<{ spreadsheetId: string; sheetName: string }>;');
ssContent = ssContent.replaceAll('sheetTemplates = []', 'connectedSheets = []');
ssContent = ssContent.replaceAll('sheetTemplates.some', 'connectedSheets.some');
ssContent = ssContent.replaceAll('columnTemplates?: ColumnTemplate[];', 'templates?: Template[];');
ssContent = ssContent.replaceAll('columnTemplates = []', 'templates = []');
ssContent = ssContent.replaceAll('columnTemplates', 'templates');
fs.writeFileSync('d:/smart-invoice-scanner (2)/src/components/SpreadsheetSelector.tsx', ssContent, 'utf-8');

console.log('Refactoring components completed.');
