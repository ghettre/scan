import React, { useState } from "react";
import {
  Settings as SettingsIcon,
  AlertTriangle,
  Cloud,
  CheckCircle,
  FileSpreadsheet,
  Globe,
  HardDrive,
  Moon,
  ExternalLink,
  LogOut,
  Trash2
} from "lucide-react";
import { ConnectedSheet } from "../types";

interface SyncLogItem {
  id: string;
  title: string;
  time: string;
  size: string;
  success: boolean;
}

interface SettingsProps {
  onLogout: () => void;
  onNavigateToCustomizer: () => void;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;

  // Google OAuth & Sheets Props
  googleUser: any | null;
  googleToken: string | null;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetName?: string;
  onSetSpreadsheetId: (id: string) => void;
  onCreateNewSheet: (options?: { templateId?: string; title?: string }) => Promise<any>;
  isCreatingSheet: boolean;
  syncLogs: SyncLogItem[];
  onClearSyncLogs?: () => void;
  onOpenSheetSelector?: () => void;
  connectedSheets?: ConnectedSheet[];
  activeTemplateId?: string;
  onSelectTemplate?: (templateId: string) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onSaveCurrentShortcut?: () => void;
}

export default function Settings({
  onLogout,
  onNavigateToCustomizer,
  darkMode,
  setDarkMode,
  googleUser,
  googleToken,
  onConnectGoogle,
  onDisconnectGoogle,
  spreadsheetId,
  spreadsheetUrl,
  spreadsheetName = "",
  onSetSpreadsheetId,
  onCreateNewSheet,
  isCreatingSheet,
  syncLogs,
  onClearSyncLogs,
  onOpenSheetSelector,
  connectedSheets = [],
  activeTemplateId = "",
  onSelectTemplate,
  onDeleteTemplate,
  onSaveCurrentShortcut
}: SettingsProps) {
  const [googleSheetsEnabled, setGoogleSheetsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("العربية");
  const [cacheSize, setCacheSize] = useState(250);
  const [inputSheetId, setInputSheetId] = useState(spreadsheetId);

  const handleClearCache = () => {
    setCacheSize(0);
    alert("تم مسح ذاكرة التخزين المؤقت وثنائيات الكاميرا بنجاح!");
  };

  const handleToggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleSaveSheetId = () => {
    if (!inputSheetId.trim()) {
      alert("الرجاء إدخال رقم التعرف الخاص بجدول البيانات.");
      return;
    }
    // Extract spreadsheetId if user pasted a full URL
    let cleanId = inputSheetId.trim();
    const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      cleanId = urlMatch[1];
    }
    onSetSpreadsheetId(cleanId);
    setInputSheetId(cleanId);
    alert("تم حفظ رقم التعرّف وتحديث المزامنة بنجاح.");
  };
  const isCurrentInQuickAccess = !!spreadsheetId && connectedSheets.some((template) => template.spreadsheetId === spreadsheetId && template.isShortcut);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-32">

      {/* Account Profile Header Hero Section */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center border-4 border-slate-100 dark:border-slate-800 overflow-hidden relative">
          {googleUser?.photoURL ? (
            <img
              alt="Google Account Profile"
              className="w-full h-full object-cover"
              src={googleUser.photoURL}
              referrerPolicy="no-referrer"
            />
          ) : (
            <img
              alt="Default Ahmed Mohamed headshot"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBqcuzEdLbr04I3Exd57J1Aq3i9fyO9X-oIgDeTsMK4K5XeK8w2Pwy-avd3b41h4QnisIy4XdSREOXGunxxLspSWs5NvxGBzLIhh1IeDbAnl1zzEF8BvX8O92t35mqIqbVg4-p9n1BDEWoe3X-H0nLyCR8BdqdXI2NQoPy0Y1h7KTFa-FQGtFHJN_-OuAw6nsNe8lwXD4GwaLZzMtrpdIm9HalBgp51SLAkTS6tsapUsJfQVPgTAPrIGFreUuGf6eWG6xjGcSObzkk"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        <div className="text-center md:text-right space-y-1.5 flex-grow">
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            {googleUser?.displayName || "أحمد محمد"}
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {googleUser?.email || "ahmed.m@example.com"}
          </p>
          <div className="inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            <span>خطة المزامنة السحابية الذكية</span>
          </div>
        </div>

        {/* Regular application logout */}
        <button
          onClick={onLogout}
          className="px-6 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>تسجيل الخروج</span>
        </button>
      </section>

      {/* Grid Settings details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Google OAuth Account Link Box (First step) */}
        {!googleToken ? (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2 mb-2">
                <Cloud className="w-5 h-5" />
                <span>ربط الحساب عبر Google OAuth</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                اربط حسابك لتتمكن من إرسال الفواتير تلقائياً ومزامنتها داخل جداول Google Sheets الخاصة بك بكل أمان.
              </p>
            </div>

            <button
              onClick={onConnectGoogle}
              className="w-full h-12 mt-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-3 rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <img
                alt="Google G Logo"
                className="w-5 h-5 object-contain"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJney2ZKXbNwvAm7HlacNAf4-0deiT7Vj2avbIrJVDXlAGx1MiJNUds8bYKBys2ZP91PUUy887_R3yLFfaU0dZkHhoBeMega5f4RMP4Lz8Vbm2lJk7Ye-gCiSXNruqlfdcQ2v6EpmSh3mO0KQv4XdzOwOWeY4eMQIAa6XNNCmxhkT-yQhHgKlDafdEcBfPYq6lQo999ksqctzGvzD2iD2mzcthCPcTdoiiuykp5bhDcH8kwSm5IFyw6GZgFXpkHjO6CEYVby5McVE"
                referrerPolicy="no-referrer"
              />
              <span>ربط حساب Google Sheets مباشرة</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                <span>تحديثات الربط والمزامنة</span>
              </h3>
              <span className="text-xs text-emerald-500 font-bold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>متصل سحابياً</span>
              </span>
            </div>

            <div className="space-y-3 pt-2 text-xs font-sans">
              <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/60">
                <span className="text-slate-400 font-semibold">حساب Google المتصل</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold max-w-[180px] truncate">
                  {googleUser?.email}
                </span>
              </div>

            </div>
          </div>
        )}

        {/* Integration block spreadsheet details (Only usable when logged in) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            <span>قاعدة البيانات والمخرجات الرقمية</span>
          </h3>

          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                <img
                  alt="Google Sheets logo representing automatic digital syncing"
                  className="w-6 h-6 object-contain"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDXh8tL4pgUhbmnxS7hYbZwGJ0Y6iOrvJhNK7gfXjhT-LPTUr5OunBwtBcf0bfMLgZDNm3dBIld3HmOXFAA1GF0ILILlPX0uvqx-dQoE1JxjKyICWsKc3vA_hZM1x597nHV28CEzs-8nfLSZ06KZHGrJ80fEBD8meBikrDliHBXyy3XFIeWjtmnUJ9644g6mkGKQHCRRYOLZpo2Audm_SCksYS85TxzSc2tDDOtL2yamPDZnBoopnCTTJlKNKhk5gohUHGtWeFboiE"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-0.5 overflow-hidden">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">جداول بيانات Google Sheets</p>
                {spreadsheetId ? (
                  <div className="space-y-0.5">
                    <a
                      href={spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-bold truncate max-w-[210px]"
                    >
                      <span>{spreadsheetName || "شيت Google الحالي"}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                    <p className="text-[9px] text-slate-400 truncate max-w-[210px] font-mono">
                      {spreadsheetId}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">لم يتم ربط جدول بيانات بعد</p>
                )}
              </div>
            </div>


          </div>

          {/* Connect Spreadsheets Configuration UI */}
          {googleToken && (
            <div className="space-y-4 font-sans pt-1">
              <button
                onClick={onOpenSheetSelector}
                className="w-full bg-[#0052ff] hover:bg-[#0042cc] text-white py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>اختيار أو إنشاء شيت</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onNavigateToCustomizer}
                  className="border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850/50 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>تعديل الأعمدة</span>
                </button>
                <button
                  onClick={onSaveCurrentShortcut}
                  disabled={!spreadsheetId || isCurrentInQuickAccess}
                  className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isCurrentInQuickAccess ? "موجود في الوصول السريع" : "إضافة للوصول السريع"}</span>
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500">الوصول السريع</span>
                  <button
                    onClick={onOpenSheetSelector}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    إضافة من الشيتات
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400">شيتات محفوظة للوصول السريع</label>
                  {connectedSheets.filter(t => t.isShortcut).length > 0 ? (
                    <div className="space-y-2">
                      {connectedSheets.filter(t => t.isShortcut).map((template) => {
                        const isReference = template.id === activeTemplateId || template.spreadsheetId === spreadsheetId;
                        return (
                          <div
                            key={template.id}
                            className={`bg-white dark:bg-slate-900 border rounded-xl p-3 space-y-2 ${isReference ? "border-blue-500" : "border-slate-200 dark:border-slate-800"
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{template.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{template.sheetName}</p>
                              </div>
                              {isReference && (
                                <span className="shrink-0 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                  مرجعي
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectTemplate?.(template.id)}
                                className="bg-[#0052ff] hover:bg-[#0042cc] text-white rounded-lg py-2 text-[11px] font-bold"
                              >
                                تأكيد استخدامه
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTemplate?.(template.id)}
                                className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg px-3"
                                title="حذف من الوصول السريع"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">يمكن تعليم أي شيت من نافذة اختيار الشيتات ليظهر هنا.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* General Settings */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            <span>إعدادات عامة</span>
          </h3>

          <div className="space-y-4 pt-1 text-xs">
            {/* Dark mode */}
            <div className="flex justify-between items-center py-1">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">الوضع الليلي (Dark Mode)</span>
              </div>
              <button
                onClick={handleToggleDarkMode}
                className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${darkMode ? "bg-blue-600" : "bg-slate-200"
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${darkMode ? "-translate-x-5" : "translate-x-0"
                    }`}
                />
              </button>
            </div>

            {/* Language */}
            <div className="flex justify-between items-center py-1">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">لغة التطبيق الافتراضية</span>
              </div>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-xl py-1.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="العربية">العربية</option>
                <option value="English">English</option>
                <option value="Français">Français</option>
              </select>
            </div>

            {/* Storage cache */}
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-slate-400" />
                <div>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold block">ذاكرة التخزين المؤقت</span>
                  <span className="text-[10px] text-slate-400">
                    المساحة المستخدمة: {cacheSize} ميجابايت
                  </span>
                </div>
              </div>
              <button
                onClick={handleClearCache}
                className="text-red-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                مسح الذاكرة
              </button>
            </div>
          </div>
        </div>


      </div>

    </div>
  );
}
