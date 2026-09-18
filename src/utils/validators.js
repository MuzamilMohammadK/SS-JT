// ============================================================
//  Shared Client-Side Validators
//  Used across Party Form and Auth forms for consistent rules.
// ============================================================

/** Letters and spaces only — for party names and user display names */
export const NAME_REGEX = /^[A-Za-z\s]+$/;

/** Exactly 10 digits — for Indian mobile numbers */
export const MOBILE_REGEX = /^\d{10}$/;

/**
 * Validates a party/user name.
 * @param {string} value
 * @returns {string|null} error message or null if valid
 */
export function validateName(value) {
  if (!value || value.trim().length === 0) return "Name is required.";
  if (!NAME_REGEX.test(value.trim()))
    return "Name must contain letters and spaces only (no numbers or special characters).";
  return null;
}

/**
 * Validates a 10-digit mobile number.
 * @param {string} value
 * @returns {string|null} error message or null if valid
 */
export function validateMobile(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "Mobile number is required.";
  if (!MOBILE_REGEX.test(digits)) return "Mobile number must be exactly 10 digits.";
  return null;
}

/**
 * Validates that a value is a positive number > 0.
 * @param {number|string} value
 * @returns {string|null} error message or null if valid
 */
export function validatePositive(value) {
  const num = Number(value);
  if (isNaN(num) || num <= 0) return "Value must be a positive number greater than 0.";
  return null;
}

/**
 * Validates email format (basic).
 * @param {string} value
 * @returns {string|null}
 */
export function validateEmail(value) {
  if (!value || value.trim().length === 0) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
    return "Please enter a valid email address.";
  return null;
}

/**
 * Validates password length.
 * @param {string} value
 * @returns {string|null}
 */
export function validatePassword(value) {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return null;
}
