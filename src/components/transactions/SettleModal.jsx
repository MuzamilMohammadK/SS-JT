import { useState } from "react";
import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { fmtINR, validateNonNegative } from "../../utils/validators";
import { CreditCard, X, CheckCircle2, AlertCircle, Clock, IndianRupee } from "lucide-react";
import toast from "react-hot-toast";

function PaymentLogRow({ log, index }) {
  const d = log.date ? new Date(log.date) : null;
  const dateStr = d
    ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
    : "—";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-400 text-[9px] font-bold">{index + 1}</span>
        </div>
        <span className="text-slate-500 text-xs">{dateStr}</span>
      </div>
      <span className="text-emerald-400 font-semibold text-sm num">{fmtINR(log.amount)}</span>
    </div>
  );
}

export default function SettleModal({ transaction: tx, onClose }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [amount,  setAmount]  = useState("");
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  if (!tx) return null;

  const isPurchase   = tx.type === "Purchase" || tx.type === "Taken" || tx.type === "Purchase Return";
  const isTaken      = isPurchase;
  const existingLogs = tx.paymentLogs || [];

  // Safely parse numerical values regardless of whether Firestore returned strings or numbers
  const currentPaid  = Number(tx.amountPaid) || 0;
  const currentTotal = Number(tx.totalAmount) || 0;
  const rawDue       = tx.pendingDue !== undefined && tx.pendingDue !== null
    ? Number(tx.pendingDue)
    : Math.max(0, currentTotal - currentPaid);
  const currentDue   = isNaN(rawDue) ? Math.max(0, currentTotal - currentPaid) : rawDue;
  const maxAllowed   = parseFloat(Math.max(0, currentDue).toFixed(2));

  const validate = () => {
    const n = Number(amount);
    if (!amount) return "Please enter an amount.";
    const e = validateNonNegative(amount);
    if (e) return e;
    if (n <= 0) return "Settlement amount must be greater than zero.";
    if (maxAllowed > 0 && n > maxAllowed + 0.005) {
      return `Cannot exceed the pending balance of ${fmtINR(maxAllowed)}.`;
    }
    return null;
  };

  const executeSettlement = async (settleAmount) => {
    if (!uid) {
      toast.error("User session expired. Please sign in again.");
      return;
    }
    setLoading(true);
    try {
      const paid = parseFloat(Number(settleAmount).toFixed(2));
      const newPaid = parseFloat((currentPaid + paid).toFixed(2));
      const newDue  = parseFloat(Math.max(0, currentDue - paid).toFixed(2));
      const isFullySettled = newDue <= 0.005;

      // Build payment log entry
      const logEntry = {
        amount: paid,
        date:   new Date().toISOString(),
        type:   isPurchase ? "Payment to Supplier" : "Receipt from Customer",
      };

      await updateDoc(doc(db, "users", uid, "transactions", tx.id), {
        amountPaid:  newPaid,
        pendingDue:  newDue,
        status:      isFullySettled ? "Settled" : "Pending",
        settledAt:   isFullySettled ? serverTimestamp() : null,
        paymentLogs: arrayUnion(logEntry),
      });

      toast.success(
        isFullySettled
          ? `✅ Fully settled — ${fmtINR(currentTotal)} cleared.`
          : `💰 ${fmtINR(paid)} recorded. ${fmtINR(newDue)} still pending.`
      );
      onClose();
    } catch (err) {
      toast.error("Failed to record settlement. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    await executeSettlement(amount);
  };

  const settleAll = () => {
    if (maxAllowed <= 0) {
      executeSettlement(0);
      return;
    }
    setAmount(String(maxAllowed));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 card w-full max-w-md animate-fade-in-scale max-h-[90vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/60 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isPurchase ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
            }`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-slate-100 font-semibold text-[15px] truncate">
                {isPurchase ? "Settle Payable (Purchase)" : "Settle Receivable (Sale)"}
              </h2>
              <p className="text-slate-500 text-xs truncate" title={tx.partyName}>
                {isPurchase ? `Paying to ${tx.partyName}` : `Receiving from ${tx.partyName}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Summary ── */}
          <div className="card bg-slate-950/60 p-4 space-y-2 text-sm">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 flex-shrink-0">Invoice Total</span>
              <span className="text-slate-300 num truncate">{fmtINR(currentTotal)}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 flex-shrink-0">Total Paid So Far</span>
              <span className="text-emerald-400 num truncate">{fmtINR(currentPaid)}</span>
            </div>
            <div className="flex justify-between items-center gap-2 border-t border-slate-800 pt-2 font-semibold">
              <span className="text-amber-400 flex-shrink-0">Remaining Balance Due</span>
              <span className="text-amber-400 num text-base truncate">{fmtINR(maxAllowed)}</span>
            </div>

            {/* Payment progress bar */}
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                <span>Paid: {currentTotal > 0 ? Math.round((currentPaid / currentTotal) * 100) : 0}%</span>
                <span>Remaining: {currentTotal > 0 ? Math.round((maxAllowed / currentTotal) * 100) : 0}%</span>
              </div>
              <div className="progress-track h-2">
                <div
                  className="progress-fill bg-emerald-500"
                  style={{
                    width: currentTotal > 0
                      ? `${Math.min(100, Math.round((currentPaid / currentTotal) * 100))}%`
                      : "0%"
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Payment History ── */}
          {existingLogs.length > 0 && (
            <div className="card bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Payment History ({existingLogs.length} payment{existingLogs.length > 1 ? "s" : ""})
                </span>
              </div>
              {existingLogs.map((log, i) => (
                <PaymentLogRow key={i} log={log} index={i} />
              ))}
              <div className="flex justify-between pt-2 mt-1 text-xs font-semibold">
                <span className="text-slate-400">Total settled</span>
                <span className="text-emerald-400 num">{fmtINR(currentPaid)}</span>
              </div>
            </div>
          )}

          {/* ── Amount Input ── */}
          <div className="field">
            <label htmlFor="settle-amount" className="label flex items-center justify-between">
              <span className="flex items-center gap-1">
                <IndianRupee className="w-3 h-3" />
                {isPurchase ? "Amount Being Paid to Supplier (₹)" : "Amount Received from Customer (₹)"}
              </span>
              {maxAllowed > 0 && (
                <button
                  type="button"
                  onClick={settleAll}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  Pay Full ({fmtINR(maxAllowed)})
                </button>
              )}
            </label>
            <input
              id="settle-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                  setAmount(val);
                  setError(null);
                }
              }}
              placeholder={`0.00 (Max: ${fmtINR(maxAllowed)})`}
              className={`input-base text-lg font-semibold num ${error ? "input-error" : ""}`}
              autoFocus
            />
            {error && (
              <p className="flex items-center gap-1.5 text-rose-400 text-xs mt-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
              </p>
            )}

            {/* Quick Presets */}
            {maxAllowed > 0 && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={settleAll}
                  className="btn-secondary flex-1 text-xs py-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                  Full Due ({fmtINR(maxAllowed)})
                </button>
                {maxAllowed >= 100 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmount(String(parseFloat((maxAllowed / 2).toFixed(2))));
                      setError(null);
                    }}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    50% ({fmtINR(parseFloat((maxAllowed / 2).toFixed(2)))})
                  </button>
                )}
              </div>
            )}

            {/* Preview of remaining due after this payment */}
            {amount && !error && Number(amount) > 0 && Number(amount) <= maxAllowed && (
              <div className="mt-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Amount now</span>
                  <span className="text-emerald-400 font-semibold num">− {fmtINR(Number(amount))}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700/50 pt-1 font-semibold">
                  <span className="text-slate-300">Remaining after payment</span>
                  <span className={`num ${Math.max(0, maxAllowed - Number(amount)) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {fmtINR(Math.max(0, maxAllowed - Number(amount)))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer Buttons ── */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSettle}
              className="btn-primary flex-1"
            >
              {loading ? <span className="spinner" /> : <CreditCard className="w-4 h-4" />}
              {loading
                ? "Saving…"
                : isPurchase
                  ? "Record Supplier Payment"
                  : "Record Customer Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
