import { useState, useMemo } from "react";
import { doc, updateDoc, writeBatch, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { fmtINR, validateNonNegative } from "../../utils/validators";
import {
  Users, ArrowUpRight, ArrowDownLeft, CheckCircle2, Search, X,
  CreditCard, ChevronDown, ChevronUp, AlertCircle, IndianRupee,
  Layers, CheckCheck, Sparkles, Receipt, Calendar, Building2,
  BadgePercent, Handshake, Tag, Percent, UserCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import OwnerCollectorSelector, { getRegisteredOwners } from "../transactions/OwnerCollectorSelector";

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
function PartyBulkSettlePanel({ party, parties = [], uid, onDone }) {
  const isPurchase = party.type === "Purchase" || party.type === "Taken" || party.type === "Purchase Return";
  const todayStr = () => new Date().toISOString().split("T")[0];

  // Total pending due calculated accurately from party transactions
  const totalPartyDue = parseFloat(
    party.txs.reduce((acc, t) => acc + (Number(t.pendingDue) || 0), 0).toFixed(2)
  );

  const registeredOwners = useMemo(() => getRegisteredOwners(parties), [parties]);

  const [amount,             setAmount]             = useState(String(totalPartyDue));
  const [collectedBy,        setCollectedBy]        = useState("");
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
          collectedBy: collectedBy.trim() || null,
          note: payMode === "cheque"
            ? `Single Cheque #${chequeNo.trim()} total ${fmtINR(paidTotal)} for ${party.partyName} (Allocated: ${fmtINR(item.alloc)})${collectedBy.trim() ? ` · Collected by: ${collectedBy.trim()}` : ""}`
            : `Bulk settlement of ${fmtINR(paidTotal)} for ${party.partyName} (Allocated: ${fmtINR(item.alloc)})${collectedBy.trim() ? ` · Collected by: ${collectedBy.trim()}` : ""}`,
          ...modeDetails,
        };

        const txRef = doc(db, "users", uid, "transactions", item.tx.id);
        const updatePayload = {
          amountPaid: item.newPaid,
          pendingDue: item.newDue,
          status: item.isFullySettled ? "Settled" : "Pending",
          settledAt: item.isFullySettled ? serverTimestamp() : null,
          paymentLogs: arrayUnion(logEntry),
        };
        if (collectedBy.trim()) {
          updatePayload.lastCollectedBy = collectedBy.trim();
        }
        batch.update(txRef, updatePayload);
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
        `✅ Bulk Settle Complete! ${fmtINR(paidTotal)} applied across ${count} invoice${count > 1 ? "s" : ""} via ${payModeLabel}${collectedBy.trim() ? ` · Collected by ${collectedBy.trim()}` : ""}!`,
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

      {/* Owner / Collector Selection */}
      <OwnerCollectorSelector
        value={collectedBy}
        onChange={setCollectedBy}
        registeredOwners={registeredOwners}
        id={`bulk-collector-${party.partyId}`}
      />

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

// ── PARTY-LEVEL CLOSE / BARGAIN SETTLEMENT PANEL ──────────────
// Allows closing all pending dues for a party when customer bargains/negotiates
// Supports entering agreed payment and recording discount waiver to clear dues to 0
function PartyCloseBargainPanel({ party, parties = [], uid, onDone }) {
  const isPurchase = party.type === "Purchase" || party.type === "Taken" || party.type === "Purchase Return";
  const todayStr = () => new Date().toISOString().split("T")[0];

  const totalPartyDue = parseFloat(
    party.txs.reduce((acc, t) => acc + (Number(t.pendingDue) || 0), 0).toFixed(2)
  );

  const registeredOwners = useMemo(() => getRegisteredOwners(parties), [parties]);

  const [paidAmount,         setPaidAmount]         = useState(String(totalPartyDue));
  const [discountAmount,     setDiscountAmount]     = useState("0");
  const [collectedBy,        setCollectedBy]        = useState("");
  const [closeFullDue,       setCloseFullDue]       = useState(true);
  const [error,              setError]              = useState(null);
  const [loading,            setLoading]            = useState(false);
  const [payMode,            setPayMode]            = useState("cash");
  const [cashDate,           setCashDate]           = useState(todayStr());
  const [chequeNo,           setChequeNo]           = useState("");
  const [chequeReceivedDate, setChequeReceivedDate] = useState(todayStr());
  const [chequeDate,         setChequeDate]         = useState(todayStr());
  const [chequePassDate,     setChequePassDate]     = useState("");
  const [neftRef,            setNeftRef]            = useState("");
  const [neftDate,           setNeftDate]           = useState(todayStr());
  const [notes,              setNotes]              = useState("");

  const numPaid = Number(paidAmount) || 0;
  const numDiscount = Number(discountAmount) || 0;
  const totalCleared = parseFloat((numPaid + numDiscount).toFixed(2));
  const remainingPartyDue = parseFloat(Math.max(0, totalPartyDue - totalCleared).toFixed(2));
  const discountPercent = totalPartyDue > 0 ? ((numDiscount / totalPartyDue) * 100).toFixed(1) : "0";

  const handlePaidChange = (val) => {
    const v = val.trim();
    if (v === "" || /^\d*\.?\d*$/.test(v)) {
      setPaidAmount(v);
      setError(null);
      if (closeFullDue) {
        const n = Number(v) || 0;
        const autoDisc = parseFloat(Math.max(0, totalPartyDue - n).toFixed(2));
        setDiscountAmount(autoDisc > 0 ? String(autoDisc) : "0");
      }
    }
  };

  const handleDiscountChange = (val) => {
    const v = val.trim();
    if (v === "" || /^\d*\.?\d*$/.test(v)) {
      setDiscountAmount(v);
      setError(null);
      if (closeFullDue) {
        const d = Number(v) || 0;
        const autoPaid = parseFloat(Math.max(0, totalPartyDue - d).toFixed(2));
        setPaidAmount(autoPaid > 0 ? String(autoPaid) : "0");
      }
    }
  };

  const applyExactDiscount = (disc) => {
    const d = parseFloat(Math.min(totalPartyDue, Math.max(0, disc)).toFixed(2));
    const p = parseFloat(Math.max(0, totalPartyDue - d).toFixed(2));
    setDiscountAmount(String(d));
    setPaidAmount(String(p));
    setError(null);
  };

  const applyRoundOff = () => {
    let rounded = totalPartyDue;
    if (totalPartyDue >= 10000) {
      rounded = Math.floor(totalPartyDue / 1000) * 1000;
    } else if (totalPartyDue >= 1000) {
      rounded = Math.floor(totalPartyDue / 100) * 100;
    } else if (totalPartyDue >= 100) {
      rounded = Math.floor(totalPartyDue / 10) * 10;
    } else {
      rounded = Math.floor(totalPartyDue);
    }
    const diff = parseFloat(Math.max(0, totalPartyDue - rounded).toFixed(2));
    if (diff > 0) {
      applyExactDiscount(diff);
    } else {
      applyExactDiscount(0);
    }
  };

  // Real-time FIFO allocation breakdown across invoices (oldest first)
  const allocations = useMemo(() => {
    let unallocatedPaid = Math.max(0, numPaid);
    let unallocatedDisc = Math.max(0, numDiscount);

    return party.txs.map((tx) => {
      const currentPaid = Number(tx.amountPaid) || 0;
      const currentDisc = Number(tx.discount) || 0;
      const currentTotal = Number(tx.totalAmount) || 0;
      const rawDue = tx.pendingDue !== undefined && tx.pendingDue !== null
        ? Number(tx.pendingDue)
        : Math.max(0, currentTotal - currentPaid);
      const txDue = parseFloat(Math.max(0, isNaN(rawDue) ? (currentTotal - currentPaid) : rawDue).toFixed(2));

      // 1. Allocate payment first
      const paidAlloc = parseFloat(Math.min(unallocatedPaid, txDue).toFixed(2));
      unallocatedPaid = parseFloat(Math.max(0, unallocatedPaid - paidAlloc).toFixed(2));

      // 2. Remaining due after payment
      const dueAfterPaid = parseFloat(Math.max(0, txDue - paidAlloc).toFixed(2));

      // 3. Allocate discount to cover remaining due on this tx
      const discAlloc = parseFloat(Math.min(unallocatedDisc, dueAfterPaid).toFixed(2));
      unallocatedDisc = parseFloat(Math.max(0, unallocatedDisc - discAlloc).toFixed(2));

      const newPaid = parseFloat((currentPaid + paidAlloc).toFixed(2));
      const newDisc = parseFloat((currentDisc + discAlloc).toFixed(2));
      const newDue = parseFloat(Math.max(0, dueAfterPaid - discAlloc).toFixed(2));
      const isFullySettled = newDue <= 0.005;

      return {
        tx,
        txDue,
        currentPaid,
        currentDisc,
        currentTotal,
        paidAlloc,
        discAlloc,
        newPaid,
        newDisc,
        newDue,
        isFullySettled,
      };
    });
  }, [party.txs, numPaid, numDiscount]);

  const fullyClearedCount = allocations.filter((a) => a.isFullySettled && (a.paidAlloc > 0 || a.discAlloc > 0)).length;

  const validate = () => {
    if (numPaid < 0) return "Settlement amount cannot be negative.";
    if (numDiscount < 0) return "Discount cannot be negative.";
    if (numPaid === 0 && numDiscount === 0) return "Please enter settlement amount or discount.";
    if (totalCleared > totalPartyDue + 0.005) {
      return `Total settled (${fmtINR(totalCleared)}) cannot exceed total balance of ${fmtINR(totalPartyDue)}.`;
    }
    if (payMode === "cheque" && numPaid > 0) {
      if (!chequeNo.trim()) return "Please enter the cheque number.";
      if (!chequeDate) return "Please enter the date written on the cheque.";
    }
    return null;
  };

  const handleBargainSettle = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!uid) { toast.error("User session expired."); return; }

    setLoading(true);
    try {
      const batch = writeBatch(db);

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
        if (item.paidAlloc <= 0.005 && item.discAlloc <= 0.005) continue;

        const isTxPurchase = item.tx.type === "Purchase" || item.tx.type === "Taken" || item.tx.type === "Purchase Return";
        const logsToAdd = [];

        if (item.paidAlloc > 0.005) {
          logsToAdd.push({
            amount: item.paidAlloc,
            date: new Date().toISOString(),
            type: isTxPurchase ? "Payment to Supplier" : "Receipt from Customer",
            bargainSettlement: true,
            totalSettledAmount: numPaid,
            totalDiscountAmount: numDiscount,
            collectedBy: collectedBy.trim() || null,
            note: payMode === "cheque"
              ? `Bargain Settle Cheque #${chequeNo.trim()}: Paid ${fmtINR(item.paidAlloc)}${item.discAlloc > 0 ? ` + Discount ${fmtINR(item.discAlloc)}` : ""}${collectedBy.trim() ? ` · Collected by: ${collectedBy.trim()}` : ""}`
              : `Bargain Settle (${payMode.toUpperCase()}): Paid ${fmtINR(item.paidAlloc)}${item.discAlloc > 0 ? ` + Discount ${fmtINR(item.discAlloc)}` : ""}${collectedBy.trim() ? ` · Collected by: ${collectedBy.trim()}` : ""}`,
            ...modeDetails,
          });
        }

        if (item.discAlloc > 0.005) {
          logsToAdd.push({
            amount: item.discAlloc,
            isDiscount: true,
            date: new Date().toISOString(),
            type: isTxPurchase ? "Discount Received from Supplier" : "Discount Allowed to Customer",
            note: notes.trim()
              ? `Bargain discount: ${notes.trim()} (${fmtINR(item.discAlloc)})`
              : `Bargain discount / waiver of ${fmtINR(item.discAlloc)} to close dues`,
          });
        }

        const txRef = doc(db, "users", uid, "transactions", item.tx.id);
        const updatePayload = {
          amountPaid: item.newPaid,
          discount: item.newDisc,
          pendingDue: item.newDue,
          status: item.isFullySettled ? "Settled" : "Pending",
          settledAt: item.isFullySettled ? serverTimestamp() : null,
          paymentLogs: arrayUnion(...logsToAdd),
        };
        if (collectedBy.trim()) {
          updatePayload.lastCollectedBy = collectedBy.trim();
        }
        if (notes.trim()) {
          updatePayload.settlementNotes = notes.trim();
        }

        batch.update(txRef, updatePayload);
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
        `🎉 Dues Closed! Settled for ${fmtINR(numPaid)} with ${fmtINR(numDiscount)} discount (${discountPercent}%) for ${party.partyName} via ${payModeLabel}${collectedBy.trim() ? ` · Collected by ${collectedBy.trim()}` : ""}!`,
        { duration: 5500 }
      );
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Failed to close dues. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldCls = "input-base text-xs";
  const labelCls = "label text-xs mb-1";

  return (
    <div className="rounded-2xl bg-slate-900 border-2 border-amber-500/50 p-4 sm:p-5 space-y-4 shadow-2xl shadow-amber-950/40 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30 text-white">
            <BadgePercent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-white font-bold text-base">
                Close Dues (Bargain Settlement) — {party.partyName}
              </h4>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                Bargain &amp; Discount
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              Customer negotiated a lower amount? Enter the agreed settlement and record the discount waiver to close all pending dues.
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right bg-slate-800/60 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-slate-700/50">
          <p className="text-[10px] text-slate-500 font-semibold uppercase">Original Balance Due</p>
          <p className="text-base font-bold text-amber-400 num">{fmtINR(totalPartyDue)}</p>
        </div>
      </div>

      {/* 4-Box Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-slate-800/60 p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Due</p>
          <p className="font-bold text-sm num text-slate-300">{fmtINR(totalPartyDue)}</p>
        </div>
        <div className="rounded-xl bg-emerald-950/30 p-2.5 border border-emerald-500/30">
          <p className="text-[10px] text-emerald-400 uppercase font-semibold">Customer Pays</p>
          <p className="font-bold text-sm num text-emerald-400">{fmtINR(numPaid)}</p>
        </div>
        <div className="rounded-xl bg-amber-950/30 p-2.5 border border-amber-500/30">
          <p className="text-[10px] text-amber-400 uppercase font-semibold">Discount / Waived</p>
          <p className="font-bold text-sm num text-amber-300">
            {fmtINR(numDiscount)} <span className="text-[11px] font-normal">({discountPercent}%)</span>
          </p>
        </div>
        <div className="rounded-xl bg-slate-800/60 p-2.5 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Remaining Due</p>
          <p className={`font-bold text-sm num ${remainingPartyDue <= 0.005 ? "text-emerald-400" : "text-amber-400"}`}>
            {remainingPartyDue <= 0.005 ? "₹0.00 (Closed ✅)" : fmtINR(remainingPartyDue)}
          </p>
        </div>
      </div>

      {/* Synchronized Paid & Discount Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/30 p-3.5 rounded-xl border border-slate-700/60">
        {/* Paid Amount Field */}
        <div className="field">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={`bargain-paid-${party.partyId}`} className="label flex items-center gap-1 text-xs font-semibold text-emerald-300">
              <IndianRupee className="w-3.5 h-3.5" /> Agreed Settle Amount (Customer Pays ₹)
            </label>
            <button
              type="button"
              onClick={() => {
                setPaidAmount(String(totalPartyDue));
                setDiscountAmount("0");
                setError(null);
              }}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2"
            >
              Pay 100% Full
            </button>
          </div>
          <input
            id={`bargain-paid-${party.partyId}`}
            type="text"
            inputMode="decimal"
            value={paidAmount}
            onChange={(e) => handlePaidChange(e.target.value)}
            placeholder={`0.00 (e.g. 190000)`}
            className={`input-base text-base sm:text-lg font-bold num ${error ? "input-error" : ""}`}
            style={{ padding: "10px 12px" }}
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Cash / Bank amount actually received from customer
          </p>
        </div>

        {/* Discount Amount Field */}
        <div className="field">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={`bargain-discount-${party.partyId}`} className="label flex items-center gap-1 text-xs font-semibold text-amber-300">
              <BadgePercent className="w-3.5 h-3.5" /> Discount / Bargain Waiver (₹)
            </label>
            <span className="text-[11px] text-amber-400 font-bold bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
              {discountPercent}% OFF
            </span>
          </div>
          <input
            id={`bargain-discount-${party.partyId}`}
            type="text"
            inputMode="decimal"
            value={discountAmount}
            onChange={(e) => handleDiscountChange(e.target.value)}
            placeholder={`0.00 (e.g. 10000)`}
            className={`input-base text-base sm:text-lg font-bold num text-amber-300 border-amber-500/40 focus:border-amber-400 ${error ? "input-error" : ""}`}
            style={{ padding: "10px 12px" }}
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Amount reduced / waived to close and clear the account
          </p>
        </div>
      </div>

      {/* Preset Quick Buttons */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-slate-400">Quick Bargain / Discount Presets:</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyRoundOff}
            className="btn-secondary text-xs py-1.5 px-3 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            title="Round off odd figures to nearest 1,000 / 100 and waive difference"
          >
            ⚡ Round Off
          </button>
          {[2, 5, 10].map((pct) => {
            const discVal = parseFloat(((totalPartyDue * pct) / 100).toFixed(2));
            return (
              <button
                key={pct}
                type="button"
                onClick={() => applyExactDiscount(discVal)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                {pct}% ({fmtINR(discVal)})
              </button>
            );
          })}
          {totalPartyDue >= 5000 && (
            <button
              type="button"
              onClick={() => applyExactDiscount(1000)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              ₹1,000 Off
            </button>
          )}
          {totalPartyDue >= 20000 && (
            <button
              type="button"
              onClick={() => applyExactDiscount(5000)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              ₹5,000 Off
            </button>
          )}
          {totalPartyDue >= 50000 && (
            <button
              type="button"
              onClick={() => applyExactDiscount(10000)}
              className="btn-secondary text-xs py-1.5 px-3 border-amber-500/40 text-amber-300"
            >
              ₹10,000 Off
            </button>
          )}
        </div>
      </div>

      {/* Close Full Due Checkbox */}
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
        <input
          type="checkbox"
          id={`close-full-${party.partyId}`}
          checked={closeFullDue}
          onChange={(e) => {
            setCloseFullDue(e.target.checked);
            if (e.target.checked) {
              const diff = parseFloat(Math.max(0, totalPartyDue - numPaid).toFixed(2));
              setDiscountAmount(diff > 0 ? String(diff) : "0");
            }
          }}
          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
        />
        <label htmlFor={`close-full-${party.partyId}`} className="text-xs text-slate-200 font-medium cursor-pointer select-none">
          <span className="font-bold text-amber-300">Close Account &amp; Clear All Remaining Dues</span> — Automatically calculates discount so remaining balance is exactly ₹0.00.
        </label>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-rose-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </p>
      )}

      {/* Payment Mode Selector */}
      <div className="field">
        <label className="label text-xs mb-1.5 block font-semibold text-slate-300">Payment Mode (for settled amount)</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "cash",   icon: "💵", label: "Cash" },
            { key: "cheque", icon: "🏦", label: "Cheque" },
            { key: "neft",   icon: "⚡", label: "NEFT / Online" },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setPayMode(key); setError(null); }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                payMode === key
                  ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30"
                  : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cheque Details */}
      {payMode === "cheque" && numPaid > 0 && (
        <div className="space-y-3 rounded-xl bg-slate-800/60 border border-slate-700/60 p-3.5">
          <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
            <span>🏦</span> Cheque Details
          </p>
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

      {/* Settlement Reason / Notes */}
      <div className="field">
        <label className={labelCls}>Bargain Settlement Note (Optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`e.g. Customer negotiated settlement — ${fmtINR(numDiscount)} discount allowed to close account`}
          className={fieldCls}
        />
      </div>

      {/* Owner / Collector Selection */}
      <OwnerCollectorSelector
        value={collectedBy}
        onChange={setCollectedBy}
        registeredOwners={registeredOwners}
        id={`bargain-collector-${party.partyId}`}
      />

      {/* Live Distribution Breakdown */}
      <div className="space-y-2 rounded-xl bg-slate-800/40 border border-slate-700/50 p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-amber-400" />
            Automatic FIFO Clearance across Invoices
          </span>
          <span className="text-amber-400 font-semibold text-[11px]">
            {fullyClearedCount} of {party.txCount} fully cleared
          </span>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {allocations.map(({ tx, txDue, paidAlloc, discAlloc, newDue, isFullySettled }) => (
            <div
              key={tx.id}
              className={`flex items-center justify-between text-xs p-2 rounded-lg border transition-all ${
                isFullySettled
                  ? "bg-emerald-950/30 border-emerald-500/30 text-slate-200"
                  : (paidAlloc > 0 || discAlloc > 0)
                  ? "bg-amber-950/20 border-amber-500/30 text-slate-200"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isFullySettled ? (
                  <CheckCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (paidAlloc > 0 || discAlloc > 0) ? (
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

              <div className="text-right flex-shrink-0 ml-2 space-y-0.5">
                <div className="flex items-center justify-end gap-1.5">
                  {paidAlloc > 0 && (
                    <span className="text-emerald-400 font-bold num text-xs">
                      +{fmtINR(paidAlloc)}
                    </span>
                  )}
                  {discAlloc > 0 && (
                    <span className="text-amber-400 font-bold num text-xs">
                      −{fmtINR(discAlloc)} <span className="text-[10px] font-normal text-amber-300">disc</span>
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    isFullySettled
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {isFullySettled ? "Closed" : `Bal: ${fmtINR(newDue)}`}
                  </span>
                </div>
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
          disabled={loading || totalCleared <= 0}
          onClick={handleBargainSettle}
          className="btn-primary flex-[2] text-xs font-bold bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 border-0 shadow-lg shadow-amber-500/20"
          style={{ minHeight: "44px" }}
        >
          {loading ? <span className="spinner" /> : <CheckCheck className="w-4 h-4 text-slate-950" />}
          {loading ? "Recording Bargain Close…" : `Confirm & Close Dues (Paid: ${fmtINR(numPaid)}${numDiscount > 0 ? ` + Discount: ${fmtINR(numDiscount)}` : ""})`}
        </button>
      </div>
    </div>
  );
}

// ── Inline Single-Transaction Settle Panel (with Bargain Discount) ───
export function InlineSettlePanel({ tx, parties = [], uid, initialBargainMode = false, onDone }) {
  const isPurchase = tx.type === "Purchase" || tx.type === "Taken" || tx.type === "Purchase Return";
  const todayStr = () => new Date().toISOString().split("T")[0];

  const currentPaid  = Number(tx.amountPaid)  || 0;
  const currentTotal = Number(tx.totalAmount) || 0;
  const currentDisc  = Number(tx.discount)    || 0;
  const rawDue = tx.pendingDue !== undefined && tx.pendingDue !== null
    ? Number(tx.pendingDue) : Math.max(0, currentTotal - currentPaid - currentDisc);
  const currentDue = isNaN(rawDue) ? Math.max(0, currentTotal - currentPaid - currentDisc) : rawDue;
  const maxAllowed  = parseFloat(Math.max(0, currentDue).toFixed(2));

  const registeredOwners = useMemo(() => getRegisteredOwners(parties), [parties]);

  const [isBargain,          setIsBargain]          = useState(initialBargainMode);
  const [amount,             setAmount]             = useState(initialBargainMode ? "" : "");
  const [discount,           setDiscount]           = useState("");
  const [collectedBy,        setCollectedBy]        = useState("");
  const [closeBill,          setCloseBill]          = useState(true);
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

  const numPaid = Number(amount) || 0;
  const numDiscount = isBargain ? (Number(discount) || 0) : 0;
  const totalCleared = parseFloat((numPaid + numDiscount).toFixed(2));
  const remainingDue = parseFloat(Math.max(0, maxAllowed - totalCleared).toFixed(2));

  const handlePaidChange = (v) => {
    const val = v.trim();
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
      setError(null);
      if (isBargain && closeBill) {
        const nPaid = Number(val) || 0;
        const autoDisc = parseFloat(Math.max(0, maxAllowed - nPaid).toFixed(2));
        setDiscount(autoDisc > 0 ? String(autoDisc) : "0");
      }
    }
  };

  const handleDiscountChange = (v) => {
    const val = v.trim();
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setDiscount(val);
      setError(null);
      if (isBargain && closeBill) {
        const nDisc = Number(val) || 0;
        const autoPaid = parseFloat(Math.max(0, maxAllowed - nDisc).toFixed(2));
        setAmount(autoPaid > 0 ? String(autoPaid) : "0");
      }
    }
  };

  const validate = () => {
    if (numPaid < 0) return "Payment amount cannot be negative.";
    if (numDiscount < 0) return "Discount cannot be negative.";
    if (numPaid === 0 && numDiscount === 0) return "Please enter payment or discount amount.";
    if (totalCleared > maxAllowed + 0.005) {
      return `Total settled (${fmtINR(totalCleared)}) cannot exceed due balance of ${fmtINR(maxAllowed)}.`;
    }
    if (payMode === "cheque" && numPaid > 0) {
      if (!chequeNo.trim()) return "Please enter the cheque number.";
      if (!chequeDate) return "Please enter the date on the cheque.";
    }
    return null;
  };

  const handleSettle = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!uid) { toast.error("Session expired."); return; }
    setLoading(true);
    try {
      const paid = parseFloat(numPaid.toFixed(2));
      const disc = parseFloat(numDiscount.toFixed(2));
      const newPaid = parseFloat((currentPaid + paid).toFixed(2));
      const newDisc = parseFloat((currentDisc + disc).toFixed(2));
      const newDue  = parseFloat(Math.max(0, maxAllowed - paid - disc).toFixed(2));
      const isFullySettled = newDue <= 0.005;

      let modeDetails = {};
      if (payMode === "cash")   modeDetails = { paymentMode: "Cash",   paymentDate: cashDate };
      if (payMode === "cheque") modeDetails = { paymentMode: "Cheque", chequeNo: chequeNo.trim(), chequeReceivedDate, chequeDate, chequePassDate: chequePassDate || null };
      if (payMode === "neft")   modeDetails = { paymentMode: "NEFT",   neftRefNo: neftRef.trim(), paymentDate: neftDate };

      const logsToAdd = [];
      if (paid > 0.005) {
        logsToAdd.push({
          amount: paid,
          date: new Date().toISOString(),
          type: isPurchase ? "Payment to Supplier" : "Receipt from Customer",
          collectedBy: collectedBy.trim() || null,
          ...(disc > 0 ? { bargainSettlement: true, discountAmount: disc } : {}),
          ...modeDetails,
        });
      }
      if (disc > 0.005) {
        logsToAdd.push({
          amount: disc,
          isDiscount: true,
          date: new Date().toISOString(),
          type: isPurchase ? "Discount Received from Supplier" : "Discount Allowed to Customer",
          note: `Bargain discount / waiver of ${fmtINR(disc)} to close bill`,
        });
      }

      const updateData = {
        amountPaid:  newPaid,
        discount:    newDisc,
        pendingDue:  newDue,
        status:      isFullySettled ? "Settled" : "Pending",
        settledAt:   isFullySettled ? serverTimestamp() : null,
        paymentLogs: arrayUnion(...logsToAdd),
      };
      if (collectedBy.trim()) {
        updateData.lastCollectedBy = collectedBy.trim();
      }

      await updateDoc(doc(db, "users", uid, "transactions", tx.id), updateData);

      const collectorNote = collectedBy.trim() ? ` · Collected by ${collectedBy.trim()}` : "";
      if (isFullySettled) {
        toast.success(
          disc > 0
            ? `🎉 Bill closed! Paid ${fmtINR(paid)} + Discount ${fmtINR(disc)} (Cleared ${fmtINR(currentTotal)})${collectorNote}`
            : `✅ Fully settled — ${fmtINR(currentTotal)} cleared${collectorNote}.`
        );
      } else {
        toast.success(`💰 ${fmtINR(paid)} recorded${collectorNote}. ${fmtINR(newDue)} still pending.`);
      }
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
          <div>
            <p className="text-slate-100 font-semibold text-sm">
              {isPurchase ? "Pay Supplier" : "Receive Payment"}
            </p>
            {isBargain && (
              <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                <BadgePercent className="w-3 h-3" /> Bargain / Discount Mode Active
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsBargain(!isBargain);
              if (!isBargain) {
                setDiscount("0");
              } else {
                setDiscount("");
              }
            }}
            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all flex items-center gap-1 ${
              isBargain
                ? "bg-amber-500/20 border-amber-500 text-amber-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-300"
            }`}
            title="Toggle bargain discount for this invoice"
          >
            <BadgePercent className="w-3 h-3" />
            {isBargain ? "Bargain On" : "Add Discount"}
          </button>
          <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/30 num">
            Due: {fmtINR(maxAllowed)}
          </span>
        </div>
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

      {/* Amount Input (or Double Inputs if Bargain) */}
      {!isBargain ? (
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
            onChange={(e) => handlePaidChange(e.target.value)}
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
      ) : (
        /* BARGAIN MODE: Dual Inputs */
        <div className="space-y-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor={`due-bargain-paid-${tx.id}`} className="label text-xs font-semibold text-emerald-300">
                Customer Pays (₹)
              </label>
              <input
                id={`due-bargain-paid-${tx.id}`}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handlePaidChange(e.target.value)}
                placeholder="0.00"
                className="input-base text-sm font-bold num"
              />
            </div>
            <div className="field">
              <label htmlFor={`due-bargain-disc-${tx.id}`} className="label text-xs font-semibold text-amber-300">
                Discount / Waiver (₹)
              </label>
              <input
                id={`due-bargain-disc-${tx.id}`}
                type="text"
                inputMode="decimal"
                value={discount}
                onChange={(e) => handleDiscountChange(e.target.value)}
                placeholder="0.00"
                className="input-base text-sm font-bold num text-amber-300 border-amber-500/40"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`close-bill-${tx.id}`}
              checked={closeBill}
              onChange={(e) => setCloseBill(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-amber-500"
            />
            <label htmlFor={`close-bill-${tx.id}`} className="text-xs text-slate-300 cursor-pointer">
              Auto-calculate discount to close this bill to ₹0.00
            </label>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Customer Pays:</span>
              <span className="text-emerald-400 font-semibold num">{fmtINR(numPaid)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Discount Waived:</span>
              <span className="text-amber-300 font-semibold num">− {fmtINR(numDiscount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700/50 pt-1 font-semibold">
              <span className="text-slate-300">Remaining Balance:</span>
              <span className={`num ${remainingDue <= 0.005 ? "text-emerald-400" : "text-amber-400"}`}>
                {remainingDue <= 0.005 ? "₹0.00 (Cleared & Closed ✅)" : fmtINR(remainingDue)}
              </span>
            </div>
          </div>
        </div>
      )}

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

      {/* Owner / Collector Selection */}
      <OwnerCollectorSelector
        value={collectedBy}
        onChange={setCollectedBy}
        registeredOwners={registeredOwners}
        id={`inline-collector-${tx.id}`}
      />

      {/* Actions */}
      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onDone} className="btn-secondary flex-1 text-xs" style={{ minHeight: "44px" }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={loading || totalCleared <= 0}
          onClick={handleSettle}
          className={`btn-primary flex-1 text-xs font-bold ${
            isBargain
              ? "bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 border-0"
              : ""
          }`}
          style={{ minHeight: "44px" }}
        >
          {loading ? <span className="spinner" /> : <CreditCard className="w-4 h-4" />}
          {loading
            ? "Recording…"
            : isBargain
            ? `Close Bill (${fmtINR(numPaid)} + Disc ${fmtINR(numDiscount)})`
            : "Record Payment"}
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
  const [closingPartyId,       setClosingPartyId]       = useState(null); // Bargain / Discount Close Dues
  const [expandedParty,        setExpandedParty]        = useState(null); // Expand individual bills
  const [settlingTxId,         setSettlingTxId]         = useState(null); // Individual bill settle
  const [settleMode,           setSettleMode]           = useState("regular"); // "regular" | "bargain"

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
            const isClosing = closingPartyId === item.partyId;

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
                            setClosingPartyId(null);
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

                      {/* CLOSE / BARGAIN SETTLE BUTTON */}
                      <button
                        type="button"
                        onClick={() => {
                          setClosingPartyId(isClosing ? null : item.partyId);
                          if (!isClosing) {
                            setBulkSettlingPartyId(null);
                            setExpandedParty(null);
                            setSettlingTxId(null);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border shadow-sm transition-all ${
                          isClosing
                            ? "bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/30"
                            : "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500 hover:text-slate-950"
                        }`}
                        title="Customer bargained? Settle for reduced amount with discount and close all dues"
                      >
                        <BadgePercent className="w-3.5 h-3.5" />
                        <span>Close</span>
                      </button>

                      {/* Secondary: View individual bills */}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedParty(isOpen ? null : item.partyId);
                          setSettlingTxId(null);
                          if (!isOpen) {
                            setBulkSettlingPartyId(null);
                            setClosingPartyId(null);
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
                      parties={parties}
                      uid={uid}
                      onDone={() => setBulkSettlingPartyId(null)}
                    />
                  </div>
                )}

                {/* BARGAIN & DISCOUNT CLOSE PANEL */}
                {isClosing && (
                  <div className="pl-4 sm:pl-9 pt-1 animate-fade-in">
                    <PartyCloseBargainPanel
                      party={item}
                      parties={parties}
                      uid={uid}
                      onDone={() => setClosingPartyId(null)}
                    />
                  </div>
                )}

                {/* Expanded per-transaction rows (Secondary) */}
                {isOpen && !isBulkSettling && !isClosing && (
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
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSettlingTxId(isSettlingThis && settleMode === "regular" ? null : tx.id);
                                  setSettleMode("regular");
                                }}
                                className={`btn-emerald text-xs py-1.5 px-2.5 ${
                                  isSettlingThis && settleMode === "regular" ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900" : ""
                                }`}
                              >
                                <CreditCard className="w-3 h-3" />
                                {isSettlingThis && settleMode === "regular" ? "Cancel" : "Settle"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSettlingTxId(isSettlingThis && settleMode === "bargain" ? null : tx.id);
                                  setSettleMode("bargain");
                                }}
                                className={`btn-secondary text-xs py-1.5 px-2.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 ${
                                  isSettlingThis && settleMode === "bargain" ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900 bg-amber-500/20" : ""
                                }`}
                                title="Customer bargained? Settle with discount to close this bill"
                              >
                                <BadgePercent className="w-3 h-3" />
                                {isSettlingThis && settleMode === "bargain" ? "Cancel" : "Close"}
                              </button>
                            </div>
                          </div>

                          {isSettlingThis && (
                            <div className="border-t border-slate-700/50 p-3">
                              <InlineSettlePanel
                                tx={tx}
                                parties={parties}
                                uid={uid}
                                initialBargainMode={settleMode === "bargain"}
                                onDone={() => setSettlingTxId(null)}
                              />
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
