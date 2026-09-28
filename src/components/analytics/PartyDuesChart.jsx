import { useState, useMemo } from "react";
import { fmtINR } from "../../utils/validators";
import { Users, ArrowUpRight, ArrowDownLeft, CheckCircle2, Search, X } from "lucide-react";

export default function PartyDuesChart({ transactions = [], parties = [] }) {
  const [search, setSearch] = useState("");

  // Build per-party pending-due totals
  const partyDues = useMemo(() => {
    const map = {};

    transactions.forEach((tx) => {
      if (!tx.partyId || tx.pendingDue <= 0) return;
      if (!map[tx.partyId]) {
        map[tx.partyId] = {
          partyId:    tx.partyId,
          partyName:  tx.partyName || "Unknown",
          type:       tx.type,
          pendingDue: 0,
          txCount:    0,
        };
      }
      map[tx.partyId].pendingDue += tx.pendingDue;
      map[tx.partyId].txCount    += 1;
    });

    const list = Object.values(map);
    list.sort((a, b) => b.pendingDue - a.pendingDue);
    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [transactions]);

  const maxDue = partyDues.length > 0 ? partyDues[0].pendingDue : 1;

  // Filtered by search query
  const filteredDues = useMemo(() => {
    if (!search.trim()) return partyDues;
    const q = search.trim().toLowerCase();
    return partyDues.filter((item) =>
      item.partyName.toLowerCase().includes(q)
    );
  }, [partyDues, search]);

  if (partyDues.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="text-slate-300 font-semibold">All dues cleared!</p>
        <p className="text-slate-600 text-sm mt-1">No party has a pending balance.</p>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header with Title and Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="section-title text-base">Pending Dues by Party</h3>
            <p className="text-slate-500 text-xs">
              {partyDues.length} {partyDues.length === 1 ? "party" : "parties"} with outstanding balances
              {search && ` · ${filteredDues.length} found`}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party name…"
            className="input-base pl-8 pr-7 py-1.5 text-xs w-full"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list showing ~5 parties at a time */}
      {filteredDues.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-slate-400 text-xs">No parties match "{search}"</p>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-xs text-indigo-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="max-h-[305px] overflow-y-auto space-y-3 pr-1.5">
          {filteredDues.map((item) => {
            const widthPct = Math.round((item.pendingDue / maxDue) * 100);
            const isSale   = item.type === "Sale" || item.type === "Given" || item.type === "Sale Return";

            return (
              <div key={item.partyId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0 font-mono">
                      {item.rank}.
                    </span>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSale ? "bg-indigo-500/15" : "bg-rose-500/15"
                    }`}>
                      {isSale
                        ? <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                        : <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-200 text-sm font-medium truncate">{item.partyName}</p>
                      <p className="text-slate-600 text-[10px]">
                        {item.txCount} pending {item.txCount === 1 ? "transaction" : "transactions"}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm num flex-shrink-0 ${
                    isSale ? "text-indigo-300" : "text-rose-300"
                  }`}>
                    {fmtINR(item.pendingDue)}
                  </span>
                </div>

                {/* Bar */}
                <div className="pl-11 pr-0">
                  <div className="progress-track h-1.5">
                    <div
                      className={`progress-fill ${isSale ? "bg-indigo-500" : "bg-rose-500"}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
