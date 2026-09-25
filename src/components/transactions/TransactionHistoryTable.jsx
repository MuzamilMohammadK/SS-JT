import { useState } from "react";
import { doc, updateDoc, collection, addDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { fmtINR, validateNonNegative } from "../../utils/validators";
import {
  Search, X, BookOpen, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Clock, ChevronUp, Eye, CreditCard,
  Loader2, AlertCircle, CalendarDays, RotateCcw, FileText,
  IndianRupee, Pencil, Plus, Trash2, Minus,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Type helpers (backward-compat) ────────────────────────────
const isSale     = (t) => t === "Sale"     || t === "Given"  || t === "Sale Return";
const isPurchase = (t) => t === "Purchase" || t === "Taken"  || t === "Purchase Return";
const canReturn  = (tx) => tx.type === "Sale" || tx.type === "Given" || tx.type === "Purchase" || tx.type === "Taken";

// ── TypeBadge ─────────────────────────────────────────────────
function TypeBadge({ type }) {
  if (type === "Sale"     || type === "Given")
    return <span className="badge-indigo"><ArrowUpRight className="w-3 h-3" />Sale</span>;
  if (type === "Purchase" || type === "Taken")
    return <span className="badge-rose"><ArrowDownLeft className="w-3 h-3" />Purchase</span>;
  if (type === "Sale Return")
    return <span className="badge-amber"><RotateCcw className="w-3 h-3" />Sale Return</span>;
  if (type === "Purchase Return")
    return <span className="badge-teal"><RotateCcw className="w-3 h-3" />Purchase Return</span>;
  return <span className="badge-slate">{type}</span>;
}

function StatusBadge({ status }) {
  return status === "Settled"
    ? <span className="badge-emerald"><CheckCircle2 className="w-3 h-3" />Settled</span>
    : <span className="badge-amber"><Clock className="w-3 h-3" />Pending</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ── Compute unified payment terms / installments ──────────────
function getPaymentTerms(tx) {
  const rawLogs = tx.paymentLogs || [];
  const logSum = rawLogs.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const totalPaid = Number(tx.amountPaid) || 0;
  const initialAmount = parseFloat(Math.max(0, totalPaid - logSum).toFixed(2));

  const terms = [];

  if (initialAmount > 0.005) {
    terms.push({
      termNumber: 1,
      title: "Term 1 · Initial Payment",
      date: tx.transactionDate,
      amount: initialAmount,
      type: (tx.type === "Purchase" || tx.type === "Taken") ? "Payment to Supplier" : "Receipt from Customer",
      isInitial: true,
    });
  }

  rawLogs.forEach((log) => {
    terms.push({
      termNumber: terms.length + 1,
      title: `Term ${terms.length + 1} · ${log.type || "Installment"}`,
      date: log.date ? log.date.slice(0, 10) : tx.transactionDate,
      rawDate: log.date,
      amount: Number(log.amount) || 0,
      type: log.type || "Settlement Payment",
      isInitial: false,
      // payment mode fields
      paymentMode: log.paymentMode || null,
      paymentDate: log.paymentDate || null,
      chequeNo: log.chequeNo || null,
      chequeReceivedDate: log.chequeReceivedDate || null,
      chequeDate: log.chequeDate || null,
      chequePassDate: log.chequePassDate || null,
      neftRefNo: log.neftRefNo || null,
    });
  });

  let cumulative = 0;
  const total = Number(tx.totalAmount) || 0;
  return terms.map((t) => {
    cumulative = parseFloat((cumulative + t.amount).toFixed(2));
    const balanceAfter = parseFloat(Math.max(0, total - cumulative).toFixed(2));
    return { ...t, cumulative, balanceAfter };
  });
}

// ── Inline Calendar Subview (No pop-up) ────────────────────────
function InlineCalendarView({ tx, uid, onDone }) {
  const [date, setDate] = useState(tx.transactionDate ?? new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!date) { toast.error("Please pick a valid date."); return; }
    if (!uid) { toast.error("Session expired."); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", uid, "transactions", tx.id), { transactionDate: date });
      toast.success("Transaction date updated.");
      onDone();
    } catch (err) {
      toast.error("Failed to update date.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/25 p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-slate-100 font-bold text-sm">Change Transaction Date</h4>
            <p className="text-slate-500 text-xs">Update record date inline for {tx.partyName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-3 py-2.5 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Current Date</p>
          <p className="text-slate-300 font-bold text-sm num">{formatDate(tx.transactionDate)}</p>
        </div>
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/25 px-3 py-2.5 text-center">
          <p className="text-indigo-400 text-[10px] uppercase tracking-wider font-semibold mb-0.5">New Date</p>
          <p className="text-indigo-200 font-bold text-sm num">{formatDate(date)}</p>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`edit-date-${tx.id}`} className="label flex items-center gap-1.5 text-xs">
          <CalendarDays className="w-3.5 h-3.5 text-indigo-400" /> Select New Date
        </label>
        <input
          id={`edit-date-${tx.id}`}
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="input-base cursor-pointer"
          style={{ fontSize: "16px", padding: "12px 14px" }}
        />
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="btn-secondary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading || !date || date === tx.transactionDate}
          onClick={handleSave}
          className="btn-primary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          {loading ? <span className="spinner" /> : <CalendarDays className="w-4 h-4" />}
          {loading ? "Saving…" : "Save Date"}
        </button>
      </div>
    </div>
  );
}

// ── Inline Return Subview (No pop-up) ──────────────────────────
function InlineReturnView({ tx, uid, onDone }) {
  const returnType = (tx.type === "Sale" || tx.type === "Given") ? "Sale Return" : "Purchase Return";
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState((tx.sareeDetails || []).map((item) => ({ ...item, returnQty: "" })));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const returnTotal = items.reduce((sum, item) =>
    sum + (Number(item.returnQty) || 0) * (Number(item.pricePerUnit) || 0), 0);

  const handleSave = async () => {
    if (!items.some((item) => Number(item.returnQty) > 0)) {
      toast.error("Enter return quantity for at least one item.");
      return;
    }
    if (!uid) { toast.error("Session expired."); return; }
    setLoading(true);
    try {
      const sareeDetails = items
        .filter((item) => Number(item.returnQty) > 0)
        .map((item) => ({
          sareeName:    item.sareeName,
          quantity:     Number(item.returnQty),
          pricePerUnit: Number(item.pricePerUnit),
          subtotal:     Number(item.returnQty) * Number(item.pricePerUnit),
        }));

      await addDoc(collection(db, "users", uid, "transactions"), {
        partyId:         tx.partyId,
        partyName:       tx.partyName,
        type:            returnType,
        sareeDetails,
        subTotalAmount:  parseFloat(returnTotal.toFixed(2)),
        gstRate:         0,
        gstAmount:       0,
        totalAmount:     parseFloat(returnTotal.toFixed(2)),
        amountPaid:      parseFloat(returnTotal.toFixed(2)),
        pendingDue:      0,
        status:          "Settled",
        transactionDate: returnDate,
        notes:           notes.trim(),
        returnOfTxId:    tx.id,
        createdAt:       serverTimestamp(),
        settledAt:       serverTimestamp(),
      });

      toast.success(`${returnType} of ${fmtINR(returnTotal)} recorded.`);
      onDone();
    } catch (err) {
      toast.error("Failed to record return.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-amber-500/25 p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-slate-100 font-bold text-sm">Record Return Sarees</h4>
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                {returnType}
              </span>
            </div>
            <p className="text-slate-500 text-xs">Record returned stock directly inline for {tx.partyName}</p>
          </div>
        </div>
      </div>

      <div className="field">
        <label className="label flex items-center gap-1.5 text-xs">
          <CalendarDays className="w-3.5 h-3.5 text-amber-400" /> Return Date
        </label>
        <input
          type="date"
          value={returnDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setReturnDate(e.target.value)}
          className="input-base cursor-pointer"
          style={{ fontSize: "16px", padding: "10px 14px" }}
        />
      </div>

      <div>
        <p className="label mb-2 text-xs">Select Sarees to Return</p>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-200 text-xs font-semibold truncate flex-1">{item.sareeName}</p>
                <span className="text-slate-400 text-xs flex-shrink-0 ml-2">@ {fmtINR(item.pricePerUnit)}/pc</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Return Qty (max {item.quantity})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="1"
                    value={item.returnQty}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[i] = { ...updated[i], returnQty: e.target.value };
                      setItems(updated);
                    }}
                    placeholder="0"
                    className="input-base py-1.5 text-sm mt-0.5"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div className="text-right flex-shrink-0 min-w-[72px]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Value</p>
                  <p className="text-amber-400 font-bold num text-sm mt-1">
                    {fmtINR((Number(item.returnQty) || 0) * item.pricePerUnit)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-xl px-3.5 py-2.5 flex justify-between items-center transition-all ${
        returnTotal > 0 ? "bg-amber-500/10 border border-amber-500/25" : "bg-slate-800/40 border border-slate-700/40"
      }`}>
        <span className={`font-semibold text-xs ${returnTotal > 0 ? "text-amber-300" : "text-slate-500"}`}>
          Total Return Value
        </span>
        <span className={`font-bold num text-sm ${returnTotal > 0 ? "text-amber-300" : "text-slate-600"}`}>
          {fmtINR(returnTotal)}
        </span>
      </div>

      <div className="field">
        <label className="label text-xs">Notes (optional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for return, condition of goods…"
          className="input-base resize-none text-xs"
        />
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="btn-secondary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading || returnTotal <= 0}
          onClick={handleSave}
          className="btn-primary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          {loading ? <span className="spinner" /> : <RotateCcw className="w-4 h-4" />}
          {loading ? "Saving…" : "Record Return"}
        </button>
      </div>
    </div>
  );
}

// ── Inline Settle Subview (No pop-up) ──────────────────────────
function InlineSettleView({ tx, uid, onDone }) {
  const isPurchase = tx.type === "Purchase" || tx.type === "Taken" || tx.type === "Purchase Return";

  // ── amount & validation
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── payment mode: "cash" | "cheque" | "neft"
  const [payMode, setPayMode] = useState("cash");

  // ── cash fields
  const todayStr = () => new Date().toISOString().split("T")[0];
  const [cashDate, setCashDate] = useState(todayStr());

  // ── cheque fields
  const [chequeNo, setChequeNo]           = useState("");
  const [chequeReceivedDate, setChequeReceivedDate] = useState(todayStr());
  const [chequeDate, setChequeDate]       = useState("");   // date written on cheque
  const [chequePassDate, setChequePassDate] = useState(""); // cheque cleared / pass date

  // ── NEFT fields
  const [neftRef, setNeftRef]     = useState("");
  const [neftDate, setNeftDate]   = useState(todayStr());

  const currentPaid = Number(tx.amountPaid) || 0;
  const currentTotal = Number(tx.totalAmount) || 0;
  const rawDue = tx.pendingDue !== undefined && tx.pendingDue !== null
    ? Number(tx.pendingDue)
    : Math.max(0, currentTotal - currentPaid);
  const currentDue = isNaN(rawDue) ? Math.max(0, currentTotal - currentPaid) : rawDue;
  const maxAllowed = parseFloat(Math.max(0, currentDue).toFixed(2));

  const validate = () => {
    const n = Number(amount);
    if (!amount) return "Please enter an amount.";
    const e = validateNonNegative(amount);
    if (e) return e;
    if (n <= 0) return "Settlement amount must be greater than zero.";
    if (maxAllowed > 0 && n > maxAllowed + 0.005) {
      return `Cannot exceed the pending balance of ${fmtINR(maxAllowed)}.`;
    }
    if (payMode === "cheque" && !chequeNo.trim()) return "Please enter the cheque number.";
    if (payMode === "cheque" && !chequeDate) return "Please enter the date written on the cheque.";
    return null;
  };

  const handleSettle = async (e) => {
    if (e) e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    if (!uid) { toast.error("Session expired."); return; }

    setLoading(true);
    try {
      const paid = parseFloat(Number(amount).toFixed(2));
      const newPaid = parseFloat((currentPaid + paid).toFixed(2));
      const newDue = parseFloat(Math.max(0, currentDue - paid).toFixed(2));
      const isFullySettled = newDue <= 0.005;

      // Build mode-specific details
      let modeDetails = {};
      if (payMode === "cash") {
        modeDetails = { paymentMode: "Cash", paymentDate: cashDate };
      } else if (payMode === "cheque") {
        modeDetails = {
          paymentMode: "Cheque",
          chequeNo: chequeNo.trim(),
          chequeReceivedDate,
          chequeDate,
          chequePassDate: chequePassDate || null,
        };
      } else if (payMode === "neft") {
        modeDetails = {
          paymentMode: "NEFT",
          neftRefNo: neftRef.trim(),
          paymentDate: neftDate,
        };
      }

      const logEntry = {
        amount: paid,
        date: new Date().toISOString(),
        type: isPurchase ? "Payment to Supplier" : "Receipt from Customer",
        ...modeDetails,
      };

      await updateDoc(doc(db, "users", uid, "transactions", tx.id), {
        amountPaid: newPaid,
        pendingDue: newDue,
        status: isFullySettled ? "Settled" : "Pending",
        settledAt: isFullySettled ? serverTimestamp() : null,
        paymentLogs: arrayUnion(logEntry),
      });

      toast.success(
        isFullySettled
          ? `✅ Fully settled — ${fmtINR(currentTotal)} cleared.`
          : `💰 ${fmtINR(paid)} recorded. ${fmtINR(newDue)} still pending.`
      );
      onDone();
    } catch (err) {
      toast.error("Failed to record settlement.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const settleAll = () => {
    setAmount(String(maxAllowed));
    setError(null);
  };

  // Shared input style helpers
  const fieldCls = "input-base text-xs";
  const labelCls = "label text-xs mb-1";

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/25 p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isPurchase ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
          }`}>
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-slate-100 font-bold text-sm">
              {isPurchase ? "Record Payment to Supplier" : "Record Payment from Customer"}
            </h4>
            <p className="text-slate-500 text-xs">
              {isPurchase ? `Paying to ${tx.partyName}` : `Receiving from ${tx.partyName}`}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 num">
          Due: {fmtINR(maxAllowed)}
        </span>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-800/60 p-2 border border-slate-700/40">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Total</p>
          <p className="text-white font-bold text-xs num">{fmtINR(currentTotal)}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 p-2 border border-slate-700/40">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Paid</p>
          <p className="text-emerald-400 font-bold text-xs num">{fmtINR(currentPaid)}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 p-2 border border-slate-700/40">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Pending Due</p>
          <p className="text-amber-400 font-bold text-xs num">{fmtINR(maxAllowed)}</p>
        </div>
      </div>

      {/* Amount input */}
      <div className="field">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={`settle-in-${tx.id}`} className="label flex items-center gap-1 text-xs">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-400" /> Payment Amount (₹)
          </label>
          {maxAllowed > 0 && (
            <button
              type="button"
              onClick={settleAll}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Pay Full ({fmtINR(maxAllowed)})
            </button>
          )}
        </div>
        <input
          id={`settle-in-${tx.id}`}
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
          className={`input-base text-base font-semibold num ${error ? "input-error" : ""}`}
          style={{ fontSize: "16px", padding: "12px 14px" }}
        />
        {error && (
          <p className="flex items-center gap-1 text-rose-400 text-xs mt-1">
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

        {/* Remaining calculation preview */}
        {amount && !error && Number(amount) > 0 && Number(amount) <= maxAllowed && (
          <div className="mt-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 text-xs space-y-1">
            <div className="flex justify-between items-center text-slate-400">
              <span>This Payment:</span>
              <span className="text-emerald-400 font-semibold num">+ {fmtINR(Number(amount))}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-700/40 pt-1 font-semibold">
              <span className="text-slate-300">Remaining Balance:</span>
              <span className={`num ${Math.max(0, maxAllowed - Number(amount)) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {fmtINR(Math.max(0, maxAllowed - Number(amount)))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Payment Mode Selector ── */}
      <div className="field">
        <label className="label text-xs mb-2 block">Payment Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "cash",   icon: "💵", label: "Cash" },
            { key: "cheque", icon: "🏦", label: "Cheque" },
            { key: "neft",   icon: "⚡", label: "NEFT" },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setPayMode(key); setError(null); }}
              className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                payMode === key
                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-500/20"
                  : "bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Cash Fields ── */}
      {payMode === "cash" && (
        <div className="field">
          <label className={labelCls}>Payment Date</label>
          <input
            type="date"
            value={cashDate}
            onChange={(e) => setCashDate(e.target.value)}
            className={fieldCls}
          />
        </div>
      )}

      {/* ── Cheque Fields ── */}
      {payMode === "cheque" && (
        <div className="space-y-3 rounded-xl bg-slate-800/40 border border-slate-700/40 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Cheque Details</p>

          {/* Cheque Number */}
          <div className="field">
            <label className={labelCls}>Cheque Number <span className="text-rose-400">*</span></label>
            <input
              type="text"
              value={chequeNo}
              onChange={(e) => { setChequeNo(e.target.value); setError(null); }}
              placeholder="e.g. 004521"
              className={fieldCls}
            />
          </div>

          {/* 3 date fields in a grid */}
          <div className="grid grid-cols-1 gap-3">
            <div className="field">
              <label className={labelCls}>
                📅 Cheque Received Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={chequeReceivedDate}
                onChange={(e) => setChequeReceivedDate(e.target.value)}
                className={fieldCls}
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Date you received the cheque</p>
            </div>

            <div className="field">
              <label className={labelCls}>
                🗓️ Cheque Date (Date Written on Cheque) <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={chequeDate}
                onChange={(e) => { setChequeDate(e.target.value); setError(null); }}
                className={fieldCls}
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Date printed / written on the cheque</p>
            </div>

            <div className="field">
              <label className={labelCls}>✅ Cheque Pass Date (Cleared)</label>
              <input
                type="date"
                value={chequePassDate}
                onChange={(e) => setChequePassDate(e.target.value)}
                className={fieldCls}
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Date cheque was cleared by bank (optional)</p>
            </div>
          </div>
        </div>
      )}

      {/* ── NEFT Fields ── */}
      {payMode === "neft" && (
        <div className="space-y-3 rounded-xl bg-slate-800/40 border border-slate-700/40 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">NEFT / Online Transfer Details</p>

          <div className="field">
            <label className={labelCls}>Transaction / UTR Reference No.</label>
            <input
              type="text"
              value={neftRef}
              onChange={(e) => setNeftRef(e.target.value)}
              placeholder="e.g. UTIB026547893021"
              className={fieldCls}
            />
          </div>

          <div className="field">
            <label className={labelCls}>Transfer Date</label>
            <input
              type="date"
              value={neftDate}
              onChange={(e) => setNeftDate(e.target.value)}
              className={fieldCls}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="btn-secondary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading || !amount || Number(amount) <= 0}
          onClick={handleSettle}
          className="btn-primary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          {loading ? <span className="spinner" /> : <CreditCard className="w-4 h-4" />}
          {loading ? "Recording…" : "Record Payment"}
        </button>
      </div>
    </div>
  );
}

// ── Inline Edit Sarees / Add Items Subview (No pop-up) ─────────
function InlineEditItemsView({ tx, uid, onDone }) {
  const initialItems = (tx.sareeDetails && tx.sareeDetails.length > 0)
    ? tx.sareeDetails.map((it) => ({
        sareeName: it.sareeName || "",
        quantity: it.quantity ?? 1,
        pricePerUnit: it.pricePerUnit ?? "",
      }))
    : [{ sareeName: "", quantity: 1, pricePerUnit: "" }];

  const [items,   setItems]   = useState(initialItems);
  const [loading, setLoading] = useState(false);

  const updateItem = (index, field, val) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const incrementQty = (index) => {
    const cur = Number(items[index].quantity) || 0;
    updateItem(index, "quantity", cur + 1);
  };

  const decrementQty = (index) => {
    const cur = Number(items[index].quantity) || 1;
    if (cur > 1) {
      updateItem(index, "quantity", cur - 1);
    }
  };

  const addItemRow = () => {
    setItems([...items, { sareeName: "", quantity: 1, pricePerUnit: "" }]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const totalSareesCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const newSubtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.pricePerUnit) || 0), 0);
  const gstRate = Number(tx.gstRate) || 0;
  const newGst = gstRate > 0 ? parseFloat((newSubtotal * (gstRate / 100)).toFixed(2)) : 0;
  const newTotal = parseFloat((newSubtotal + newGst).toFixed(2));
  const paidSoFar = Number(tx.amountPaid) || 0;
  const newDue = parseFloat(Math.max(0, newTotal - paidSoFar).toFixed(2));

  const handleSave = async () => {
    // Validate
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.sareeName.trim()) {
        toast.error(`Please enter a name for saree item #${i + 1}.`);
        return;
      }
      if (!it.quantity || Number(it.quantity) <= 0) {
        toast.error(`Enter a valid quantity (> 0) for saree item #${i + 1}.`);
        return;
      }
      if (it.pricePerUnit === "" || isNaN(Number(it.pricePerUnit)) || Number(it.pricePerUnit) < 0) {
        toast.error(`Enter a valid price (>= 0) for saree item #${i + 1}.`);
        return;
      }
    }

    if (!uid) { toast.error("Session expired."); return; }
    setLoading(true);

    try {
      const sareeDetails = items.map((it) => ({
        sareeName:    it.sareeName.trim(),
        quantity:     Number(it.quantity),
        pricePerUnit: Number(it.pricePerUnit),
        subtotal:     parseFloat((Number(it.quantity) * Number(it.pricePerUnit)).toFixed(2)),
      }));

      const isFullySettled = newDue <= 0.005;

      await updateDoc(doc(db, "users", uid, "transactions", tx.id), {
        sareeDetails,
        subTotalAmount: parseFloat(newSubtotal.toFixed(2)),
        gstAmount:      newGst,
        totalAmount:    newTotal,
        pendingDue:     newDue,
        status:         isFullySettled ? "Settled" : "Pending",
        settledAt:      isFullySettled ? (tx.settledAt || serverTimestamp()) : null,
      });

      toast.success("Saree counts & items updated successfully.");
      onDone();
    } catch (err) {
      toast.error("Failed to update saree items.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/25 p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <Pencil className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-slate-100 font-bold text-sm">Edit Sarees & Add Items</h4>
            <p className="text-slate-500 text-xs">{tx.partyName} · Adjust counts or add new sarees</p>
          </div>
        </div>
        <span className="text-xs font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30">
          {totalSareesCount} {totalSareesCount === 1 ? "Saree" : "Sarees"} Total
        </span>
      </div>

      {/* Saree rows */}
      <div className="space-y-3">
        {items.map((item, idx) => {
          const itemSub = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);
          return (
            <div key={idx} className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  #{idx + 1} Saree Item
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold num text-slate-300">
                    Subtotal: <strong className="text-white">{fmtINR(itemSub)}</strong>
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Saree Name */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Saree Name / Description
                </label>
                <input
                  type="text"
                  value={item.sareeName}
                  onChange={(e) => updateItem(idx, "sareeName", e.target.value)}
                  placeholder="e.g. Kanchipuram Silk, Banarasi, Cotton…"
                  className="input-base py-1.5 text-xs sm:text-sm mt-0.5"
                />
              </div>

              {/* Quantity Count & Price per unit */}
              <div className="grid grid-cols-2 gap-2">
                {/* Count stepper */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Count / Quantity
                  </label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <button
                      type="button"
                      onClick={() => decrementQty(idx)}
                      disabled={Number(item.quantity) <= 1}
                      className="w-8 h-8 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      className="input-base py-1 text-center font-bold text-sm min-w-0"
                      style={{ fontSize: "16px" }}
                    />
                    <button
                      type="button"
                      onClick={() => incrementQty(idx)}
                      className="w-8 h-8 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Price per unit */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Price / Unit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.pricePerUnit}
                    onChange={(e) => updateItem(idx, "pricePerUnit", e.target.value)}
                    placeholder="0.00"
                    className="input-base py-1.5 text-sm mt-0.5 num"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Saree Item Button */}
      <button
        type="button"
        onClick={addItemRow}
        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
      >
        <Plus className="w-4 h-4 text-indigo-400" />
        <span>+ Add Another Saree / Item</span>
      </button>

      {/* Live Financial Breakdown Summary */}
      <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1.5 text-xs">
        <div className="flex justify-between items-center text-slate-400">
          <span>Total Saree Count:</span>
          <span className="text-white font-bold">{totalSareesCount} pcs</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Subtotal Amount:</span>
          <span className="text-slate-200 font-semibold num">{fmtINR(newSubtotal)}</span>
        </div>
        {gstRate > 0 && (
          <div className="flex justify-between items-center text-slate-400">
            <span>GST ({gstRate}%):</span>
            <span className="text-slate-200 font-semibold num">{fmtINR(newGst)}</span>
          </div>
        )}
        <div className="flex justify-between items-center border-t border-slate-800 pt-1.5 font-bold text-sm">
          <span className="text-white">New Total Amount:</span>
          <span className="text-white num">{fmtINR(newTotal)}</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Paid So Far:</span>
          <span className="text-emerald-400 font-semibold num">{fmtINR(paidSoFar)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-slate-800/80 pt-1 font-semibold">
          <span className="text-slate-300">Remaining Balance:</span>
          <span className={`num ${newDue > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {newDue > 0 ? fmtINR(newDue) : "✅ Fully Settled"}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="btn-secondary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading || items.length === 0}
          onClick={handleSave}
          className="btn-primary flex-1 text-xs"
          style={{ minHeight: "44px" }}
        >
          {loading ? <span className="spinner" /> : <Pencil className="w-4 h-4" />}
          {loading ? "Saving Changes…" : "Save Sarees & Totals"}
        </button>
      </div>
    </div>
  );
}

// ── Detail Drawer (Contains all inline subviews) ───────────────
function DetailDrawer({ tx, uid, activeTab = "details", onTabChange, onClose }) {
  const terms = getPaymentTerms(tx);
  const total = Number(tx.totalAmount) || 0;
  const paid  = Number(tx.amountPaid) || 0;
  const due   = Number(tx.pendingDue) || 0;
  const pct   = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const totalSarees = (tx.sareeDetails || []).reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

  return (
    <div className="px-3.5 pb-4 sm:px-4 animate-slide-up">
      <div className="card bg-slate-950/80 border border-slate-800 p-4 mt-2 space-y-4">

        {/* Invoice & Party Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-100 font-bold text-sm">{tx.partyName}</span>
                {tx.invoiceNumber && (
                  <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                    Invoice #{tx.invoiceNumber}
                  </span>
                )}
                {totalSarees > 0 && (
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                    🏷️ {totalSarees} sarees
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Date: {formatDate(tx.transactionDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={tx.type} />
            <StatusBadge status={tx.status} />
          </div>
        </div>

        {/* ── Subview Switcher Tab Bar (All inside the same card) ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => onTabChange("details")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
              activeTab === "details"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Details & Terms
          </button>

          <button
            type="button"
            onClick={() => onTabChange("editItems")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
              activeTab === "editItems"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/15"
            }`}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit Sarees / Add Items
          </button>

          <button
            type="button"
            onClick={() => onTabChange("calendar")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
              activeTab === "calendar"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Change Date
          </button>

          {canReturn(tx) && (
            <button
              type="button"
              onClick={() => onTabChange("return")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
                activeTab === "return"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Return Sarees
            </button>
          )}

          {(tx.status === "Pending" || due > 0) && (
            <button
              type="button"
              onClick={() => onTabChange("settle")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
                activeTab === "settle"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" /> Settle Due ({fmtINR(due)})
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
              title="Hide Details"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Subview 1: Details & Terms ── */}
        {activeTab === "details" && (
          <div className="space-y-4 animate-fade-in">
            {/* Payment Details & Term-by-Term Installments */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Payment Installment Terms ({terms.length} {terms.length === 1 ? "term" : "terms"})
                  </h4>
                </div>
                <span className={`text-xs font-bold num ${due <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {due <= 0 ? "✅ 100% Settled" : `${fmtINR(due)} Due`}
                </span>
              </div>

              {terms.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-800/40 text-center">
                  <p className="text-slate-400 text-xs font-medium">No payments received yet.</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">Total invoice amount {fmtINR(total)} is pending.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {terms.map((term, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3 bg-slate-800/60 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {term.termNumber}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-slate-100 font-semibold text-xs">{term.title}</span>
                            <span className="text-slate-500 text-[11px]">📅 {formatDate(term.date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <p className="text-slate-400 text-[11px]">{term.type}</p>
                            {term.paymentMode && !term.isInitial && (() => {
                              const modeMap = {
                                Cash:   { icon: "💵", cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
                                Cheque: { icon: "🏦", cls: "bg-blue-500/15 border-blue-500/30 text-blue-300" },
                                NEFT:   { icon: "⚡", cls: "bg-violet-500/15 border-violet-500/30 text-violet-300" },
                              };
                              const m = modeMap[term.paymentMode] || { icon: "💳", cls: "bg-slate-700/40 border-slate-600/30 text-slate-300" };
                              return (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${m.cls}`}>
                                  {m.icon} {term.paymentMode}
                                  {term.paymentMode === "Cheque" && term.chequeNo && (
                                    <span className="opacity-70">#{term.chequeNo}</span>
                                  )}
                                  {term.paymentMode === "NEFT" && term.neftRefNo && (
                                    <span className="opacity-70 font-mono">{term.neftRefNo}</span>
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                          {/* Cheque extra dates */}
                          {term.paymentMode === "Cheque" && !term.isInitial && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {term.chequeReceivedDate && (
                                <span className="text-[10px] text-slate-500">Rcvd: <span className="text-slate-400">{formatDate(term.chequeReceivedDate)}</span></span>
                              )}
                              {term.chequeDate && (
                                <span className="text-[10px] text-slate-500">Chq Date: <span className="text-slate-400">{formatDate(term.chequeDate)}</span></span>
                              )}
                              {term.chequePassDate && (
                                <span className="text-[10px] text-emerald-600">✅ Cleared: <span className="text-emerald-500">{formatDate(term.chequePassDate)}</span></span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 border-slate-700/40 pt-1.5 sm:pt-0 sm:text-right">
                        <div>
                          <p className="text-emerald-400 font-bold text-sm num">+ {fmtINR(term.amount)}</p>
                          <p className="text-slate-500 text-[10px] num">Remaining: {fmtINR(term.balanceAfter)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress bar */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Total: <strong className="text-white num">{fmtINR(total)}</strong></span>
                  <span>Paid: <strong className="text-emerald-400 num">{fmtINR(paid)}</strong></span>
                  <span>Due: <strong className={due > 0 ? "text-amber-400 num" : "text-slate-500 num"}>{fmtINR(due)}</strong></span>
                </div>
                <div className="progress-track h-2">
                  <div className="progress-fill bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 text-right">
                  {pct}% completed ({terms.length} term{terms.length !== 1 ? "s" : ""} paid)
                </p>
              </div>
            </div>

            {/* Saree items with Edit Sarees / Add Items Button */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Saree Items ({totalSarees} total count)
                </p>
                <button
                  type="button"
                  onClick={() => onTabChange("editItems")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-all"
                >
                  <Pencil className="w-3 h-3 text-indigo-400" />
                  <span>Edit Count / Add Items</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {(tx.sareeDetails || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm gap-2 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-slate-300 truncate min-w-0 flex-1 text-xs sm:text-sm">
                      {item.sareeName} <span className="text-slate-500 text-xs">×{item.quantity}</span>
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-slate-500 text-xs">@ {fmtINR(item.pricePerUnit)}</span>
                      <span className="text-slate-200 num font-medium text-xs sm:text-sm">{fmtINR(item.subtotal ?? item.lineTotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs sm:text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 flex-shrink-0">Subtotal</span>
                <span className="text-slate-300 num truncate">{fmtINR(tx.subTotalAmount ?? tx.totalAmount)}</span>
              </div>
              {tx.gstRate > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 flex-shrink-0">GST ({tx.gstRate}%)</span>
                  <span className="text-slate-300 num truncate">{fmtINR(tx.gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-2 font-semibold">
                <span className="text-white flex-shrink-0">Total Amount</span>
                <span className="text-white num truncate">{fmtINR(tx.totalAmount)}</span>
              </div>
            </div>

            {/* Notes */}
            {tx.notes && (
              <div className="border-t border-slate-800 pt-2.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-slate-400 text-xs break-words">📝 {tx.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Subview 2: Edit Sarees Count & Add Items Inline ── */}
        {activeTab === "editItems" && (
          <InlineEditItemsView tx={tx} uid={uid} onDone={() => onTabChange("details")} />
        )}

        {/* ── Subview 3: Change Date Inline ── */}
        {activeTab === "calendar" && (
          <InlineCalendarView tx={tx} uid={uid} onDone={() => onTabChange("details")} />
        )}

        {/* ── Subview 4: Return Sarees Inline ── */}
        {activeTab === "return" && (
          <InlineReturnView tx={tx} uid={uid} onDone={() => onTabChange("details")} />
        )}

        {/* ── Subview 5: Settle Due Payment Inline ── */}
        {activeTab === "settle" && (
          <InlineSettleView tx={tx} uid={uid} onDone={() => onTabChange("details")} />
        )}

      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function TransactionHistoryTable({ transactions, loading, error }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [activeTab,    setActiveTab]    = useState(null); // null = All, "Sales", "Purchases"
  const [searchParty,  setSearchParty]  = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  // Inline expansion state: id = transaction ID, tab = "details" | "editItems" | "calendar" | "return" | "settle"
  const [expandedId,   setExpandedId]   = useState(null);
  const [expandedTab,  setExpandedTab]  = useState("details");

  // Live counts for tabs
  const salesCount     = transactions.filter((tx) => isSale(tx.type)).length;
  const purchasesCount = transactions.filter((tx) => isPurchase(tx.type)).length;

  const isReturn       = (t) => t === "Sale Return" || t === "Purchase Return";

  // Tab → search/status filtering
  const tabFiltered = activeTab === "Sales"
    ? transactions.filter((tx) => isSale(tx.type))
    : activeTab === "Purchases"
    ? transactions.filter((tx) => isPurchase(tx.type))
    : transactions;

  const filtered = tabFiltered.filter((tx) => {
    const q           = searchParty.trim().toLowerCase();
    const matchParty  = !q
      || tx.partyName?.toLowerCase().includes(q)
      || tx.invoiceNumber?.toLowerCase().includes(q)
      || tx.notes?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "All"
      ? true
      : filterStatus === "Returns"
      ? (isReturn(tx.type) || !!tx.returnOfTxId)
      : tx.status === filterStatus;
    return matchParty && matchStatus;
  });

  // Action toggle helper: opens inline subview or closes if clicking same action
  const handleAction = (txId, tab) => {
    if (expandedId === txId && expandedTab === tab) {
      setExpandedId(null);
    } else {
      setExpandedId(txId);
      setExpandedTab(tab);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── 2 Prominent Section Tabs ── */}
      <div className="flex gap-3">
        {[
          { key: "Sales",     count: salesCount,     Icon: ArrowUpRight,  color: "indigo" },
          { key: "Purchases", count: purchasesCount, Icon: ArrowDownLeft, color: "rose"   },
        ].map(({ key, count, Icon, color }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(active ? null : key)}
              className={`flex-1 flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border font-semibold text-sm transition-all duration-200 ${
                active
                  ? color === "indigo"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/25"
                  : color === "indigo"
                  ? "bg-indigo-500/8 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/15 hover:border-indigo-500/40"
                  : "bg-rose-500/8 border-rose-500/20 text-rose-300 hover:bg-rose-500/15 hover:border-rose-500/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span>{key}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold tabular-nums ${
                active
                  ? "bg-white/20 text-white"
                  : color === "indigo" ? "bg-indigo-500/20 text-indigo-300" : "bg-rose-500/20 text-rose-300"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ── */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input type="text" value={searchParty} onChange={(e) => setSearchParty(e.target.value)}
            placeholder="Search by party, invoice no, notes…"
            className="input-base pl-10 pr-9 py-2 text-sm" />
          {searchParty && (
            <button onClick={() => setSearchParty("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800/60 flex-shrink-0">
          {["All", "Pending", "Settled", "Returns"].map((s) => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className={`tab-item py-1.5 px-3 text-xs${filterStatus === s ? " active" : ""}`}>
              {s === "Returns" ? "↩ Returns" : s}
            </button>
          ))}
        </div>
      </div>

      {/* ── States ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading transactions…
        </div>
      ) : error ? (
        <div className="alert-error"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No transactions recorded yet</p>
          <p className="text-slate-600 text-sm mt-1">Use the Ledger tab to record your first transaction.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="w-8 h-8 text-slate-600 mb-3" />
          <p className="text-slate-400 font-semibold">No results match your filters</p>
          <p className="text-slate-600 text-sm mt-1">Try clearing the filters above.</p>
        </div>
      ) : (
        <>
          <p className="text-slate-500 text-xs px-1">
            Showing {filtered.length} of {transactions.length} transactions
            {activeTab && <span className="text-slate-600"> · {activeTab} only — tap tab to clear</span>}
          </p>

          {/* ── Desktop Table ── */}
          <div className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px]">
                <thead className="bg-slate-900/60 border-b border-slate-800/60">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Invoice #</th>
                    <th className="table-th">Party</th>
                    <th className="table-th">Type</th>
                    <th className="table-th text-right">Total</th>
                    <th className="table-th text-right">Paid</th>
                    <th className="table-th text-right">Due</th>
                    <th className="table-th">Status</th>
                    <th className="table-th text-center">Actions</th>
                  </tr>
                </thead>
                {filtered.map((tx) => {
                  const termsCount = getPaymentTerms(tx).length;
                  const totalSarees = (tx.sareeDetails || []).reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                  const isExpanded = expandedId === tx.id;
                  return (
                    <tbody key={tx.id}>
                      <tr className="table-row">
                        <td className="table-td text-slate-400 text-sm whitespace-nowrap">{formatDate(tx.transactionDate)}</td>
                        <td className="table-td">
                          {tx.invoiceNumber ? (
                            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
                              <FileText className="w-3 h-3 text-indigo-400" />
                              {tx.invoiceNumber}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="table-td cursor-pointer" onClick={() => handleAction(tx.id, "details")}>
                          <p className="text-slate-200 font-semibold text-sm hover:text-indigo-300 transition-colors">{tx.partyName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {totalSarees > 0 && (
                              <span className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 px-1.5 py-0.2 rounded">
                                {totalSarees} sarees
                              </span>
                            )}
                            {termsCount > 0 && (
                              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                {termsCount} term{termsCount > 1 ? "s" : ""}
                              </span>
                            )}
                            {tx.returnOfTxId && <span className="text-[10px] text-amber-500">↩ Return</span>}
                          </div>
                        </td>
                        <td className="table-td"><TypeBadge type={tx.type} /></td>
                        <td className="table-td text-right text-slate-200 font-semibold num text-sm">{fmtINR(tx.totalAmount)}</td>
                        <td className="table-td text-right text-emerald-400 num text-sm">{fmtINR(tx.amountPaid)}</td>
                        <td className="table-td text-right num text-sm">
                          <span className={tx.pendingDue > 0 ? "text-amber-400 font-semibold" : "text-slate-500"}>
                            {fmtINR(tx.pendingDue)}
                          </span>
                        </td>
                        <td className="table-td"><StatusBadge status={tx.status} /></td>
                        <td className="table-td text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Details Button */}
                            <button
                              type="button"
                              onClick={() => handleAction(tx.id, "details")}
                              className={`btn-icon ${isExpanded && expandedTab === "details" ? "text-indigo-400 bg-indigo-500/20" : ""}`}
                              title="View details & terms"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {/* Edit Sarees / Add Items Button with Pencil */}
                            <button
                              type="button"
                              onClick={() => handleAction(tx.id, "editItems")}
                              className={`btn-icon ${isExpanded && expandedTab === "editItems" ? "text-indigo-400 bg-indigo-500/20" : ""}`}
                              title="Edit sarees count / Add items"
                            >
                              <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                            </button>
                            {/* Calendar Button */}
                            <button
                              type="button"
                              onClick={() => handleAction(tx.id, "calendar")}
                              className={`btn-icon ${isExpanded && expandedTab === "calendar" ? "text-indigo-400 bg-indigo-500/20" : ""}`}
                              title="Change date"
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                            </button>
                            {/* Return Button */}
                            {canReturn(tx) && (
                              <button
                                type="button"
                                onClick={() => handleAction(tx.id, "return")}
                                className={`p-2 rounded-lg text-amber-500 hover:text-amber-300 hover:bg-amber-500/10 transition-all duration-150 ${
                                  isExpanded && expandedTab === "return" ? "bg-amber-500/20 text-amber-300" : ""
                                }`}
                                title="Record return"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* Settle Button */}
                            {tx.status === "Pending" && (
                              <button
                                type="button"
                                onClick={() => handleAction(tx.id, "settle")}
                                className={`btn-emerald text-xs py-1.5 px-2.5 ${
                                  isExpanded && expandedTab === "settle" ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900" : ""
                                }`}
                              >
                                <CreditCard className="w-3 h-3" /> Settle
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${tx.id}-detail`}>
                          <td colSpan={9} className="p-0">
                            <DetailDrawer
                              tx={tx}
                              uid={uid}
                              activeTab={expandedTab}
                              onTabChange={(tab) => setExpandedTab(tab)}
                              onClose={() => setExpandedId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </table>
            </div>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="md:hidden space-y-3">
            {filtered.map((tx) => {
              const termsCount = getPaymentTerms(tx).length;
              const totalSarees = (tx.sareeDetails || []).reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
              const isExpanded = expandedId === tx.id;
              return (
                <div key={tx.id} className="card overflow-hidden border border-slate-800/80 hover:border-slate-700 transition-all">
                  {/* Tap card body/header to toggle details */}
                  <div
                    onClick={() => handleAction(tx.id, "details")}
                    className="p-3.5 sm:p-4 cursor-pointer select-none active:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-slate-100 font-bold text-sm truncate">{tx.partyName}</p>
                          {tx.invoiceNumber && (
                            <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
                              #{tx.invoiceNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-slate-500 text-xs">{formatDate(tx.transactionDate)}</p>
                          {totalSarees > 0 && (
                            <span className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded">
                              🏷️ {totalSarees} sarees
                            </span>
                          )}
                          {termsCount > 0 && (
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              💰 {termsCount} term{termsCount > 1 ? "s" : ""}
                            </span>
                          )}
                          {tx.returnOfTxId && <span className="text-[10px] text-amber-500">↩ Return entry</span>}
                        </div>
                      </div>

                      {/* Top Corner: Badges + Pencil Edit Button */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <TypeBadge type={tx.type} />
                          <StatusBadge status={tx.status} />
                        </div>
                        {/* Pencil Edit button in the top corner! */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAction(tx.id, "editItems"); }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            isExpanded && expandedTab === "editItems"
                              ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400"
                              : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 active:scale-95"
                          }`}
                          title="Edit sarees count / Add items"
                        >
                          <Pencil className="w-3 h-3 text-indigo-400" />
                          <span>Edit / Add Items</span>
                        </button>
                      </div>
                    </div>

                    {/* Tap hint */}
                    <p className="text-[11px] text-indigo-400/90 font-medium mb-3 flex items-center gap-1">
                      {isExpanded ? (
                        <span>▲ Tap card to hide</span>
                      ) : (
                        <span>▼ Tap card to view details & terms</span>
                      )}
                    </p>

                    <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                      <div className="bg-slate-800/60 rounded-xl p-1.5 min-w-0">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider truncate">Total</p>
                        <p className="text-white font-bold text-xs num truncate">{fmtINR(tx.totalAmount)}</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-xl p-1.5 min-w-0">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider truncate">Paid</p>
                        <p className="text-emerald-400 font-bold text-xs num truncate">{fmtINR(tx.amountPaid)}</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-xl p-1.5 min-w-0">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider truncate">Due</p>
                        <p className={`font-bold text-xs num truncate ${tx.pendingDue > 0 ? "text-amber-400" : "text-slate-500"}`}>
                          {fmtINR(tx.pendingDue)}
                        </p>
                      </div>
                    </div>

                    {tx.totalAmount > 0 && (
                      <div className="mb-3">
                        <div className="progress-track h-1">
                          <div className="progress-fill bg-emerald-500"
                            style={{ width: `${Math.min(100, Math.round((tx.amountPaid / tx.totalAmount) * 100))}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Mobile action buttons */}
                    <div className="flex gap-2">
                      {/* Details */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(tx.id, "details"); }}
                        className={`btn-secondary flex-1 text-xs py-2 gap-1.5 ${
                          isExpanded && expandedTab === "details" ? "bg-indigo-600/25 border-indigo-500/50 text-indigo-300" : ""
                        }`}
                      >
                        {isExpanded && expandedTab === "details" ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {isExpanded && expandedTab === "details" ? "Hide" : "Details"}
                      </button>
                      {/* Edit Sarees Pencil button */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(tx.id, "editItems"); }}
                        className={`btn-secondary text-xs py-2 px-3 ${
                          isExpanded && expandedTab === "editItems" ? "bg-indigo-600 border-indigo-500 text-white" : ""
                        }`}
                        title="Edit sarees count / Add items"
                      >
                        <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                      </button>
                      {/* Calendar */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(tx.id, "calendar"); }}
                        className={`btn-secondary text-xs py-2 px-3 ${
                          isExpanded && expandedTab === "calendar" ? "bg-indigo-600 border-indigo-500 text-white" : ""
                        }`}
                        title="Change date"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                      </button>
                      {/* Return */}
                      {canReturn(tx) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAction(tx.id, "return"); }}
                          className={`text-xs py-2 px-3 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all ${
                            isExpanded && expandedTab === "return" ? "bg-amber-600 border-amber-500 text-white" : ""
                          }`}
                          title="Record return"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Settle */}
                      {tx.status === "Pending" && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAction(tx.id, "settle"); }}
                          className={`btn-emerald flex-1 text-xs py-2 ${
                            isExpanded && expandedTab === "settle" ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900" : ""
                          }`}
                        >
                          <CreditCard className="w-3 h-3" /> Settle
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline drawer directly in the card */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-950/70">
                      <DetailDrawer
                        tx={tx}
                        uid={uid}
                        activeTab={expandedTab}
                        onTabChange={(tab) => setExpandedTab(tab)}
                        onClose={() => setExpandedId(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
