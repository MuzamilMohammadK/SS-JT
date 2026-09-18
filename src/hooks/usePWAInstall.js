import { useState, useEffect } from "react";
import toast from "react-hot-toast";

let globalDeferredPrompt = null;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check for iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      toast.success("Shivaayaha Ledger installed as an app!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast(
          "To install on iOS: Tap the Share button (⎋) in Safari and select 'Add to Home Screen' (+).",
          { icon: "📱", duration: 6000 }
        );
      } else {
        toast("App installation is supported via your browser menu (Add to Home Screen / Install).", {
          icon: "ℹ️",
        });
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
    }
  };

  return {
    isInstallable: !!deferredPrompt || isIOS,
    hasNativePrompt: !!deferredPrompt,
    isInstalled,
    isIOS,
    installApp,
  };
}
