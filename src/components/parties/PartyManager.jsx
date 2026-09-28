import { useState } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { validateName, validateMobile } from "../../utils/validators";
import PartyEditModal from "./PartyEditModal";
import {
  UserPlus,
  Phone,
  Tag,
  Users,
  Search,
  X,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Plus,
  MapPin,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Helpers ────────────────────────────────────────────────────
const INITIAL = {
  name: "",
  mobiles: [""],
  type: "",
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

// ── Delete Confirm Dialog ─────────────────────────────────────
function DeleteConfirm({ partyName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 card p-6 w-full max-w-sm animate-fade-in-scale">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-slate-100 font-semibold">Delete Party</p>
            <p className="text-slate-500 text-sm mt-1">
              Remove <span className="text-slate-300 font-medium">"{partyName}"</span>?
              Existing transactions will show "Unknown Party".
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger text-sm px-4 py-2">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Type Badge ────────────────────────────────────────────────
function TypeBadge({ type }) {
  return type === "Customer" ? (
    <span className="badge-indigo">Customer · AR</span>
  ) : (
    <span className="badge-rose">Supplier · AP</span>
  );
}

// ── Party Card ────────────────────────────────────────────────
export function PartyCard({ party, onEdit, onDelete }) {
  const avatarGradient =
    party.type === "Customer"
      ? "from-indigo-600 to-purple-600"
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
    <div className="card-hover p-4 flex flex-col justify-between gap-3 group">
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
            <TypeBadge type={party.type} />
          </div>

          {/* Multiple Mobile Numbers */}
          {allMobiles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {allMobiles.map((mob, idx) => (
                <a
                  key={idx}
                  href={`tel:${mob}`}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50 transition-colors"
                  title="Click to call"
                >
                  <Phone className="w-2.5 h-2.5 text-slate-500" />
                  <span>{mob}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-xs mt-1">No phone number</p>
          )}

          {/* Address Details */}
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

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800/50 opacity-90 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(party)}
          className="btn-icon text-slate-400 hover:text-indigo-300"
          title="Edit party"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(party)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          title="Delete party"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Add Party Form ────────────────────────────────────────────
export function AddPartyForm({ uid }) {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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

    // Validate mobiles
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

    if (!form.type) {
      e.type = "Please select a party type.";
      toast.error("Please select a party type (Customer or Supplier).");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const cleanMobiles = form.mobiles
      .map((m) => m.replace(/\D/g, ""))
      .filter(Boolean);

    try {
      await addDoc(collection(db, "users", uid, "parties"), {
        name: form.name.trim(),
        mobile: cleanMobiles[0] || "",
        mobiles: cleanMobiles,
        type: form.type,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.replace(/\D/g, "").slice(0, 6),
        createdAt: serverTimestamp(),
      });
      toast.success(`Party "${form.name.trim()}" added.`);
      setForm(INITIAL);
      setErrors({});
    } catch (err) {
      toast.error("Failed to add party. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="section-title">Add New Party</h2>
          <p className="text-slate-500 text-xs mt-0.5">Register a customer or supplier account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Row 1: Name & Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Party Name */}
          <div className="field">
            <label htmlFor="p-name" className="label">
              Party Name
            </label>
            <input
              id="p-name"
              type="text"
              value={form.name}
              onChange={setField("name")}
              placeholder="e.g. Ramesh Textiles"
              className={`input-base ${errors.name ? "input-error" : ""}`}
            />
            {errors.name && <p className="text-rose-400 text-xs mt-1">⚠ {errors.name}</p>}
          </div>

          {/* Type Radio Buttons */}
          <div className="field">
            <label className="label flex items-center gap-1">
              <Tag className="w-3 h-3" /> Party Type
            </label>
            <div className="flex items-center gap-3 pt-1">
              <label
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-all select-none ${
                  form.type === "Customer"
                    ? "border-indigo-500 bg-indigo-500/15 text-indigo-300 shadow-sm"
                    : "border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="partyType"
                  value="Customer"
                  checked={form.type === "Customer"}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, type: e.target.value }));
                    if (errors.type) setErrors((er) => ({ ...er, type: null }));
                  }}
                  className="w-4 h-4 text-indigo-500 accent-indigo-500 cursor-pointer"
                />
                <span>Customer</span>
              </label>

              <label
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-all select-none ${
                  form.type === "Supplier"
                    ? "border-indigo-500 bg-indigo-500/15 text-indigo-300 shadow-sm"
                    : "border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="partyType"
                  value="Supplier"
                  checked={form.type === "Supplier"}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, type: e.target.value }));
                    if (errors.type) setErrors((er) => ({ ...er, type: null }));
                  }}
                  className="w-4 h-4 text-indigo-500 accent-indigo-500 cursor-pointer"
                />
                <span>Supplier</span>
              </label>
            </div>
            {errors.type && <p className="text-rose-400 text-xs mt-1.5 font-medium">⚠ {errors.type}</p>}
          </div>
        </div>

        {/* Row 2: Multiple Mobile Numbers */}
        <div className="field">
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
                  placeholder={idx === 0 ? "Primary mobile (10 digits)" : `Secondary mobile #${idx + 1}`}
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
            <p className="text-rose-400 text-xs mt-1.5 font-medium">⚠ {errors.mobiles}</p>
          )}
        </div>

        {/* Row 3: Address Details */}
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

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <span className="spinner" /> : <UserPlus className="w-4 h-4" />}
            {loading ? "Adding…" : "Add Party"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── PartyManager (exported) ───────────────────────────────────
export default function PartyManager({ parties, loading, error }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [search, setSearch] = useState("");
  const [editingParty, setEditingParty] = useState(null);
  const [deletingParty, setDeletingParty] = useState(null);

  const filtered = parties.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const nameMatch = p.name.toLowerCase().includes(q);
    const mobMatch =
      p.mobiles?.some((m) => m.includes(q)) || (p.mobile && p.mobile.includes(q));
    const cityMatch = p.city?.toLowerCase().includes(q);
    return nameMatch || mobMatch || cityMatch;
  });

  const handleDeleteConfirm = async () => {
    if (!deletingParty) return;
    try {
      await deleteDoc(doc(db, "users", uid, "parties", deletingParty.id));
      toast.success(`"${deletingParty.name}" removed.`);
    } catch (err) {
      toast.error("Failed to delete party.");
      console.error(err);
    } finally {
      setDeletingParty(null);
    }
  };

  // Display only recent 5 registered parties (newest first)
  const recentParties = [...parties]
    .sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    })
    .slice(0, 5);

  return (
    <>
      {editingParty && (
        <PartyEditModal party={editingParty} onClose={() => setEditingParty(null)} />
      )}
      {deletingParty && (
        <DeleteConfirm
          partyName={deletingParty.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingParty(null)}
        />
      )}

      <AddPartyForm uid={uid} />

      {/* Section header: Recent 5 Parties + View All Link */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
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
          title="Open Dedicated Registered Parties Directory"
        >
          <span>View All Registered Parties ({parties.length})</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* States */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading recent parties…
        </div>
      ) : error ? (
        <div className="alert-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      ) : parties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center card p-8">
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
          {recentParties.map((p) => (
            <PartyCard
              key={p.id}
              party={p}
              onEdit={setEditingParty}
              onDelete={setDeletingParty}
            />
          ))}
        </div>
      )}
    </>
  );
}
