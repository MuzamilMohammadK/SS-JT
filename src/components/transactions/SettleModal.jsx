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

  const existingLogs = tx.paymentLogs || [];
  const maxAllowed   = parseFloat(tx.pendingDue.toFixed(2));

  const validate = () => {
    const n = Number(amount);
    if (!amount)        return "Please enter an amount.";
    const e = validateNonNegative(amount);
    if (e) return e;
    if (n <= 0)         return "Settlement amount must be greater than zero.";
    if (n > maxAllowed + 0.005) return `Cannot exceed the pending due of ${fmtINR(maxAllowed)}.`;
    return null;
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const paid    = parseFloat(Number(amount).toFixed(2));
      const newPaid = parseFloat((tx.amountPaid + paid).toFixed(2));
      const newDue  = parseFloat(Math.max(0, tx.pendingDue - paid).toFixed(2));
      const isFullySettled = newDue <= 0.005;

      // Build payment log entry
      const logEntry = {
        amount: paid,
        date:   new Date().toISOString(),
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
          ? `✅ Fully settled — ${fmtINR(tx.totalAmount)} cleared.`
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

  const settleAll = () => {
    setAmount(String(maxAllowed));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 card w-full max-w-md animate-fade-in-scale max-h-[90vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/60 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-slate-100 font-semibold text-[15px]">Record Payment</h2>
              <p className="text-slate-500 text-xs">{tx.partyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Summary ── */}
          <div className="card bg-slate-950/60 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Total</span>
              <span className="text-slate-300 num">{fmtINR(tx.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Paid So Far</span>
              <span className="text-emerald-400 num">{fmtINR(tx.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2 font-semibold">
              <span className="text-amber-400">Remaining Due</span>
              <span className="text-amber-400 num text-base">{fmtINR(maxAllowed)}</span>
            </div>

            {/* Payment progress bar */}
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                <span>Paid: {tx.totalAmount > 0 ? Math.round((tx.amountPaid / tx.totalAmount) * 100) : 0}%</span>
                <span>Remaining: {tx.totalAmount > 0 ? Math.round((maxAllowed / tx.totalAmount) * 100) : 0}%</span>
              </div>
              <div className="progress-track h-2">
                <div
                  className="progress-fill bg-emerald-500"
                  style={{
                    width: tx.totalAmount > 0
                      ? `${Math.round((tx.amountPaid / tx.totalAmount) * 100)}%`
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
                <span className="text-slate-400">Total paid</span>
                <span className="text-emerald-400 num">{fmtINR(tx.amountPaid)}</span>
              </div>
            </div>
          )}

          {/* ── Amount Input ── */}
          <div className="field">
            <label htmlFor="settle-amount" className="label flex items-center gap-1">
              <IndianRupee className="w-3 h-3" /> Amount Being Paid Now (₹)
            </label>
            <input
              id="settle-amount"
              type="number"
              min="0.01"
              step="0.01"
              max={maxAllowed}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder={`Max: ${fmtINR(maxAllowed)}`}
              className={`input-base text-lg ${error ? "input-error" : ""}`}
              autoFocus
            />
            {error && (
              <p className="flex items-center gap-1.5 text-rose-400 text-xs">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
              </p>
            )}

            {/* Preview of remaining due after this payment */}
            {amount && !error && Number(amount) > 0 && Number(amount) <= maxAllowed && (
              <div className="mt-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Paying now</span>
                  <span className="text-emerald-400 num">− {fmtINR(Number(amount))}</span>
                </div>
                <div className="flex justify-between border-t border-slate-700/50 pt-1 font-semibold">
                  <span className="text-slate-300">Still outstanding after</span>
                  <span className={`num ${Math.max(0, maxAllowed - Number(amount)) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {fmtINR(Math.max(0, maxAllowed - Number(amount)))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Settle All Shortcut ── */}
          <button type="button" onClick={settleAll}
            className="w-full text-center py-2.5 rounded-xl border border-dashed border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 text-xs font-semibold transition-all">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
            Pay Full Remaining Due ({fmtINR(maxAllowed)})
          </button>

          {/* ── Footer Buttons ── */}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSettle}
              className="btn-primary flex-1"
            >
              {loading ? <span className="spinner" /> : <CreditCard className="w-4 h-4" />}
              {loading ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
