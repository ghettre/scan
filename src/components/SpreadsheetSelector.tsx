import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  Check, 
  Search, 
  Plus, 
  Info, 
  RefreshCw, 
  Loader2, 
  Link2, 
  ExternalLink,
  X,
  AlertCircle
} from "lucide-react";
import { listUserSpreadsheets, ensureSheetInitialized } from "../lib/googleSheets";
import { getValidGoogleAccessToken, signOutForExpiredSession } from "../lib/supabaseAuth";
import { Template, ConnectedSheet } from "../types";

type SelectedSheet = {
  id: string;
  name: string;
  url: string;
  sheetName: string;
};

interface SpreadsheetSelectorProps {
  googleToken: string | null;
  currentSelectedId: string;
  onClose: () => void;
  onSelectSpreadsheet: (id: string, name: string, url: string, sheetName: string) => void;
  onCreateNewSheet: (options?: { templateId?: string; title?: string }) => Promise<SelectedSheet | void>;
  onStartNewColumnSetup: (title?: string) => void;
  onSaveSpreadsheetShortcut: (id: string, name: string, url: string, sheetName: string) => void;
  isCreatingSheet: boolean;
  activeHeaders: string[];
  connectedSheets?: ConnectedSheet[];
  templates?: Template[];
  onDisconnectGoogle?: () => Promise<void>;
  onConnectGoogle?: () => Promise<void>;
}

