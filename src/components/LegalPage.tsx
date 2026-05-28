import React from "react";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import AppLogo from "./AppLogo";

type LegalPageType = "privacy" | "terms";

interface LegalPageProps {
  page: LegalPageType;
  onBack: () => void;
}

const content = {
  privacy: {
    icon: ShieldCheck,
    title: "سياسة الخصوصية",
    intro: "نوضح هنا كيف يتعامل smart scan مع بيانات الفواتير وحساب Google عند استخدام التطبيق.",
    sections: [
      {
        heading: "البيانات التي نستخدمها",
        body: "قد يستخدم التطبيق صورة الفاتورة، الحقول المستخرجة، وبيانات الحساب اللازمة لتسجيل الدخول وربط Google Sheets."
      },
      {
        heading: "الغرض من المعالجة",
        body: "تستخدم البيانات لتحليل الفواتير، حفظ النتائج، مزامنتها مع Google Sheets، وتحسين تجربة إدارة المصاريف داخل التطبيق."
      },
      {
        heading: "التحكم في بياناتك",
        body: "يمكنك تسجيل الخروج، فصل ربط Google، وحذف أو تعديل الفواتير والحقول المحفوظة من داخل التطبيق متى احتجت."
      }
    ]
  },
  terms: {
    icon: FileText,
    title: "شروط الاستخدام",
    intro: "باستخدام smart scan فأنت توافق على استخدام التطبيق بطريقة مسؤولة ومراجعة البيانات قبل اعتمادها.",
    sections: [
      {
        heading: "دقة النتائج",
        body: "يعتمد المسح الذكي على جودة الصورة والبيانات المتاحة، لذلك يجب مراجعة القيم المستخرجة قبل الحفظ أو المزامنة."
      },
      {
        heading: "ربط الخدمات",
        body: "عند ربط Google Sheets، تمنح التطبيق الصلاحيات اللازمة لإنشاء أو تحديث الجداول التي تختارها للمزامنة."
      },
      {
        heading: "الاستخدام المقبول",
        body: "يلتزم المستخدم بعدم رفع محتوى مخالف أو استخدام التطبيق بطريقة تضر بالخدمات المتصلة أو حسابات الآخرين."
      }
    ]
  }
};

export default function LegalPage({ page, onBack }: LegalPageProps) {
  const details = content[page];
  const Icon = details.icon;

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-slate-900 px-4 py-6">
      <main className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-[28px] shadow-[0_24px_80px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size="sm" />
            <div>
              <p className="text-xs font-black text-[#0052ff]">smart scan</p>
              <h1 className="text-2xl font-black">{details.title}</h1>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-4 bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <div className="w-11 h-11 rounded-2xl bg-white text-[#0052ff] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm leading-7 text-slate-600">{details.intro}</p>
          </div>

          <div className="space-y-4">
            {details.sections.map((section) => (
              <section key={section.heading} className="border border-slate-100 rounded-2xl p-5">
                <h2 className="text-base font-black mb-2">{section.heading}</h2>
                <p className="text-sm leading-7 text-slate-600">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
