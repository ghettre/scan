const fs = require('fs');

let content = fs.readFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', 'utf-8');

// 1. Imports
content = content.replace(
  'import { Invoice, FieldConfig, SheetTemplate, ColumnTemplate, InvoiceSyncTarget } from "./types";', 
  'import { Invoice, FieldConfig, ConnectedSheet, Template, InvoiceSyncTarget } from "./types";'
);
content = content.replace(
  'import SpreadsheetSelector from "./components/SpreadsheetSelector";',
  'import SpreadsheetSelector from "./components/SpreadsheetSelector";\nimport TemplatesPage from "./components/TemplatesPage";\nimport { Layers, BookTemplate } from "lucide-react";'
);

// 2. States
content = content.replace(
  'const [sheetTemplates, setSheetTemplates] = useState<SheetTemplate[]>', 
  'const [connectedSheets, setConnectedSheets] = useState<ConnectedSheet[]>'
);
content = content.replaceAll('billflow_sheet_templates', 'billflow_connected_sheets');
content = content.replaceAll('setSheetTemplates', 'setConnectedSheets');
content = content.replaceAll('sheetTemplates', 'connectedSheets');

content = content.replace(
  'const [columnTemplates, setColumnTemplates] = useState<ColumnTemplate[]>', 
  'const [templates, setTemplates] = useState<Template[]>'
);
content = content.replaceAll('billflow_column_templates', 'billflow_templates');
content = content.replaceAll('setColumnTemplates', 'setTemplates');
content = content.replaceAll('columnTemplates', 'templates');

// 3. activeTab
content = content.replace(
  'const [activeTab, setActiveTab] = useState<"home" | "analytics" | "history" | "settings">("home");', 
  'const [activeTab, setActiveTab] = useState<"home" | "analytics" | "history" | "settings" | "templates">("home");'
);

// 4. old activeColumnTemplateId
content = content.replace(
  /const \[activeColumnTemplateId, setActiveColumnTemplateId\] = useState\(\(\) => \{[\s\S]*?\}\);/,
  'const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);'
);
content = content.replace(
  /useEffect\(\(\) => \{\s*localStorage\.setItem\("billflow_active_column_template_id", activeColumnTemplateId\);\s*\}, \[activeColumnTemplateId\]\);/,
  ''
);

// 5. Types logic
content = content.replaceAll('nextTemplate: SheetTemplate', 'nextTemplate: ConnectedSheet');
content = content.replaceAll('nextTemplate: ColumnTemplate', 'nextTemplate: Template');

// 6. Navigation
const oldNav = `<button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("settings");
            }}
            className={\`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer \${
              activeTab === "settings" && !showCustomizer
                ? "text-[#0052ff] scale-105"
                : "text-neutral-400 hover:text-neutral-600"
            }\`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">الإعدادات</span>
          </button>
        </nav>`;

const newNav = `<button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("templates");
            }}
            className={\`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer \${
              activeTab === "templates" && !showCustomizer
                ? "text-[#0052ff] scale-105"
                : "text-neutral-400 hover:text-neutral-600"
            }\`}
          >
            <BookTemplate className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">القوالب</span>
          </button>
          
          <button
            onClick={() => {
              setShowCustomizer(false);
              setActiveTab("settings");
            }}
            className={\`flex flex-col items-center justify-center text-xs font-semibold rounded-full w-12 h-12 transition-all duration-200 cursor-pointer \${
              activeTab === "settings" && !showCustomizer
                ? "text-[#0052ff] scale-105"
                : "text-neutral-400 hover:text-neutral-600"
            }\`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans">الإعدادات</span>
          </button>
        </nav>`;

content = content.replace(oldNav, newNav);

// 7. Route TemplatesPage
const oldRoute = `{activeTab === "settings" && (`;
const newRoute = `{activeTab === "templates" && (
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
                    setFieldsConfig(t.fieldsConfig.map(f => ({...f})));
                    setShowCustomizer(true);
                  }
                }}
                onDeleteTemplate={(id) => {
                  setTemplates(prev => prev.filter(t => t.id !== id));
                }}
              />
            )}
            {activeTab === "settings" && (`;

content = content.replace(oldRoute, newRoute);

fs.writeFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', content, 'utf-8');
console.log('Refactoring script completed successfully.');
