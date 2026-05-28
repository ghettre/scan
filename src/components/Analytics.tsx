import React, { useState } from "react";
import { Coins, Grid, FileText, ChevronLeft, Store, Fuel, TrendingUp } from "lucide-react";
import { Invoice } from "../types";

interface AnalyticsProps {
  invoices: Invoice[];
  onNavigateToHome: () => void;
}

export default function Analytics({ invoices, onNavigateToHome }: AnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"week" | "month" | "year">("week");
  const [hoveredBar, setHoveredBar] = useState<number | null>(2); // Default hover on March

  const barData = [
    { name: "يناير", value: 1.8, height: "40%" },
    { name: "فبراير", value: 3.2, height: "65%" },
    { name: "مارس", value: 4.5, height: "90%" },
    { name: "ابريل", value: 2.5, height: "55%" },
    { name: "مايو", value: 3.8, height: "75%" },
    { name: "يونيو", value: 2.1, height: "45%" },
    { name: "يوليو", value: 1.5, height: "30%" }
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-12 py-8 space-y-8 pb-32">
      
      {/* Title Filters */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#191c1e]">التحليلات المالية</h2>
          <p className="text-[#505f76] text-sm md:text-base font-light font-sans">
            نظرة شاملة ودقيقة على مصاريفك المسجلة بالفواتير الممسوحة
          </p>
        </div>

        {/* Option toggles */}
        <div className="flex bg-[#eceef0] p-1 rounded-full border border-neutral-100 shadow-sm">
          <button
            onClick={() => setActiveTab("week")}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "week" ? "bg-[#0052ff] text-white shadow" : "text-[#505f76] hover:bg-[#eceef0]/65"
            }`}
          >
            أسبوع
          </button>
          <button
            onClick={() => setActiveTab("month")}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "month" ? "bg-[#0052ff] text-white shadow" : "text-[#505f76] hover:bg-[#eceef0]/65"
            }`}
          >
            شهر
          </button>
          <button
            onClick={() => setActiveTab("year")}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "year" ? "bg-[#0052ff] text-white shadow" : "text-[#505f76] hover:bg-[#eceef0]/65"
            }`}
          >
            سنة
          </button>
        </div>
      </section>

      {/* Stats Cards Bento Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total expenses with micro comparison tag */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <Coins className="w-5 h-5" />
            </span>
            <span className="text-emerald-500 text-xs font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12%</span>
            </span>
          </div>
          <div className="mt-6 space-y-1">
            <p className="text-xs text-slate-400 font-semibold">إجمالي المصروفات</p>
            <h3 className="text-2xl font-black text-blue-600 tracking-tight">12,450.00 ر.س</h3>
          </div>
        </div>

        {/* Top category consumed */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2.5 bg-slate-50 rounded-xl text-slate-600">
              <Grid className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-6 space-y-1">
            <p className="text-xs text-slate-400 font-semibold">الفئة الأكثر استهلاكاً</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">المواد الغذائية</h3>
          </div>
        </div>

        {/* Count of captured invoices */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2.5 bg-slate-50 rounded-xl text-slate-500">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-6 space-y-1">
            <p className="text-xs text-slate-400 font-semibold">عدد الفواتير الممسوحة</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">48 فاتورة</h3>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Spending trend columns graph bar */}
        <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-md font-bold text-slate-800">تريند الإنفاق الشهري</h3>
            <span className="text-xs text-slate-400 font-medium">خطوة سريعة</span>
          </div>

          {/* Graphical display */}
          <div className="h-64 flex items-end justify-between gap-3 px-4 relative mt-8">
            {barData.map((bar, idx) => {
              const isSelected = hoveredBar === idx;
              return (
                <div
                  key={bar.name}
                  onClick={() => setHoveredBar(idx)}
                  className="flex-1 flex flex-col justify-end items-center h-full group cursor-pointer relative"
                >
                  {/* Floating value tooltip */}
                  {isSelected && (
                    <div className="absolute top-0 bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-md shadow-md animate-bounce">
                      {bar.value}k ر.س
                    </div>
                  )}

                  {/* Vertical bar capsule */}
                  <div
                    style={{ height: bar.height }}
                    className={`w-full max-w-10 rounded-t-xl transition-all duration-300 relative ${
                      isSelected
                        ? "bg-blue-600 shadow-lg shadow-blue-100"
                        : "bg-blue-50 hover:bg-blue-100"
                    }`}
                  />
                  <span className="text-[11px] text-slate-400 mt-2 font-medium">{bar.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side category weightings progress block */}
        <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-md font-bold text-slate-800 font-sans">توزيع الفئات</h3>
          
          <div className="space-y-6">
            
            {/* Food items */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border-[5px] border-[#0052ff] flex-shrink-0" />
              <div className="flex-grow space-y-1">
                <div className="flex justify-between text-xs font-semibold text-neutral-700">
                  <span>مواد غذائية</span>
                  <span>45%</span>
                </div>
                <div className="w-full bg-[#f2f4f6] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#0052ff] h-full w-[45%] rounded-full" />
                </div>
              </div>
            </div>

            {/* Travel / Fuel */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border-[5px] border-[#bec6e0] flex-shrink-0" />
              <div className="flex-grow space-y-1">
                <div className="flex justify-between text-xs font-semibold text-neutral-700">
                  <span>نقل ومواصلات</span>
                  <span>25%</span>
                </div>
                <div className="w-full bg-[#f2f4f6] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#bec6e0] h-full w-[25%] rounded-full" />
                </div>
              </div>
            </div>

            {/* Fun / Entertainment */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border-[5px] border-amber-400 flex-shrink-0" />
              <div className="flex-grow space-y-1">
                <div className="flex justify-between text-xs font-semibold text-neutral-700">
                  <span>ترفيه</span>
                  <span>20%</span>
                </div>
                <div className="w-full bg-[#f2f4f6] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-[20%] rounded-full" />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Top visited vendors list */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 px-1">المتاجر الأكثر زيارة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card Othaim */}
          <div className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">أسواق العثيم</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">12 عملية شرائية</p>
              </div>
            </div>
            <div className="text-left flex flex-col items-end">
              <p className="text-[10px] text-slate-400 font-semibold mb-0.5">القيمة الإجمالية</p>
              <p className="text-xs font-extrabold text-blue-600 tracking-tight">3,420.50 ر.س</p>
            </div>
          </div>

          {/* Card Aldrees */}
          <div className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">محطة الدريس</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">8 عمليات شرائية</p>
              </div>
            </div>
            <div className="text-left flex flex-col items-end">
              <p className="text-[10px] text-slate-400 font-semibold mb-0.5">القيمة الإجمالية</p>
              <p className="text-xs font-extrabold text-blue-600 tracking-tight">1,200.00 ر.س</p>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