export default function SpreadsheetSelector({
  googleToken,
  currentSelectedId,
  onClose,
  onSelectSpreadsheet,
  onCreateNewSheet,
  onStartNewColumnSetup,
  onSaveSpreadsheetShortcut,
  isCreatingSheet,
  activeHeaders,
  connectedSheets = [],
  templates = [],
  onDisconnectGoogle,
  onConnectGoogle
}: SpreadsheetSelectorProps) {
  const getTemplateFieldCount = (template: Template) =>
    Array.isArray(template.fieldsConfig)
      ? template.fieldsConfig.filter((field: any) => field?.enabled).length
      : 0;

  const [spreadsheets, setSpreadsheets] = useState<Array<{ id: string; name: string; url: string; modifiedTime: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [initializingId, setInitializingId] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [showCreateSetup, setShowCreateSetup] = useState(false);
  const [createMode, setCreateMode] = useState<"current" | "template">("current");
  const [selectedColumnTemplateId, setSelectedColumnTemplateId] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<SelectedSheet | null>(null);
  const [newSheetTitle, setNewSheetTitle] = useState("");

  const resolveGoogleToken = async () => {
    try {
      return await getValidGoogleAccessToken();
    } catch {
      return googleToken && googleToken !== "connected" ? googleToken : null;
    }
  };

  const handleMaybeExpiredGoogleSession = async (err: any) => {
    if (err?.status === 401 || String(err?.message || "").includes("401")) {
      await signOutForExpiredSession();
      return true;
    }
    return false;
  };

  const fetchSpreadsheets = async () => {
    if (!googleToken) {
      setError("الرجاء ربط حساب Google أولاً.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const token = await resolveGoogleToken();
      if (!token) {
        setError("انتهت صلاحية اتصال Google. أعد تسجيل الدخول من جديد.");
        return;
      }
      const list = await listUserSpreadsheets(token);
      setSpreadsheets(list);
    } catch (err: any) {
      console.error(err);
      if (await handleMaybeExpiredGoogleSession(err)) return;
      setError(err.message || "فشل استرداد قائمة الجداول من حسابك. تأكد من إعطاء الصلاحيات الكافية.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken) {
      fetchSpreadsheets();
    }
  }, [googleToken]);

  useEffect(() => {
    if (!currentSelectedId || selectedSheet) return;
    const currentSheet = spreadsheets.find((sheet) => sheet.id === currentSelectedId);
    if (currentSheet) {
      setSelectedSheet({
        id: currentSheet.id,
        name: currentSheet.name,
        url: currentSheet.url,
        sheetName: "قائمة الفواتير"
      });
    }
  }, [currentSelectedId, spreadsheets, selectedSheet]);

  const handleReconnect = async () => {
    if (!onDisconnectGoogle || !onConnectGoogle) {
      setError("الرجاء تسجيل الخروج من صفحة الإعدادات والاتصال مجدداً.");
      return;
    }
    try {
      setReconnecting(true);
      setError(null);
      await onDisconnectGoogle();
      await onConnectGoogle();
    } catch (err: any) {
      console.error(err);
      setError(`خطأ أثناء تجديد الاتصال وتأكيد الصلاحيات: ${err.message || err}`);
    } finally {
      setReconnecting(false);
    }
  };

  const handleSelect = async (id: string, name: string, url: string) => {
    if (!googleToken) return;
    try {
      setInitializingId(id);
      setError(null);
      // Ensure the worksheet is initialized inside the selected spreadsheet
      const token = await resolveGoogleToken();
      if (!token) {
        setError("انتهت صلاحية اتصال Google. أعد تسجيل الدخول من جديد.");
        return;
      }
      const resolvedSheetName = await ensureSheetInitialized(token, id, activeHeaders);
      onSelectSpreadsheet(id, name, url, resolvedSheetName);
      setSelectedSheet({ id, name, url, sheetName: resolvedSheetName });
    } catch (err: any) {
      console.error(err);
      if (await handleMaybeExpiredGoogleSession(err)) return;
      setError(`تعذر تهيئة جدول البيانات داخل الملف المحدد: ${err.message || err}`);
    } finally {
      setInitializingId(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || !googleToken) return;

    let cleanId = customInput.trim();
    // Extract ID if a full URL was pasted
    const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      cleanId = urlMatch[1];
    }

    await handleSelect(
      cleanId,
      "جدول مخصص مربوط يدوياً",
      `https://docs.google.com/spreadsheets/d/${cleanId}/edit`
    );
  };

  const handleCreateNewClick = async () => {
    try {
      setError(null);
      const title = newSheetTitle.trim();
      if (!title) {
        setError("اكتب اسم الشيت الجديد أولاً.");
        return;
      }
      const templateId = createMode === "template" ? selectedColumnTemplateId : undefined;
      if (createMode === "template" && !templateId) {
        setError("اختر قالب أعمدة محفوظ أو استعمل خيار أعمدة جديدة.");
        return;
      }
      const createdSheet = await onCreateNewSheet({ templateId, title });
      if (createdSheet) {
        setSelectedSheet(createdSheet);
        setShowCreateSetup(false);
      }
    } catch (err: any) {
      setError(err.message || "فشل إنشاء جدول ذكي جديد.");
    }
  };

  const handleSaveShortcut = async (id: string, name: string, url: string) => {
    if (!googleToken) return;
    try {
      setInitializingId(id);
      setError(null);
      const token = await resolveGoogleToken();
      if (!token) {
        setError("انتهت صلاحية اتصال Google. أعد تسجيل الدخول من جديد.");
        return;
      }
      const resolvedSheetName = await ensureSheetInitialized(token, id, activeHeaders);
      onSaveSpreadsheetShortcut(id, name, url, resolvedSheetName);
    } catch (err: any) {
      console.error(err);
      if (await handleMaybeExpiredGoogleSession(err)) return;
      setError(`تعذر حفظ الشيت في الوصول السريع: ${err.message || err}`);
    } finally {
      setInitializingId(null);
    }
  };

  // Filter spreadsheets based on query
  const filteredSheets = spreadsheets.filter(sheet => 
    sheet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sheet.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedSheetIsShortcut = selectedSheet
    ? connectedSheets.some((template) => template.spreadsheetId === selectedSheet.id && template.isShortcut)
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="spreadsheet-selector-overlay">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header section with Close Button */}
        <div className="p-6 border-b border-neutral-100 dark:border-slate-800/60 flex items-center justify-between bg-neutral-50/50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-md font-bold text-slate-850 dark:text-slate-150">تحديد شيت المزامنة والربط الدائم</h3>
              <p className="text-[11px] text-slate-400">اختر أين تريد مزامنة وحفظ الفواتير المستخرجة بدقة</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info advice card describing persistence */}
        <div className="px-6 pt-4">
          <div className="bg-blue-50/40 dark:bg-blue-950/20 border border-blue-105/30 dark:border-blue-900/30 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
	            <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
	              اختر شيت موجود للعمل عليه. إضافة الشيت للوصول السريع تتم من صفحة الإعدادات أسفل قاعدة البيانات والمخرجات الرقمية.
	            </p>
          </div>
        </div>

        {/* Content list body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-grow">
          {error && (() => {
            const isScopeError = error.toLowerCase().includes("scope") || 
                                 error.toLowerCase().includes("permission") || 
                                 error.toLowerCase().includes("403") || 
                                 error.includes("صلاحية") || 
                                 error.includes("صلاحيات");
            return (
              <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 rounded-2xl space-y-3 font-sans">
                <div className="flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-450">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-bold">خطأ في الاتصال أو الصلاحيات:</p>
                    <p className="text-[11px] leading-relaxed font-mono opacity-90">{error}</p>
                  </div>
                </div>

                {isScopeError && (
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-100/50 dark:border-rose-950/30 text-xs text-slate-700 dark:text-slate-200 mt-2 space-y-3 shadow-sm">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs">
                      <span>💡</span>
                      <span>كيفية حل مشكلة صلاحيات Google Drive / Sheets:</span>
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      بما أنك قمت بربط حسابك مسبقاً قبل تهيئة الصلاحيات الجديدة، فإن Google تتطلب منك إعادة الاتصال لتفويض التطبيق بكتابة وقراءة الملفات. يرجى اتباع الخطوات البسيطة التالية:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 dark:text-slate-350 pr-1">
                      <li>اضغط على زر <strong className="text-blue-600 dark:text-blue-400">تجديد الاتصال وتفعيل الصلاحيات</strong> بالأسفل للبدء.</li>
                      <li>ستنبثق لك نافذة تسجيل الدخول من Google بشكل طبيعي.</li>
                      <li><strong className="text-slate-800 dark:text-white">تنبيه هام جداً:</strong> عندما تظهر الأذونات المطلوبة، <strong className="text-blue-600 dark:text-blue-400">ضع علامة صح (Checkbox) أمام كل الخيارات والصلاحيات</strong> المتاحة (مثل قراءة أو إدارة ملفات دنت وتعديل ملفات Google Sheets) لتفويض التطبيق، ثم أكمل الموافقة.</li>
                    </ol>

                    <button
                      type="button"
                      onClick={handleReconnect}
                      disabled={reconnecting}
                      className="w-full bg-[#0052ff] hover:bg-[#0042cc] disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm mt-3"
                    >
                      {reconnecting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري تجديد المصادقة...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>تجديد الاتصال وتفعيل الصلاحيات الآن</span>
                        </>
                      )}
                    </button>

                    <div className="border-t border-neutral-100 dark:border-slate-800/60 pt-3 text-[10px] text-slate-400 leading-relaxed">
                      👉 <strong>كبديل فوري ومضمون بالتأكيد:</strong> يمكنك ببساطة نسخ رابط أي جدول مالي (Google Sheet) مفتوح أمامك في المتصفح، ولصقه مباشرة في حقل <strong>الربط اليدوي بالأسفل</strong>، وسيقوم التطبيق بالربط والتهيئة والعمل فوراً دون أي قيود!
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Quick Search & New spreadsheets buttons list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Search Input bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث في ملفات Drive الخاصة بك..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-slate-950 border border-neutral-150 dark:border-slate-800 rounded-xl py-2.5 pr-9 pl-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-100"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Create new sheet action */}
            <button
              onClick={() => setShowCreateSetup(true)}
              disabled={isCreatingSheet}
              className="w-full bg-[#0052ff] hover:bg-[#0042cc] disabled:bg-slate-150 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              {isCreatingSheet ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>إنشاء شيت جديد</span>
            </button>
          </div>

          {showCreateSetup && (
            <div className="border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    ما هي أعمدة الشيت الجديد؟
                  </h4>
	                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
	                    اختر إعداد أعمدة جديدة للانتقال إلى صفحة التخصيص، أو استعمل قالب أعمدة محفوظ لإنشاء الشيت فوراً.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateSetup(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-white dark:hover:bg-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  اسم الشيت الجديد
                </label>
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(event) => setNewSheetTitle(event.target.value)}
                  placeholder="مثال: فواتير شهر يناير"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

	              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
	                  onClick={() => setCreateMode("current")}
                  className={`text-right rounded-2xl border p-4 transition-all ${
                    createMode === "current"
                      ? "bg-white dark:bg-slate-900 border-blue-500 shadow-sm"
                      : "bg-white/60 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      createMode === "current" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    }`}>
                      {createMode === "current" && <Check className="w-3.5 h-3.5" />}
                    </span>
	                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">شيت فارغ (Empty Sheet)</span>
	              </div>

	                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
	                    انتقل لصفحة تخصيص الأعمدة ثم أنشئ الشيت.
                  </p>
                  <p className="text-[10px] text-blue-600 font-bold mt-2">
	                    يمكنك حفظ الأعمدة كقالب لاحقاً
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("template");
                    if (!selectedColumnTemplateId && templates[0]) {
                      setSelectedColumnTemplateId(templates[0].id);
                    }
                  }}
                  disabled={templates.length === 0}
                  className={`text-right rounded-2xl border p-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    createMode === "template"
                      ? "bg-white dark:bg-slate-900 border-blue-500 shadow-sm"
                      : "bg-white/60 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      createMode === "template" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    }`}>
                      {createMode === "template" && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">استخدام قالب محفوظ</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    اربط الشيت بقالب أعمدة محفوظ.
                  </p>
                  <p className="text-[10px] text-blue-600 font-bold mt-2">
                    {templates.length > 0 ? `${templates.length} قوالب متاحة` : "لا توجد قوالب محفوظة"}
                  </p>
                </button>
              </div>

              {createMode === "template" && templates.length > 0 && (
                <select
                  value={selectedColumnTemplateId}
                  onChange={(event) => setSelectedColumnTemplateId(event.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name || "قالب بدون اسم"} - {getTemplateFieldCount(template)} أعمدة
                    </option>
                  ))}
                </select>
              )}

	              <button
	                type="button"
	                onClick={() => {
	                  if (createMode === "current") {
	                    if (!newSheetTitle.trim()) {
	                      setError("اكتب اسم الشيت الجديد أولاً.");
	                      return;
	                    }
	                    onStartNewColumnSetup(newSheetTitle);
	                    return;
	                  }
	                  handleCreateNewClick();
	                }}
	                disabled={isCreatingSheet || (createMode === "template" && !selectedColumnTemplateId)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                {isCreatingSheet ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
	                <span>{isCreatingSheet ? "جاري الإنشاء والمزامنة..." : createMode === "current" ? "متابعة لإعداد الأعمدة" : "تأكيد وإنشاء الشيت"}</span>
	              </button>
            </div>
          )}

          {selectedSheet && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                    تم ربط هذا الشيت للعمل عليه
                  </p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mt-1">
                    {selectedSheet.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {selectedSheet.sheetName}
                  </p>
                </div>
                <span className="bg-emerald-600 text-white rounded-full p-1 shrink-0">
                  <Check className="w-4 h-4" />
                </span>
              </div>

              {selectedSheetIsShortcut && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">
                  هذا الشيت موجود في الوصول السريع.
                </p>
              )}
              {(() => {
                const sheetConfig = connectedSheets.find(s => s.spreadsheetId === selectedSheet.id);
                if (sheetConfig?.basedOnTemplateId) {
                  const templateName = templates.find(t => t.id === sheetConfig.basedOnTemplateId)?.name || 'غير معروف';
                  return (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                      <Link2 className="w-3 h-3" />
                      <span>مبني على قالب: {templateName} (Linked Template)</span>
                    </div>
                  );
                }
                return null;
              })()}
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          )}

          <div className="relative font-sans">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-450">جداول البيانات السحابية (آخر التحديثات)</span>
              <button 
                onClick={fetchSpreadsheets}
                disabled={loading}
                className="text-[#0052ff] hover:underline flex items-center gap-1 text-[11px] font-bold cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>تحديث القائمة</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-xs font-semibold">جاري تحميل ملفات Excel والجداول من حسابك...</p>
              </div>
            ) : filteredSheets.length === 0 ? (
              <div className="border border-dashed border-neutral-200 dark:border-slate-800 rounded-2xl py-10 px-4 text-center text-slate-400">
                <FileSpreadsheet className="w-8 h-8 mx-auto opacity-20 mb-2" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">لم نعثر على أي جداول بيانات بعد</p>
                <p className="text-[10px] text-slate-405 mt-1">انقر على زر "إنشاء ملف جديد" لبدء جدول مخصص مباشرة</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
	                {filteredSheets.map((sheet) => {
	                  const isCurrent = sheet.id === currentSelectedId;
	                  const isInitializing = initializingId === sheet.id;
	                  return (
                    <div
                      key={sheet.id}
                      onClick={() => !isInitializing && handleSelect(sheet.id, sheet.name, sheet.url)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 text-blue-600 dark:text-blue-400"
                          : "bg-white dark:bg-slate-950/60 border-neutral-100 dark:border-slate-800/80 hover:bg-neutral-50 dark:hover:bg-slate-850/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isCurrent ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"
                        }`}>
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{sheet.name}</p>
                          <p className="text-[9px] text-slate-400 truncate max-w-[350px] font-mono">{sheet.id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
	                        {isInitializing ? (
	                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : isCurrent ? (
                          <span className="bg-blue-500 text-white rounded-full p-0.5">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : null}
                        <a 
                          href={sheet.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded text-neutral-400"
                          title="عرض في صفحة مستقلة"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form for manual input ID insertion */}
          <form onSubmit={handleCustomSubmit} className="space-y-2 pt-2 border-t border-neutral-100 dark:border-slate-800/60">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
              <Link2 className="w-3.5 h-3.5" />
              <span>ربط جدول مخصص يدويًا بالرابط أو المعرّف</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ألصق رابط شيت Google أو المعرّف الفريد هنا..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="flex-grow bg-slate-50 dark:bg-slate-950 border border-neutral-150 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!customInput.trim() || initializingId !== null}
                className="bg-neutral-100 hover:bg-neutral-250 dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50 text-xs font-bold px-4 rounded-xl cursor-pointer shrink-0 transition-colors"
              >
                {initializingId ? <Loader2 className="w-4 h-4 animate-spin" /> : "ربط الجدول"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
