import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import {
  X,
  Settings,
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  LogOut,
  MailCheck,
  RefreshCw,
  ArrowLeft,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsModal({ isOpen, onClose }) {
  const { currentUser, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState("email"); // 'email' | 'password'

  // Email form state
  const [newEmail, setNewEmail] = useState("");
  const [emailOldPassword, setEmailOldPassword] = useState("");
  const [showEmailOldPassword, setShowEmailOldPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Email verification state (when Firebase requires link verification)
  const [verificationPending, setVerificationPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setNewEmail("");
      setEmailOldPassword("");
      setEmailError("");
      setVerificationPending(false);
      setPendingEmail("");
      setCheckingStatus(false);
      setStatusMessage("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser) return null;

  // ── Handle Logout ─────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      onClose();
      await logout();
      toast.success("Logged out successfully.");
    } catch {
      toast.error("Failed to log out. Please try again.");
    }
  };

  // ── Handle Change Email ───────────────────────────────────────
  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setEmailError("");

    const emailTrimmed = newEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      setEmailError("Please enter a new email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (emailTrimmed === currentUser.email?.toLowerCase()) {
      setEmailError("The new email must be different from your current email.");
      return;
    }
    if (!emailOldPassword) {
      setEmailError("Please enter your current password to verify your identity.");
      return;
    }

    setEmailLoading(true);
    try {
      // 1. Re-authenticate user with current credentials
      const credential = EmailAuthProvider.credential(currentUser.email, emailOldPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Try direct email update first (succeeds if allowed by project configuration)
      try {
        await updateEmail(currentUser, emailTrimmed);
        await refreshUser();
        toast.success(`Email successfully updated to ${emailTrimmed}!`);
        onClose();
        return;
      } catch (updateErr) {
        console.warn("Direct updateEmail failed, checking verification fallback:", updateErr);
        // Firebase projects with Email Enumeration Protection require verification link before update
        try {
          await verifyBeforeUpdateEmail(currentUser, emailTrimmed);
          setPendingEmail(emailTrimmed);
          setVerificationPending(true);
          setStatusMessage("");
          toast.success(`Verification email sent to ${emailTrimmed}!`, { duration: 6000 });
          return;
        } catch (verifyErr) {
          console.error("verifyBeforeUpdateEmail failed:", verifyErr);
          throw verifyErr;
        }
      }
    } catch (err) {
      console.error("Change email error:", err);
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setEmailError("Incorrect current password. Please try again.");
      } else if (err.code === "auth/email-already-in-use") {
        setEmailError("This email address is already associated with another account.");
      } else if (err.code === "auth/invalid-email") {
        setEmailError("The email address provided is not valid.");
      } else if (err.code === "auth/requires-recent-login") {
        setEmailError("Your login session has expired. Please sign out and sign in again.");
      } else if (err.code === "auth/too-many-requests") {
        setEmailError("Too many attempts. Please wait a few moments and try again.");
      } else {
        setEmailError(err.message || "Failed to update email. Please try again.");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Handle Check Verification Status ──────────────────────────
  const handleCheckVerification = async () => {
    setCheckingStatus(true);
    setStatusMessage("");
    try {
      const updatedUser = await refreshUser();
      if (updatedUser?.email?.toLowerCase() === pendingEmail.toLowerCase()) {
        toast.success(`Email updated to ${pendingEmail}!`);
        setVerificationPending(false);
        onClose();
      } else {
        setStatusMessage(
          `Firebase has not recorded your verification yet. Please open the email sent to "${pendingEmail}", click the verification link, and then tap this button again.`
        );
      }
    } catch (err) {
      console.error("Check status error:", err);
      setStatusMessage("Could not refresh status. Please check your network and try again.");
    } finally {
      setCheckingStatus(false);
    }
  };

  // ── Handle Resend Verification Link ───────────────────────────
  const handleResendVerification = async () => {
    setEmailLoading(true);
    try {
      await verifyBeforeUpdateEmail(currentUser, pendingEmail);
      toast.success(`Verification link re-sent to ${pendingEmail}!`);
      setStatusMessage(`A fresh verification link has been sent to ${pendingEmail}. Please check your inbox and spam folder.`);
    } catch (err) {
      console.error("Resend error:", err);
      toast.error(err.message || "Failed to re-send verification link.");
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Handle Change Password ────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("New password cannot be the same as your current password.");
      return;
    }

    setPasswordLoading(true);
    try {
      // 1. Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Update password
      await updatePassword(currentUser, newPassword);
      await refreshUser();
      toast.success("Password changed successfully!");
      onClose();
    } catch (err) {
      console.error("Change password error:", err);
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setPasswordError("Incorrect current password. Please try again.");
      } else if (err.code === "auth/weak-password") {
        setPasswordError("Password is too weak. Please use at least 6 characters.");
      } else if (err.code === "auth/too-many-requests") {
        setPasswordError("Too many failed attempts. Please wait a few moments and try again.");
      } else {
        setPasswordError(err.message || "Failed to change password. Please try again.");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog — Centered in Viewport */}
      <div className="relative z-10 m-auto card p-6 w-full max-w-md animate-fade-in-scale border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-slate-100 font-bold text-base">Account Settings</h2>
              <p className="text-slate-500 text-xs">Manage credentials &amp; session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "email"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Change Email</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "password"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>
        </div>

        {/* ── Tab 1: Change Email ── */}
        {activeTab === "email" && (
          verificationPending ? (
            /* Verification in Progress View */
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 shadow-inner">
                  <MailCheck className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-slate-100 font-bold text-sm mb-1">
                  Verification Email Sent
                </h3>
                <p className="text-slate-400 text-xs max-w-xs mb-2">
                  Firebase requires email verification before the change can take effect:
                </p>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 font-mono text-indigo-300 text-xs font-semibold select-all break-all">
                  {pendingEmail}
                </div>
              </div>

              {/* Step instructions */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px] flex items-center justify-center mt-0.5">1</span>
                  <span>Open your inbox for <strong className="text-white">{pendingEmail}</strong> (check Spam / Junk too).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px] flex items-center justify-center mt-0.5">2</span>
                  <span>Click the verification link from Firebase.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px] flex items-center justify-center mt-0.5">3</span>
                  <span>Return here and tap <strong>"I've Verified — Check Status"</strong> below.</span>
                </div>
              </div>

              {/* Status or warning alert */}
              {statusMessage && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleCheckVerification}
                  disabled={checkingStatus}
                  className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2"
                >
                  {checkingStatus ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking verification status…</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>I've Verified — Check Status</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationPending(false);
                      setStatusMessage("");
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={emailLoading}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors py-1"
                  >
                    {emailLoading ? "Sending…" : "Resend Link"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangeEmail} className="space-y-4" noValidate>
              {/* Current Email Display */}
              <div>
                <label className="label text-[11px]">Current Email</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-slate-400 text-sm flex items-center gap-2 select-none">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="truncate font-mono text-xs">{currentUser.email}</span>
                </div>
              </div>

              {/* New Email */}
              <div>
                <label htmlFor="settings-new-email" className="label text-[11px]">
                  New Email Address
                </label>
                <div className="relative">
                  <input
                    id="settings-new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    placeholder="Enter new email address"
                    className="input-base text-sm pl-10"
                    required
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Current Password (Old Password) Verification */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="settings-email-old-password" className="label text-[11px] mb-0">
                    Current Password
                  </label>
                  <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Security verification
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="settings-email-old-password"
                    type={showEmailOldPassword ? "text" : "password"}
                    value={emailOldPassword}
                    onChange={(e) => {
                      setEmailOldPassword(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    placeholder="Enter current password to authorize"
                    className="input-base text-sm pl-10 pr-10"
                    required
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowEmailOldPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showEmailOldPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Enter your old/current password to authorize updating your email.
                </p>
              </div>

              {/* Error Message */}
              {emailError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{emailError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary text-xs px-4 py-2"
                  disabled={emailLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="btn-primary text-xs px-4 py-2"
                >
                  {emailLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Update Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )
        )}

        {/* ── Tab 2: Change Password ── */}
        {activeTab === "password" && (
          <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
            {/* Current (Old) Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="settings-current-password" className="label text-[11px] mb-0">
                  Current (Old) Password
                </label>
                <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> Security verification
                </span>
              </div>
              <div className="relative">
                <input
                  id="settings-current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="Enter your current password"
                  className="input-base text-sm pl-10 pr-10"
                  required
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="settings-new-password" className="label text-[11px]">
                New Password
              </label>
              <div className="relative">
                <input
                  id="settings-new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="At least 6 characters"
                  className="input-base text-sm pl-10 pr-10"
                  required
                />
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="settings-confirm-password" className="label text-[11px]">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="settings-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="Re-enter new password"
                  className="input-base text-sm pl-10 pr-10"
                  required
                />
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-4 py-2"
                disabled={passwordLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-primary text-xs px-4 py-2"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── Logout Section (Inside Settings) ── */}
        <div className="pt-4 mt-5 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0 pr-2">
            <p className="text-slate-300 text-xs font-semibold">Account Session</p>
            <p className="text-slate-500 text-[11px] truncate">
              Signed in as <span className="text-slate-400 font-mono">{currentUser.email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-semibold transition-all flex-shrink-0"
            title="Sign out of Shivaayaha Silks"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
