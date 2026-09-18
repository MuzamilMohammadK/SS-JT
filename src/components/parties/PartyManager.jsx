import { useState } from "react";
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { validateName, validateMobile } from "../../utils/validators";
import PartyEditModal from "./PartyEditModal";
import {
  UserPlus, Phone, Tag, Users, Search, X,
  Pencil, Trash2, Loader2, AlertCircle, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Helpers ────────────────────────────────────────────────────
const INITIAL = { name: "", mobile: "", type: "Customer" };

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
          <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">Cancel</button>
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
  return type === "Customer"
    ? <span className="badge-indigo">Customer · AR</span>
    : <span className="badge-rose">Supplier · AP</span>;
}

// ── Party Card ────────────────────────────────────────────────
function PartyCard({ party, onEdit, onDelete }) {
  const avatarGradient = party.type === "Customer"
    ? "from-indigo-600 to-purple-600"
    : "from-rose-600 to-pink-600";

  return (
    <div className="card-hover p-4 flex items-center gap-3.5 group">
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
        {getInitials(party.name)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-slate-100 font-semibold text-sm truncate">{party.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Phone className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <p className="text-slate-500 text-xs">{party.mobile || "—"}</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <TypeBadge type={party.type} />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => onEdit(party)} className="btn-icon" title="Edit party">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(party)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Delete party">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Party Form ────────────────────────────────────────────
function AddPartyForm({ uid }) {
  const [form,    setForm]    = useState(INITIAL);
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

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
      await addDoc(collection(db, "users", uid, "parties"), {
        name:      form.name.trim(),
        mobile:    form.mobile.replace(/\D/g, ""),
        type:      form.type,
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

  const setField = (k) => (e) => {
    const val = k === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Name */}
          <div className="field md:col-span-1">
            <label htmlFor="p-name" className="label">Party Name</label>
            <input id="p-name" type="text" value={form.name} onChange={setField("name")}
              placeholder="e.g. Ramesh Textiles"
              className={`input-base ${errors.name ? "input-error" : ""}`} />
            {errors.name && <p className="text-rose-400 text-xs">{errors.name}</p>}
          </div>

          {/* Mobile */}
          <div className="field">
            <label htmlFor="p-mobile" className="label flex items-center gap-1">
              <Phone className="w-3 h-3" /> Mobile Number
            </label>
            <input id="p-mobile" type="tel" inputMode="numeric" value={form.mobile}
              onChange={setField("mobile")} placeholder="10-digit number" maxLength={10}
              className={`input-base ${errors.mobile ? "input-error" : ""}`} />
            {errors.mobile && <p className="text-rose-400 text-xs">{errors.mobile}</p>}
          </div>

          {/* Type */}
          <div className="field">
            <label htmlFor="p-type" className="label flex items-center gap-1">
              <Tag className="w-3 h-3" /> Party Type
            </label>
            <select id="p-type" value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="input-base cursor-pointer">
              <option value="Customer">Customer (Accounts Receivable)</option>
              <option value="Supplier">Supplier (Accounts Payable)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
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

  const [search,       setSearch]       = useState("");
  const [editingParty, setEditingParty] = useState(null);
  const [deletingParty,setDeletingParty]= useState(null);

  const filtered = parties.filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.mobile && p.mobile.includes(q));
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

  return (
    <>
      {editingParty  && <PartyEditModal party={editingParty}  onClose={() => setEditingParty(null)} />}
      {deletingParty && (
        <DeleteConfirm
          partyName={deletingParty.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingParty(null)}
        />
      )}

      <AddPartyForm uid={uid} />

      {/* Section header + search */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="section-title text-base">Registered Parties</h2>
            <p className="text-slate-600 text-xs">{parties.length} {parties.length === 1 ? "party" : "parties"} on record</p>
          </div>
        </div>

        {parties.length > 0 && (
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile…"
              className="input-base pl-10 pr-9 py-2 text-xs"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* States */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading parties…
        </div>
      ) : error ? (
        <div className="alert-error"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>
      ) : parties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No parties registered yet</p>
          <p className="text-slate-600 text-sm mt-1">Use the form above to add your first customer or supplier.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Search className="w-8 h-8 text-slate-600 mb-3" />
          <p className="text-slate-400 font-semibold">No matches found</p>
          <p className="text-slate-600 text-sm mt-1">Try a different name or mobile number.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          {filtered.map((p) => (
            <PartyCard key={p.id} party={p} onEdit={setEditingParty} onDelete={setDeletingParty} />
          ))}
        </div>
      )}
    </>
  );
}
