import { useRegisterSW } from "virtual:pwa-register/react";
import toast from "react-hot-toast";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Registers the service worker and shows a toast
 * when a new version of the app is available.
 */
export function usePWA() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("[PWA] Service Worker registered:", r);
    },
    onRegisterError(error) {
      console.error("[PWA] Service Worker registration error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold text-sm text-slate-100">Update Available</p>
              <p className="text-xs text-slate-400 mt-0.5">
                A new version of the app is ready.
              </p>
            </div>
            <button
              onClick={() => {
                updateServiceWorker(true);
                toast.dismiss(t.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Update
            </button>
          </div>
        ),
        {
          duration: Infinity,
          id: "pwa-update",
          style: {
            background: "#1e293b",
            color: "#f1f5f9",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "12px",
            maxWidth: "360px",
          },
        }
      );
      setNeedRefresh(false);
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);
}
