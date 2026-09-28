import { useState, useRef, useEffect } from "react";
import { ShieldCheck, Delete, LogOut } from "lucide-react";
import { usePin } from "../../context/PinContext";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"];

export default function PinEntryScreen() {
  const { verifyPin, resetVerification } = usePin();
  const { logout } = useAuth();

  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      const ok = verifyPin(pin);
      if (!ok) {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin("");
          setAttempts((a) => a + 1);
        }, 600);
        if (attempts >= 2) {
          toast.error("Too many incorrect attempts. Please try again.");
        }
      }
      // If correct, PinContext updates pinVerified → component unmounts
    }
  }, [pin]);

  const handleDigit = (d) => {
    if (pin.length < 4) setPin((p) => p + d);
  };

  const handleDel = () => setPin((p) => p.slice(0, -1));

  const handleLogout = async () => {
    resetVerification();
    await logout();
    toast.success("Logged out.");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-xs">
        {/* Icon + title */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="text-center">
            <h1 className="text-slate-100 text-xl font-bold tracking-tight">Security PIN</h1>
            <p className="text-slate-500 text-sm mt-1">Enter your 4-digit PIN to continue</p>
          </div>
        </div>

        {/* PIN dots */}
        <div className={`flex items-center gap-4 ${shake ? "animate-shake" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > i
                  ? "bg-indigo-500 border-indigo-500 scale-110"
                  : "bg-transparent border-slate-600"
              }`}
            />
          ))}
        </div>

        {/* Wrong PIN hint */}
        {attempts > 0 && (
          <p className="text-rose-400 text-xs -mt-4 animate-fade-in">
            Incorrect PIN. Please try again.
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {DIGITS.map((d, idx) => {
            if (d === null) {
              return <div key={idx} />;
            }
            if (d === "del") {
              return (
                <button
                  key={idx}
                  onClick={handleDel}
                  disabled={pin.length === 0}
                  className="h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:bg-slate-700/70 hover:text-white active:scale-95 transition-all disabled:opacity-30"
                  aria-label="Delete"
                >
                  <Delete className="w-5 h-5" />
                </button>
              );
            }
            return (
              <button
                key={idx}
                onClick={() => handleDigit(String(d))}
                disabled={pin.length === 4}
                className="h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-100 font-semibold text-xl hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-white active:scale-95 transition-all"
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Logout link */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors mt-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out instead</span>
        </button>
      </div>
    </div>
  );
}
