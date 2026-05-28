import React, { useState } from "react";
import { X, Layers, Save, Check } from "lucide-react";
import { FieldConfig } from "../types";

interface TemplateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  currentTemplateName?: string;
  fieldsConfig?: FieldConfig[];
}

export default function TemplateEditModal({
  isOpen,
  onClose,
  onSave,
  currentTemplateName = "",
  fieldsConfig = [],
}: TemplateEditModalProps) {
  const [name, setName] = useState(currentTemplateName || "قالب أعمدة جديد");
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const enabledFields = fieldsConfig.filter((f) => f.enabled).sort((a, b) => a.order - b.order);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">حفظ القالب</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">احفظ إعدادات الأعمدة الحالية كقالب</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>



        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saved}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${saved
                ? "bg-emerald-500"
                : "bg-[#0052ff] hover:bg-[#0042cc] shadow-lg shadow-blue-500/20"
              }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                <span>تم الحفظ!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ القالب</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
