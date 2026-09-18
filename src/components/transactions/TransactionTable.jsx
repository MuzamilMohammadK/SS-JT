import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import {
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";

function StatusBadge({ status }) {
  return status === "Settled" ? (
    <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-3 h-3 mr-1" /> Settled
    </span>
  ) : (
    <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/20">
      <Clock className="w-3 h-3 mr-1" /> Pending
    </span>
  );
}

function TypeBadge({ type }) {
  return type === "Given" ? (
    <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
      Given · Credit
    </span>
  ) : (
    <span className="badge bg-rose-500/15 text-rose-400 border border-rose-500/20">
      Taken · Due
    </span>
  );
}

function TransactionRow({ tx, partyName, onSettle }) {
  const [expanded, setExpanded] = useState(false);
  const [settling, setSettling] = useState(false);

  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n || 0);

  const handleSettle = async () => {
    setSettling(true);
    try {
      await updateDoc(doc(db, "transactions", tx.id), {
        status: "Settled",
        pendingDue: 0,
        amountPaid: tx.totalAmount,
      });
      toast.success("Transaction marked as Settled.");
    } catch (err) {
      toast.error("Failed to update transaction.");
      console.error(err);
    } finally {
      setSettling(false);
    }
  };

  const dateStr = tx.transactionDate
    ? new Date(tx.transactionDate + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <>
      <tr className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
        {/* Date */}
        <td className="px-4 py-3 text-slate-400 text-xs font-medium whitespace-nowrap">
          {dateStr}
        </td>
        {/* Party */}
        <td className="px-4 py-3">
          <p className="text-slate-200 text-sm font-semibold">{partyName}</p>
        </td>
        {/* Type */}
        <td className="px-4 py-3">
          <TypeBadge type={tx.type} />
        </td>
        {/* Total */}
        <td className="px-4 py-3 text-slate-200 text-sm font-semibold whitespace-nowrap">
          {fmt(tx.totalAmount)}
        </td>
        {/* Paid */}
        <td className="px-4 py-3 text-emerald-400 text-sm font-medium whitespace-nowrap">
          {fmt(tx.amountPaid)}
        </td>
        {/* Pending */}
        <td className="px-4 py-3 text-amber-400 text-sm font-semibold whitespace-nowrap">
          {fmt(tx.pendingDue)}
        </td>
        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={tx.status} />
        </td>
        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {tx.status === "Pending" && (
              <button
                onClick={handleSettle}
                disabled={settling}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all duration-200 disabled:opacity-50"
              >
                {settling ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                Settle
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="View saree details"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Saree Details */}
      {expanded && tx.sareeDetails?.length > 0 && (
        <tr className="border-b border-slate-800/40 bg-slate-900/50">
          <td colSpan={8} className="px-6 py-3">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
              Saree / Inventory Ledger
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tx.sareeDetails.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/40"
                >
                  <div>
                    <p className="text-slate-200 text-xs font-semibold">{s.sareeName}</p>
                    <p className="text-slate-500 text-xs">
                      {s.quantity} pcs × {fmt(s.pricePerUnit)}
                    </p>
                  </div>
                  <p className="text-indigo-300 text-xs font-bold">{fmt(s.lineTotal)}</p>
                </div>
              ))}
            </div>
            {tx.notes && (
              <p className="mt-2 text-slate-500 text-xs italic">Notes: {tx.notes}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function TransactionTable({ transactions, parties, loading }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [partyFilter, setPartyFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const partyMap = Object.fromEntries(parties.map((p) => [p.id, p.name]));

  const filtered = transactions.filter((tx) => {
    if (statusFilter !== "All" && tx.status !== statusFilter) return false;
    if (partyFilter !== "All" && tx.partyId !== partyFilter) return false;
    if (typeFilter !== "All" && tx.type !== typeFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        <span className="ml-3 text-slate-500 text-sm">Loading transactions…</span>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Filters */}
      <div className="px-6 py-4 border-b border-slate-800/60">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base w-auto text-xs py-1.5 px-3 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Settled">Settled</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-base w-auto text-xs py-1.5 px-3 cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="Given">Given (Credit)</option>
            <option value="Taken">Taken (Due)</option>
          </select>

          {/* Party Filter */}
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="input-base w-auto text-xs py-1.5 px-3 cursor-pointer"
          >
            <option value="All">All Parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <span className="ml-auto text-slate-500 text-xs font-medium">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No transactions found</p>
          <p className="text-slate-600 text-sm mt-1">
            {transactions.length === 0
              ? "Record your first transaction using the form above."
              : "Try adjusting your filter criteria."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {[
                  "Date",
                  "Party",
                  "Type",
                  "Total Amount",
                  "Amount Paid",
                  "Pending Due",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  partyName={partyMap[tx.partyId] || "Unknown Party"}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
