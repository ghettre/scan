import React from "react";
import { Plus, BookTemplate, Edit2, Trash2, Layers } from "lucide-react";
import { Template } from "../types";

interface TemplatesPageProps {
  templates: Template[];
  onCreateTemplate: () => void;
  onEditTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export default function TemplatesPage({
  templates,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate
}: TemplatesPageProps) {
  const getTemplateFieldCount = (template: Template) =>
    Array.isArray(template.fieldsConfig) ? template.fieldsConfig.length : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <BookTemplate className="w-5 h-5" />
            </div>
            <span>إدارة القوالب (Templates)</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            قم بإنشاء وتعديل قوالب الأعمدة لتطبيقها على جداول البيانات الجديدة كنموذج افتراضي.
          </p>
        </div>
        <button
          onClick={onCreateTemplate}
          className="bg-[#0052ff] hover:bg-[#0042cc] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء قالب جديد</span>
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">لا توجد قوالب حتى الآن</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
            القوالب تساعدك على تنظيم الأعمدة المطلوبة وتطبيقها كنموذج عند إنشاء جداول جديدة (مثل Notion أو Airtable).
          </p>
          <button
            onClick={onCreateTemplate}
            className="text-[#0052ff] bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-6 py-2.5 rounded-xl font-bold transition-all text-sm"
          >
            البدء بإنشاء قالب
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-3xl"></div>
              
              <div className="flex justify-between items-start mb-4 pl-3">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onEditTemplate(template.id)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                    title="تعديل القالب"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`هل أنت متأكد من حذف القالب "${template.name}"؟`)) {
                        onDeleteTemplate(template.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                    title="حذف القالب"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 pl-3">
                {template.name}
              </h3>
              {template.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 pl-3 line-clamp-2">
                  {template.description}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 pl-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>عدد الأعمدة: <strong className="text-slate-700 dark:text-slate-200">{getTemplateFieldCount(template)}</strong></span>
                  <span>تم التحديث: {new Date(template.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
