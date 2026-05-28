import React, { useState } from "react";
import { GripVertical, AlertCircle, ArrowUp, ArrowDown, Check, X, ShieldAlert, Plus, Trash2, RefreshCw } from "lucide-react";
import { FieldConfig, FieldId } from "../types";

interface FieldCustomizerProps {
  fields: FieldConfig[];
  setFields: React.Dispatch<React.SetStateAction<FieldConfig[]>>;
  
  // Handlers
  onSave: () => void;
  onUpdateTemplate?: () => void;
  onSaveAsNewTemplate?: (name: string) => void;
  
  // States
  mode?: "normal" | "newSheet" | "editTemplate";
  isBasedOnTemplate?: boolean;
  
  // Creation props
  onCreateSheet?: (options: { sheetTitle?: string }) => Promise<void>;
  initialSheetTitle?: string;
  isCreatingSheet?: boolean;
  
  // Sync
  onSyncColumns?: () => Promise<void>;
  isSyncingColumns?: boolean;
  
  onCancel: () => void;
}

const SYSTEM_FIELD_IDS = ["store_name", "total_amount", "date", "category", "tax_amount"];

export default function FieldCustomizer({
  fields,
  setFields,
  onSave,
  onUpdateTemplate,
  onSaveAsNewTemplate,
  mode = "normal",
  isBasedOnTemplate = false,
  onCreateSheet,
  initialSheetTitle = "",
  onSyncColumns,
  onCancel,
  isSyncingColumns = false,
  isCreatingSheet = false
}: FieldCustomizerProps) {
  const [newFieldName, setNewFieldName] = useState("");
  const [sheetTitle, setSheetTitle] = useState(initialSheetTitle);
  const isNewSheetMode = mode === "newSheet";
  const isEditTemplateMode = mode === "editTemplate";
  
  const handleToggle = (id: FieldId) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const handleLabelChange = (id: FieldId, value: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, label: value } : f))
    );
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newFields = [...fields];
    
    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;

    const updated = newFields.map((f, i) => ({ ...f, order: i + 1 }));
    setFields(updated);
  };

  const handleAddNewField = () => {
    const trimmed = newFieldName.trim();
    if (!trimmed) {
      alert("الرجاء إدخال اسم حقل صحيح.");
      return;
    }

    const isDuplicate = fields.some(
      (f) => f.label.toLowerCase() === trimmed.toLowerCase() || f.id.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      alert("اسم هذا الحقل متواجد بالفعل في الإعدادات!");
      return;
    }

    const customId = "custom_" + Date.now();
    const newField: FieldConfig = {
      id: customId,
      label: trimmed,
      enabled: true,
      order: fields.length + 1
    };

    setFields((prev) => [...prev, newField]);
    setNewFieldName("");
  };

  const handleDeleteField = (id: FieldId) => {
    if (SYSTEM_FIELD_IDS.includes(id)) {
      alert("لا يمكن حذف حقول النظام الافتراضية، يمكنك فقط إلغاء تفعيلها.");
      return;
    }
    
    setFields((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      return filtered.map((f, i) => ({ ...f, order: i + 1 }));
    });
  };

  const activeCount = fields.filter((f) => f.enabled).length;

  const previewColumns = [...fields]
    .filter((f) => f.enabled)
    .sort((a, b) => a.order - b.order);

  const previewData = [
    { store_name: "أمازون", total_amount: "450 ر.س", date: "2023/10/24", category: "إلكترونيات", tax_amount: "67.50 ر.س" },
    { store_name: "ستار باكس", total_amount: "24 ر.س", date: "2023/10/23", category: "كافيهات", tax_amount: "3 ر.س" }
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-12 py-8 pb-32">
      <section className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#191c1e] dark:text-slate-100 mb-2">
          {isNewSheetMode ? "إعداد أعمدة الشيت الجديد" : isEditTemplateMode ? "تعديل القالب" : "تخصيص بنية الشيت"}
        </h1>
        <p className="text-[#505f76] dark:text-slate-400 text-sm md:text-base max-w-2xl font-light leading-relaxed">
          {isNewSheetMode
            ? "عدّل الأعمدة ثم أنشئ الشيت."
            : isEditTemplateMode
            ? "التعديل هنا سيؤثر على أي شيت جديد يستخدم هذا القالب لاحقاً، ولن يكسر الشيتات القديمة."
            : "قم بتنظيم وتسمية الحقول التي تظهر في ملفات التصدير السحابي."}
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0052ff] dark:text-[#adc6ff] flex items-center gap-2">
              <Plus className="w-5 h-5 animate-pulse" />
              <span>إضافة حقل مخصص جديد</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="أدخل اسم الحقل الجديد"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewField();
                  }
                }}
                className="flex-grow bg-[#f2f4f6] dark:bg-slate-950 text-neutral-800 dark:text-slate-200 border-none rounded-xl text-sm font-semibold px-4 py-3 outline-none focus:ring-2 focus:ring-[#0052ff]/20"
              />
              <button
                onClick={handleAddNewField}
                className="bg-[#0052ff] hover:bg-[#0052ff]/95 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 py-1">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">الترتيب والحقول الحالية</h2>
            <span className="text-xs text-[#0052ff] dark:text-[#adc6ff] font-bold px-3 py-1 bg-[#d0e1fb]/60 dark:bg-blue-950/50 rounded-full">
              {activeCount} نشطة
            </span>
          </div>

          <div className="space-y-4">
            {fields.map((field, idx) => {
              const isSystemField = SYSTEM_FIELD_IDS.includes(field.id);
              return (
                <div
                  key={field.id}
                  className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all duration-200 flex items-center gap-4 hover:border-[#0052ff]/30 dark:hover:border-slate-700 ${
                    field.enabled ? "border-neutral-100 dark:border-slate-800 shadow-sm" : "border-dashed border-neutral-200 dark:border-slate-800 opacity-60"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1 text-neutral-400">
                    <button onClick={() => moveField(idx, "up")} disabled={idx === 0} className="p-1 hover:text-[#0052ff] disabled:opacity-30">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <GripVertical className="w-5 h-5 opacity-40" />
                    <button onClick={() => moveField(idx, "down")} disabled={idx === fields.length - 1} className="p-1 hover:text-[#0052ff] disabled:opacity-30">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-grow space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                      <span>{field.id}</span>
                    </div>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleLabelChange(field.id, e.target.value)}
                      className="w-full bg-[#f2f4f6] dark:bg-slate-950 text-neutral-800 dark:text-slate-200 border-none rounded-xl text-sm font-semibold px-4 py-3 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0052ff]/10 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(field.id)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${field.enabled ? "bg-[#0052ff]" : "bg-neutral-200 dark:bg-slate-800"}`}
                    >
                      <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${field.enabled ? "-translate-x-5" : "translate-x-0"}`} />
                    </button>
                    {!isSystemField && (
                      <button onClick={() => handleDeleteField(field.id)} className="p-2 border border-rose-100 text-rose-500 rounded-xl hover:bg-rose-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          {isNewSheetMode ? (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-blue-100 shadow-sm space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-200">اسم الشيت الجديد</label>
                <input
                  type="text"
                  value={sheetTitle}
                  onChange={(event) => setSheetTitle(event.target.value)}
                  className="w-full bg-[#f2f4f6] dark:bg-slate-950 border-none rounded-xl text-sm font-semibold px-4 py-3 outline-none"
                  placeholder="مثال: فواتير شهر يناير"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (!sheetTitle.trim()) { alert("اكتب اسم الشيت أولاً."); return; }
                    onCreateSheet?.({ sheetTitle });
                  }}
                  disabled={isCreatingSheet || activeCount === 0 || !sheetTitle.trim()}
                  className="bg-[#0052ff] hover:bg-[#0052ff]/90 disabled:bg-slate-200 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all"
                >
                  {isCreatingSheet ? "جاري الإنشاء..." : "إنشاء الشيت"}
                </button>
                <button onClick={onCancel} className="bg-transparent border border-neutral-250 font-bold px-8 py-3.5 rounded-xl text-sm">رجوع</button>
              </div>
            </div>
          ) : isEditTemplateMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <button onClick={onSave} className="bg-[#0052ff] text-white font-bold px-6 py-3.5 rounded-xl text-sm shadow-md">
                حفظ القالب
              </button>
              <button onClick={onCancel} className="bg-transparent border border-neutral-250 font-bold px-6 py-3.5 rounded-xl text-sm">إلغاء</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-4">
              {isBasedOnTemplate ? (
                <>
                  <button onClick={onSave} className="bg-white border border-[#0052ff] text-[#0052ff] font-bold px-6 py-3.5 rounded-xl text-sm shadow-sm cursor-pointer hover:bg-slate-50">
                    حفظ فقط في هذا الشيت (Save only in this sheet)
                  </button>
                  <button onClick={onUpdateTemplate} className="bg-[#0052ff] hover:bg-[#0042cc] text-white font-bold px-6 py-3.5 rounded-xl text-sm shadow-md cursor-pointer transition-colors">
                    تحديث القالب أيضاً (Update template)
                  </button>
                  {onSaveAsNewTemplate && (
                    <button
                      onClick={() => {
                        const name = window.prompt("اسم القالب الجديد:")?.trim();
                        if (name) onSaveAsNewTemplate(name);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-6 py-3.5 rounded-xl text-sm transition-colors cursor-pointer"
                    >
                      حفظ كقالب جديد (Save as new template)
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={onSave} className="bg-white border border-[#0052ff] text-[#0052ff] font-bold px-6 py-3.5 rounded-xl text-sm shadow-sm cursor-pointer hover:bg-slate-50">
                    حفظ لهذا الشيت فقط (Save only for this sheet)
                  </button>
                  {onSaveAsNewTemplate && (
                    <button
                      onClick={() => {
                        const name = window.prompt("اسم القالب الجديد:")?.trim();
                        if (name) onSaveAsNewTemplate(name);
                      }}
                      className="bg-[#0052ff] hover:bg-[#0042cc] text-white font-bold px-6 py-3.5 rounded-xl text-sm shadow-md cursor-pointer transition-colors"
                    >
                      حفظ كقالب جديد (Save as new template)
                    </button>
                  )}
                </>
              )}
              {onSyncColumns && (
                <button onClick={onSyncColumns} disabled={isSyncingColumns} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${isSyncingColumns ? "animate-spin" : ""}`} />
                  <span>{isSyncingColumns ? "جاري المزامنة..." : "مزامنة مع Google Sheets"}</span>
                </button>
              )}
              <button onClick={onCancel} className="bg-transparent border border-neutral-250 font-bold px-6 py-3.5 rounded-xl text-sm hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">إلغاء</button>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="bg-[#f2f4f6] dark:bg-slate-950 px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-bold">معاينة الجدول</h3>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b">
                      {previewColumns.map((col) => (
                        <th key={col.id} className="py-3 px-3 text-xs font-bold text-neutral-400 bg-neutral-50/50">{col.label || col.id}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-xs text-neutral-600">
                    {previewData.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {previewColumns.map((col) => (
                          <td key={col.id} className="py-4 px-3 font-medium">
                            {col.id === "store_name" ? row.store_name : col.id === "total_amount" ? row.total_amount : col.id === "date" ? row.date : col.id === "category" ? row.category : col.id === "tax_amount" ? row.tax_amount : "بيانات"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
