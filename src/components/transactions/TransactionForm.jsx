import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { validatePositive } from "../../utils/validators";
import {
  Plus, Trash2, Receipt, IndianRupee, ShoppingBag,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, RotateCcw, FileText,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Constants ─────────────────────────────────────────────────
const EMPTY_ROW = { sareeName: "", quantity: "", pricePerUnit: "" };

function getInitialForm() {
  return {
    partyId:         "",
    invoiceNumber:   "",
    type:            "Sale",
    sareeDetails:    [{ ...EMPTY_ROW }],
    amountPaid:      "",
    transactionDate: new Date().toISOString().slice(0, 10),
    notes:           "",
  };
}

// ── Currency formatter ────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

// ── Saree Row ─────────────────────────────────────────────────
function SareeRow({ index, row, onChange, onRemove, canRemove, errors }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      {/* Row number */}
      <div className="col-span-1 hidden sm:flex items-center pt-8">
        <span className="text-slate-600 text-xs font-mono font-bold">{index + 1}.</span>
      </div>

      {/* Saree Name */}
      <div className="col-span-12 sm:col-span-5">
        {index === 0 && <label className="label">Saree Name / Design</label>}
        <input type="text" value={row.sareeName}
          onChange={(e) => onChange(index, "sareeName", e.target.value)}
          placeholder="e.g. Banarasi Pure Silk"
          className={`input-base ${errors?.sareeName ? "input-error" : ""}`} />
        {errors?.sareeName && <p className="text-rose-400 text-xs mt-0.5">{errors.sareeName}</p>}
      </div>

      {/* Qty */}
      <div className="col-span-5 sm:col-span-2">
        {index === 0 && <label className="label">Qty</label>}
        <input type="number" min="1" value={row.quantity}
          onChange={(e) => onChange(index, "quantity", e.target.value)}
          placeholder="0" className={`input-base ${errors?.quantity ? "input-error" : ""}`} />
        {errors?.quantity && <p className="text-rose-400 text-xs mt-0.5">Required</p>}
      </div>

      {/* Price/unit */}
      <div className="col-span-5 sm:col-span-3">
        {index === 0 && <label className="label">Price / Unit (₹)</label>}
        <input type="number" min="0.01" step="0.01" value={row.pricePerUnit}
          onChange={(e) => onChange(index, "pricePerUnit", e.target.value)}
          placeholder="0.00" className={`input-base ${errors?.pricePerUnit ? "input-error" : ""}`} />
        {errors?.pricePerUnit && <p className="text-rose-400 text-xs mt-0.5">Required</p>}
      </div>

      {/* Remove */}
      <div className="col-span-2 sm:col-span-1 flex items-center justify-end sm:pt-7">
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)} className="btn-danger !px-2 !py-1.5" title="Remove row">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── TransactionForm (exported) ────────────────────────────────
export default function TransactionForm({ parties }) {
  const { currentUser } = useAuth();
  const [form,      setForm]      = useState(getInitialForm);
  const [rowErrors, setRowErrors] = useState([]);
  const [formErrors,setFormErrors]= useState({});
  const [loading,   setLoading]   = useState(false);
  const [showItems, setShowItems] = useState(true);

  // ── Computed ─────────────────────────────────────────────
  const totalAmount = form.sareeDetails.reduce((sum, r) => {
    return sum + (parseFloat(r.quantity) || 0) * (parseFloat(r.pricePerUnit) || 0);
  }, 0);
  const amountPaidNum = parseFloat(form.amountPaid) || 0;
  const pendingDue    = Math.max(0, totalAmount - amountPaidNum);
  const isSettled     = pendingDue <= 0 && totalAmount > 0;

  // ── Row handlers ─────────────────────────────────────────
  const handleRowChange = (idx, field, value) => {
    setForm((f) => {
      const rows = [...f.sareeDetails];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...f, sareeDetails: rows };
    });
    setRowErrors((errs) => {
      const updated = [...errs];
      if (updated[idx]) updated[idx] = { ...updated[idx], [field]: null };
      return updated;
    });
    if (formErrors.totalAmount) setFormErrors((fe) => ({ ...fe, totalAmount: null }));
  };

  const addRow    = () => setForm((f) => ({ ...f, sareeDetails: [...f.sareeDetails, { ...EMPTY_ROW }] }));
  const removeRow = (idx) => setForm((f) => ({ ...f, sareeDetails: f.sareeDetails.filter((_, i) => i !== idx) }));

  // ── Validation ────────────────────────────────────────────
  const validate = () => {
    const fErrs = {};
    if (!form.partyId)        fErrs.partyId        = "Please select a party.";
    if (!form.transactionDate) fErrs.transactionDate = "Date is required.";
    if (totalAmount <= 0)      fErrs.totalAmount     = "Total must be greater than ₹0.";

    const rErrs = form.sareeDetails.map((r) => {
      const e = {};
      if (!r.sareeName.trim())       e.sareeName   = "Required.";
      if (validatePositive(r.quantity))  e.quantity    = "Must be > 0.";
      if (validatePositive(r.pricePerUnit)) e.pricePerUnit = "Must be > 0.";
      return e;
    });

    setFormErrors(fErrs);
    setRowErrors(rErrs);
    return Object.keys(fErrs).length === 0 && !rErrs.some((e) => Object.keys(e).length > 0);
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) { toast.error("Please fix the validation errors."); return; }
    setLoading(true);
    try {
      const sareeDetails = form.sareeDetails.map((r) => ({
        sareeName:    r.sareeName.trim(),
        quantity:     parseFloat(r.quantity),
        pricePerUnit: parseFloat(r.pricePerUnit),
        lineTotal:    parseFloat(r.quantity) * parseFloat(r.pricePerUnit),
      }));

      const partyObj = parties.find((p) => p.id === form.partyId);
      const initialLogs = amountPaidNum > 0 ? [{
        amount: amountPaidNum,
        date: new Date(form.transactionDate + "T12:00:00").toISOString(),
        type: form.type === "Sale" ? "Initial Receipt from Customer" : "Initial Payment to Supplier",
        note: "Initial upfront payment",
      }] : [];

      await addDoc(collection(db, "users", currentUser.uid, "transactions"), {
        partyId:         form.partyId,
        partyName:       partyObj?.name ?? "Unknown",
        invoiceNumber:   form.invoiceNumber.trim(),
        type:            form.type,
        sareeDetails,
        totalAmount,
        amountPaid:      amountPaidNum,
        pendingDue,
        paymentLogs:     initialLogs,
        transactionDate: form.transactionDate,
        status:          pendingDue <= 0 ? "Settled" : "Pending",
        notes:           form.notes.trim(),
        createdAt:       serverTimestamp(),
        settledAt:       pendingDue <= 0 ? serverTimestamp() : null,
      });

      toast.success("Transaction recorded successfully!");
      setForm(getInitialForm());
      setRowErrors([]);
      setFormErrors({});
    } catch (err) {
      toast.error("Failed to save transaction. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="section-title">Record Transaction</h2>
          <p className="text-slate-500 text-xs mt-0.5">Enter saree details given to or taken from a party</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Row 1: Party + Invoice No. + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Party select */}
          <div className="field">
            <label htmlFor="tx-party" className="label">Party</label>
            <select id="tx-party" value={form.partyId}
              onChange={(e) => { setForm((f) => ({ ...f, partyId: e.target.value })); setFormErrors((fe) => ({ ...fe, partyId: null })); }}
              className={`input-base cursor-pointer ${formErrors.partyId ? "input-error" : ""}`}>
              <option value="">— Select Party —</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
            </select>
            {formErrors.partyId && <p className="text-rose-400 text-xs">{formErrors.partyId}</p>}
          </div>

          {/* Invoice Number */}
          <div className="field">
            <label htmlFor="tx-invoice" className="label flex items-center gap-1">
              <FileText className="w-3 h-3 text-indigo-400" /> Invoice Number
            </label>
            <input id="tx-invoice" type="text" value={form.invoiceNumber}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              placeholder="e.g. INV-2026-001" className="input-base" />
          </div>

          {/* Date */}
          <div className="field">
            <label htmlFor="tx-date" className="label">Transaction Date</label>
            <input id="tx-date" type="date" value={form.transactionDate}
              onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))}
              className={`input-base ${formErrors.transactionDate ? "input-error" : ""}`} />
            {formErrors.transactionDate && <p className="text-rose-400 text-xs">{formErrors.transactionDate}</p>}
          </div>
        </div>

        {/* Row 2: Transaction Type */}
        <div className="field">
          <label className="label">Transaction Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { value: "Sale",            label: "Sale",            sub: "Sold to customer",         Icon: ArrowUpRight,  cls: "indigo" },
              { value: "Purchase",        label: "Purchase",        sub: "Received from supplier",   Icon: ArrowDownLeft, cls: "rose"   },
              { value: "Sale Return",     label: "Sale Return",     sub: "Customer returned sarees", Icon: RotateCcw,     cls: "amber"  },
              { value: "Purchase Return", label: "Purchase Return", sub: "Returned to supplier",     Icon: RotateCcw,     cls: "teal"   },
            ].map(({ value, label, sub, Icon, cls }) => (
              <button key={value} type="button"
                onClick={() => setForm((f) => ({ ...f, type: value }))}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                  form.type === value
                    ? cls === "indigo" ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                    : cls === "rose"   ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                    : cls === "amber"  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    :                    "bg-teal-500/20 border-teal-500/50 text-teal-300"
                    : "bg-slate-800/50 border-slate-700/60 text-slate-500 hover:text-slate-300"
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight">{label}</p>
                  <p className="text-[10px] opacity-70 truncate mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Saree / Inventory Rows */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setShowItems((v) => !v)}
              className="flex items-center gap-2 text-slate-300 font-semibold text-sm hover:text-white transition-colors">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              Inventory / Saree Details
              {showItems ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            <button type="button" onClick={addRow} className="btn-secondary text-xs py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          {showItems && (
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 space-y-3">
              {form.sareeDetails.map((row, idx) => (
                <SareeRow key={idx} index={idx} row={row}
                  onChange={handleRowChange} onRemove={removeRow}
                  canRemove={form.sareeDetails.length > 1} errors={rowErrors[idx]} />
              ))}
            </div>
          )}
          {formErrors.totalAmount && (
            <p className="mt-2 text-rose-400 text-xs font-medium">{formErrors.totalAmount}</p>
          )}
        </div>

        {/* Amount Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total (auto) */}
          <div className="field">
            <label className="label">Total Amount (Auto)</label>
            <div className="input-base flex items-center gap-2 bg-slate-800/30 cursor-not-allowed opacity-80 min-w-0">
              <IndianRupee className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-slate-100 font-bold num truncate">{fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Amount Paid */}
          <div className="field">
            <label htmlFor="tx-paid" className="label">Amount Paid (₹)</label>
            <input id="tx-paid" type="number" min="0" step="0.01" value={form.amountPaid}
              onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
              placeholder="0.00" className="input-base" />
          </div>

          {/* Pending Due (auto) */}
          <div className="field">
            <label className="label">Pending Due (Auto)</label>
            <div className={`input-base flex items-center gap-2 cursor-not-allowed min-w-0 ${
              isSettled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"
            }`}>
              <IndianRupee className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className={`font-bold num truncate ${isSettled ? "text-emerald-300" : "text-amber-300"}`}>
                {fmt(pendingDue)}
              </span>
              {isSettled && <span className="ml-auto text-emerald-400 text-xs font-semibold flex-shrink-0">✓ Settled</span>}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="field">
          <label htmlFor="tx-notes" className="label">Notes (Optional)</label>
          <textarea id="tx-notes" rows={2} value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Additional notes about this transaction…"
            className="input-base resize-none" />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="btn-primary px-8">
            {loading ? <span className="spinner" /> : <Receipt className="w-4 h-4" />}
            {loading ? "Saving…" : "Save Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
