import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { validateName, validateMobile } from "../../utils/validators";
import { UserPlus, Phone, Tag } from "lucide-react";
import toast from "react-hot-toast";

const INITIAL = { name: "", mobile: "", type: "Customer" };

export default function PartyForm() {
  const { currentUser } = useAuth();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    const nameErr = validateName(form.name);
    const mobileErr = validateMobile(form.mobile);
    if (nameErr) e.name = nameErr;
    if (mobileErr) e.mobile = mobileErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "users", currentUser.uid, "parties"), {
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, ""),
        type: form.type,
        createdAt: serverTimestamp(),
      });
      toast.success(`Party "${form.name.trim()}" added successfully.`);
      setForm(INITIAL);
      setErrors({});
    } catch (err) {
      toast.error("Failed to add party. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e) => {
    setForm((f) => ({ ...f, name: e.target.value }));
    if (errors.name) setErrors((er) => ({ ...er, name: null }));
  };

  const handleMobileChange = (e) => {
    // Strip non-digits and enforce 10-char max
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({ ...f, mobile: digits }));
    if (errors.mobile) setErrors((er) => ({ ...er, mobile: null }));
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/15">
          <UserPlus className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="section-title">Add New Party</h2>
          <p className="text-slate-500 text-xs mt-0.5">Register a customer or supplier account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Party Name */}
          <div className="md:col-span-1">
            <label htmlFor="party-name" className="label">Party Name</label>
            <input
              id="party-name"
              type="text"
              value={form.name}
              onChange={handleNameChange}
              placeholder="e.g. Ramesh Textiles"
              className={`input-base ${errors.name ? "input-error" : ""}`}
            />
            {errors.name && (
              <p className="mt-1.5 text-rose-400 text-xs font-medium">{errors.name}</p>
            )}
          </div>

          {/* Mobile */}
          <div>
            <label htmlFor="party-mobile" className="label">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> Mobile Number
              </span>
            </label>
            <input
              id="party-mobile"
              type="tel"
              inputMode="numeric"
              value={form.mobile}
              onChange={handleMobileChange}
              placeholder="10-digit number"
              maxLength={10}
              className={`input-base ${errors.mobile ? "input-error" : ""}`}
            />
            {errors.mobile && (
              <p className="mt-1.5 text-rose-400 text-xs font-medium">{errors.mobile}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label htmlFor="party-type" className="label">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> Party Type
              </span>
            </label>
            <select
              id="party-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="input-base cursor-pointer"
            >
              <option value="Customer">Customer (Accounts Receivable)</option>
              <option value="Supplier">Supplier (Accounts Payable)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {loading ? "Adding…" : "Add Party"}
          </button>
        </div>
      </form>
    </div>
  );
}
