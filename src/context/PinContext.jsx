import { createContext, useContext, useState, useEffect, useCallback } from "react";

const PIN_KEY = "saree_app_pin";
const PIN_VERIFIED_KEY = "saree_app_pin_verified_session";

const PinContext = createContext(null);

export function PinProvider({ children }) {
  // Whether a PIN has been configured
  const [hasPin, setHasPin] = useState(() => !!localStorage.getItem(PIN_KEY));

  // Whether the PIN has been verified this session
  const [pinVerified, setPinVerified] = useState(() => {
    return sessionStorage.getItem(PIN_VERIFIED_KEY) === "true";
  });

  // Set a new PIN (hashed via btoa for minimal obfuscation)
  const savePin = useCallback((pin) => {
    localStorage.setItem(PIN_KEY, btoa(pin));
    setHasPin(true);
    // Also mark as verified since the user just set it
    sessionStorage.setItem(PIN_VERIFIED_KEY, "true");
    setPinVerified(true);
  }, []);

  // Remove PIN
  const removePin = useCallback(() => {
    localStorage.removeItem(PIN_KEY);
    sessionStorage.removeItem(PIN_VERIFIED_KEY);
    setHasPin(false);
    setPinVerified(true); // no PIN means no gate
  }, []);

  // Verify supplied PIN
  const verifyPin = useCallback((pin) => {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return true; // no PIN set
    const match = btoa(pin) === stored;
    if (match) {
      sessionStorage.setItem(PIN_VERIFIED_KEY, "true");
      setPinVerified(true);
    }
    return match;
  }, []);

  // Reset verification (on logout)
  const resetVerification = useCallback(() => {
    sessionStorage.removeItem(PIN_VERIFIED_KEY);
    setPinVerified(false);
  }, []);

  // Recheck hasPin whenever localStorage changes (e.g. across tabs)
  useEffect(() => {
    const handler = () => {
      setHasPin(!!localStorage.getItem(PIN_KEY));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <PinContext.Provider
      value={{ hasPin, pinVerified, savePin, removePin, verifyPin, resetVerification }}
    >
      {children}
    </PinContext.Provider>
  );
}

export function usePin() {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error("usePin must be used inside <PinProvider>");
  return ctx;
}
