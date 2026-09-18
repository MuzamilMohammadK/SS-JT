import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { validateEmail, validatePassword, firebaseAuthError } from "../../utils/validators";
import { Gem, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, UserPlus, LogIn } from "lucide-react";
import toast from "react-hot-toast";

// ── Field component ────────────────────────────────────────────
function Field({ id, label, type = "text", value, onChange, error, placeholder, icon: Icon, rightSlot }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={id}
          className={`input-base ${Icon ? "pl-10" : ""} ${rightSlot ? "pr-11" : ""} ${error ? "input-error" : ""}`}
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {error && (
        <p className="text-rose-400 text-xs font-medium mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

// ── Sign In Form ───────────────────────────────────────────────
function SignInForm({ onSwitch }) {
  const { login } = useAuth();
  const [form,    setForm]    = useState({ email: "", password: "" });
  const [errors,  setErrors]  = useState({});
  const [authErr, setAuthErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: null }));
    setAuthErr("");
  };

  const validate = () => {
    const e = {};
    const emailErr = validateEmail(form.email);
    const pwdErr   = validatePassword(form.password);
    if (emailErr) e.email    = emailErr;
    if (pwdErr)   e.password = pwdErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setAuthErr("");
    try {
      await login(form.email.trim(), form.password);
      toast.success("Welcome back!");
    } catch (err) {
      setAuthErr(firebaseAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {authErr && (
        <div className="alert-error animate-fade-in-up">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{authErr}</span>
        </div>
      )}

      <Field
        id="signin-email" label="Email Address" type="email"
        value={form.email} onChange={set("email")} error={errors.email}
        placeholder="you@example.com" icon={Mail}
      />
      <Field
        id="current-password" label="Password" type={showPwd ? "text" : "password"}
        value={form.password} onChange={set("password")} error={errors.password}
        placeholder="Enter your password" icon={Lock}
        rightSlot={
          <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />

      <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <p className="text-center text-slate-500 text-sm">
        No account?{" "}
        <button type="button" onClick={onSwitch} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
          Create one
        </button>
      </p>
    </form>
  );
}

// ── Register Form ─────────────────────────────────────────────
function RegisterForm({ onSwitch }) {
  const { register } = useAuth();
  const [form,    setForm]    = useState({ email: "", password: "", confirm: "" });
  const [errors,  setErrors]  = useState({});
  const [authErr, setAuthErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: null }));
    setAuthErr("");
  };

  const validate = () => {
    const e = {};
    const emailErr = validateEmail(form.email);
    const pwdErr   = validatePassword(form.password);
    if (emailErr) e.email = emailErr;
    if (pwdErr)   e.password = pwdErr;
    if (form.password !== form.confirm) e.confirm = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setAuthErr("");
    try {
      await register(form.email.trim(), form.password);
      toast.success("Account created successfully!");
    } catch (err) {
      setAuthErr(firebaseAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {authErr && (
        <div className="alert-error animate-fade-in-up">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{authErr}</span>
        </div>
      )}

      <Field
        id="register-email" label="Email Address" type="email"
        value={form.email} onChange={set("email")} error={errors.email}
        placeholder="you@example.com" icon={Mail}
      />
      <Field
        id="new-password" label="Password" type={showPwd ? "text" : "password"}
        value={form.password} onChange={set("password")} error={errors.password}
        placeholder="Min. 6 characters" icon={Lock}
        rightSlot={
          <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />
      <Field
        id="confirm-password" label="Confirm Password" type={showPwd ? "text" : "password"}
        value={form.confirm} onChange={set("confirm")} error={errors.confirm}
        placeholder="Repeat your password" icon={Lock}
      />

      <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        {loading ? "Creating account…" : "Create Account"}
      </button>

      <p className="text-center text-slate-500 text-sm">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
          Sign in
        </button>
      </p>
    </form>
  );
}

// ── AuthScreen (exported) ─────────────────────────────────────
export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-rose-600/4 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm animate-slide-up">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 shadow-2xl shadow-indigo-500/30 mb-5 animate-glow-pulse">
            <Gem className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Shivaayaha Silks &amp; Jari Trades
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 font-medium tracking-widest uppercase">
            Professional Ledger Management
          </p>
        </div>

        {/* Auth Card */}
        <div className="card-glass p-7 shadow-2xl shadow-black/50">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-slate-900/60 p-1 mb-6 gap-1">
            {[["Sign In", true], ["Create Account", false]].map(([label, isL]) => (
              <button
                key={label}
                onClick={() => setIsLogin(isL)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isLogin === isL
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form — key forces re-mount on tab switch, clearing all state */}
          <div key={isLogin ? "login" : "register"} className="animate-fade-in-up">
            {isLogin
              ? <SignInForm  onSwitch={() => setIsLogin(false)} />
              : <RegisterForm onSwitch={() => setIsLogin(true)} />
            }
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          Secured with Firebase Authentication · Client-Side Only
        </p>
      </div>
    </div>
  );
}
