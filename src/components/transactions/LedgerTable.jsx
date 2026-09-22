import { useState } from "react";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  CheckCircle2, Clock, Loader2, FileText, ChevronDown, ChevronUp,
  IndianRupee, Filter, Trash2, AlertTriangle, Search, X,
  ArrowUpRight, ArrowDownLeft, RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Formatters ────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (str) =>
  str
    ? new Date(str + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

// ── Badges ────────────────────────────────────────────────────
const StatusBadge = ({ status }) =>
  status === "Settled"
    ? <span className="badge-emerald"><CheckCircle2 className="w-3 h-3" />Settled</span>
    : <span className="badge-amber"><Clock className="w-3 h-3" />Pending</span>;

const TypeBadge = ({ type }) => {
  if (type === "Sale" || type === "Given")
    return <span className="badge-indigo"><ArrowUpRight className="w-3 h-3" />Sale</span>;
  if (type === "Purchase" || type === "Taken")
    return <span className="badge-rose"><ArrowDownLeft className="w-3 h-3" />Purchase</span>;
  if (type === "Sale Return")
    return <span className="badge-amber"><RotateCcw className="w-3 h-3" />Sale Return</span>;
  if (type === "Purchase Return")
    return <span className="badge-teal"><RotateCcw className="w-3 h-3" />Purchase Return</span>;
  return <span className="badge-slate">{type}</span>;
};

// ── Confirm Delete Dialog ─────────────────────────────────────
function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 card p-6 w-full max-w-sm animate-fade-in-scale">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex-shrink-0 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-slate-100 font-semibold">Delete Transaction</p>
            <p className="text-slate-500 text-sm mt-1">This record will be permanently removed. This action cannot be undone.</p>
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

// ── Transaction Row ───────────────────────────────────────────
function TxRow({ tx, partyName, uid }) {
  const [expanded, setExpanded]           = useState(false);
  const [settling, setSettling]           = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);

  const handleSettle = async () => {
    setSettling(true);
    try {
      await updateDoc(doc(db, "users", uid, "transactions", tx.id), {
        status:     "Settled",
        pendingDue: 0,
        amountPaid: tx.totalAmount,
        settledAt:  serverTimestamp(),
      });
      toast.success("Transaction marked as Settled.");
    } catch (err) {
      toast.error("Failed to update transaction.");
      console.error(err);
    } finally { setSettling(false); }
  };

  const handleDelete = async () => {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", uid, "transactions", tx.id));
      toast.success("Transaction deleted.");
    } catch (err) {
      toast.error("Failed to delete transaction.");
      console.error(err);
    } finally { setDeleting(false); }
  };

  return (
    <>
      {showConfirm && <ConfirmDialog onConfirm={handleDelete} onCancel={() => setShowConfirm(false)} />}

      <tr className="table-row">
        <td className="table-td text-slate-400 text-xs font-medium whitespace-nowrap num">{fmtDate(tx.transactionDate)}</td>
        <td className="table-td">
          <p className="text-slate-200 text-sm font-semibold max-w-[140px] truncate">{partyName}</p>
        </td>
        <td className="table-td"><TypeBadge type={tx.type} /></td>
        <td className="table-td text-slate-200 text-sm font-semibold whitespace-nowrap num">{fmt(tx.totalAmount)}</td>
        <td className="table-td text-emerald-400 text-sm font-medium whitespace-nowrap num">{fmt(tx.amountPaid)}</td>
        <td className="table-td">
          <span className={`text-sm font-semibold whitespace-nowrap num ${tx.pendingDue > 0 ? "text-amber-400" : "text-slate-500"}`}>
            {fmt(tx.pendingDue)}
          </span>
        </td>
        <td className="table-td"><StatusBadge status={tx.status} /></td>
        <td className="table-td">
          <div className="flex items-center gap-1.5">
            {tx.status === "Pending" && (
              <button onClick={handleSettle} disabled={settling}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all disabled:opacity-50">
                {settling ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Settle
              </button>
            )}
            <button onClick={() => setShowConfirm(true)} disabled={deleting}
              className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50"
              title="Delete transaction">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 transition-all" title="View items">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded saree details */}
      {expanded && tx.sareeDetails?.length > 0 && (
        <tr className="border-b border-slate-800/40 bg-slate-900/40">
          <td colSpan={8} className="px-6 py-4">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest mb-3">Inventory Items</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tx.sareeDetails.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-3.5 py-2.5 border border-slate-700/30">
                  <div>
                    <p className="text-slate-200 text-xs font-semibold">{s.sareeName}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{s.quantity} pcs × {fmt(s.pricePerUnit)}</p>
                  </div>
                  <p className="text-indigo-300 text-xs font-bold num">{fmt(s.lineTotal)}</p>
                </div>
              ))}
            </div>
            {tx.notes && (
              <p className="mt-3 text-slate-500 text-xs italic border-t border-slate-800/60 pt-2">
                📝 {tx.notes}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── LedgerTable (exported) ────────────────────────────────────
export default function LedgerTable({ transactions, parties, loading }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [statusFilter, setStatusFilter] = useState("All");
  const [partyFilter,  setPartyFilter]  = useState("All");
  const [typeFilter,   setTypeFilter]   = useState("All");
  const [search,       setSearch]       = useState("");

  const partyMap = Object.fromEntries(parties.map((p) => [p.id, p.name]));

  const filtered = transactions.filter((tx) => {
    if (statusFilter !== "All" && tx.status !== statusFilter) return false;
    if (partyFilter  !== "All" && tx.partyId !== partyFilter) return false;
    if (typeFilter !== "All") {
      if (typeFilter === "Sale") {
        if (tx.type !== "Sale" && tx.type !== "Given") return false;
      } else if (typeFilter === "Purchase") {
        if (tx.type !== "Purchase" && tx.type !== "Taken") return false;
      } else if (tx.type !== typeFilter) {
        return false;
      }
    }
    if (search) {
      const q = search.toLowerCase();
      const pName = (partyMap[tx.partyId] || "").toLowerCase();
      if (!pName.includes(q) && !tx.notes?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading transactions…
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Filter Bar */}
      <div className="px-5 py-4 border-b border-slate-800/60 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by party name or notes…"
            className="input-base pl-10 pr-9 py-2 text-xs" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />

          {[
            { value: statusFilter, onChange: setStatusFilter, options: [["All", "All Statuses"], ["Pending", "Pending"], ["Settled", "Settled"]] },
            { value: typeFilter,   onChange: setTypeFilter,   options: [["All", "All Types"], ["Sale", "Sale"], ["Purchase", "Purchase"], ["Sale Return", "Sale Return"], ["Purchase Return", "Purchase Return"]] },
          ].map(({ value, onChange, options }, i) => (
            <select key={i} value={value} onChange={(e) => onChange(e.target.value)}
              className="input-base w-auto text-xs py-1.5 px-3 cursor-pointer">
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}

          <select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)}
            className="input-base w-auto text-xs py-1.5 px-3 cursor-pointer">
            <option value="All">All Parties</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <span className="ml-auto text-slate-600 text-xs font-medium">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-slate-700" />
          </div>
          <p className="text-slate-400 font-semibold">No transactions found</p>
          <p className="text-slate-600 text-sm mt-1">
            {transactions.length === 0
              ? "Record your first transaction using the form above."
              : "Try adjusting your filters or search query."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {["Date", "Party", "Type", "Total", "Paid", "Pending Due", "Status", "Actions"].map((h) => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <TxRow key={tx.id} tx={tx} partyName={partyMap[tx.partyId] || "Unknown Party"} uid={uid} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
