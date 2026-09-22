import { useState } from "react";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { fmtINR } from "../../utils/validators";
import SettleModal from "./SettleModal";
import {
  Search, X, BookOpen, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Clock, ChevronUp, Eye, CreditCard,
  Loader2, AlertCircle, CalendarDays, RotateCcw, FileText,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Type helpers (backward-compat) ────────────────────────────
const isSale     = (t) => t === "Sale"     || t === "Given"  || t === "Sale Return";
const isPurchase = (t) => t === "Purchase" || t === "Taken"  || t === "Purchase Return";

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

function logDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

// ── Detail Drawer ─────────────────────────────────────────────
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

// ── Detail Drawer ─────────────────────────────────────────────
function DetailDrawer({ tx }) {
  const terms = getPaymentTerms(tx);
  const total = Number(tx.totalAmount) || 0;
  const paid  = Number(tx.amountPaid) || 0;
  const due   = Number(tx.pendingDue) || 0;
  const pct   = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

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
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Date: {formatDate(tx.transactionDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={tx.type} />
            <StatusBadge status={tx.status} />
          </div>
        </div>

        {/* ── Payment Details & Term-by-Term Installments ── */}
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
                      <p className="text-slate-400 text-[11px] truncate">{term.type}</p>
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

        {/* Saree items */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Saree Items</p>
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
    </div>
  );
}

// ── Edit Date Modal (bottom-sheet) ────────────────────────────
function EditDateModal({ transaction: tx, uid, onClose }) {
  const [date,    setDate]    = useState(tx.transactionDate ?? new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const fmt = (s) => { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };

  const handleSave = async () => {
    if (!date) { toast.error("Please pick a valid date."); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", uid, "transactions", tx.id), { transactionDate: date });
      toast.success("Transaction date updated.");
      onClose();
    } catch (err) {
      toast.error("Failed to update date. Please try again.");
      console.error(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full md:max-w-sm animate-slide-in-up md:animate-fade-in-scale">
        <div className="card rounded-t-3xl rounded-b-none md:rounded-2xl overflow-hidden"
             style={{ paddingBottom: "env(safe-area-inset-bottom, 20px)" }}>
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-700" />
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-4 md:pt-5 md:border-b md:border-slate-800/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-slate-100 font-bold text-base leading-tight">Edit Transaction Date</h2>
                <p className="text-slate-500 text-xs mt-0.5 truncate">{tx.partyName}</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon flex-shrink-0 hidden md:flex"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-5 pt-3 pb-2 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-3 py-3 text-center">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Current</p>
                <p className="text-slate-300 font-bold text-sm num">{fmt(tx.transactionDate)}</p>
              </div>
              <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/25 px-3 py-3 text-center">
                <p className="text-indigo-400 text-[10px] uppercase tracking-wider font-semibold mb-1">New</p>
                <p className="text-indigo-200 font-bold text-sm num">{fmt(date)}</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="edit-tx-date" className="label flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> Select New Date
              </label>
              <input id="edit-tx-date" type="date" value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="input-base cursor-pointer"
                style={{ fontSize: "16px", padding: "14px 16px" }} />
            </div>
            <div className="flex gap-3 pt-1 pb-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1" style={{ minHeight: "52px" }}>Cancel</button>
              <button type="button" disabled={loading || !date || date === tx.transactionDate}
                onClick={handleSave} className="btn-primary flex-1" style={{ minHeight: "52px" }}>
                {loading ? <span className="spinner" /> : <CalendarDays className="w-4 h-4" />}
                {loading ? "Saving…" : "Save Date"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Return Modal (bottom-sheet) ───────────────────────────────
function ReturnModal({ transaction: tx, uid, onClose }) {
  const returnType = (tx.type === "Sale" || tx.type === "Given") ? "Sale Return" : "Purchase Return";
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [items,   setItems]   = useState((tx.sareeDetails || []).map((item) => ({ ...item, returnQty: "" })));
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);

  const returnTotal = items.reduce((sum, item) =>
    sum + (Number(item.returnQty) || 0) * (Number(item.pricePerUnit) || 0), 0);

  const handleSave = async () => {
    if (!items.some((item) => Number(item.returnQty) > 0)) {
      toast.error("Enter return quantity for at least one item.");
      return;
    }
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
      onClose();
    } catch (err) {
      toast.error("Failed to record return. Please try again.");
      console.error(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full md:max-w-lg animate-slide-in-up md:animate-fade-in-scale">
        <div className="card rounded-t-3xl rounded-b-none md:rounded-2xl"
             style={{ maxHeight: "90vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 20px)" }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-700" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-4 md:pt-5 border-b border-slate-800/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-slate-100 font-bold text-base">Record Return</h2>
                <p className="text-slate-500 text-xs mt-0.5 truncate">
                  {tx.partyName} · <span className="text-amber-400">{returnType}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon hidden md:flex"><X className="w-4 h-4" /></button>
          </div>

          <div className="px-5 pt-4 pb-2 space-y-4">
            {/* Return date */}
            <div className="field">
              <label className="label flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> Return Date
              </label>
              <input type="date" value={returnDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setReturnDate(e.target.value)}
                className="input-base cursor-pointer"
                style={{ fontSize: "16px" }} />
            </div>

            {/* Items */}
            <div>
              <p className="label mb-2">Returned Items</p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-slate-200 text-sm font-semibold truncate flex-1">{item.sareeName}</p>
                      <span className="text-slate-500 text-xs flex-shrink-0 ml-2">@ {fmtINR(item.pricePerUnit)}/pc</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Return Qty (max {item.quantity})
                        </label>
                        <input
                          type="number" min="0" max={item.quantity} step="1"
                          value={item.returnQty}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[i] = { ...updated[i], returnQty: e.target.value };
                            setItems(updated);
                          }}
                          placeholder="0"
                          className="input-base py-2 text-sm mt-0.5"
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

            {/* Return total pill */}
            <div className={`rounded-xl px-4 py-3 flex justify-between items-center transition-all ${
              returnTotal > 0
                ? "bg-amber-500/10 border border-amber-500/25"
                : "bg-slate-800/40 border border-slate-700/40"
            }`}>
              <span className={`font-semibold text-sm ${returnTotal > 0 ? "text-amber-300" : "text-slate-500"}`}>
                Total Return Value
              </span>
              <span className={`font-bold num text-base ${returnTotal > 0 ? "text-amber-300" : "text-slate-600"}`}>
                {fmtINR(returnTotal)}
              </span>
            </div>

            {/* Notes */}
            <div className="field">
              <label className="label">Notes (optional)</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for return, condition of goods…"
                className="input-base resize-none text-sm" />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1 pb-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1" style={{ minHeight: "52px" }}>
                Cancel
              </button>
              <button type="button" disabled={loading || returnTotal <= 0} onClick={handleSave}
                className="btn-primary flex-1" style={{ minHeight: "52px" }}>
                {loading ? <span className="spinner" /> : <RotateCcw className="w-4 h-4" />}
                {loading ? "Saving…" : "Record Return"}
              </button>
            </div>
          </div>
        </div>
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
  const [expanded,     setExpanded]     = useState(null);
  const [settling,     setSettling]     = useState(null);
  const [editingDate,  setEditingDate]  = useState(null);
  const [returning,    setReturning]    = useState(null);

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

  const toggleExpand = (id) => setExpanded((v) => (v === id ? null : id));
  const canReturn    = (tx) => tx.type === "Sale" || tx.type === "Given" || tx.type === "Purchase" || tx.type === "Taken";

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

      {/* ── Modals ── */}
      {settling    && <SettleModal   transaction={settling}    onClose={() => setSettling(null)} />}
      {editingDate && <EditDateModal transaction={editingDate} uid={uid} onClose={() => setEditingDate(null)} />}
      {returning   && <ReturnModal   transaction={returning}   uid={uid} onClose={() => setReturning(null)} />}

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
                <tbody>
                  {filtered.map((tx) => {
                    const termsCount = getPaymentTerms(tx).length;
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
                          <td className="table-td cursor-pointer" onClick={() => toggleExpand(tx.id)}>
                            <p className="text-slate-200 font-semibold text-sm hover:text-indigo-300 transition-colors">{tx.partyName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
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
                              {/* Details */}
                              <button onClick={() => toggleExpand(tx.id)} className="btn-icon" title="View details">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {/* Calendar / Edit Date */}
                              <button onClick={() => setEditingDate(tx)} className="btn-icon" title="Edit date">
                                <CalendarDays className="w-3.5 h-3.5" />
                              </button>
                              {/* Return */}
                              {canReturn(tx) && (
                                <button onClick={() => setReturning(tx)}
                                  className="p-2 rounded-lg text-amber-500 hover:text-amber-300 hover:bg-amber-500/10 transition-all duration-150"
                                  title="Record return">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* Settle */}
                              {tx.status === "Pending" && (
                                <button onClick={() => setSettling(tx)}
                                  className="btn-emerald text-xs py-1.5 px-2.5">
                                  <CreditCard className="w-3 h-3" /> Settle
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded === tx.id && (
                          <tr key={`${tx.id}-detail`}>
                            <td colSpan={9} className="p-0"><DetailDrawer tx={tx} /></td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="md:hidden space-y-3">
            {filtered.map((tx) => {
              const termsCount = getPaymentTerms(tx).length;
              return (
                <div key={tx.id} className="card overflow-hidden border border-slate-800/80 hover:border-slate-700 transition-all">
                  {/* Tap card body/header to toggle payment details */}
                  <div
                    onClick={() => toggleExpand(tx.id)}
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
                          {termsCount > 0 && (
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              💰 {termsCount} term{termsCount > 1 ? "s" : ""}
                            </span>
                          )}
                          {tx.returnOfTxId && <span className="text-[10px] text-amber-500">↩ Return entry</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <TypeBadge type={tx.type} />
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>

                    {/* Tap hint */}
                    <p className="text-[11px] text-indigo-400/90 font-medium mb-3 flex items-center gap-1">
                      {expanded === tx.id ? (
                        <span>▲ Tap card to hide details</span>
                      ) : (
                        <span>▼ Tap card to view payment terms & items</span>
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
                        onClick={(e) => { e.stopPropagation(); toggleExpand(tx.id); }}
                        className="btn-secondary flex-1 text-xs py-2 gap-1.5"
                      >
                        {expanded === tx.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {expanded === tx.id ? "Hide Details" : "View Details"}
                      </button>
                      {/* Calendar */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingDate(tx); }}
                        className="btn-secondary text-xs py-2 px-3" title="Edit date"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                      </button>
                      {/* Return */}
                      {canReturn(tx) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setReturning(tx); }}
                          className="text-xs py-2 px-3 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all"
                          title="Record return"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Settle */}
                      {tx.status === "Pending" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSettling(tx); }}
                          className="btn-emerald flex-1 text-xs py-2"
                        >
                          <CreditCard className="w-3 h-3" /> Settle
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded === tx.id && (
                    <div className="border-t border-slate-800 bg-slate-950/70">
                      <DetailDrawer tx={tx} />
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
