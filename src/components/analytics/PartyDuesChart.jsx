import { useState, useMemo } from "react";
import { doc, updateDoc, writeBatch, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { fmtINR, validateNonNegative } from "../../utils/validators";
import {
  Users, ArrowUpRight, ArrowDownLeft, CheckCircle2, Search, X,
  CreditCard, ChevronDown, ChevronUp, AlertCircle, IndianRupee,
  Layers, CheckCheck, Sparkles, Receipt, Calendar, Building2,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Date formatting helper ─────────────────────────────────────
function formatDate(d) {
  if (!d) return "—";
  const clean = String(d).split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return String(d);
}

// ── PARTY-LEVEL BULK SETTLE PANEL (Priority Level 1) ───────────
// Allows settling ALL pending invoices for a party with a SINGLE cheque or payment
function PartyBulkSettlePanel({ party, uid, onDone }) {
  const isPurchase = party.type === "Purchase" || party.type === "Taken" || party.type === "Purchase Return";
  const todayStr = () => new Date().toISOString().split("T")[0];

  // Total pending due calculated accurately from party transactions
  const totalPartyDue = parseFloat(
    party.txs.reduce((acc, t) => acc + (Number(t.pendingDue) || 0), 0).toFixed(2)
  );

  const [amount,             setAmount]             = useState(String(totalPartyDue));
  const [error,              setError]              = useState(null);
  const [loading,            setLoading]            = useState(false);
  const [payMode,            setPayMode]            = useState("cheque"); // Cheque default as priority
  const [cashDate,           setCashDate]           = useState(todayStr());
  const [chequeNo,           setChequeNo]           = useState("");
  const [chequeReceivedDate, setChequeReceivedDate] = useState(todayStr());
  const [chequeDate,         setChequeDate]         = useState(todayStr());
  const [chequePassDate,     setChequePassDate]     = useState("");
  const [neftRef,            setNeftRef]            = useState("");
  const [neftDate,           setNeftDate]           = useState(todayStr());

  const enteredAmount = Number(amount) || 0;

  // Real-time FIFO allocation breakdown across invoices (oldest first)
  const allocations = useMemo(() => {
    let unallocated = Math.max(0, enteredAmount);
    return party.txs.map((tx) => {
      const currentPaid = Number(tx.amountPaid) || 0;
      const currentTotal = Number(tx.totalAmount) || 0;
      const rawDue = tx.pendingDue !== undefined && tx.pendingDue !== null
        ? Number(tx.pendingDue)
        : Math.max(0, currentTotal - currentPaid);
      const txDue = parseFloat(Math.max(0, isNaN(rawDue) ? (currentTotal - currentPaid) : rawDue).toFixed(2));

      const alloc = parseFloat(Math.min(unallocated, txDue).toFixed(2));
      unallocated = parseFloat(Math.max(0, unallocated - alloc).toFixed(2));

      const newPaid = parseFloat((currentPaid + alloc).toFixed(2));
      const newDue = parseFloat(Math.max(0, txDue - alloc).toFixed(2));
      const isFullySettled = newDue <= 0.005;

      return {
        tx,
        txDue,
        currentPaid,
        currentTotal,
        alloc,
        newPaid,
        newDue,
        isFullySettled,
      };
    });
  }, [party.txs, enteredAmount]);

  const fullyClearedCount = allocations.filter((a) => a.isFullySettled && a.alloc > 0).length;
  const partiallyClearedCount = allocations.filter((a) => !a.isFullySettled && a.alloc > 0).length;
  const affectedCount = fullyClearedCount + partiallyClearedCount;
  const remainingPartyDue = parseFloat(Math.max(0, totalPartyDue - enteredAmount).toFixed(2));

  const validate = () => {
    const n = Number(amount);
    if (!amount) return "Please enter settlement amount.";
    const e = validateNonNegative(amount);
    if (e) return e;
    if (n <= 0) return "Settlement amount must be greater than zero.";
    if (n > totalPartyDue + 0.005) {
      return `Amount cannot exceed total party balance of ${fmtINR(totalPartyDue)}.`;
    }
    if (payMode === "cheque" && !chequeNo.trim()) {
      return "Please enter the cheque number.";
    }
    if (payMode === "cheque" && !chequeDate) {
      return "Please enter the date written on the cheque.";
    }
    return null;
  };

  const handleBulkSettle = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!uid) { toast.error("User session expired."); return; }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const paidTotal = parseFloat(Number(amount).toFixed(2));

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

      let count = 0;
      for (const item of allocations) {
        if (item.alloc <= 0.005) continue; // skip transactions that received no funds

        const isTxPurchase = item.tx.type === "Purchase" || item.tx.type === "Taken" || item.tx.type === "Purchase Return";
        const logEntry = {
          amount: item.alloc,
          date: new Date().toISOString(),
          type: isTxPurchase ? "Payment to Supplier" : "Receipt from Customer",
          bulkSettlement: true,
          totalChequeAmount: paidTotal,
          note: payMode === "cheque"
            ? `Single Cheque #${chequeNo.trim()} total ${fmtINR(paidTotal)} for ${party.partyName} (Allocated: ${fmtINR(item.alloc)})`
            : `Bulk settlement of ${fmtINR(paidTotal)} for ${party.partyName} (Allocated: ${fmtINR(item.alloc)})`,
          ...modeDetails,
        };

        const txRef = doc(db, "users", uid, "transactions", item.tx.id);
        batch.update(txRef, {
          amountPaid: item.newPaid,
          pendingDue: item.newDue,
          status: item.isFullySettled ? "Settled" : "Pending",
          settledAt: item.isFullySettled ? serverTimestamp() : null,
          paymentLogs: arrayUnion(logEntry),
        });
        count++;
      }

      if (count === 0) {
        toast.error("No transactions affected.");
        setLoading(false);
        return;
      }

      await batch.commit();

      const payModeLabel = payMode === "cheque" ? `Cheque #${chequeNo.trim()}` : payMode === "cash" ? "Cash" : "NEFT";
      toast.success(
        `✅ Bulk Settle Complete! ${fmtINR(paidTotal)} applied across ${count} invoice${count > 1 ? "s" : ""} via ${payModeLabel}!`,
        { duration: 5500 }
      );
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Failed to record bulk settlement. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldCls = "input-base text-xs";
  const labelCls = "label text-xs mb-1";

  return (
    <div className="rounded-2xl bg-slate-900 border-2 border-emerald-500/50 p-4 sm:p-5 space-y-4 shadow-2xl shadow-emerald-950/50 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isPurchase ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          }`}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-white font-bold text-base">
                Settle All Dues — {party.partyName}
              </h4>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Single Cheque Settle
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              1 cheque or payment automatically distributes across all {party.txCount} pending bills (oldest first)
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right bg-slate-800/60 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-slate-700/50">
          <p className="text-[10px] text-slate-500 font-semibold uppercase">Total Outstanding</p>
          <p className="text-base font-bold text-amber-400 num">{fmtINR(totalPartyDue)}</p>
        </div>
      </div>

      {/* Mini 3-box summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-800/60 p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Due</p>
          <p className="font-bold text-sm num text-amber-400">{fmtINR(totalPartyDue)}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">This Payment</p>
          <p className="font-bold text-sm num text-emerald-400">{fmtINR(enteredAmount)}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Remaining Due</p>
          <p className={`font-bold text-sm num ${remainingPartyDue <= 0.005 ? "text-emerald-400" : "text-amber-400"}`}>
            {fmtINR(remainingPartyDue)}
          </p>
        </div>
      </div>

      {/* Amount Input */}
      <div className="field">
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={`bulk-settle-${party.partyId}`} className="label flex items-center gap-1 text-xs font-semibold text-slate-200">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-400" /> Total Payment Amount (₹)
          </label>
          <button
            type="button"
            onClick={() => { setAmount(String(totalPartyDue)); setError(null); }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2"
          >
            Pay Full Balance ({fmtINR(totalPartyDue)})
          </button>
        </div>
        <input
          id={`bulk-settle-${party.partyId}`}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (v === "" || /^\d*\.?\d*$/.test(v)) { setAmount(v); setError(null); }
          }}
          placeholder={`0.00 (Max: ${fmtINR(totalPartyDue)})`}
          className={`input-base text-base sm:text-lg font-bold num ${error ? "input-error" : ""}`}
          style={{ padding: "12px 14px" }}
        />
        {error && (
          <p className="flex items-center gap-1.5 text-rose-400 text-xs mt-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </p>
        )}

        {/* Quick Presets */}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => { setAmount(String(totalPartyDue)); setError(null); }}
            className="btn-secondary flex-1 text-xs py-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 font-semibold"
          >
            Pay 100% Full ({fmtINR(totalPartyDue)})
          </button>
          {totalPartyDue >= 100 && (
            <button
              type="button"
              onClick={() => { setAmount(String(parseFloat((totalPartyDue / 2).toFixed(2)))); setError(null); }}
              className="btn-secondary text-xs py-2 px-3 sm:px-4"
            >
              50% ({fmtINR(parseFloat((totalPartyDue / 2).toFixed(2)))})
            </button>
          )}
        </div>
      </div>

      {/* Payment Mode Selector */}
      <div className="field">
        <label className="label text-xs mb-1.5 block font-semibold text-slate-300">Payment Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "cheque", icon: "🏦", label: "Cheque (Single Cheque)" },
            { key: "cash",   icon: "💵", label: "Cash" },
            { key: "neft",   icon: "⚡", label: "NEFT / Online" },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setPayMode(key); setError(null); }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                payMode === key
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500/30"
                  : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cheque Details (Highlighted) */}
      {payMode === "cheque" && (
        <div className="space-y-3 rounded-xl bg-slate-800/60 border border-slate-700/60 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
              <span>🏦</span> Cheque Details (Applied to all settled bills)
            </p>
            <span className="text-[10px] text-slate-400">1 Cheque covers multiple invoices</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label className={labelCls}>
                Cheque Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={chequeNo}
                onChange={(e) => { setChequeNo(e.target.value); setError(null); }}
                placeholder="e.g. 004521"
                className={fieldCls}
              />
            </div>

            <div className="field">
              <label className={labelCls}>
                🗓️ Date on Cheque <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={chequeDate}
                onChange={(e) => { setChequeDate(e.target.value); setError(null); }}
                className={fieldCls}
              />
            </div>

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
            </div>

            <div className="field">
              <label className={labelCls}>
                ✅ Cheque Pass Date (Cleared)
              </label>
              <input
                type="date"
                value={chequePassDate}
                onChange={(e) => setChequePassDate(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cash Details */}
      {payMode === "cash" && (
        <div className="field">
          <label className={labelCls}>Payment Date</label>
          <input type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} className={fieldCls} />
        </div>
      )}

      {/* NEFT Details */}
      {payMode === "neft" && (
        <div className="space-y-3 rounded-xl bg-slate-800/60 border border-slate-700/60 p-3.5">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">NEFT / Online Transfer</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label className={labelCls}>UTR / Reference No.</label>
              <input type="text" value={neftRef} onChange={(e) => setNeftRef(e.target.value)} placeholder="e.g. UTIB026547893021" className={fieldCls} />
            </div>
            <div className="field">
              <label className={labelCls}>Transfer Date</label>
              <input type="date" value={neftDate} onChange={(e) => setNeftDate(e.target.value)} className={fieldCls} />
            </div>
          </div>
        </div>
      )}

      {/* Live Invoices Distribution Breakdown */}
      <div className="space-y-2 rounded-xl bg-slate-800/40 border border-slate-700/50 p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-indigo-400" />
            Automatic Distribution across Invoices
          </span>
          <span className="text-emerald-400 font-semibold text-[11px]">
            {fullyClearedCount} of {party.txCount} fully cleared
          </span>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {allocations.map(({ tx, txDue, alloc, newDue, isFullySettled }) => (
            <div
              key={tx.id}
              className={`flex items-center justify-between text-xs p-2 rounded-lg border transition-all ${
                isFullySettled
                  ? "bg-emerald-950/30 border-emerald-500/30 text-slate-200"
                  : alloc > 0
                  ? "bg-amber-950/20 border-amber-500/30 text-slate-200"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isFullySettled ? (
                  <CheckCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : alloc > 0 ? (
                  <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0" />
                )}
                <div className="truncate">
                  <span className="font-mono font-bold text-slate-300 mr-2">
                    {tx.invoiceNumber ? `#${tx.invoiceNumber}` : "Bill"}
                  </span>
                  <span className="text-[11px] text-slate-500 mr-2">
                    {formatDate(tx.transactionDate)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Due: <span className="num font-semibold">{fmtINR(txDue)}</span>
                  </span>
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-2">
                {alloc > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold num text-xs">
                      +{fmtINR(alloc)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isFullySettled
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {isFullySettled ? "Cleared" : `Bal: ${fmtINR(newDue)}`}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 italic">No allocation</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
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
          onClick={handleBulkSettle}
          className="btn-primary flex-[2] text-xs font-bold"
          style={{ minHeight: "44px" }}
        >
          {loading ? <span className="spinner" /> : <CheckCheck className="w-4 h-4 text-emerald-300" />}
          {loading ? "Recording Settle All…" : `Confirm & Settle All (${fmtINR(Number(amount) || 0)})`}
        </button>
      </div>
    </div>
  );
}

// ── Inline Single-Transaction Settle Panel ─────────────────────
function InlineSettlePanel({ tx, uid, onDone }) {
  const isPurchase = tx.type === "Purchase" || tx.type === "Taken" || tx.type === "Purchase Return";
  const todayStr = () => new Date().toISOString().split("T")[0];

  const [amount,             setAmount]             = useState("");
  const [error,              setError]              = useState(null);
  const [loading,            setLoading]            = useState(false);
  const [payMode,            setPayMode]            = useState("cash");
  const [cashDate,           setCashDate]           = useState(todayStr());
  const [chequeNo,           setChequeNo]           = useState("");
  const [chequeReceivedDate, setChequeReceivedDate] = useState(todayStr());
  const [chequeDate,         setChequeDate]         = useState("");
  const [chequePassDate,     setChequePassDate]     = useState("");
  const [neftRef,            setNeftRef]            = useState("");
  const [neftDate,           setNeftDate]           = useState(todayStr());

  const currentPaid  = Number(tx.amountPaid)  || 0;
  const currentTotal = Number(tx.totalAmount) || 0;
  const rawDue = tx.pendingDue !== undefined && tx.pendingDue !== null
    ? Number(tx.pendingDue) : Math.max(0, currentTotal - currentPaid);
  const currentDue = isNaN(rawDue) ? Math.max(0, currentTotal - currentPaid) : rawDue;
  const maxAllowed  = parseFloat(Math.max(0, currentDue).toFixed(2));

  const validate = () => {
    const n = Number(amount);
    if (!amount) return "Please enter an amount.";
    const e = validateNonNegative(amount);
    if (e) return e;
    if (n <= 0) return "Settlement amount must be greater than zero.";
    if (maxAllowed > 0 && n > maxAllowed + 0.005)
      return `Cannot exceed pending balance of ${fmtINR(maxAllowed)}.`;
    if (payMode === "cheque" && !chequeNo.trim()) return "Please enter the cheque number.";
    if (payMode === "cheque" && !chequeDate) return "Please enter the date on the cheque.";
    return null;
  };

  const handleSettle = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!uid) { toast.error("Session expired."); return; }
    setLoading(true);
    try {
      const paid = parseFloat(Number(amount).toFixed(2));
      const newPaid = parseFloat((currentPaid + paid).toFixed(2));
      const newDue  = parseFloat(Math.max(0, currentDue - paid).toFixed(2));
      const isFullySettled = newDue <= 0.005;

      let modeDetails = {};
      if (payMode === "cash")   modeDetails = { paymentMode: "Cash",   paymentDate: cashDate };
      if (payMode === "cheque") modeDetails = { paymentMode: "Cheque", chequeNo: chequeNo.trim(), chequeReceivedDate, chequeDate, chequePassDate: chequePassDate || null };
      if (payMode === "neft")   modeDetails = { paymentMode: "NEFT",   neftRefNo: neftRef.trim(), paymentDate: neftDate };

      await updateDoc(doc(db, "users", uid, "transactions", tx.id), {
        amountPaid:  newPaid,
        pendingDue:  newDue,
        status:      isFullySettled ? "Settled" : "Pending",
        settledAt:   isFullySettled ? serverTimestamp() : null,
        paymentLogs: arrayUnion({
          amount: paid,
          date:   new Date().toISOString(),
          type:   isPurchase ? "Payment to Supplier" : "Receipt from Customer",
          ...modeDetails,
        }),
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

  const fCls = "input-base text-xs";
  const lCls = "label text-xs mb-1";

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/25 p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isPurchase ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}>
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <p className="text-slate-100 font-semibold text-sm">
            {isPurchase ? "Pay Supplier" : "Receive Payment"}
          </p>
        </div>
        <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/30 num">
          Due: {fmtINR(maxAllowed)}
        </span>
      </div>

      {/* Mini summary */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[["Total", fmtINR(currentTotal), "text-white"], ["Paid", fmtINR(currentPaid), "text-emerald-400"], ["Due", fmtINR(maxAllowed), "text-amber-400"]].map(([l, v, c]) => (
          <div key={l} className="rounded-xl bg-slate-800/60 p-2 border border-slate-700/40">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">{l}</p>
            <p className={`font-bold text-xs num ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Amount */}
      <div className="field">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={`due-settle-${tx.id}`} className="label flex items-center gap-1 text-xs">
            <IndianRupee className="w-3 h-3 text-emerald-400" /> Amount (₹)
          </label>
          {maxAllowed > 0 && (
            <button type="button" onClick={() => { setAmount(String(maxAllowed)); setError(null); }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
              Pay Full ({fmtINR(maxAllowed)})
            </button>
          )}
        </div>
        <input
          id={`due-settle-${tx.id}`}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (v === "" || /^\d*\.?\d*$/.test(v)) { setAmount(v); setError(null); }
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
        {maxAllowed >= 100 && (
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => { setAmount(String(maxAllowed)); setError(null); }}
              className="btn-secondary flex-1 text-xs py-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
              Full ({fmtINR(maxAllowed)})
            </button>
            <button type="button"
              onClick={() => { setAmount(String(parseFloat((maxAllowed / 2).toFixed(2)))); setError(null); }}
              className="btn-secondary text-xs py-1.5 px-3">
              50% ({fmtINR(parseFloat((maxAllowed / 2).toFixed(2)))})
            </button>
          </div>
        )}
        {amount && !error && Number(amount) > 0 && Number(amount) <= maxAllowed && (
          <div className="mt-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>This Payment:</span>
              <span className="text-emerald-400 font-semibold num">+ {fmtINR(Number(amount))}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700/40 pt-1 font-semibold">
              <span className="text-slate-300">Remaining:</span>
              <span className={`num ${Math.max(0, maxAllowed - Number(amount)) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {fmtINR(Math.max(0, maxAllowed - Number(amount)))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Payment Mode */}
      <div className="field">
        <label className="label text-xs mb-2 block">Payment Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {[{ key: "cash", icon: "💵", label: "Cash" }, { key: "cheque", icon: "🏦", label: "Cheque" }, { key: "neft", icon: "⚡", label: "NEFT" }].map(({ key, icon, label }) => (
            <button key={key} type="button" onClick={() => { setPayMode(key); setError(null); }}
              className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                payMode === key
                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                  : "bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}>
              <span className="text-base">{icon}</span><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cash */}
      {payMode === "cash" && (
        <div className="field">
          <label className={lCls}>Payment Date</label>
          <input type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} className={fCls} />
        </div>
      )}

      {/* Cheque */}
      {payMode === "cheque" && (
        <div className="space-y-3 rounded-xl bg-slate-800/40 border border-slate-700/40 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Cheque Details</p>
          <div className="field">
            <label className={lCls}>Cheque Number <span className="text-rose-400">*</span></label>
            <input type="text" value={chequeNo} onChange={(e) => { setChequeNo(e.target.value); setError(null); }} placeholder="e.g. 004521" className={fCls} />
          </div>
          <div className="field">
            <label className={lCls}>Cheque Received Date <span className="text-rose-400">*</span></label>
            <input type="date" value={chequeReceivedDate} onChange={(e) => setChequeReceivedDate(e.target.value)} className={fCls} />
          </div>
          <div className="field">
            <label className={lCls}>Date on Cheque <span className="text-rose-400">*</span></label>
            <input type="date" value={chequeDate} onChange={(e) => { setChequeDate(e.target.value); setError(null); }} className={fCls} />
          </div>
          <div className="field">
            <label className={lCls}>Cheque Pass Date (optional)</label>
            <input type="date" value={chequePassDate} onChange={(e) => setChequePassDate(e.target.value)} className={fCls} />
          </div>
        </div>
      )}

      {/* NEFT */}
      {payMode === "neft" && (
        <div className="space-y-3 rounded-xl bg-slate-800/40 border border-slate-700/40 p-3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">NEFT / Online Transfer</p>
          <div className="field">
            <label className={lCls}>UTR / Reference No.</label>
            <input type="text" value={neftRef} onChange={(e) => setNeftRef(e.target.value)} placeholder="e.g. UTIB026547893021" className={fCls} />
          </div>
          <div className="field">
            <label className={lCls}>Transfer Date</label>
            <input type="date" value={neftDate} onChange={(e) => setNeftDate(e.target.value)} className={fCls} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onDone} className="btn-secondary flex-1 text-xs" style={{ minHeight: "44px" }}>
          Cancel
        </button>
        <button type="button" disabled={loading || !amount || Number(amount) <= 0} onClick={handleSettle}
          className="btn-primary flex-1 text-xs" style={{ minHeight: "44px" }}>
          {loading ? <span className="spinner" /> : <CreditCard className="w-4 h-4" />}
          {loading ? "Recording…" : "Record Payment"}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function PartyDuesChart({ transactions = [], parties = [] }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [search,               setSearch]               = useState("");
  const [bulkSettlingPartyId,  setBulkSettlingPartyId]  = useState(null); // Priority 1: Party bulk settle
  const [expandedParty,        setExpandedParty]        = useState(null); // Expand individual bills
  const [settlingTxId,         setSettlingTxId]         = useState(null); // Individual bill settle

  const partyDues = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      if (!tx.partyId || tx.pendingDue <= 0) return;
      if (!map[tx.partyId]) {
        map[tx.partyId] = {
          partyId:    tx.partyId,
          partyName:  tx.partyName || "Unknown",
          type:       tx.type,
          pendingDue: 0,
          txCount:    0,
          txs:        [],
        };
      }
      map[tx.partyId].pendingDue += tx.pendingDue;
      map[tx.partyId].txCount    += 1;
      map[tx.partyId].txs.push(tx);
    });
    const list = Object.values(map);
    list.forEach((p) => {
      // Sort oldest transaction first (FIFO) so older debts are cleared first
      p.txs.sort((a, b) => (a.transactionDate || "").localeCompare(b.transactionDate || ""));
      p.pendingDue = parseFloat(p.pendingDue.toFixed(2));
    });
    list.sort((a, b) => b.pendingDue - a.pendingDue);
    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [transactions]);

  const maxDue = partyDues.length > 0 ? partyDues[0].pendingDue : 1;

  const filteredDues = useMemo(() => {
    if (!search.trim()) return partyDues;
    const q = search.trim().toLowerCase();
    return partyDues.filter((item) => item.partyName.toLowerCase().includes(q));
  }, [partyDues, search]);

  if (partyDues.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="text-slate-300 font-semibold">All dues cleared!</p>
        <p className="text-slate-600 text-sm mt-1">No party has a pending balance.</p>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="section-title text-base">Pending Dues by Party</h3>
            <p className="text-slate-500 text-xs">
              {partyDues.length} {partyDues.length === 1 ? "party" : "parties"} with outstanding balances
              {search && ` · ${filteredDues.length} found`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party name…"
            className="input-base pl-8 pr-7 py-1.5 text-xs w-full"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {filteredDues.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-slate-400 text-xs">No parties match "{search}"</p>
          <button type="button" onClick={() => setSearch("")} className="text-xs text-indigo-400 hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        <div className="max-h-[650px] overflow-y-auto space-y-4 pr-1.5">
          {filteredDues.map((item) => {
            const widthPct = Math.round((item.pendingDue / maxDue) * 100);
            const isSale   = item.type === "Sale" || item.type === "Given" || item.type === "Sale Return";
            const isOpen   = expandedParty === item.partyId;
            const isBulkSettling = bulkSettlingPartyId === item.partyId;

            return (
              <div key={item.partyId} className="space-y-2">
                {/* Party row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0 font-mono">{item.rank}.</span>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isSale ? "bg-indigo-500/15" : "bg-rose-500/15"}`}>
                        {isSale ? <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-200 text-sm font-medium truncate">{item.partyName}</p>
                        <p className="text-slate-600 text-[10px]">
                          {item.txCount} pending {item.txCount === 1 ? "invoice" : "invoices"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-bold text-sm num ${isSale ? "text-indigo-300" : "text-rose-300"}`}>
                        {fmtINR(item.pendingDue)}
                      </span>

                      {/* PRIORITY LEVEL 1: SETTLE ALL (1 Cheque / Lump Sum) */}
                      <button
                        type="button"
                        onClick={() => {
                          setBulkSettlingPartyId(isBulkSettling ? null : item.partyId);
                          if (!isBulkSettling) {
                            setExpandedParty(null);
                            setSettlingTxId(null);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border shadow-sm transition-all ${
                          isBulkSettling
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/30"
                            : "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950"
                        }`}
                        title="Settle all pending invoices for this party at once with a single cheque or payment"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Settle All</span>
                      </button>

                      {/* Secondary: View individual bills */}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedParty(isOpen ? null : item.partyId);
                          setSettlingTxId(null);
                          if (!isOpen) {
                            setBulkSettlingPartyId(null);
                          }
                        }}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border transition-all ${
                          isOpen
                            ? "bg-slate-700/60 border-slate-600 text-slate-200"
                            : "bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                        }`}
                        title="View individual invoices"
                      >
                        <span>{item.txCount} Bills</span>
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="pl-11 pr-0">
                    <div className="progress-track h-1.5">
                      <div className={`progress-fill ${isSale ? "bg-indigo-500" : "bg-rose-500"}`} style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* PRIORITY 1: BULK SETTLE PANEL */}
                {isBulkSettling && (
                  <div className="pl-4 sm:pl-9 pt-1 animate-fade-in">
                    <PartyBulkSettlePanel
                      party={item}
                      uid={uid}
                      onDone={() => setBulkSettlingPartyId(null)}
                    />
                  </div>
                )}

                {/* Expanded per-transaction rows (Secondary) */}
                {isOpen && !isBulkSettling && (
                  <div className="pl-4 sm:pl-9 space-y-2 animate-fade-in">
                    {item.txs.map((tx) => {
                      const isSettlingThis = settlingTxId === tx.id;
                      const isPurchaseTx   = tx.type === "Purchase" || tx.type === "Taken" || tx.type === "Purchase Return";
                      return (
                        <div key={tx.id} className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
                          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {tx.invoiceNumber && (
                                  <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/25">
                                    #{tx.invoiceNumber}
                                  </span>
                                )}
                                <span className="text-slate-500 text-[10px]">{formatDate(tx.transactionDate)}</span>
                                <span className={`text-[10px] font-semibold ${isPurchaseTx ? "text-rose-400" : "text-indigo-400"}`}>
                                  {tx.type}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-slate-400 text-xs">
                                  Total: <span className="num text-slate-300">{fmtINR(tx.totalAmount)}</span>
                                </span>
                                <span className="text-slate-600 text-[10px]">·</span>
                                <span className="text-slate-400 text-xs">
                                  Due: <span className="num text-amber-400 font-semibold">{fmtINR(tx.pendingDue)}</span>
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettlingTxId(isSettlingThis ? null : tx.id)}
                              className={`flex-shrink-0 btn-emerald text-xs py-1.5 px-2.5 ${
                                isSettlingThis ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900" : ""
                              }`}
                            >
                              <CreditCard className="w-3 h-3" />
                              {isSettlingThis ? "Cancel" : "Settle"}
                            </button>
                          </div>

                          {isSettlingThis && (
                            <div className="border-t border-slate-700/50 p-3">
                              <InlineSettlePanel tx={tx} uid={uid} onDone={() => setSettlingTxId(null)} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
