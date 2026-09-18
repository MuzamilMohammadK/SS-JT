import { useState } from "react";
import { LogOut, Gem, Menu, X, ChevronDown, Download } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import InstallModal from "./InstallModal";
import toast from "react-hot-toast";

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const {
    isInstallable,
    isInstalled,
    installApp,
    isModalOpen,
    closeModal,
    isIOS,
    hasNativePrompt,
  } = usePWAInstall();
  const [menuOpen, setMenuOpen] = useState(false);



  const handleLogout = async () => {
    try {
      setMenuOpen(false);
      await logout();
      toast.success("Logged out successfully.");
    } catch {
      toast.error("Failed to log out. Please try again.");
    }
  };

  // First letter of email as avatar
  const avatar = currentUser?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/60 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Brand ── */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
              <Gem className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-white font-bold text-sm sm:text-[15px] tracking-wide">
                Shivaayaha Silks &amp; Jari Trades
              </p>
              <p className="text-indigo-400 text-[10px] font-semibold tracking-widest uppercase">
                Ledger Management System
              </p>
            </div>
          </div>

          {/* ── Desktop user menu ── */}
          <div className="hidden sm:flex items-center gap-3">
            {isInstallable && !isInstalled && (
              <button
                onClick={installApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs font-semibold transition-all duration-200"
                title="Install App on Device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                {avatar}
              </div>
              <span className="text-slate-300 text-xs font-medium max-w-[180px] truncate">
                {currentUser?.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-sm font-medium transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            className="sm:hidden btn-icon"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* ── Mobile dropdown ── */}
        {menuOpen && (
          <div className="sm:hidden border-t border-slate-800/60 py-4 space-y-3 animate-slide-in-down">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                {avatar}
              </div>
              <span className="text-slate-300 text-sm truncate">{currentUser?.email}</span>
            </div>
            {isInstallable && !isInstalled && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  installApp();
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-sm font-semibold"
              >
                <Download className="w-4 h-4" />
                Install Web App
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>

      {/* ── Install Instructions Modal ── */}
      <InstallModal
        isOpen={isModalOpen}
        onClose={closeModal}
        isIOS={isIOS}
        onNativeInstall={installApp}
        hasNativePrompt={hasNativePrompt}
      />
    </header>
  );

}
