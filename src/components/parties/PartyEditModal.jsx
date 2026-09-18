import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { validateName, validateMobile } from "../../utils/validators";
import { X, Save, Phone, Tag, UserCog, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function PartyEditModal({ party, onClose }) {
  const { currentUser } = useAuth();
  const [form,    setForm]    = useState({ name: party.name || "", mobile: party.mobile || "", type: party.type || "Customer" });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const setField = (k) => (e) => {
    const val = k === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  const validate = () => {
    const e = {};
    const ne = validateName(form.name);
    const me = validateMobile(form.mobile);
    if (ne) e.name   = ne;
    if (me) e.mobile = me;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid, "parties", party.id), {
        name:   form.name.trim(),
        mobile: form.mobile.replace(/\D/g, ""),
        type:   form.type,
      });
      toast.success(`"${form.name.trim()}" updated.`);
      onClose();
    } catch (err) {
      toast.error("Failed to update party. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 card p-6 w-full max-w-md animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-100 font-semibold text-sm">Edit Party</p>
              <p className="text-slate-500 text-xs mt-0.5">Update account details</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="field">
            <label htmlFor="edit-name" className="label">Party Name</label>
            <input id="edit-name" type="text" value={form.name} onChange={setField("name")}
              placeholder="e.g. Ramesh Textiles"
              className={`input-base ${errors.name ? "input-error" : ""}`} />
            {errors.name && <p className="text-rose-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
          </div>

          <div className="field">
            <label htmlFor="edit-mobile" className="label flex items-center gap-1">
              <Phone className="w-3 h-3" /> Mobile Number
            </label>
            <input id="edit-mobile" type="tel" inputMode="numeric" value={form.mobile}
              onChange={setField("mobile")} placeholder="10-digit number" maxLength={10}
              className={`input-base ${errors.mobile ? "input-error" : ""}`} />
            {errors.mobile && <p className="text-rose-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.mobile}</p>}
          </div>

          <div className="field">
            <label htmlFor="edit-type" className="label flex items-center gap-1">
              <Tag className="w-3 h-3" /> Party Type
            </label>
            <select id="edit-type" value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="input-base cursor-pointer">
              <option value="Customer">Customer (Accounts Receivable)</option>
              <option value="Supplier">Supplier (Accounts Payable)</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <span className="spinner" /> : <Save className="w-4 h-4" />}
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
