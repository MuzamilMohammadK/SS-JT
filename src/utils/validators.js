// ============================================================
//  Shared Client-Side Validators
//  All validators return { valid: boolean, error: string|null }
// ============================================================

/** Letters + spaces only — for party/user names */
export const NAME_REGEX   = /^[A-Za-z\s]+$/;
/** Exactly 10 digits — for Indian mobile numbers */
export const MOBILE_REGEX = /^\d{10}$/;

export function validateName(value) {
  const v = value?.trim() ?? "";
  if (!v)                    return "Name is required.";
  if (!NAME_REGEX.test(v))   return "Name must contain letters and spaces only.";
  return null;
}

export function validateMobile(value) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits)                      return "Mobile number is required.";
  if (!MOBILE_REGEX.test(digits))   return "Mobile number must be exactly 10 digits.";
  return null;
}

export function validatePositive(value) {
  const n = Number(value);
  if (isNaN(n) || n <= 0) return "Must be a positive number greater than 0.";
  return null;
}

export function validateEmail(value) {
  const v = value?.trim() ?? "";
  if (!v)                                          return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))      return "Enter a valid email address.";
  return null;
}

export function validatePassword(value) {
  if (!value)              return "Password is required.";
  if (value.length < 6)   return "Password must be at least 6 characters.";
  return null;
}

/** Map Firebase Auth error codes → user-friendly messages */
export function firebaseAuthError(code) {
  const map = {
    "auth/invalid-email":           "Please enter a valid email address.",
    "auth/user-not-found":          "No account found with this email address.",
    "auth/wrong-password":          "Incorrect password. Please try again.",
    "auth/invalid-credential":      "Incorrect email or password. Please try again.",
    "auth/email-already-in-use":    "An account with this email already exists. Sign in instead.",
    "auth/weak-password":           "Password must be at least 6 characters long.",
    "auth/operation-not-allowed":   "Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.",
    "auth/too-many-requests":       "Account temporarily locked. Too many failed attempts — try again later.",
    "auth/network-request-failed":  "Network error. Please check your internet connection.",
    "auth/user-disabled":           "This account has been disabled. Contact support.",
  };
  return map[code] ?? `Authentication error (${code}). Please try again.`;
}
