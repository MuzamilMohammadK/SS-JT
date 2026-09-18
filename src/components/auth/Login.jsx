import { useState } from "react";
import { Eye, EyeOff, LogIn, Gem } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { validateEmail, validatePassword } from "../../utils/validators";
import toast from "react-hot-toast";

export default function Login({ onSwitch }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    const emailErr = validateEmail(form.email);
    const passErr = validatePassword(form.password);
    if (emailErr) e.email = emailErr;
    if (passErr) e.password = passErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      toast.success("Welcome back!");
    } catch (err) {
      const msg =
        err.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : err.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Email */}
      <div>
        <label htmlFor="login-email" className="label">Email Address</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange("email")}
          placeholder="you@example.com"
          className={`input-base ${errors.email ? "input-error" : ""}`}
        />
        {errors.email && (
          <p className="mt-1.5 text-rose-400 text-xs font-medium">{errors.email}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="login-password" className="label">Password</label>
        <div className="relative">
          <input
            id="login-password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange("password")}
            placeholder="••••••••"
            className={`input-base pr-11 ${errors.password ? "input-error" : ""}`}
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1.5 text-rose-400 text-xs font-medium">{errors.password}</p>
        )}
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <LogIn className="w-4 h-4" />
            Sign In
          </>
        )}
      </button>

      <p className="text-center text-slate-500 text-sm">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        >
          Create Account
        </button>
      </p>
    </form>
  );
}
