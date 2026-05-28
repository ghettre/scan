import React, { useState } from "react";
import TemplateEditModal from './TemplateEditModal';
import { Store, Coins, Calendar, AlignLeft, Check, Edit2, Camera, ArrowRight, Maximize2, Sliders } from "lucide-react";
import { Invoice, FieldConfig } from "../types";

interface InvoiceReviewProps {
  initialData: {
    storeName: string;
    totalAmount: number;
    taxAmount: number;
    date: string;
    category: string;
    [key: string]: any;
  };
  imageSrc: string;
  onSave: (newData: Invoice) => void;
  onCancel: () => void;
  onRescan: () => void;
  fieldsConfig?: FieldConfig[];
  onSaveTemplate?: (name: string) => void;
}

const SYSTEM_FIELD_IDS = ["store_name", "total_amount", "date", "category", "tax_amount"];

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `invoice_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export default function InvoiceReview({
  initialData,
  imageSrc,
  onSave,
  onCancel,
  onRescan,
  fieldsConfig,
  onSaveTemplate,
}: InvoiceReviewProps) {
  const [storeName, setStoreName] = useState(initialData.storeName || "");
  const [totalAmount, setTotalAmount] = useState(initialData.totalAmount || 0);
  const [taxAmount, setTaxAmount] = useState(initialData.taxAmount || 0);
  const [date, setDate] = useState(initialData.date || "");
  const [category, setCategory] = useState(initialData.category || "أخرى");
  const [isEditable, setIsEditable] = useState(true);
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const enabledFields = [...(fieldsConfig || [])]
    .filter((field) => field.enabled)
    .sort((a, b) => a.order - b.order);
  const hasField = (id: string) => enabledFields.some((field) => field.id === id);
  const customFields = enabledFields.filter((field) => !SYSTEM_FIELD_IDS.includes(field.id));

  // Read initial custom keys from incoming data
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    fieldsConfig?.forEach((field) => {
      if (!SYSTEM_FIELD_IDS.includes(field.id)) {
        values[field.id] = initialData[field.id] || "";
      }
    });
    return values;
  });

  const handleSave = () => {
    const enabledCustomValues = customFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.id] = customValues[field.id] || "";
      return acc;
    }, {});
    const finalData: Invoice = {
      id: createId(),
      storeName,
      totalAmount: Number(totalAmount),
      taxAmount: Number(taxAmount),
      date,
      category,
      status: "synced",
      createdAt: new Date().toISOString(),
      ...enabledCustomValues
    };
    onSave(finalData);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header section */}
      <section className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 text-sm mb-2 font-medium cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 ml-1" />
            <span>العودة للرئيسية</span>
          </button>
          <h1 className="text-3xl font-extrabold text-[#191c1e] tracking-tight">مراجعة الفاتورة</h1>

          <div className="flex items-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <p className="text-sm text-neutral-500 font-medium">تم استخراج البيانات بنجاح</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left Column: Digital Receipt Image Preview Card */}
        <section className="lg:col-span-5 w-full">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#0052ff]/10 to-emerald-500/10 rounded-[32px] blur opacity-30 group-hover:opacity-40 transition duration-1000" />
            <div className="relative bg-white rounded-3xl p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden border border-neutral-100">

              <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-50 flex items-center justify-center border border-neutral-100 relative">
                <img
                  alt="Invoice source scan digital preview"
                  src={imageSrc}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />

                {/* Subtle digital filter layout overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 flex justify-between items-center text-white">
                  <span className="text-xs font-mono tracking-widest text-[#dfe3ff]">DIGITAL PREVIEW</span>
                  <button
                    onClick={() => {
                      alert("عرض ملف الفاتورة مكبر ومصفي للتدقيق المحاسبي.");
                    }}
                    className="flex items-center gap-1 text-xs hover:underline cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>تكبير الصورة</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Editable form review fields */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_12px_rgba(15,23,42,0.04)] border border-neutral-100 space-y-6">

            {enabledFields.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <Sliders className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold">لا توجد حقول مفعلة في القالب الحالي</p>
                <p className="text-xs mt-1">ارجع إلى تخصيص الأعمدة وفعل حقلاً واحداً على الأقل.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Store Name input */}
                {hasField("store_name") && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-400 mr-1">اسم المتجر</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Store className="w-5 h-5" />
                      </span>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="w-full bg-neutral-50 border-none rounded-xl py-4 pr-12 pl-4 text-sm font-semibold text-neutral-800 focus:ring-2 focus:ring-[#0052ff]/20 outline-none transition-all disabled:text-neutral-500 disabled:bg-neutral-100/60"
                      />
                    </div>
                  </div>
                )}

                {/* Total Amount input */}
                {hasField("total_amount") && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-400 mr-1">المبلغ الإجمالي</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Coins className="w-5 h-5" />
                      </span>
                      <input
                        type="number"
                        disabled={!isEditable}
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(Number(e.target.value))}
                        className="w-full bg-neutral-50 border-none rounded-xl py-4 pr-12 pl-4 text-sm font-bold text-neutral-800 focus:ring-2 focus:ring-[#0052ff]/20 outline-none transition-all disabled:text-neutral-500 disabled:bg-neutral-100/60"
                      />
                    </div>
                  </div>
                )}

                {/* Tax Amount input */}
                {hasField("tax_amount") && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-400 mr-1">مبلغ الضريبة</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Coins className="w-5 h-5" />
                      </span>
                      <input
                        type="number"
                        step="any"
                        disabled={!isEditable}
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(Number(e.target.value))}
                        className="w-full bg-neutral-50 border-none rounded-xl py-4 pr-12 pl-4 text-sm font-bold text-neutral-800 focus:ring-2 focus:ring-[#0052ff]/20 outline-none transition-all disabled:text-neutral-500 disabled:bg-neutral-100/60"
                      />
                    </div>
                  </div>
                )}

                {/* Date string */}
                {hasField("date") && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-400 mr-1">التاريخ</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Calendar className="w-5 h-5" />
                      </span>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-neutral-50 border-none rounded-xl py-4 pr-12 pl-4 text-sm font-semibold text-neutral-800 focus:ring-2 focus:ring-[#0052ff]/20 outline-none transition-all disabled:text-neutral-500 disabled:bg-neutral-100/60"
                      />
                    </div>
                  </div>
                )}

                {/* Dropdown for expense categories */}
                {hasField("category") && (
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-400 mr-1">التصنيف</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        <AlignLeft className="w-5 h-5" />
                      </span>
                      <select
                        disabled={!isEditable}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-neutral-50 border-none rounded-xl py-4 pr-12 pl-4 text-sm font-semibold text-neutral-800 focus:ring-2 focus:ring-[#0052ff]/20 outline-none transition-all disabled:text-neutral-500 disabled:bg-neutral-100/60"
                      >
                        <option value="البقالة والمواد الغذائية">البقالة والمواد الغذائية</option>
                        <option value="المطاعم والكافيهات">المطاعم والكافيهات</option>
                        <option value="النقل والمواصلات">النقل والمواصلات</option>
                        <option value="ترفيه">ترفيه</option>
                        <option value="إلكترونيات">إلكترونيات</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Dynamic User-Customized Custom Fields */}
                {customFields.map((col) => (
                  <div key={col.id} className="flex flex-col gap-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-neutral-400 mr-1">{col.label}</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Sliders className="w-5 h-5 text-neutral-400" />
                      </span>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={customValues[col.id] || ""}
                        onChange={(e) => {
                          setCustomValues((prev) => ({ ...prev, [col.id]: e.target.value }));
                        }}
                        placeholder={`قيمة ${col.label}...`}
                        className="w-full bg-neutral-50 dark:bg-slate-950 border-none rounded-xl py-4 pr-12 pl-4 text-sm font-semibold text-neutral-800 dark:text-slate-200 focus:ring-2 focus:ring-[#0052ff]/20 outline-none transition-all disabled:text-neutral-500 disabled:bg-neutral-100/60"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Core Action triggers */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleSave}
                className="flex-1 bg-[#0052ff] hover:bg-[#0052ff]/90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#0052ff]/10 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>حفظ البيانات</span>
              </button>

              <button
                onClick={() => setIsEditable(!isEditable)}
                className="flex-1 bg-[#d0e1fb] hover:bg-[#b7c4ff] text-[#0052ff] font-bold py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit2 className="w-5 h-5" />
                <span>تعديل يدوي</span>
              </button>
            </div>

            <div className="flex justify-center mt-2">
              <button
                onClick={onRescan}
                className="text-neutral-500 hover:text-[#0052ff]/90 bg-neutral-100 hover:bg-neutral-200/60 font-medium py-3 px-6 rounded-full transition-all flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>إعادة مسح الفاتورة</span>
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* Template save modal */}
      <TemplateEditModal
        isOpen={isTemplateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSave={(name) => {
          if (onSaveTemplate) onSaveTemplate(name);
          setTemplateModalOpen(false);
        }}
        fieldsConfig={fieldsConfig}
      />
    </div>
  );
}
