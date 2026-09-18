import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { validatePositive } from "../../utils/validators";
import { Plus, Trash2, Receipt, IndianRupee, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";

const EMPTY_ROW = { sareeName: "", quantity: "", pricePerUnit: "" };

function SareeRow({ index, row, onChange, onRemove, canRemove, errors }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      {/* Row number */}
      <div className="col-span-12 sm:col-span-1 flex items-center pt-8 sm:pt-8">
        <span className="text-slate-600 text-xs font-bold">{index + 1}.</span>
      </div>

      {/* Saree Name / Design */}
      <div className="col-span-12 sm:col-span-5">
        {index === 0 && <label className="label">Saree Name / Design</label>}
        <input
          type="text"
          value={row.sareeName}
          onChange={(e) => onChange(index, "sareeName", e.target.value)}
          placeholder="e.g. Banarasi Pure Silk"
          className={`input-base ${errors?.sareeName ? "input-error" : ""}`}
        />
        {errors?.sareeName && (
          <p className="mt-1 text-rose-400 text-xs">{errors.sareeName}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="col-span-6 sm:col-span-2">
        {index === 0 && <label className="label">Qty</label>}
        <input
          type="number"
          min="1"
          value={row.quantity}
          onChange={(e) => onChange(index, "quantity", e.target.value)}
          placeholder="0"
          className={`input-base ${errors?.quantity ? "input-error" : ""}`}
        />
        {errors?.quantity && (
          <p className="mt-1 text-rose-400 text-xs">{errors.quantity}</p>
        )}
      </div>

      {/* Price per unit */}
      <div className="col-span-6 sm:col-span-3">
        {index === 0 && <label className="label">Price / Unit (₹)</label>}
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={row.pricePerUnit}
          onChange={(e) => onChange(index, "pricePerUnit", e.target.value)}
          placeholder="0.00"
          className={`input-base ${errors?.pricePerUnit ? "input-error" : ""}`}
        />
        {errors?.pricePerUnit && (
          <p className="mt-1 text-rose-400 text-xs">{errors.pricePerUnit}</p>
        )}
      </div>

      {/* Sub-total + remove */}
      <div className="col-span-12 sm:col-span-1 flex items-center justify-between sm:justify-end gap-2 sm:pt-7">
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="btn-danger shrink-0"
            title="Remove row"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

const INITIAL_FORM = {
  partyId: "",
  type: "Given",
  sareeDetails: [{ ...EMPTY_ROW }],
  amountPaid: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function TransactionForm({ parties }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [rowErrors, setRowErrors] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // ── Computed values ──────────────────────────────
  const totalAmount = form.sareeDetails.reduce((sum, r) => {
    const qty = parseFloat(r.quantity) || 0;
    const price = parseFloat(r.pricePerUnit) || 0;
    return sum + qty * price;
  }, 0);

  const amountPaidNum = parseFloat(form.amountPaid) || 0;
  const pendingDue = Math.max(0, totalAmount - amountPaidNum);

  // ── Helpers ──────────────────────────────────────
  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);

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
  };

  const addRow = () =>
    setForm((f) => ({ ...f, sareeDetails: [...f.sareeDetails, { ...EMPTY_ROW }] }));

  const removeRow = (idx) =>
    setForm((f) => ({
      ...f,
      sareeDetails: f.sareeDetails.filter((_, i) => i !== idx),
    }));

  // ── Validation ────────────────────────────────────
  const validate = () => {
    const fErrs = {};
    if (!form.partyId) fErrs.partyId = "Please select a party.";
    if (!form.transactionDate) fErrs.transactionDate = "Transaction date is required.";
    if (totalAmount <= 0) fErrs.totalAmount = "Total amount must be greater than zero.";

    const rErrs = form.sareeDetails.map((r) => {
      const e = {};
      if (!r.sareeName.trim()) e.sareeName = "Name required.";
      const qtyErr = validatePositive(r.quantity);
      const priceErr = validatePositive(r.pricePerUnit);
      if (qtyErr) e.quantity = qtyErr;
      if (priceErr) e.pricePerUnit = priceErr;
      return e;
    });

    const hasRowErrors = rErrs.some((e) => Object.keys(e).length > 0);
    setFormErrors(fErrs);
    setRowErrors(rErrs);
    return Object.keys(fErrs).length === 0 && !hasRowErrors;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error("Please fix the validation errors before submitting.");
      return;
    }
    setLoading(true);
    try {
      const sareeDetails = form.sareeDetails.map((r) => ({
        sareeName: r.sareeName.trim(),
        quantity: parseFloat(r.quantity),
        pricePerUnit: parseFloat(r.pricePerUnit),
        lineTotal: parseFloat(r.quantity) * parseFloat(r.pricePerUnit),
      }));

      await addDoc(collection(db, "transactions"), {
        partyId: form.partyId,
        type: form.type,
        sareeDetails,
        totalAmount,
        amountPaid: amountPaidNum,
        pendingDue,
        transactionDate: form.transactionDate,
        status: pendingDue <= 0 ? "Settled" : "Pending",
        notes: form.notes.trim(),
        createdAt: serverTimestamp(),
      });

      toast.success("Transaction recorded successfully!");
      setForm({ ...INITIAL_FORM, transactionDate: new Date().toISOString().slice(0, 10) });
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
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/15">
          <Receipt className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="section-title">Record Transaction</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Enter saree details given to or taken from a party
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* ── Row 1: Party + Type + Date ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Party */}
          <div>
            <label htmlFor="tx-party" className="label">Party</label>
            <select
              id="tx-party"
              value={form.partyId}
              onChange={(e) => {
                setForm((f) => ({ ...f, partyId: e.target.value }));
                if (formErrors.partyId) setFormErrors((fe) => ({ ...fe, partyId: null }));
              }}
              className={`input-base cursor-pointer ${formErrors.partyId ? "input-error" : ""}`}
            >
              <option value="">— Select Party —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
            {formErrors.partyId && (
              <p className="mt-1.5 text-rose-400 text-xs font-medium">{formErrors.partyId}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="label">Transaction Type</label>
            <div className="flex gap-3 mt-1">
              {["Given", "Taken"].map((t) => (
                <label
                  key={t}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer text-sm font-semibold transition-all duration-200
                    ${
                      form.type === t
                        ? t === "Given"
                          ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                          : "bg-rose-500/20 border-rose-500/50 text-rose-300"
                        : "bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300"
                    }`}
                >
                  <input
                    type="radio"
                    name="tx-type"
                    value={t}
                    checked={form.type === t}
                    onChange={() => setForm((f) => ({ ...f, type: t }))}
                    className="sr-only"
                  />
                  {t === "Given" ? "Given (Credit)" : "Taken (Due)"}
                </label>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="tx-date" className="label">Transaction Date</label>
            <input
              id="tx-date"
              type="date"
              value={form.transactionDate}
              onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))}
              className={`input-base ${formErrors.transactionDate ? "input-error" : ""}`}
            />
          </div>
        </div>

        {/* ── Saree Rows ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              Inventory / Saree Details
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 space-y-3">
            {form.sareeDetails.map((row, idx) => (
              <SareeRow
                key={idx}
                index={idx}
                row={row}
                onChange={handleRowChange}
                onRemove={removeRow}
                canRemove={form.sareeDetails.length > 1}
                errors={rowErrors[idx]}
              />
            ))}
          </div>

          {formErrors.totalAmount && (
            <p className="mt-2 text-rose-400 text-xs font-medium">{formErrors.totalAmount}</p>
          )}
        </div>

        {/* ── Amounts Summary ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total (auto) */}
          <div>
            <label className="label">Total Amount (Auto)</label>
            <div className="input-base flex items-center gap-2 bg-slate-800/30 cursor-not-allowed">
              <IndianRupee className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-slate-100 font-bold">{fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Amount Paid */}
          <div>
            <label htmlFor="tx-paid" className="label">Amount Paid (₹)</label>
            <input
              id="tx-paid"
              type="number"
              min="0"
              step="0.01"
              value={form.amountPaid}
              onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
              placeholder="0.00"
              className="input-base"
            />
          </div>

          {/* Pending Due (auto) */}
          <div>
            <label className="label">Pending Due (Auto)</label>
            <div
              className={`input-base flex items-center gap-2 cursor-not-allowed ${
                pendingDue > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30"
              }`}
            >
              <IndianRupee className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className={`font-bold ${pendingDue > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                {fmt(pendingDue)}
              </span>
              {pendingDue <= 0 && totalAmount > 0 && (
                <span className="ml-auto text-emerald-400 text-xs font-semibold">Settled</span>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="tx-notes" className="label">Notes (Optional)</label>
          <textarea
            id="tx-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional notes about this transaction…"
            className="input-base resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="btn-primary px-8">
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Receipt className="w-4 h-4" />
            )}
            {loading ? "Saving…" : "Save Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
