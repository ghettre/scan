import React, { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { CameraPreview, CameraPreviewOptions } from "@capacitor-community/camera-preview";
import { Image, X, Zap, RefreshCw, Loader2, FlipVertical } from "lucide-react";
import { FieldConfig } from "../types";
import { apiFetch } from "../lib/api";

interface ScannerContainerProps {
  onClose: () => void;
  onScanComplete: (result: any, imageUrl: string) => void;
  fieldsConfig?: FieldConfig[];
  userId?: string;
}

const isNative = Capacitor.isNativePlatform();

export default function ScannerContainer({ onClose, onScanComplete, fieldsConfig, userId }: ScannerContainerProps) {
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState("نقوم باستخراج البيانات من الفاتورة بذكاء");
  const [errorMessage, setErrorMessage] = useState("");
  const [cameraStarted, setCameraStarted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const nativeCameraStartedRef = useRef(false);

  useEffect(() => {
    nativeCameraStartedRef.current = cameraStarted && isNative;
  }, [cameraStarted]);

  // ─── Start Camera ────────────────────────────────────────────────────
  useEffect(() => {
    if (isNative) {
      document.documentElement.classList.add("native-camera-active");
      document.body.classList.add("native-camera-active");
    }

    if (isNative) {
      requestAnimationFrame(() => {
        startNativeCamera();
      });
    } else {
      startWebCamera();
    }

    return () => {
      stopCamera();
      document.documentElement.classList.remove("native-camera-active");
      document.body.classList.remove("native-camera-active");
    };
  }, []);

  const startNativeCamera = async () => {
    try {
      setCameraStarted(false);
      if (nativeCameraStartedRef.current) {
        try { await CameraPreview.stop(); } catch {}
        nativeCameraStartedRef.current = false;
      }

      const options: CameraPreviewOptions = {
        position: "rear",
        parent: "cameraPreviewContainer",
        className: "cameraPreview",
        x: 0,
        y: 0,
        width: Math.round(window.screen.width || window.innerWidth),
        height: Math.round(window.screen.height || window.innerHeight),
        toBack: true,
        enableZoom: true,
        lockAndroidOrientation: true,
        disableExifHeaderStripping: true,
      };
      await CameraPreview.start(options);
      const started = await CameraPreview.isCameraStarted().catch(() => ({ value: true }));
      if (!started.value) throw new Error("Camera preview did not start");
      nativeCameraStartedRef.current = true;
      setCameraStarted(true);
    } catch (err: any) {
      console.error("Native camera failed:", err);
      nativeCameraStartedRef.current = false;
      setCameraStarted(false);
      const message = String(err?.message || err || "");
      if (message.toLowerCase().includes("permission")) {
        setErrorMessage("يرجى منح صلاحية الكاميرا للتطبيق من إعدادات Android ثم المحاولة مرة أخرى.");
      } else {
        setErrorMessage(`تعذر تشغيل الكاميرا: ${message}`);
      }
    }
  };

  const startWebCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage("متصفحك لا يدعم الكاميرا. استخدم زر الاستيراد من المعرض.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      webStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStarted(true);
    } catch (err: any) {
      console.warn("Web camera failed:", err);
      if (err?.name === "NotAllowedError") {
        setErrorMessage("يرجى منح صلاحية الوصول إلى الكاميرا في إعدادات المتصفح.");
      } else {
        setErrorMessage(`تعذر تشغيل الكاميرا: ${err?.message || err}`);
      }
    }
  };

  const stopCamera = async () => {
    if (isNative && nativeCameraStartedRef.current) {
      try { await CameraPreview.stop(); } catch {}
      nativeCameraStartedRef.current = false;
    }
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach(t => t.stop());
      webStreamRef.current = null;
    }
    setCameraStarted(false);
  };

  // ─── Flash Toggle ────────────────────────────────────────────────────
  const handleToggleFlash = async () => {
    const next = !isFlashOn;
    setIsFlashOn(next);
    if (isNative) {
      try { await CameraPreview.setFlashMode({ flashMode: next ? "on" : "off" }); } catch {}
    }
  };

  // ─── Flip Camera ─────────────────────────────────────────────────────
  const handleFlipCamera = async () => {
    if (isNative) {
      try {
        await CameraPreview.flip();
        setIsFrontCamera(prev => !prev);
      } catch {}
    } else {
      // Toggle facing mode on web
      const stream = webStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      const nextFacing = isFrontCamera ? "environment" : "user";
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing },
          audio: false,
        });
        webStreamRef.current = newStream;
        if (videoRef.current) videoRef.current.srcObject = newStream;
        setIsFrontCamera(prev => !prev);
      } catch {}
    }
  };

  // ─── Capture ─────────────────────────────────────────────────────────
  const handleShutter = async () => {
    if (isProcessing || !cameraStarted) return;

    let base64Image = "";

    try {
      if (isNative) {
        // Capture from native camera plugin
        const result = await CameraPreview.capture({ quality: 85 });
        base64Image = `data:image/jpeg;base64,${result.value}`;
      } else {
        // Capture from web video element
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        base64Image = canvas.toDataURL("image/jpeg", 0.9);
      }
    } catch (err: any) {
      setErrorMessage(`فشل التقاط الصورة: ${err?.message || err}`);
      return;
    }

    if (base64Image) {
      sendToBackend(base64Image, undefined);
    }
  };

  // ─── File Upload ─────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => sendToBackend(reader.result as string, undefined);
    reader.readAsDataURL(file);
  };

  // ─── Sample Invoice ───────────────────────────────────────────────────
  const handleSelectSample = (sampleId: string) => sendToBackend("", sampleId);

  // ─── Backend Scan ─────────────────────────────────────────────────────
  const sendToBackend = async (imageData: string, sampleId?: string) => {
    setIsProcessing(true);
    setErrorMessage("");

    // Stop native camera while processing to free memory
    if (isNative && nativeCameraStartedRef.current) {
      try { await CameraPreview.stop(); } catch {}
      nativeCameraStartedRef.current = false;
      setCameraStarted(false);
    }

    const messages = [
      "جاري قراءة الفاتورة...",
      "جاري تحليل الحسابات والضرائب...",
      "نقوم باستخراج البيانات بذكاء...",
    ];
    let msgIndex = 0;
    const interval = setInterval(() => {
      if (msgIndex < messages.length) setProcessingText(messages[msgIndex++]);
    }, 900);

    try {
      const response = await apiFetch("/api/scan-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: sampleId ? undefined : imageData, sampleId, fieldsConfig, userId }),
      });

      const data = await response.json();
      if (response.ok && data) {
        onScanComplete(data, imageData);
      } else {
        throw new Error(data.error || "فشل مسح الفاتورة الذكي");
      }
    } catch (err: any) {
      console.error("Scanning failed:", err);
      setErrorMessage(err?.message || "فشل معالجة الفاتورة؛ يمكنك المحاولة مرة أخرى أو الإدخال يدوياً.");
      // Restart camera after failure
      if (isNative) {
        setTimeout(() => startNativeCamera(), 500);
      }
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
    }
  };

  const handleClose = async () => {
    await stopCamera();
    onClose();
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden scanner-native-camera"
      style={{ background: isNative ? "transparent" : "black" }}
    >
      {/* Native camera slot — the CameraPreview plugin renders into this div */}
      {isNative && (
        <div
          id="cameraPreviewContainer"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background: "transparent",
          }}
        />
      )}

      {/* Web camera <video> element */}
      {!isNative && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* ── Dark overlay around the scanner frame ── */}
      <div className="absolute inset-0 z-10 pointer-events-none" style={{
        background: "radial-gradient(ellipse 65% 55% at 50% 42%, transparent 80%, rgba(0,0,0,0.72) 100%)"
      }} />

      {/* ── HUD Header ── */}
      <header className="relative z-20 p-4 flex justify-between items-center">
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-md border border-white/15 cursor-pointer"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <h2 className="text-sm font-bold text-white/90 bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10">
          مستشعر الفواتير الذكي
        </h2>

        <button
          onClick={handleToggleFlash}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors cursor-pointer backdrop-blur-md border border-white/15 ${
            isFlashOn ? "bg-yellow-400/90 text-black" : "bg-black/40 text-white hover:bg-black/60"
          }`}
        >
          <Zap className="w-5 h-5" />
        </button>
      </header>

      {/* ── Scanner Viewfinder ── */}
      <main className="relative z-20 flex-grow flex flex-col items-center justify-center px-4">
        {/* Scanner frame */}
        <div className="w-full max-w-xs aspect-[3/4] relative">
          {/* Animated corner markers */}
          {[
            "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
            "top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
            "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl",
            "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
          ].map((cls, i) => (
            <div key={i} className={`absolute w-8 h-8 border-[#0052ff] ${cls}`} />
          ))}

          {/* Scan line animation */}
          <div
            className="absolute left-2 right-2 h-0.5 bg-[#0052ff] opacity-90 shadow-[0_0_12px_3px_#0052ff]"
            style={{ animation: "scanLine 2.5s ease-in-out infinite" }}
          />
        </div>

        {/* Instruction pill */}
        <div className="mt-5 text-center">
          <p className="bg-black/50 text-white text-xs px-5 py-2 rounded-full backdrop-blur-md font-medium border border-white/10">
            {cameraStarted ? "ضع الفاتورة داخل الإطار" : "جاري تشغيل الكاميرا..."}
          </p>
        </div>

        {/* Sample invoice quick-picks */}
        <div className="z-10 mt-4 bg-black/50 backdrop-blur-lg border border-white/10 rounded-2xl p-3 w-full max-w-xs">
          <p className="text-center text-xs text-neutral-300 font-medium mb-2">
            أو اختر فاتورة نموذجية للتجربة:
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "panda", label: "🛒 بنده" },
              { id: "petromin", label: "⛽ بترومين" },
              { id: "nozomi", label: "🍣 نوزومي" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleSelectSample(id)}
                disabled={isProcessing}
                className="px-2 py-2 text-xs bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-all cursor-pointer text-center text-white disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Error badge */}
        {errorMessage && (
          <div className="absolute top-24 left-4 right-4 z-30 bg-red-600/95 text-white text-xs p-3 rounded-2xl shadow-xl backdrop-blur text-center flex items-center justify-center gap-2 border border-red-400/30">
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
            <button onClick={() => setErrorMessage("")} className="font-bold shrink-0 underline cursor-pointer">
              ×
            </button>
          </div>
        )}
      </main>

      {/* ── Shutter Controls ── */}
      <footer className="relative z-20 pb-8 pt-4 px-6 flex items-center justify-between">
        {/* Gallery picker */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex flex-col items-center gap-1 cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95">
            <Image className="w-5 h-5" />
          </div>
          <span className="text-xs text-white/70">المعرض</span>
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        {/* Main shutter button */}
        <button
          onClick={handleShutter}
          disabled={isProcessing || !cameraStarted}
          className="relative w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center cursor-pointer transition-transform active:scale-90 disabled:opacity-40"
        >
          <div className="w-full h-full bg-white rounded-full shadow-xl" />
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#0052ff] animate-spin" />
            </div>
          )}
        </button>

        {/* Flip camera */}
        <button
          onClick={handleFlipCamera}
          disabled={isProcessing}
          className="flex flex-col items-center gap-1 cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95">
            <FlipVertical className="w-5 h-5" />
          </div>
          <span className="text-xs text-white/70">قلب</span>
        </button>
      </footer>

      {/* Hidden canvas for web capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-[#031427]/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center text-center p-6">
          <div className="relative w-28 h-28 mb-6">
            <div className="w-full h-full rounded-full border-4 border-[#0052ff]/20 border-t-[#0052ff] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-[#0052ff] animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">جاري المعالجة...</h3>
          <p className="text-neutral-400 text-sm">{processingText}</p>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 5%;  opacity: 0.4; }
          50%  { opacity: 1; }
          100% { top: 95%; opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
