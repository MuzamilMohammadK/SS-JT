import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  validateName,
  validateMobile,
  validateGSTIN,
  validateOwnerName,
} from "../../utils/validators";
import {
  X,
  Save,
  Phone,
  Tag,
  UserCog,
  AlertCircle,
  Plus,
  Trash2,
  MapPin,
  User,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

export default function PartyEditModal({ party, onClose }) {
  const { currentUser } = useAuth();

  // Extract initial mobiles
  const initialMobiles = party.mobiles?.length
    ? party.mobiles
    : party.mobile
    ? [party.mobile]
    : [""];

  const [form, setForm] = useState({
    name: party.name || "",
    ownerName: party.ownerName || party.owner || "",
    gstin: party.gstin || "",
    mobiles: initialMobiles,
    type: party.type || "Customer",
    address: party.address || "",
    city: party.city || "",
    state: party.state || "",
    pincode: party.pincode || "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const setField = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  const handleMobileChange = (idx, val) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setForm((f) => {
      const updated = [...f.mobiles];
      updated[idx] = digits;
      return { ...f, mobiles: updated };
    });
    if (errors.mobiles) setErrors((er) => ({ ...er, mobiles: null }));
  };

  const handleAddMobile = () => {
    setForm((f) => ({ ...f, mobiles: [...f.mobiles, ""] }));
  };

  const handleRemoveMobile = (idx) => {
    if (form.mobiles.length <= 1) return;
    setForm((f) => ({
      ...f,
      mobiles: f.mobiles.filter((_, i) => i !== idx),
    }));
  };

  const validate = () => {
    const e = {};
    const ne = validateName(form.name);
    if (ne) e.name = ne;

    if (!form.type) e.type = "Please select a party type.";

    // If Owner is selected, only the name is required — skip all other validations
    if (form.type === "Owner") {
      setErrors(e);
      return Object.keys(e).length === 0;
    }

    const oe = validateOwnerName(form.ownerName);
    if (oe) e.ownerName = oe;

    const cleanGstin = (form.gstin || "").trim().toUpperCase();
    const ge = validateGSTIN(cleanGstin, form.type === "Customer");
    if (ge) e.gstin = ge;

    // Validate mobiles: first is required, others optional but must be 10 digits if filled
    const firstMob = form.mobiles[0] || "";
    const firstErr = validateMobile(firstMob);
    if (firstErr) {
      e.mobiles = "Primary mobile number must be 10 digits.";
    } else {
      for (let i = 1; i < form.mobiles.length; i++) {
        const m = form.mobiles[i];
        if (m && m.length !== 10) {
          e.mobiles = `Mobile number #${i + 1} must be 10 digits.`;
          break;
        }
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const isOwner = form.type === "Owner";
    const cleanMobiles = isOwner
      ? []
      : form.mobiles.map((m) => m.replace(/\D/g, "")).filter(Boolean);

    try {
      await updateDoc(doc(db, "users", currentUser.uid, "parties", party.id), {
        name: form.name.trim(),
        ownerName: isOwner ? form.name.trim() : form.ownerName.trim(),
        owner: isOwner ? form.name.trim() : form.ownerName.trim(),
        gstin: isOwner ? "" : form.gstin.trim().toUpperCase(),
        mobile: cleanMobiles[0] || "",
        mobiles: cleanMobiles,
        type: form.type,
        address: isOwner ? "" : form.address.trim(),
        city: isOwner ? "" : form.city.trim(),
        state: isOwner ? "" : form.state.trim(),
        pincode: isOwner ? "" : form.pincode.replace(/\D/g, "").slice(0, 6),
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

      <div className="relative z-10 card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-100 font-semibold text-sm">Edit Party</p>
              <p className="text-slate-500 text-xs mt-0.5">Update contact, address & type</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Party Name */}
          <div className="field">
            <label htmlFor="edit-name" className="label">
              {form.type === "Owner" ? "Owner Name" : "Party Name"}
            </label>
            <input
              id="edit-name"
              type="text"
              value={form.name}
              onChange={setField("name")}
              placeholder={form.type === "Owner" ? "e.g. Ramesh Bhai" : "e.g. Ramesh Textiles"}
              className={`input-base ${errors.name ? "input-error" : ""}`}
            />
            {errors.name && (
              <p className="text-rose-400 text-xs flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Party Type Radio */}
          <div>
            <label className="label flex items-center gap-1">
              <Tag className="w-3 h-3" /> Party Type
            </label>
            <div className="flex items-center gap-2.5 pt-1">
              {["Customer", "Supplier", "Owner"].map((opt) => {
                const isSelected = form.type === opt;
                const activeClass =
                  opt === "Customer"
                    ? "border-indigo-500 bg-indigo-500/15 text-indigo-300 shadow-sm"
                    : opt === "Supplier"
                    ? "border-rose-500 bg-rose-500/15 text-rose-300 shadow-sm"
                    : "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-sm";

                return (
                  <label
                    key={opt}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border cursor-pointer text-xs sm:text-sm font-medium transition-all select-none ${
                      isSelected
                        ? activeClass
                        : "border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="editPartyType"
                      value={opt}
                      checked={isSelected}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setForm((f) => ({ ...f, type: nextType }));
                        if (errors.type) setErrors((er) => ({ ...er, type: null }));
                        if (nextType === "Owner") {
                          setErrors((er) => ({
                            ...er,
                            mobiles: null,
                            gstin: null,
                            ownerName: null,
                          }));
                        } else if (
                          nextType === "Supplier" &&
                          errors.gstin === "GSTIN is required for customers."
                        ) {
                          setErrors((er) => ({ ...er, gstin: null }));
                        }
                      }}
                      className="w-4 h-4 accent-indigo-500 cursor-pointer"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            {errors.type && <p className="text-rose-400 text-xs mt-1.5">⚠ {errors.type}</p>}
          </div>

          {/* When Owner is selected, hide all other inputs */}
          {form.type !== "Owner" && (
            <>
              {/* Owner Name & GSTIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="edit-owner-name" className="label flex items-center gap-1">
                    <User className="w-3 h-3" /> Owner Name
                  </label>
                  <input
                    id="edit-owner-name"
                    type="text"
                    value={form.ownerName}
                    onChange={setField("ownerName")}
                    placeholder="e.g. Ramesh Kumar"
                    className={`input-base ${errors.ownerName ? "input-error" : ""}`}
                  />
                  {errors.ownerName && (
                    <p className="text-rose-400 text-xs flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.ownerName}
                    </p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="edit-gstin" className="label flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> GSTIN
                      {form.type === "Customer" && <span className="text-rose-400 font-bold">*</span>}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {form.gstin.length}/15
                    </span>
                  </label>
                  <input
                    id="edit-gstin"
                    type="text"
                    value={form.gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
                      setForm((f) => ({ ...f, gstin: val }));
                      if (errors.gstin) setErrors((er) => ({ ...er, gstin: null }));
                    }}
                    placeholder="15-digit / char GSTIN"
                    maxLength={15}
                    className={`input-base font-mono uppercase tracking-wider ${
                      errors.gstin ? "input-error" : ""
                    }`}
                  />
                  {errors.gstin && (
                    <p className="text-rose-400 text-xs flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.gstin}
                    </p>
                  )}
                </div>
              </div>

              {/* Multiple Mobile Numbers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Mobile Numbers
                  </label>
                  <button
                    type="button"
                    onClick={handleAddMobile}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Number
                  </button>
                </div>
                <div className="space-y-2">
                  {form.mobiles.map((mob, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={mob}
                        onChange={(e) => handleMobileChange(idx, e.target.value)}
                        placeholder={idx === 0 ? "Primary mobile (10 digits)" : `Secondary mobile #${idx + 1}`}
                        maxLength={10}
                        className="input-base"
                      />
                      {form.mobiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMobile(idx)}
                          className="p-2.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove number"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {errors.mobiles && (
                  <p className="text-rose-400 text-xs flex items-center gap-1 mt-1.5 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    {errors.mobiles}
                  </p>
                )}
              </div>

              {/* Address Details */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <label className="label flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address Details
                </label>
                <div>
                  <input
                    type="text"
                    value={form.address}
                    onChange={setField("address")}
                    placeholder="Street address / Shop / Door No."
                    className="input-base text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={form.city}
                    onChange={setField("city")}
                    placeholder="City / Town"
                    className="input-base text-sm"
                  />
                  <input
                    type="text"
                    value={form.state}
                    onChange={setField("state")}
                    placeholder="State"
                    className="input-base text-sm"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setForm((f) => ({ ...f, pincode: val }));
                    }}
                    placeholder="PIN Code"
                    maxLength={6}
                    className="input-base text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
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
