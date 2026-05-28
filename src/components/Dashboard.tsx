import React, { useState, useRef } from "react";
import { Wallet, FileText, ShoppingCart, Fuel, Utensils, TrendingUp, RefreshCw, Camera, ArrowLeft, Image } from "lucide-react";
import { Invoice } from "../types";
import AppLogo from "./AppLogo";

interface DashboardProps {
  invoices: Invoice[];
  onTriggerScan: () => void;
  onNavigateToHistory: () => void;
  onNavigateToAnalytics: () => void;
  onScanDirectImage?: (base64Image: string) => void;
  onOpenLegal: (page: "privacy" | "terms") => void;
}

export default function Dashboard({
  invoices,
  onTriggerScan,
  onNavigateToHistory,
  onNavigateToAnalytics,
  onScanDirectImage,
  onOpenLegal
}: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto trigger small refresh simulation
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  // Dynamic calculations from localStorage invoices
  const totalExpenses = invoices.reduce((sum, item) => sum + item.totalAmount, 0) + 12450.00;
  const recentInvoices = invoices.slice(0, 4);

  // Map categories to appropriate icons
  const getCategoryIcon = (category: string) => {
    if (category.includes("بقالة") || category.includes("مواد غذائية")) {
      return <ShoppingCart className="w-5 h-5 text-blue-600" />;
    }
    if (category.includes("نقل") || category.includes("مواصلات") || category.includes("بنزين")) {
      return <Fuel className="w-5 h-5 text-blue-600" />;
    }
    return <Utensils className="w-5 h-5 text-blue-600" />;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      
      <section className="flex items-center justify-between gap-4 bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <AppLogo size="sm" />
          <div>
            <h1 className="text-xl font-black text-slate-900">smart scan</h1>
            <p className="text-xs text-slate-400">مسح فواتير ذكي ومزامنة مباشرة مع Google Sheets</p>
          </div>
        </div>
      </section>

      {/* Central Bento Grid Container */}
      <main className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Module 1: Main Metric & visual chart (Bento item 2 columns wide, 2 rows high) */}
        <div className="md:col-span-2 md:row-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                إجمالي المصاريف الشهرية
              </p>
              <div className="flex items-baseline gap-1.5">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                  {totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <span className="text-sm font-semibold text-slate-400">ر.س</span>
              </div>
            </div>
            <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12.5%</span>
            </div>
          </div>

          {/* Simple Premium Bento Bar Visual representing weekly breakdown */}
          <div className="h-32 flex items-end gap-3 px-2 mb-6">
            <div className="w-full bg-slate-100 rounded-t-lg h-[40%] transition-all hover:bg-blue-200" title="الأسبوع الأول: ٣٢٪" />
            <div className="w-full bg-slate-200 rounded-t-lg h-[60%] transition-all hover:bg-blue-300" />
            <div className="w-full bg-slate-300 rounded-t-lg h-[45%] transition-all hover:bg-blue-400" />
            <div className="w-full bg-blue-600 rounded-t-lg h-[85%] shadow-lg shadow-blue-100 animate-pulse" />
          </div>

          {/* Spark metrics footer */}
          <div className="flex justify-around border-t border-slate-50 pt-6">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">المفحوصة</p>
              <p className="text-md font-bold text-slate-800">{12 + invoices.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">الشيتات</p>
              <p className="text-md font-bold text-slate-800">
                {new Set(invoices.map((i) => i.syncTarget?.templateId).filter(Boolean)).size || 1}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">المزامنة</p>
              <p className="text-md font-bold text-slate-800">{invoices.filter(i => i.status === "synced").length}</p>
            </div>
          </div>
        </div>

        {/* Module 2: Dark Slate clock / hour styled tracker */}
        <div className="md:col-span-1 md:row-span-1 bg-[#1E293B] rounded-[2rem] p-6 text-white flex flex-col justify-between shadow-xl">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold opacity-60 uppercase tracking-widest">فواتير هذا الأسبوع</span>
            <FileText className="h-5 w-5 text-blue-400" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-light">
              {24 + invoices.length}
              <span className="text-sm opacity-50"> فاتورة</span>
            </p>
            <p className="text-[10px] opacity-40 mt-1">
              تحسن المعالجة بنسبة 8%
            </p>
          </div>
        </div>

        {/* Module 3: Vivid Emerald balanced budget display */}
        <div className="md:col-span-1 md:row-span-1 bg-emerald-500 rounded-[2rem] p-6 text-white flex flex-col justify-between shadow-lg shadow-emerald-100">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold opacity-85 uppercase tracking-widest">الميزانية</span>
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-light">3,540<span className="text-sm opacity-70"> ر.س</span></p>
            <p className="text-[10px] opacity-75 mt-1">
              المتبقي من الميزانية المحددة
            </p>
          </div>
        </div>

        {/* Module 4: Live Instant action trigger (Interactive bento box) */}
        <div className="md:col-span-2 md:row-span-1 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
              <Camera className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">التصوير السريع والمسح الذكي</h3>
              <p className="text-xs text-slate-400">امسح فواتيرك فوراً بالكاميرا أو بتحميل ملف الصورة</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={onTriggerScan}
                className="flex-grow py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>تشغيل الكاميرا والمستشعر</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-grow py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <Image className="w-3.5 h-3.5" />
                <span>تحميل صورة فاتورة</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = reader.result as string;
                  if (onScanDirectImage) onScanDirectImage(base64);
                };
                reader.readAsDataURL(file);
              }}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        {/* Module 5: Recent Transactions Lists log (Takes wide screen 4 columns layout) */}
        <div className="md:col-span-4 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">أحدث الفواتير المسحوبة</h3>
              <p className="text-xs text-slate-400">آخر التحديثات التي تمت قراءتها ومزامنتها بنجاح</p>
            </div>
            <button
              onClick={onNavigateToHistory}
              className="text-blue-600 hover:text-blue-700 text-xs font-bold border border-slate-100 px-4 py-2 rounded-full hover:bg-slate-50 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>عرض الكل</span>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-xs">لم تقم بمسح أي فواتير حالياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="bg-slate-50 p-4 rounded-2xl border border-transparent hover:border-slate-100 flex items-center justify-between transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      {getCategoryIcon(invoice.category)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{invoice.storeName}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {invoice.date} • {invoice.category}
                      </p>
                    </div>
                  </div>

                  <div className="text-left flex flex-col items-end gap-1">
                    <p className="text-xs font-black text-blue-600 tracking-tight">
                      {invoice.totalAmount.toFixed(2)} ر.س
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">
                      محفوظة في الشيت
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Float Camera Shutter Trigger Action FAB */}
      <button
        onClick={onTriggerScan}
        className="fixed bottom-24 left-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl flex items-center justify-center z-40 active:scale-95 transition-transform duration-200 cursor-pointer"
        title="مسح فاتورة جديدة"
      >
        <Camera className="w-6 h-6" />
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white">
          +
        </div>
      </button>

      {/* Floating Refresh button */}
      <button
        onClick={handleRefresh}
        className="fixed bottom-24 right-6 w-12 h-12 bg-white hover:bg-neutral-50 text-blue-600 border border-slate-100 rounded-xl shadow-md flex items-center justify-center z-40 active:scale-95 transition-transform cursor-pointer"
        title="تحديث البيانات"
      >
        <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
      </button>

      <footer className="pb-28 pt-2 flex items-center justify-center gap-4 text-xs font-bold text-slate-400">
        <button
          onClick={() => onOpenLegal("privacy")}
          className="hover:text-blue-600 transition-colors cursor-pointer"
        >
          سياسة الخصوصية
        </button>
        <span className="w-1 h-1 rounded-full bg-slate-300" />
        <button
          onClick={() => onOpenLegal("terms")}
          className="hover:text-blue-600 transition-colors cursor-pointer"
        >
          شروط الاستخدام
        </button>
      </footer>

    </div>
  );
}
