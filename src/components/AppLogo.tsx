import React from "react";
import { ReceiptText, ScanLine } from "lucide-react";

interface AppLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function AppLogo({ size = "md", className = "" }: AppLogoProps) {
  const sizes = {
    sm: "w-9 h-9 rounded-2xl",
    md: "w-16 h-16 rounded-3xl",
    lg: "w-20 h-20 rounded-3xl"
  };
  const receiptSizes = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10"
  };
  const scanSizes = {
    sm: "w-7 h-7",
    md: "w-12 h-12",
    lg: "w-14 h-14"
  };

  return (
    <div
      className={`${sizes[size]} relative flex items-center justify-center overflow-hidden bg-[#0052ff] text-white shadow-[0_16px_40px_rgba(0,82,255,0.30)] ${className}`}
      aria-label="smart scan"
    >
      <ReceiptText className={`${receiptSizes[size]} relative z-10`} />
      <ScanLine className={`${scanSizes[size]} absolute text-white/25 -bottom-2 -left-2`} />
      <div className="absolute inset-x-3 top-2 h-px bg-white/50" />
    </div>
  );
}
