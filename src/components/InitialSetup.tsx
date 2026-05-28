import React, { useState } from "react";
import {
    FileSpreadsheet,
    Plus,
    Link as LinkIcon,
    ArrowLeft,
    CheckCircle,
    Loader2,
    Sparkles
} from "lucide-react";

interface InitialSetupProps {
    googleToken: string | null;
    onConnectGoogle: () => Promise<void>;
    onCreateNewSheet: (options?: { title?: string }) => Promise<any>;
    onSetSpreadsheetId: (id: string) => void;
    isCreatingSheet: boolean;
    onComplete: () => void;
    userName: string;
}

export default function InitialSetup({
    googleToken,
    onConnectGoogle,
    onCreateNewSheet,
    onSetSpreadsheetId,
    isCreatingSheet,
    onComplete,
    userName
}: InitialSetupProps) {
    const [step, setStep] = useState<"welcome" | "connect" | "setup">("welcome");
    const [isConnecting, setIsConnecting] = useState(false);
    const [manualSheetId, setManualSheetId] = useState("");
    const [setupMode, setSetupMode] = useState<"create" | "link">("create");

    const handleConnectGoogle = async () => {
        try {
            setIsConnecting(true);
            await onConnectGoogle();
            // After connecting, move to setup step
            setStep("setup");
        } catch (err) {
            console.error(err);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleCreateNewSheet = async () => {
        try {
            await onCreateNewSheet();
            onComplete();
        } catch (err: any) {
            alert(err.message || "فشل إنشاء جدول البيانات");
        }
    };

    const handleLinkExistingSheet = () => {
        if (!manualSheetId.trim()) {
            alert("الرجاء إدخال معرف جدول البيانات");
            return;
        }

        // Extract spreadsheetId if user pasted a full URL
        let cleanId = manualSheetId.trim();
        const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (urlMatch && urlMatch[1]) {
            cleanId = urlMatch[1];
        }

        onSetSpreadsheetId(cleanId);
        onComplete();
    };

    if (step === "welcome") {
        return (
            <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center px-4">
                <main className="w-full max-w-lg bg-white rounded-[32px] shadow-[0_24px_80px_rgba(15,23,42,0.10)] border border-slate-100 p-8 md:p-12">
                    {/* Logo */}
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-20 h-20 rounded-3xl bg-[#0052ff] text-white flex items-center justify-center shadow-[0_16px_40px_rgba(0,82,255,0.30)] mb-6">
                            <Sparkles className="w-10 h-10" />
                        </div>

                        <h1 className="text-3xl font-black text-slate-900 mb-3">
                            مرحباً بك في smart scan، {userName.split(' ')[0]}!
                        </h1>

                        <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                            نرحب بك في عالم الفواتير الذكية. لنبدأ بتجهيز بيئة العمل الخاصة بك.
                        </p>
                    </div>

                    {/* Features */}
                    <div className="space-y-4 mb-8">
                        <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-2xl">
                            <div className="w-10 h-10 rounded-xl bg-[#0052ff] flex items-center justify-center shrink-0">
                                <FileSpreadsheet className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-right">
                                <h3 className="text-sm font-bold text-slate-800 mb-1">مزامنة مع Google Sheets</h3>
                                <p className="text-xs text-slate-500">احفظ فواتيرك تلقائياً في جداول Google Sheets</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-2xl">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-right">
                                <h3 className="text-sm font-bold text-slate-800 mb-1">مسح ذكي للفواتير</h3>
                                <p className="text-xs text-slate-500">استخرج بيانات الفواتير تلقائياً باستخدام الذكاء الاصطناعي</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={() => setStep("connect")}
                        className="w-full h-14 bg-[#0052ff] hover:bg-[#0042cc] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-[0_12px_30px_rgba(0,82,255,0.25)]"
                    >
                        <span>بدء الإعداد</span>
                        <ArrowLeft className="w-5 h-5 rotate-180" />
                    </button>
                </main>
            </div>
        );
    }

    if (step === "connect") {
        return (
            <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center px-4">
                <main className="w-full max-w-lg bg-white rounded-[32px] shadow-[0_24px_80px_rgba(15,23,42,0.10)] border border-slate-100 p-8 md:p-12">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
                            <FileSpreadsheet className="w-8 h-8 text-[#0052ff]" />
                        </div>

                        <h1 className="text-2xl font-black text-slate-900 mb-3">
                            ربط Google Sheets
                        </h1>

                        <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                            اربط حساب Google Sheets الخاص بك لإنشاء أو اختيار جدول البيانات الذي ستتم مزامنة الفواتير معه.
                        </p>
                    </div>

                    {googleToken ? (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center mb-6">
                            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                            <p className="text-sm font-bold text-emerald-700">تم ربط حساب Google بنجاح!</p>
                        </div>
                    ) : (
                        <button
                            onClick={handleConnectGoogle}
                            disabled={isConnecting}
                            className="w-full h-14 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-3 rounded-2xl transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-70 mb-6"
                        >
                            {isConnecting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <img
                                        alt="Google G Logo"
                                        className="w-5 h-5 object-contain"
                                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJney2ZKXbNwvAm7HlacNAf4-0deiT7Vj2avbIrJVDXlAGx1MiJNUds8bYKBys2ZP91PUUy887_R3yLFfaU0dZkHhoBeMega5f4RMP4Lz8Vbm2lJk7Ye-gCiSXNruqlfdcQ2v6EpmSh3mO0KQv4XdzOwOWeY4eMQIAa6XNNCmxhkT-yQhHgKlDafdEcBfPYq6lQo999ksqctzGvzD2iD2mzcthCPcTdoiiuykp5bhDcH8kwSm5IFyw6GZgFXpkHjO6CEYVby5McVE"
                                        referrerPolicy="no-referrer"
                                    />
                                    <span>ربط حساب Google Sheets</span>
                                </>
                            )}
                        </button>
                    )}

                    {googleToken && (
                        <button
                            onClick={() => setStep("setup")}
                            className="w-full h-14 bg-[#0052ff] hover:bg-[#0042cc] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-[0_12px_30px_rgba(0,82,255,0.25)]"
                        >
                            <span>متابعة إلى الإعداد</span>
                            <ArrowLeft className="w-5 h-5 rotate-180" />
                        </button>
                    )}

                    <button
                        onClick={() => setStep("welcome")}
                        className="w-full mt-4 text-slate-400 hover:text-slate-600 text-sm font-bold transition-colors"
                    >
                        رجوع
                    </button>
                </main>
            </div>
        );
    }

    if (step === "setup") {
        return (
            <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center px-4">
                <main className="w-full max-w-lg bg-white rounded-[32px] shadow-[0_24px_80px_rgba(15,23,42,0.10)] border border-slate-100 p-8 md:p-12">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
                            <FileSpreadsheet className="w-8 h-8 text-[#0052ff]" />
                        </div>

                        <h1 className="text-2xl font-black text-slate-900 mb-3">
                            اختر طريقة الإعداد
                        </h1>

                        <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                            يمكنك إنشاء جدول بيانات جديد أو ربط جدول موجود.
                        </p>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => setSetupMode("create")}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${setupMode === "create"
                                    ? "bg-white text-[#0052ff] shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <Plus className="w-4 h-4 inline-block ml-1" />
                            إنشاء جديد
                        </button>
                        <button
                            onClick={() => setSetupMode("link")}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${setupMode === "link"
                                    ? "bg-white text-[#0052ff] shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <LinkIcon className="w-4 h-4 inline-block ml-1" />
                            ربط موجود
                        </button>
                    </div>

                    {setupMode === "create" ? (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                <h3 className="text-sm font-bold text-blue-800 mb-2">إنشاء جدول بيانات جديد</h3>
                                <p className="text-xs text-blue-600 mb-4">
                                    سنقوم بإنشاء جدول Google Sheets جديد مهيأ تلقائياً بأعمدة الفواتير (التاريخ، المتجر، المبلغ، الضريبة، إلخ).
                                </p>
                                <button
                                    onClick={handleCreateNewSheet}
                                    disabled={isCreatingSheet}
                                    className="w-full h-12 bg-[#0052ff] hover:bg-[#0042cc] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
                                >
                                    {isCreatingSheet ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>جاري الإنشاء...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            <span>إنشاء جدول جديد</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-2">ربط جدول بيانات موجود</h3>
                                <p className="text-xs text-slate-500 mb-4">
                                    أدخل معرف جدول البيانات (Spreadsheet ID) من رابط Google Sheets.
                                </p>
                                <input
                                    type="text"
                                    value={manualSheetId}
                                    onChange={(e) => setManualSheetId(e.target.value)}
                                    placeholder="مثال: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#0052ff] transition-colors mb-4"
                                />
                                <button
                                    onClick={handleLinkExistingSheet}
                                    className="w-full h-12 bg-[#0052ff] hover:bg-[#0042cc] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                    <span>ربط الجدول</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setStep("connect")}
                        className="w-full mt-6 text-slate-400 hover:text-slate-600 text-sm font-bold transition-colors"
                    >
                        رجوع
                    </button>
                </main>
            </div>
        );
    }

    return null;
}
