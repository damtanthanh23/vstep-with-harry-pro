import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(checkStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable, isIOS, isStandalone, promptInstall };
}

interface PWAInstallButtonProps {
  isCollapsed?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ isCollapsed = false }) => {
  const { isInstallable, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showModal, setShowModal] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      await promptInstall();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {!isOnline && !isCollapsed && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold">
          <WifiOff className="h-4 w-4 shrink-0 text-[#FF9600]" />
          <span className="truncate">Chế độ Offline: Đã lưu trên máy</span>
        </div>
      )}

      {!isStandalone && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-[#1899D6] dark:text-[#1CB0F6] bg-[#DDF4FF]/60 dark:bg-sky-950/40 border-2 border-[#1CB0F6]/40 hover:bg-[#DDF4FF] dark:hover:bg-sky-900/50 border-b-4 border-b-[#1899D6]/50 active:translate-y-0.5 transition-all cursor-pointer group ${
            isCollapsed ? 'justify-center px-2' : ''
          }`}
          title="Cài đặt ứng dụng VSTEP Tutor về máy (Hỗ trợ Offline)"
        >
          <Download className="h-4 w-4 shrink-0 text-[#1CB0F6] group-hover:scale-110 transition-transform" />
          {!isCollapsed && (
            <span className="truncate flex-1 text-left">Cài App VSTEP về máy</span>
          )}
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-[#DDF4FF] dark:bg-sky-950/60 border-2 border-[#1CB0F6] flex items-center justify-center text-[#1CB0F6]">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Cài đặt App VSTEP Tutor
                </h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Mở nhanh từ màn hình chính & tự động lưu bài khi mất mạng
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                <p className="font-black text-slate-900 dark:text-white">
                  Hướng dẫn cài trên iPhone / iPad (Safari):
                </p>
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-[#1CB0F6] text-white font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Nhấn vào nút <strong>Chia sẻ (Share)</strong>{' '}
                    <Share className="inline h-4 w-4 text-[#1CB0F6]" /> ở thanh công cụ Safari.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-[#1CB0F6] text-white font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>{' '}
                    <PlusSquare className="inline h-4 w-4 text-[#58CC02]" />.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-[#58CC02] text-white font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Nhấn <strong>Thêm (Add)</strong> ở góc phải trên cùng để hoàn tất.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                <p className="font-black text-slate-900 dark:text-white">
                  Hướng dẫn cài đặt trên Máy tính / Android:
                </p>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#58CC02] shrink-0 mt-0.5" />
                  <span>
                    Nếu đang mở trong khung xem trước, hãy mở trang ở <strong>Tab trình duyệt mới</strong>, sau đó nhấn biểu tượng <strong>Cài đặt (Install)</strong> trên thanh địa chỉ Chrome/Edge.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#58CC02] shrink-0 mt-0.5" />
                  <span>
                    Trên điện thoại Android: Nhấn biểu tượng <strong>3 chấm (⋮)</strong> ở góc phải trình duyệt và chọn <strong>Cài đặt ứng dụng (Install app)</strong>.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 rounded-2xl bg-[#58CC02] hover:bg-[#46A302] text-white font-black text-xs border-b-4 border-[#3C8C02] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
