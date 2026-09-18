import { useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { validateEmail, validatePassword, validateName } from "../../utils/validators";
import toast from "react-hot-toast";

export default function Register({ onSwitch }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    const nameErr = validateName(form.displayName);
    const emailErr = validateEmail(form.email);
    const passErr = validatePassword(form.password);
    if (nameErr) e.displayName = nameErr;
    if (emailErr) e.email = emailErr;
    if (passErr) e.password = passErr;
    if (!form.confirm) e.confirm = "Please confirm your password.";
    else if (form.password !== form.confirm) e.confirm = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.email.trim(), form.password);
      toast.success("Account created successfully! Welcome.");
    } catch (err) {
      const msg =
        err.code === "auth/email-already-in-use"
          ? "This email is already registered. Please sign in."
          : err.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    let value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Display Name */}
      <div>
        <label htmlFor="reg-name" className="label">Full Name</label>
        <input
          id="reg-name"
          type="text"
          value={form.displayName}
          onChange={handleChange("displayName")}
          placeholder="e.g. Ramesh Sharma"
          className={`input-base ${errors.displayName ? "input-error" : ""}`}
        />
        {errors.displayName && (
          <p className="mt-1.5 text-rose-400 text-xs font-medium">{errors.displayName}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="reg-email" className="label">Email Address</label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-password" className="label">Password</label>
        <div className="relative">
          <input
            id="reg-password"
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange("password")}
            placeholder="Minimum 6 characters"
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

      {/* Confirm Password */}
      <div>
        <label htmlFor="reg-confirm" className="label">Confirm Password</label>
        <input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={handleChange("confirm")}
          placeholder="Re-enter your password"
          className={`input-base ${errors.confirm ? "input-error" : ""}`}
        />
        {errors.confirm && (
          <p className="mt-1.5 text-rose-400 text-xs font-medium">{errors.confirm}</p>
        )}
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            Create Account
          </>
        )}
      </button>

      <p className="text-center text-slate-500 text-sm">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        >
          Sign In
        </button>
      </p>
    </form>
  );
}
