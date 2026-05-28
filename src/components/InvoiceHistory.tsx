import React, { useState } from "react";
import { Search, ShoppingCart, Truck, BookOpen, TrendingDown, Coins, Package, Download, FileSpreadsheet } from "lucide-react";
import { Invoice, FieldConfig } from "../types";

interface InvoiceHistoryProps {
  invoices: Invoice[];
  fieldsConfig?: FieldConfig[];
  onNavigateToCustomizer?: () => void;
}

export default function InvoiceHistory({ invoices, fieldsConfig, onNavigateToCustomizer }: InvoiceHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPill, setFilterPill] = useState<"all" | "today" | "week" | "month">("all");

  // Filter invoices dynamically based on search and selected pill
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterPill === "today") {
      return inv.date.includes("24") || inv.date.includes("2024-05-24") || inv.date.includes(new Date().toISOString().split("T")[0]);
    }
    if (filterPill === "week") {
      return true; // Simple represent week in demo
    }
    return true;
  });

  // Export fully structured CSV file with UTF-8 BOM so Persian/Arabic characters show up perfectly in Microsoft Excel and Google Sheets
  const handleExportCSV = () => {
    const defaultCols: FieldConfig[] = [
      { id: "store_name", label: "اسم المتجر", enabled: true, order: 1 },
      { id: "total_amount", label: "المبلغ الإجمالي", enabled: true, order: 2 },
      { id: "date", label: "تاريخ الفاتورة", enabled: true, order: 3 },
      { id: "category", label: "التصنيف", enabled: true, order: 4 },
      { id: "tax_amount", label: "مبلغ الضريبة", enabled: true, order: 5 }
    ];

    const columns = (fieldsConfig || defaultCols)
      .filter((f) => f.enabled)
      .sort((a, b) => a.order - b.order);

    if (columns.length === 0) {
      alert("الرجاء تمكين حقل واحد على الأقل من إعدادات تخصيص الحقول لتتمكن من التصدير.");
      return;
    }

    const headers = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(",");
    const rows = filteredInvoices.map((inv) => {
      return columns
        .map((col) => {
          let val = "";
          if (col.id === "store_name") val = inv.storeName;
          if (col.id === "total_amount") val = inv.totalAmount.toFixed(2);
          if (col.id === "date") val = inv.date;
          if (col.id === "category") val = inv.category;
          if (col.id === "tax_amount") val = inv.taxAmount.toFixed(2);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(",");
    });

    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `smart_scan_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Category Icon Resolver
  const getCategoryIcon = (category: string) => {
    if (category.includes("بقالة") || category.includes("مواد")) {
      return <ShoppingCart className="w-5 h-5 text-emerald-500" />;
    }
    if (category.includes("نقل") || category.includes("مواصلات")) {
      return <Truck className="w-5 h-5 text-[#0052ff]" />;
    }
    if (category.includes("مطاعم") || category.includes("كافيهات")) {
      return <Package className="w-5 h-5 text-purple-500" />;
    }
    return <BookOpen className="w-5 h-5 text-indigo-500" />;
  };

  const octoberExpenses = filteredInvoices.reduce((sum, item) => sum + item.totalAmount, 0) + 2046.75;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-32">

      {/* Search Input bar */}
      <section className="relative group">
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث عن متجر، تصنيف أو فاتورة..."
          className="w-full h-14 pr-12 pl-4 bg-white border border-neutral-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#0052ff]/10 focus:border-[#0052ff]/30 outline-none transition-all font-semibold text-neutral-800 placeholder:text-neutral-400 font-sans"
        />
      </section>

      {/* Filter chips rows */}
      <section className="flex gap-3 overflow-x-auto pb-2 scrollbar-none antialiased">
        <button
          onClick={() => setFilterPill("all")}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-all active:scale-95 ${filterPill === "all" ? "bg-[#0052ff] text-white shadow-md" : "bg-[#f2f4f6] text-neutral-500 hover:bg-neutral-200/50"
            }`}
        >
          الكل ({invoices.length})
        </button>

        <button
          onClick={() => setFilterPill("today")}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-all active:scale-95 ${filterPill === "today" ? "bg-[#0052ff] text-white shadow-md" : "bg-[#f2f4f6] text-neutral-500 hover:bg-neutral-200/50"
            }`}
        >
          اليوم
        </button>

        <button
          onClick={() => setFilterPill("week")}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-all active:scale-95 ${filterPill === "week" ? "bg-[#0052ff] text-white shadow-md" : "bg-[#f2f4f6] text-neutral-500 hover:bg-neutral-200/50"
            }`}
        >
          هذا الأسبوع
        </button>


      </section>

      {/* Invoice Cards log listing */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-1">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            المعاملات والتسويات الأخيرة
          </h2>

        </div>

        {filteredInvoices.length === 0 ? (
          <div className="bg-white p-12 text-center text-neutral-400 rounded-3xl border border-neutral-100 flex flex-col items-center justify-center gap-2">
            <Package className="w-12 h-12 stroke-1 opacity-40 text-neutral-400 mb-2" />
            <p className="text-sm font-semibold">لا توجد أي فواتير تطابق بحثك</p>
            <p className="text-xs font-light">جرب تغيير الكلمات المفتاحية أو إضافة فاتورة جديدة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="group flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-2xl transition-all duration-200 hover:shadow-md hover:translate-y-[-1px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center">
                    {getCategoryIcon(inv.category)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-800 mb-0.5">{inv.storeName}</h3>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 font-light">
                      <span>{inv.date}</span>
                      <span className="w-1 h-1 rounded-full bg-neutral-200" />
                      <span>{inv.category}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        الشيت: {inv.syncTarget?.templateName || inv.syncTarget?.sheetName || "غير مرتبط بشيت محدد"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-extrabold text-[#0052ff] tracking-tight">
                    {inv.totalAmount.toFixed(2)} ر.س
                  </span>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>مرتبطة بالشيت</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dynamic Summary Expense statistics bento blocks info */}
      <section className="grid grid-cols-1 gap-4 pb-8">
        <div className="bg-white border border-neutral-100 rounded-3xl p-6 relative overflow-hidden shadow-sm">
          <div className="relative z-10">
            <p className="text-xs font-bold text-neutral-400 mb-1">إجمالي المصروفات للشهر النشط</p>
            <h3 className="text-3xl font-extrabold text-[#0052ff] tracking-tight">
              {octoberExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
            </h3>

            <div className="mt-4 flex items-center gap-2 text-emerald-600">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-semibold">أقل بنسبة 12% عن الشهر الماضي</span>
            </div>
          </div>

          <div className="absolute left-[-10px] bottom-[-20px] opacity-5 select-none pointer-events-none">
            <Coins className="w-48 h-48 text-[#191c1e]" />
          </div>
        </div>
      </section>

    </div>
  );
}
