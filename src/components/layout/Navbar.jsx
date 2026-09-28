import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LogOut, Menu, X, Download, Users, Receipt, BookOpen, BarChart3, Building2, Settings } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import InstallModal from "./InstallModal";
import SettingsModal from "./SettingsModal";
import toast from "react-hot-toast";

const DESKTOP_NAV = [
  { to: "/parties",            icon: Users,     label: "Parties"   },
  { to: "/registered-parties", icon: Building2, label: "Registered Parties" },
  { to: "/ledger",             icon: Receipt,   label: "Ledger"    },
  { to: "/history",            icon: BookOpen,  label: "History"   },
  { to: "/analytics",          icon: BarChart3, label: "Analytics" },
];

export default function Navbar() {
  const { currentUser } = useAuth();
  const {
    isInstallable, isInstalled, installApp,
    isModalOpen, closeModal, isIOS, hasNativePrompt,
  } = usePWAInstall();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const avatar = currentUser?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/60 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">

          {/* ── Brand ── */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 md:w-11 md:h-11 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 border border-white/10">
              <img src="/logo_2.jpg" alt="Shivaayaha Logo" className="w-full h-full object-cover" />
            </div>
            <div className="leading-tight">
              <p className="text-white font-bold text-sm md:text-[15px] tracking-wide">
                Shivaayaha Silks & Jari Trades
              </p>
              <p className="text-indigo-400 text-[9px] md:text-[10px] font-semibold tracking-widest uppercase hidden sm:block">
                Ledger Management System
              </p>
            </div>
          </div>

          {/* ── Desktop Nav Links ── */}
          <nav className="hidden md:flex items-center gap-1">
            {DESKTOP_NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* ── Right Actions ── */}
          <div className="flex items-center gap-2">
            {/* Install App (desktop only) */}
            {isInstallable && !isInstalled && (
              <button
                onClick={installApp}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs font-semibold transition-all duration-200"
                title="Install App on Device"
              >
                <Download className="w-3.5 h-3.5" />
                Install App
              </button>
            )}

            {/* User avatar + email (desktop) — Click to open Settings */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/40 transition-all cursor-pointer group"
              title="Click to open Account Settings"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                {avatar}
              </div>
              <span className="text-slate-300 group-hover:text-white text-xs font-medium max-w-[140px] truncate transition-colors">
                {currentUser?.email}
              </span>
            </button>

            {/* Settings (desktop) */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 hover:text-white text-xs font-medium transition-all duration-200"
              title="Account Settings & Session"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Settings</span>
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden btn-icon"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown ── */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-800/60 py-3 space-y-2 animate-slide-in-down">
            <div
              onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                {avatar}
              </div>
              <span className="text-slate-300 text-sm truncate flex-1">{currentUser?.email}</span>
              <Settings className="w-4 h-4 text-indigo-400" />
            </div>
            {isInstallable && !isInstalled && (
              <button
                onClick={() => { setMenuOpen(false); installApp(); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-sm font-semibold"
              >
                <Download className="w-4 h-4" />
                Install Web App
              </button>
            )}
            <button
              onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 hover:text-white text-sm font-medium"
            >
              <Settings className="w-4 h-4 text-indigo-400" />
              Settings &amp; Logout
            </button>
          </div>
        )}
      </div>

      <InstallModal
        isOpen={isModalOpen}
        onClose={closeModal}
        isIOS={isIOS}
        onNativeInstall={installApp}
        hasNativePrompt={hasNativePrompt}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  );
}
