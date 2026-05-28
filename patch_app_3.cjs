const fs = require('fs');

let content = fs.readFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', 'utf-8');

const oldHeader = `<span className="text-lg font-extrabold text-[#0052ff] dark:text-[#adc6ff] tracking-tight">
            BillFlow
          </span>
        </div>`;

const newHeader = `<span className="text-lg font-extrabold text-[#0052ff] dark:text-[#adc6ff] tracking-tight">
            BillFlow
          </span>
          {activeConnectedSheet?.basedOnTemplateId && (
            <span className="hidden sm:flex text-[10px] font-bold px-2.5 py-1 bg-[#d0e1fb]/60 dark:bg-blue-950/50 text-[#0052ff] dark:text-[#adc6ff] rounded-md items-center gap-1 border border-blue-200 dark:border-blue-800">
              Linked Template: {templates.find(t => t.id === activeConnectedSheet.basedOnTemplateId)?.name || 'Unknown'}
            </span>
          )}
        </div>`;

content = content.replace(oldHeader, newHeader);

fs.writeFileSync('d:/smart-invoice-scanner (2)/src/App.tsx', content, 'utf-8');
console.log('App.tsx patched with template badge');
