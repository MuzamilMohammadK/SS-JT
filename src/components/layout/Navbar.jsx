import { useState } from "react";
import { LogOut, Gem, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully.");
    } catch {
      toast.error("Failed to log out. Please try again.");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
              <Gem className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-white font-bold text-sm sm:text-base tracking-wide">
                Shivaayaha Silks &amp; Jari Trades
              </p>
              <p className="text-indigo-400 text-xs font-medium tracking-widest uppercase">
                Ledger Management
              </p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <p className="text-slate-400 text-xs">Signed in as</p>
              <p className="text-slate-200 text-sm font-medium truncate max-w-[200px]">
                {currentUser?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-sm font-medium transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden text-slate-400 hover:text-white transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden pb-4 border-t border-slate-700/50 mt-2 pt-3 space-y-3">
            <p className="text-slate-400 text-xs">
              Signed in as{" "}
              <span className="text-slate-200">{currentUser?.email}</span>
            </p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium w-full"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
