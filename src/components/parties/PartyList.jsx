import { useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  Phone,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Search,
  X,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import PartyEditModal from "./PartyEditModal";

// ── Confirm Delete Dialog ─────────────────────────────────────
function ConfirmDialog({ partyName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-scale">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/15">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-slate-100 font-semibold text-sm">Delete Party</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Remove <span className="text-slate-300 font-medium">"{partyName}"</span>?
              Existing transactions will show "Unknown Party".
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-xs px-4 py-2">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all duration-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Party
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Type Badge ────────────────────────────────────────────────
function TypeBadge({ type }) {
  return type === "Customer" ? (
    <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
      Customer · AR
    </span>
  ) : (
    <span className="badge bg-rose-500/15 text-rose-400 border border-rose-500/20">
      Supplier · AP
    </span>
  );
}

// ── Party Card ────────────────────────────────────────────────
function PartyCard({ party, onEdit, onDelete }) {
  // Fix: if single-word name, use first 2 characters instead of just 1
  const words = party.name.trim().split(/\s+/);
  const initials =
    words.length > 1
      ? words
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : party.name.slice(0, 2).toUpperCase();

  const avatarColor =
    party.type === "Customer"
      ? "from-indigo-600 to-purple-600"
      : "from-rose-600 to-pink-600";

  return (
    <div className="card p-4 flex items-center gap-4 hover:border-slate-700/80 transition-all duration-200 group">
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-slate-100 font-semibold text-sm truncate">{party.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Phone className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <p className="text-slate-500 text-xs font-medium">{party.mobile || "—"}</p>
        </div>
      </div>

      {/* Badge + Actions */}
      <div className="flex flex-col items-end gap-2">
        <TypeBadge type={party.type} />
        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onEdit(party)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-150"
            title="Edit party"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(party)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
            title="Delete party"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main PartyList Component ──────────────────────────────────
export default function PartyList({ parties, loading, error }) {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingParty, setEditingParty] = useState(null);  // party being edited
  const [deletingParty, setDeletingParty] = useState(null); // party pending delete confirm

  // Client-side search filter — no extra Firestore reads
  const filtered = parties.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.mobile && p.mobile.includes(q))
    );
  });

  const handleDeleteConfirm = async () => {
    if (!deletingParty) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "parties", deletingParty.id));
      toast.success(`Party "${deletingParty.name}" deleted.`);
    } catch (err) {
      toast.error("Failed to delete party.");
      console.error(err);
    } finally {
      setDeletingParty(null);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        <span className="ml-3 text-slate-500 text-sm">Loading parties…</span>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
        <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
        <p className="text-rose-300 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Edit Modal */}
      {editingParty && (
        <PartyEditModal
          party={editingParty}
          onClose={() => setEditingParty(null)}
        />
      )}

      {/* Delete Confirm */}
      {deletingParty && (
        <ConfirmDialog
          partyName={deletingParty.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingParty(null)}
        />
      )}

      {/* Search Bar */}
      {parties.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or mobile number…"
            className="input-base pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Empty States */}
      {parties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No parties registered yet</p>
          <p className="text-slate-600 text-sm mt-1">
            Use the form above to add your first customer or supplier.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No parties match your search</p>
          <p className="text-slate-600 text-sm mt-1">
            Try a different name or mobile number.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          {filtered.map((party) => (
            <PartyCard
              key={party.id}
              party={party}
              onEdit={setEditingParty}
              onDelete={setDeletingParty}
            />
          ))}
        </div>
      )}
    </>
  );
}
