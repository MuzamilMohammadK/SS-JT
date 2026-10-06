import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useParties } from "../hooks/useParties";
import AppShell from "../components/layout/AppShell";
import PartyEditModal from "../components/parties/PartyEditModal";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import toast from "react-hot-toast";
import {
  Users,
  Search,
  X,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  UserPlus,
  ArrowUpDown,
  Building2,
  Sparkles,
  PhoneCall,
  User,
} from "lucide-react";

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

function getInitials(name) {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? words.map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : name.slice(0, 2).toUpperCase();
}

export default function RegisteredPartiesPage() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const { parties, loading, error } = useParties(uid);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all' | 'Customer' | 'Supplier'
  const [sortBy, setSortBy] = useState("name-asc"); // 'name-asc' | 'name-desc' | 'newest'
  const [editingParty, setEditingParty] = useState(null);
  const [deletingParty, setDeletingParty] = useState(null);

  // Compute counts
  const totalCount = parties.length;
  const customerCount = useMemo(
    () => parties.filter((p) => p.type === "Customer").length,
    [parties]
  );
  const supplierCount = useMemo(
    () => parties.filter((p) => p.type === "Supplier").length,
    [parties]
  );
  const ownerCount = useMemo(
    () => parties.filter((p) => p.type === "Owner").length,
    [parties]
  );

  // Filter & Sort
  const filteredParties = useMemo(() => {
    let result = parties.filter((p) => {
      // Type filter
      if (filterType !== "all" && p.type !== filterType) return false;

      // Search filter
      const q = search.trim().toLowerCase();
      if (!q) return true;

      const nameMatch = p.name?.toLowerCase().includes(q);
      const ownerMatch =
        (p.ownerName && p.ownerName.toLowerCase().includes(q)) ||
        (p.owner && p.owner.toLowerCase().includes(q));
      const gstinMatch = p.gstin && p.gstin.toLowerCase().includes(q);
      const mobMatch =
        p.mobiles?.some((m) => m.includes(q)) || (p.mobile && p.mobile.includes(q));
      const cityMatch = p.city?.toLowerCase().includes(q);
      const stateMatch = p.state?.toLowerCase().includes(q);
      const addressMatch = p.address?.toLowerCase().includes(q);

      return (
        nameMatch ||
        ownerMatch ||
        gstinMatch ||
        mobMatch ||
        cityMatch ||
        stateMatch ||
        addressMatch
      );
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "name-asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "name-desc") {
        return (b.name || "").localeCompare(a.name || "");
      }
      if (sortBy === "newest") {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      }
      return 0;
    });

    return result;
  }, [parties, search, filterType, sortBy]);

  const handleDeleteConfirm = async () => {
    if (!deletingParty) return;
    try {
      await deleteDoc(doc(db, "users", uid, "parties", deletingParty.id));
      toast.success(`"${deletingParty.name}" deleted successfully.`);
    } catch (err) {
      toast.error("Failed to delete party.");
      console.error(err);
    } finally {
      setDeletingParty(null);
    }
  };

  return (
    <AppShell>
      <div className="page-content animate-fade-in-up pb-12">
        {/* Modals */}
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

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="page-title text-xl md:text-2xl">Registered Parties</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {totalCount} Total
                </span>
              </div>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5">
                Complete directory of registered customers, suppliers, multiple contact numbers &amp; addresses
              </p>
            </div>
          </div>

          <Link
            to="/parties"
            className="btn-primary self-start sm:self-auto text-xs md:text-sm shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Party</span>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
          <div className="card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium">All Parties</p>
              <p className="text-slate-100 text-lg font-bold">{totalCount}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium">Customers (Receivable)</p>
              <p className="text-slate-100 text-lg font-bold">{customerCount}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium">Suppliers (Payable)</p>
              <p className="text-slate-100 text-lg font-bold">{supplierCount}</p>
            </div>
          </div>
        </div>

        {/* Filters, Search & Sorting Controls */}
        <div className="card p-4 mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 self-start">
            {[
              { id: "all", label: "All" },
              { id: "Customer", label: `Customers (${customerCount})` },
              { id: "Supplier", label: `Suppliers (${supplierCount})` },
              { id: "Owner", label: `Owners (${ownerCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md sm:ml-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, city, address…"
                className="input-base pl-9 pr-8 py-2 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="relative flex-shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input-base py-2 pl-3 pr-8 text-xs cursor-pointer appearance-none bg-slate-800"
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="newest">Newest First</option>
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400 mb-3" />
            <p className="text-sm">Loading registered parties…</p>
          </div>
        ) : error ? (
          <div className="alert-error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : parties.length === 0 ? (
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-slate-200 font-semibold text-base mb-1">No Parties Registered Yet</h3>
            <p className="text-slate-500 text-xs md:text-sm max-w-md mb-5">
              Add your first customer or supplier with multiple mobile numbers and full address details.
            </p>
            <Link to="/parties" className="btn-primary text-xs md:text-sm">
              <UserPlus className="w-4 h-4" />
              <span>Register First Party</span>
            </Link>
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <Search className="w-10 h-10 text-slate-600 mb-3" />
            <h3 className="text-slate-200 font-semibold text-sm mb-1">No Matching Parties Found</h3>
            <p className="text-slate-500 text-xs mb-4">
              No results found for "{search}". Try searching another name, phone number, or city.
            </p>
            <button onClick={() => setSearch("")} className="btn-secondary text-xs">
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {filteredParties.map((party) => {
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

              const addressParts = [
                party.address,
                party.city,
                party.state,
                party.pincode ? `PIN: ${party.pincode}` : "",
              ].filter(Boolean);

              return (
                <div
                  key={party.id}
                  className="card-hover p-5 flex flex-col justify-between group transition-all duration-200 border-slate-800 hover:border-slate-700"
                >
                  <div>
                    {/* Top Row: Avatar + Name + Type Badge */}
                    <div className="flex items-start gap-3.5 mb-3.5">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                      >
                        {getInitials(party.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <h3
                            className="text-slate-100 font-semibold text-sm md:text-[15px] truncate"
                            title={party.name}
                          >
                            {party.name}
                          </h3>
                        </div>

                        <div>
                          {party.type === "Customer" ? (
                            <span className="badge-indigo text-[10px]">Customer · Accounts Receivable</span>
                          ) : party.type === "Owner" ? (
                            <span className="badge-emerald text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                              Owner
                            </span>
                          ) : (
                            <span className="badge-rose text-[10px]">Supplier · Accounts Payable</span>
                          )}
                        </div>

                        {/* Owner Name */}
                        {party.type !== "Owner" && (party.ownerName || party.owner) && (
                          <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-1.5 truncate">
                            <User className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span>
                              Owner: <strong className="text-slate-300 font-medium">{party.ownerName || party.owner}</strong>
                            </span>
                          </p>
                        )}

                        {/* GSTIN */}
                        {party.gstin && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800/90 text-indigo-300 border border-indigo-500/30">
                              GSTIN: {party.gstin}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile Numbers Section */}
                    <div className="mb-3 pt-2.5 border-t border-slate-800/70">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>Mobile Numbers ({allMobiles.length})</span>
                      </p>
                      {allMobiles.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {allMobiles.map((mob, idx) => (
                            <a
                              key={idx}
                              href={`tel:${mob}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-200 border border-slate-700/60 hover:border-indigo-500/40 transition-colors"
                              title="Click to call"
                            >
                              <PhoneCall className="w-3 h-3 text-indigo-400" />
                              <span>{mob}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-600 text-xs italic">No phone numbers saved</p>
                      )}
                    </div>

                    {/* Address Section */}
                    <div className="pt-2.5 border-t border-slate-800/70">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>Address</span>
                      </p>
                      {addressParts.length > 0 ? (
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {addressParts.join(", ")}
                        </p>
                      ) : (
                        <p className="text-slate-600 text-xs italic">No address provided</p>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-600">
                      {party.city ? `📍 ${party.city}` : "Registered"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingParty(party)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                        title="Edit party"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingParty(party)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete party"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
