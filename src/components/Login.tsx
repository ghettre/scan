import React, { useState } from "react";
import {
  Loader2,
  LogIn,
  Sparkles
} from "lucide-react";

import { nativeGoogleSignIn } from "../lib/supabaseAuth";
import AppLogo from "./AppLogo";

interface LoginProps {
  onLoginSuccess: (email: string, name: string) => void;
  onOpenLegal: (page: "privacy" | "terms") => void;
}

export default function Login({ onOpenLegal }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setError("");

    try {
      setLoading(true);
      await nativeGoogleSignIn();
    } catch (err) {
      console.error(err);
      setError("فشل تسجيل الدخول بواسطة Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center px-4">
      <main className="w-full max-w-md bg-white rounded-[32px] shadow-[0_24px_80px_rgba(15,23,42,0.10)] border border-slate-100 p-8 md:p-10">

        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-10">
          <AppLogo size="md" className="mb-5" />

          <div className="inline-flex items-center gap-2 bg-[#0052ff]/10 text-[#0052ff] px-4 py-2 rounded-full text-xs font-black mb-5">
            <Sparkles className="w-4 h-4" />
            <span>smart scan</span>
          </div>

          <h1 className="text-4xl font-black text-slate-900 mb-3">
            ابدأ الآن
          </h1>

          <p className="text-sm text-slate-500 leading-7 max-w-xs">
            سجّل الدخول أو أنشئ حساباً جديداً باستخدام Google للمتابعة
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm p-4 rounded-2xl mb-5 text-center">
            {error}
          </div>
        )}

        {/* Google Button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full h-14 bg-[#0052ff] hover:bg-[#0042cc] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-[0_12px_30px_rgba(0,82,255,0.25)] disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <div className="w-7 h-7 rounded-full bg-white text-[#0052ff] flex items-center justify-center font-black">
                G
              </div>

              <span>المتابعة باستخدام Google</span>

              <LogIn className="w-5 h-5" />
            </>
          )}
        </button>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-4 text-xs font-bold text-slate-400">
          <button
            onClick={() => onOpenLegal("privacy")}
            className="hover:text-[#0052ff] transition-colors cursor-pointer"
          >
            سياسة الخصوصية
          </button>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <button
            onClick={() => onOpenLegal("terms")}
            className="hover:text-[#0052ff] transition-colors cursor-pointer"
          >
            شروط الاستخدام
          </button>
        </div>
      </main>
    </div>
  );
}
