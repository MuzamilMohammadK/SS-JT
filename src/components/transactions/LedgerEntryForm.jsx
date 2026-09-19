import { useState, useMemo } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  validatePositive, validateNonNegative, computeGST, fmtINR,
} from "../../utils/validators";
import {
  Plus, Trash2, Receipt, IndianRupee, ShoppingBag,
  ChevronDown, ChevronUp, Calculator, Users,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Constants ──────────────────────────────────────────────────
const EMPTY_ROW = { sareeName: "", quantity: "", pricePerUnit: "" };

function getInitialForm() {
  return {
    partyId:         "",
    type:            "Given",
    sareeDetails:    [{ ...EMPTY_ROW }],
    gstRate:         "",
    amountPaid:      "",
    transactionDate: new Date().toISOString().slice(0, 10),
    notes:           "",
  };
}

// ── Saree Row ──────────────────────────────────────────────────
function SareeRow({ index, row, onChange, onRemove, canRemove, errors }) {
  const subtotal = (Number(row.quantity) || 0) * (Number(row.pricePerUnit) || 0);
  return (
    <div className="card p-3 mb-2 animate-fade-in-up">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500 text-xs font-mono font-bold">Item #{index + 1}</span>
        <div className="flex items-center gap-2">
          {subtotal > 0 && (
            <span className="text-indigo-400 text-xs font-semibold num">
              {fmtINR(subtotal)}
            </span>
          )}
          {canRemove && (
            <button type="button" onClick={() => onRemove(index)}
              className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all" title="Remove item">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2">
        {/* Saree Name */}
        <div className="col-span-12 sm:col-span-5">
          <label className="label text-[10px]">Saree Name / Design</label>
          <input type="text" value={row.sareeName}
            onChange={(e) => onChange(index, "sareeName", e.target.value)}
            placeholder="e.g. Banarasi Pure Silk"
            className={`input-base text-sm py-2 ${errors?.sareeName ? "input-error" : ""}`} />
          {errors?.sareeName && <p className="text-rose-400 text-xs mt-0.5">{errors.sareeName}</p>}
        </div>

        {/* Quantity */}
        <div className="col-span-5 sm:col-span-3">
          <label className="label text-[10px]">Quantity (pcs)</label>
          <input type="number" min="1" step="1" value={row.quantity}
            onChange={(e) => onChange(index, "quantity", e.target.value)}
            placeholder="0"
            className={`input-base text-sm py-2 ${errors?.quantity ? "input-error" : ""}`} />
          {errors?.quantity && <p className="text-rose-400 text-xs mt-0.5">{errors.quantity}</p>}
        </div>

        {/* Price per unit */}
        <div className="col-span-7 sm:col-span-4">
          <label className="label text-[10px]">Unit Price (₹)</label>
          <input type="number" min="0.01" step="0.01" value={row.pricePerUnit}
            onChange={(e) => onChange(index, "pricePerUnit", e.target.value)}
            placeholder="0.00"
            className={`input-base text-sm py-2 ${errors?.pricePerUnit ? "input-error" : ""}`} />
          {errors?.pricePerUnit && <p className="text-rose-400 text-xs mt-0.5">{errors.pricePerUnit}</p>}
        </div>
      </div>
    </div>
  );
}

// ── GST Summary Box ────────────────────────────────────────────
function GSTSummary({ subTotal, gstRate, amountPaid }) {
  const { gstAmount, totalAmount } = computeGST(subTotal, gstRate);
  const pendingDue = Math.max(0, totalAmount - (Number(amountPaid) || 0));
  return (
    <div className="card bg-slate-900/60 p-4 space-y-2.5">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Financial Breakdown</span>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between items-center gap-2">
          <span className="text-slate-500 flex-shrink-0">Subtotal</span>
          <span className="text-slate-300 num truncate">{fmtINR(subTotal)}</span>
        </div>
        {gstRate > 0 && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-500 flex-shrink-0">GST ({gstRate}%)</span>
            <span className="text-slate-300 num truncate">{fmtINR(gstAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center gap-2 border-t border-slate-800 pt-1.5">
          <span className="text-slate-300 font-semibold flex-shrink-0">Total Amount</span>
          <span className="text-white font-bold num truncate">{fmtINR(totalAmount)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-slate-500 flex-shrink-0">Amount Paid</span>
          <span className="text-emerald-400 num truncate">{fmtINR(Number(amountPaid) || 0)}</span>
        </div>
        <div className="flex justify-between items-center gap-2 border-t border-slate-800 pt-1.5">
          <span className="text-amber-400 font-semibold flex-shrink-0">Pending Due</span>
          <span className={`font-bold num truncate ${pendingDue > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {fmtINR(pendingDue)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function LedgerEntryForm({ parties }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [form,    setForm]    = useState(getInitialForm());
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  // Compute subtotal from all rows
  const subTotal = useMemo(() =>
    form.sareeDetails.reduce((acc, r) => {
      const qty   = Number(r.quantity) || 0;
      const price = Number(r.pricePerUnit) || 0;
      return acc + qty * price;
    }, 0),
    [form.sareeDetails]
  );

  const gstRateNum = form.gstRate === "" || isNaN(Number(form.gstRate)) ? 0 : Number(form.gstRate);
  const { gstAmount, totalAmount } = computeGST(subTotal, gstRateNum);

  // ── Field Helpers ──
  const setTop = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: null }));
  };

  const updateRow = (i, field, val) => {
    setForm((f) => {
      const rows = [...f.sareeDetails];
      rows[i] = { ...rows[i], [field]: val };
      return { ...f, sareeDetails: rows };
    });
  };

  const addRow = () =>
    setForm((f) => ({ ...f, sareeDetails: [...f.sareeDetails, { ...EMPTY_ROW }] }));

  const removeRow = (i) =>
    setForm((f) => ({ ...f, sareeDetails: f.sareeDetails.filter((_, idx) => idx !== i) }));

  // ── Validate ──
  const validate = () => {
    const e = {};
    if (!form.partyId) e.partyId = "Please select a party.";

    const rowErrors = form.sareeDetails.map((r) => {
      const re = {};
      if (!r.sareeName.trim())              re.sareeName    = "Name required.";
      if (validatePositive(r.quantity))      re.quantity     = "Must be > 0.";
      if (validatePositive(r.pricePerUnit))  re.pricePerUnit = "Must be > 0.";
      return Object.keys(re).length ? re : null;
    });

    if (rowErrors.some(Boolean)) e.rows = rowErrors;
    if (subTotal <= 0) e.subTotal = "Add at least one saree item with valid qty & price.";

    // GST rate
    if (form.gstRate !== "" && form.gstRate !== "0" && form.gstRate !== 0) {
      const g = Number(form.gstRate);
      if (isNaN(g) || g < 0)   e.gstRate = "GST rate cannot be negative.";
      else if (g > 100)         e.gstRate = "GST rate cannot exceed 100%.";
    }

    const paidNum = Number(form.amountPaid);
    if (form.amountPaid !== "" && (isNaN(paidNum) || paidNum < 0))
      e.amountPaid = "Amount paid cannot be negative.";
    if (!isNaN(paidNum) && paidNum > totalAmount)
      e.amountPaid = "Amount paid cannot exceed the total amount.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const amountPaid = Number(form.amountPaid) || 0;
      const pendingDue = parseFloat((totalAmount - amountPaid).toFixed(2));
      const status     = pendingDue <= 0 ? "Settled" : "Pending";

      const selectedParty = parties.find((p) => p.id === form.partyId);

      const sareeDetails = form.sareeDetails.map((r) => ({
        sareeName:    r.sareeName.trim(),
        quantity:     Number(r.quantity),
        pricePerUnit: Number(r.pricePerUnit),
        subtotal:     Number(r.quantity) * Number(r.pricePerUnit),
      }));

      await addDoc(collection(db, "users", uid, "transactions"), {
        partyId:         form.partyId,
        partyName:       selectedParty?.name ?? "Unknown",
        type:            form.type,
        sareeDetails,
        subTotalAmount:  parseFloat(subTotal.toFixed(2)),
        gstRate:         gstRateNum,
        gstAmount,
        totalAmount,
        amountPaid,
        pendingDue,
        status,
        transactionDate: form.transactionDate,
        notes:           form.notes.trim(),
        createdAt:       serverTimestamp(),
        settledAt:       null,
      });

      toast.success(`Transaction recorded — ${fmtINR(totalAmount)} (${status})`);
      setForm(getInitialForm());
      setErrors({});
    } catch (err) {
      toast.error("Failed to save transaction. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setForm(getInitialForm()); setErrors({}); };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">

      {/* ── Header ── */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="section-title">New Ledger Entry</h2>
            <p className="text-slate-500 text-xs mt-0.5">Record a saree transaction with GST</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Party */}
          <div className="field md:col-span-1">
            <label htmlFor="le-party" className="label flex items-center gap-1">
              <Users className="w-3 h-3" /> Party
            </label>
            <select id="le-party" value={form.partyId} onChange={setTop("partyId")}
              className={`select-base ${errors.partyId ? "input-error" : ""}`}>
              <option value="">— Select party —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category === "Customer" ? "Customer" : "Supplier"})
                </option>
              ))}
            </select>
            {errors.partyId && <p className="text-rose-400 text-xs">{errors.partyId}</p>}
          </div>

          {/* Type */}
          <div className="field">
            <label htmlFor="le-type" className="label">Transaction Type</label>
            <div className="tab-bar">
              {["Given", "Taken"].map((t) => (
                <button key={t} type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`tab-item${form.type === t ? " active" : ""}`}>
                  {t === "Given" ? "Given (Sold)" : "Taken (Received)"}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="field">
            <label htmlFor="le-date" className="label">Transaction Date</label>
            <input id="le-date" type="date" value={form.transactionDate}
              onChange={setTop("transactionDate")} className="input-base" />
          </div>
        </div>
      </div>

      {/* ── Saree Items ── */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="section-title text-base">Saree Items</h3>
        </div>

        {form.sareeDetails.map((row, i) => (
          <SareeRow
            key={i} index={i} row={row}
            onChange={updateRow}
            onRemove={removeRow}
            canRemove={form.sareeDetails.length > 1}
            errors={errors.rows?.[i]}
          />
        ))}

        {errors.subTotal && (
          <p className="text-rose-400 text-xs mb-2">{errors.subTotal}</p>
        )}

        <button type="button" onClick={addRow}
          className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 mt-2">
          <Plus className="w-4 h-4" /> Add Another Item
        </button>
      </div>

      {/* ── Payment & GST ── */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="section-title text-base">Payment & Tax</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* GST Rate — manual entry */}
          <div className="field">
            <label htmlFor="le-gst" className="label flex items-center gap-1">
              GST Rate
              <span className="text-slate-600 font-normal normal-case tracking-normal text-[10px] ml-1">enter any %</span>
            </label>
            <div className="relative">
              <input
                id="le-gst"
                type="text"
                inputMode="decimal"
                value={form.gstRate ?? ""}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  // Allow empty, or valid numbers and decimals (e.g. 5, 5., 5.5, 0.25)
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    if (val === "" || val === "." || Number(val) <= 100) {
                      setForm((f) => ({ ...f, gstRate: val }));
                      setErrors((er) => ({ ...er, gstRate: null }));
                    }
                  }
                }}
                placeholder="0"
                className={`input-base pr-10 ${errors.gstRate ? "input-error" : ""}`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold pointer-events-none">%</span>
            </div>
            {/* Quick presets */}
            <div className="flex gap-1.5 mt-1.5">
              {[0, 5, 12, 18].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, gstRate: r === 0 ? "0" : String(r) }));
                    setErrors((er) => ({ ...er, gstRate: null }));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 border ${
                    form.gstRate !== "" && Number(form.gstRate) === r
                      ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
                      : "bg-slate-800/60 text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {r === 0 ? "None" : `${r}%`}
                </button>
              ))}
            </div>
            {errors.gstRate && <p className="text-rose-400 text-xs">{errors.gstRate}</p>}
          </div>

          {/* Amount Paid Initially */}
          <div className="field">
            <label htmlFor="le-paid" className="label flex items-center justify-between">
              <span>Amount Paid Initially (₹)</span>
              {totalAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, amountPaid: String(totalAmount) }))}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold normal-case tracking-normal transition-colors"
                >
                  Mark Fully Paid
                </button>
              )}
            </label>
            <div className="relative">
              <input
                id="le-paid"
                type="number"
                min="0"
                step="0.01"
                value={form.amountPaid}
                onChange={setTop("amountPaid")}
                placeholder="0.00"
                className={`input-base ${errors.amountPaid ? "input-error" : ""}`}
              />
            </div>
            {/* Context: Amount breakdown mini-card that never overflows on mobile */}
            {totalAmount > 0 && (
              <div className="mt-2 p-2 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="min-w-0 px-1">
                    <p className="text-[10px] uppercase font-semibold text-slate-500 truncate">Total Bill</p>
                    <p className="text-xs sm:text-sm font-semibold text-white num truncate" title={fmtINR(totalAmount)}>
                      {fmtINR(totalAmount)}
                    </p>
                  </div>
                  <div className="min-w-0 border-x border-slate-800/80 px-1">
                    <p className="text-[10px] uppercase font-semibold text-emerald-500/90 truncate">Paid</p>
                    <p className="text-xs sm:text-sm font-semibold text-emerald-400 num truncate" title={fmtINR(Number(form.amountPaid) || 0)}>
                      {fmtINR(Number(form.amountPaid) || 0)}
                    </p>
                  </div>
                  <div className="min-w-0 px-1">
                    <p className="text-[10px] uppercase font-semibold text-amber-500/90 truncate">Pending</p>
                    <p className={`text-xs sm:text-sm font-semibold num truncate ${
                      Math.max(0, totalAmount - (Number(form.amountPaid) || 0)) > 0
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`} title={fmtINR(Math.max(0, totalAmount - (Number(form.amountPaid) || 0)))}>
                      {fmtINR(Math.max(0, totalAmount - (Number(form.amountPaid) || 0)))}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {errors.amountPaid && <p className="text-rose-400 text-xs">{errors.amountPaid}</p>}
          </div>
        </div>

        {/* GST Summary */}
        {subTotal > 0 && (
          <GSTSummary
            subTotal={subTotal}
            gstRate={gstRateNum}
            amountPaid={form.amountPaid}
          />
        )}
      </div>

      {/* ── Notes (optional) ── */}
      <div className="field">
        <label htmlFor="le-notes" className="label">Notes (optional)</label>
        <textarea id="le-notes" rows={2} value={form.notes} onChange={setTop("notes")}
          placeholder="Delivery details, cheque number, remarks…"
          className="input-base resize-none" />
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={reset} className="btn-secondary">
          Reset
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <span className="spinner" /> : <Receipt className="w-4 h-4" />}
          {loading ? "Saving…" : "Save Transaction"}
        </button>
      </div>
    </form>
  );
}
