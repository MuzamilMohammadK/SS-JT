import { useMemo } from "react";
import { fmtINR } from "../../utils/validators";
import { Users, ArrowUpRight, ArrowDownLeft, CheckCircle2 } from "lucide-react";

export default function PartyDuesChart({ transactions, parties }) {
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
    return list;
  }, [transactions]);

  const maxDue = partyDues.length > 0 ? partyDues[0].pendingDue : 1;

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
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Users className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="section-title text-base">Pending Dues by Party</h3>
          <p className="text-slate-500 text-xs">{partyDues.length} parties with outstanding balances</p>
        </div>
      </div>

      <div className="space-y-3">
        {partyDues.map((item, i) => {
          const widthPct = Math.round((item.pendingDue / maxDue) * 100);
          const isSale   = item.type === "Sale" || item.type === "Given" || item.type === "Sale Return";

          return (
            <div key={item.partyId} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0">
                    {i + 1}.
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
                  isGiven ? "text-indigo-300" : "text-rose-300"
                }`}>
                  {fmtINR(item.pendingDue)}
                </span>
              </div>

              {/* Bar */}
              <div className="pl-11 pr-0">
                <div className="progress-track h-1.5">
                  <div
                    className={`progress-fill ${isGiven ? "bg-indigo-500" : "bg-rose-500"}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
