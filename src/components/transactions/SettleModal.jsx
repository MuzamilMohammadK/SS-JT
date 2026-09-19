import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { fmtINR, validateNonNegative } from "../../utils/validators";
import { CreditCard, X, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function SettleModal({ transaction: tx, onClose }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [amount,  setAmount]  = useState("");
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const maxAllowed = tx.pendingDue;

  const validate = () => {
    const n = Number(amount);
    if (!amount) return "Please enter an amount.";
    const e = validateNonNegative(amount);
    if (e) return e;
    if (n <= 0)         return "Settlement amount must be greater than zero.";
    if (n > maxAllowed) return `Amount cannot exceed the pending due of ${fmtINR(maxAllowed)}.`;
    return null;
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const newAmountPaid = parseFloat((tx.amountPaid + Number(amount)).toFixed(2));
      const newPendingDue = parseFloat((tx.pendingDue  - Number(amount)).toFixed(2));
      const isFullySettled = newPendingDue <= 0.005; // float tolerance

      await updateDoc(doc(db, "users", uid, "transactions", tx.id), {
        amountPaid:  newAmountPaid,
        pendingDue:  Math.max(0, newPendingDue),
        status:      isFullySettled ? "Settled" : "Pending",
        settledAt:   isFullySettled ? serverTimestamp() : null,
      });

      toast.success(
        isFullySettled
          ? `Transaction fully settled — ${fmtINR(tx.totalAmount)}.`
          : `Partial payment of ${fmtINR(Number(amount))} recorded.`
      );
      onClose();
    } catch (err) {
      toast.error("Failed to record settlement. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const settleAll = () => {
    setAmount(String(maxAllowed));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 card w-full max-w-sm animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-slate-100 font-semibold text-[15px]">Record Settlement</h2>
              <p className="text-slate-500 text-xs">{tx.partyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSettle} className="p-5 space-y-4" noValidate>
          {/* Summary */}
          <div className="card bg-slate-950/60 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Amount</span>
              <span className="text-slate-300 num">{fmtINR(tx.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Already Paid</span>
              <span className="text-emerald-400 num">{fmtINR(tx.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5 font-semibold">
              <span className="text-amber-400">Pending Due</span>
              <span className="text-amber-400 num">{fmtINR(tx.pendingDue)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div className="field">
            <label htmlFor="settle-amount" className="label">Amount Being Settled (₹)</label>
            <input
              id="settle-amount"
              type="number"
              min="0.01"
              step="0.01"
              max={maxAllowed}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder="Enter amount…"
              className={`input-base ${error ? "input-error" : ""}`}
              autoFocus
            />
            {error && (
              <p className="flex items-center gap-1.5 text-rose-400 text-xs">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
              </p>
            )}
          </div>

          {/* Settle all shortcut */}
          <button type="button" onClick={settleAll}
            className="w-full text-center py-2 rounded-xl border border-dashed border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60 text-xs font-semibold transition-all">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
            Settle Full Pending Due ({fmtINR(maxAllowed)})
          </button>

          {/* Footer */}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <span className="spinner" /> : <CreditCard className="w-4 h-4" />}
              {loading ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
