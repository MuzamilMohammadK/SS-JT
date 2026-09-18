import { useState } from "react";
import { Gem, ArrowRight } from "lucide-react";
import Login from "../components/auth/Login";
import Register from "../components/auth/Register";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-rose-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-slide-up">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-4">
            <Gem className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Shivaayaha Silks &amp; Jari Trades
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium tracking-wide">
            Professional Ledger Management System
          </p>
        </div>

        {/* Auth Card */}
        <div className="card p-7 shadow-2xl shadow-black/40">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-slate-800/60 p-1 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isLogin
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                !isLogin
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="animate-fade-in" key={isLogin ? "login" : "register"}>
            {isLogin ? (
              <Login onSwitch={() => setIsLogin(false)} />
            ) : (
              <Register onSwitch={() => setIsLogin(true)} />
            )}
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          Secured with Firebase Authentication · Client-Side Only
        </p>
      </div>
    </div>
  );
}
