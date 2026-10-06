import { useState } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useParties } from "../../hooks/useParties";
import {
  validateName,
  validateMobile,
  validateGSTIN,
  validateOwnerName,
} from "../../utils/validators";
import {
  UserPlus,
  Phone,
  Tag,
  Plus,
  Trash2,
  MapPin,
  Users,
  ExternalLink,
  Loader2,
  AlertCircle,
  PhoneCall,
  User,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

const INITIAL = {
  name: "",
  ownerName: "",
  type: "",
  gstin: "",
  mobiles: [""],
  address: "",
  city: "",
  state: "",
  pincode: "",
};

function getInitials(name) {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? words.map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : name.slice(0, 2).toUpperCase();
}

export default function PartyForm() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const { parties = [], loading: pLoading, error: pError } = useParties(uid);

  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  const handleGstinChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
    setForm((f) => ({ ...f, gstin: val }));
    if (errors.gstin) setErrors((er) => ({ ...er, gstin: null }));
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
    const nameErr = validateName(form.name);
    if (nameErr) e.name = nameErr;

    if (!form.type) {
      e.type = "Please select a party type.";
      toast.error("Please select a party type (Customer, Supplier, or Owner).");
    }

    // If Owner is selected, only the name is required — skip all other validations
    if (form.type === "Owner") {
      setErrors(e);
      return Object.keys(e).length === 0;
    }

    const ownerErr = validateOwnerName(form.ownerName);
    if (ownerErr) e.ownerName = ownerErr;

    const primaryMob = form.mobiles[0] || "";
    const primaryErr = validateMobile(primaryMob);
    if (primaryErr) {
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

    const cleanGstin = (form.gstin || "").trim().toUpperCase();
    const gstinErr = validateGSTIN(cleanGstin, form.type === "Customer");
    if (gstinErr) {
      e.gstin = gstinErr;
    } else if (cleanGstin) {
      const duplicate = parties.find(
        (p) => p.gstin && p.gstin.trim().toUpperCase() === cleanGstin
      );
      if (duplicate) {
        e.gstin = `This GSTIN is already registered to "${duplicate.name}".`;
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
    const cleanGstin = isOwner ? "" : form.gstin.trim().toUpperCase();
    const cleanOwner = isOwner ? form.name.trim() : form.ownerName.trim();

    try {
      await addDoc(collection(db, "users", uid, "parties"), {
        name: form.name.trim(),
        ownerName: cleanOwner,
        owner: cleanOwner,
        gstin: cleanGstin,
        mobile: cleanMobiles[0] || "",
        mobiles: cleanMobiles,
        type: form.type,
        address: isOwner ? "" : form.address.trim(),
        city: isOwner ? "" : form.city.trim(),
        state: isOwner ? "" : form.state.trim(),
        pincode: isOwner ? "" : form.pincode.replace(/\D/g, "").slice(0, 6),
        createdAt: serverTimestamp(),
      });
      toast.success(`${form.type} "${form.name.trim()}" added successfully.`);
      setForm(INITIAL);
      setErrors({});
    } catch (err) {
      toast.error("Failed to add party. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Recent 5 registered parties (newest first)
  const recentParties = [...parties]
    .sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    })
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* ── Add Party Card ── */}
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
          {/* Row 1: Name + Type Radio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Party / Owner Name */}
            <div>
              <label htmlFor="party-name" className="label">
                {form.type === "Owner" ? "Owner Name" : "Party Name"}
              </label>
              <input
                id="party-name"
                type="text"
                value={form.name}
                onChange={setField("name")}
                placeholder={form.type === "Owner" ? "e.g. Ramesh Bhai" : "e.g. Ramesh Textiles"}
                className={`input-base ${errors.name ? "input-error" : ""}`}
              />
              {errors.name && (
                <p className="mt-1.5 text-rose-400 text-xs font-medium">⚠ {errors.name}</p>
              )}
            </div>

            {/* Party Type Radio */}
            <div>
              <label className="label flex items-center gap-1">
                <Tag className="w-3 h-3" /> Party Type
              </label>
              <div className="flex items-center gap-2 pt-1">
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
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border cursor-pointer text-xs sm:text-sm font-medium transition-all select-none ${
                        isSelected
                          ? activeClass
                          : "border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="partyType"
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
              {errors.type && (
                <p className="mt-1.5 text-rose-400 text-xs font-medium">⚠ {errors.type}</p>
              )}
            </div>
          </div>

          {/* When Owner is selected, only the name is needed — hide all other inputs */}
          {form.type !== "Owner" && (
            <>
              {/* Row 2: Owner Name + GSTIN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Owner Name */}
                <div>
                  <label htmlFor="owner-name" className="label flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Owner Name</span>
                    <span className="text-slate-500 font-normal text-xs ml-1">(Optional)</span>
                  </label>
                  <input
                    id="owner-name"
                    type="text"
                    value={form.ownerName}
                    onChange={setField("ownerName")}
                    placeholder="e.g. Ramesh Kumar"
                    className={`input-base ${errors.ownerName ? "input-error" : ""}`}
                  />
                  {errors.ownerName && (
                    <p className="mt-1.5 text-rose-400 text-xs font-medium">⚠ {errors.ownerName}</p>
                  )}
                </div>

                {/* GSTIN */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="party-gstin" className="label mb-0 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      <span>GSTIN</span>
                      {form.type === "Customer" && (
                        <span className="text-rose-400 font-bold ml-0.5">*</span>
                      )}
                    </label>
                    <span className="text-[11px] font-medium">
                      {form.type === "Customer" ? (
                        <span className="text-amber-400/90 font-semibold">Required for Customers</span>
                      ) : (
                        <span className="text-slate-500">Optional for Suppliers</span>
                      )}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="party-gstin"
                      type="text"
                      value={form.gstin}
                      onChange={handleGstinChange}
                      placeholder="e.g. 29ABCDE1234F1Z5 (15 digits/chars)"
                      maxLength={15}
                      className={`input-base font-mono uppercase tracking-wider pr-14 ${
                        errors.gstin ? "input-error" : ""
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono pointer-events-none">
                      {form.gstin.length}/15
                    </span>
                  </div>
                  {errors.gstin && (
                    <p className="mt-1.5 text-rose-400 text-xs font-medium">⚠ {errors.gstin}</p>
                  )}
                </div>
              </div>

              {/* Row 3: Multiple Mobile Numbers */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {form.mobiles.map((mob, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={mob}
                        onChange={(e) => handleMobileChange(idx, e.target.value)}
                        placeholder={idx === 0 ? "Primary mobile (10 digits)" : `Secondary #${idx + 1}`}
                        maxLength={10}
                        className="input-base"
                      />
                      {form.mobiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMobile(idx)}
                          className="p-2.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
                          title="Remove number"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {errors.mobiles && (
                  <p className="mt-1.5 text-rose-400 text-xs font-medium">⚠ {errors.mobiles}</p>
                )}
              </div>

              {/* Row 4: Address Details */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <label className="label flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address Details (Optional)
                </label>
                <div>
                  <input
                    type="text"
                    value={form.address}
                    onChange={setField("address")}
                    placeholder="Door No., Street, Building, Market or Area"
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
                    placeholder="PIN Code (6 digits)"
                    maxLength={6}
                    className="input-base text-sm"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {loading
                ? "Adding…"
                : form.type === "Owner"
                ? "Add Owner"
                : "Add Party"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Recent 5 Registered Parties Section ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="section-title text-base">Recent Registered Parties</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  Latest 5
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Showing recent {Math.min(5, parties.length)} of {parties.length} registered parties
              </p>
            </div>
          </div>

          <Link
            to="/registered-parties"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold whitespace-nowrap transition-all self-start sm:self-auto shadow-sm"
          >
            <span>View All Registered Parties ({parties.length})</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* List of Recent 5 Parties */}
        {pLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-3 text-indigo-400" />
            <span className="text-sm">Loading recent parties…</span>
          </div>
        ) : pError ? (
          <div className="alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{pError}</span>
          </div>
        ) : parties.length === 0 ? (
          <div className="card p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-slate-400 font-semibold text-sm">No parties registered yet</p>
            <p className="text-slate-600 text-xs mt-1">
              Use the form above to add your first customer or supplier.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-fade-in">
            {recentParties.map((party) => {
              const avatarGradient =
                party.type === "Customer"
                  ? "from-indigo-600 to-purple-600"
                  : party.type === "Owner"
                  ? "from-emerald-600 to-teal-600"
                  : "from-rose-600 to-pink-600";

              const allMobiles = party.mobiles?.length
                ? party.mobiles
                : party.mobile
                ? [party.mobile]
                : [];

              const addressText = [
                party.address,
                party.city,
                party.state,
                party.pincode ? `- ${party.pincode}` : "",
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={party.id}
                  className="card-hover p-4 flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
                    >
                      {getInitials(party.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-slate-100 font-semibold text-sm truncate" title={party.name}>
                          {party.name}
                        </p>
                        <span
                          className={
                            party.type === "Customer"
                              ? "badge-indigo text-[10px]"
                              : party.type === "Owner"
                              ? "badge-emerald text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold"
                              : "badge-rose text-[10px]"
                          }
                        >
                          {party.type === "Customer"
                            ? "Customer · AR"
                            : party.type === "Owner"
                            ? "Owner"
                            : "Supplier · AP"}
                        </span>
                      </div>

                      {/* Owner Name (for Customer/Supplier if entered) */}
                      {party.type !== "Owner" && (party.ownerName || party.owner) && (
                        <p className="text-slate-400 text-xs mt-1 flex items-center gap-1.5 truncate">
                          <User className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span>
                            Owner: <strong className="text-slate-300 font-medium">{party.ownerName || party.owner}</strong>
                          </span>
                        </p>
                      )}

                      {/* GSTIN */}
                      {party.gstin && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800/90 text-indigo-300 border border-indigo-500/30">
                            GSTIN: {party.gstin}
                          </span>
                        </div>
                      )}

                      {/* Phone Numbers */}
                      {allMobiles.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {allMobiles.map((mob, idx) => (
                            <a
                              key={idx}
                              href={`tel:${mob}`}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50 transition-colors"
                              title="Click to call"
                            >
                              <PhoneCall className="w-2.5 h-2.5 text-slate-500" />
                              <span>{mob}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-600 text-xs mt-1">No phone number</p>
                      )}

                      {/* Address */}
                      {addressText && (
                        <div className="flex items-start gap-1.5 mt-2 text-slate-400 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400/70 flex-shrink-0 mt-0.5" />
                          <p className="line-clamp-2 leading-relaxed text-slate-400 text-[11px]">
                            {addressText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
