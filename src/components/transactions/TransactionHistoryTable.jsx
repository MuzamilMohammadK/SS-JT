import { useState } from "react";
import { fmtINR } from "../../utils/validators";
import SettleModal from "./SettleModal";
import {
  Search, X, BookOpen, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Clock, ChevronUp, Eye, CreditCard,
  Loader2, AlertCircle,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────
function TypeBadge({ type }) {
  return type === "Given"
    ? <span className="badge-indigo"><ArrowUpRight className="w-3 h-3" />Given</span>
    : <span className="badge-rose"><ArrowDownLeft className="w-3 h-3" />Taken</span>;
}

function StatusBadge({ status }) {
  return status === "Settled"
    ? <span className="badge-emerald"><CheckCircle2 className="w-3 h-3" />Settled</span>
    : <span className="badge-amber"><Clock className="w-3 h-3" />Pending</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function logDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

// ── Row Detail Drawer ──────────────────────────────────────────
function DetailDrawer({ tx }) {
  const logs = tx.paymentLogs || [];
  return (
    <div className="px-4 pb-4 animate-slide-up">
      <div className="card bg-slate-950/60 p-4 mt-2 space-y-3">

        {/* Saree items */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Saree Items</p>
          <div className="space-y-1.5">
            {(tx.sareeDetails || []).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm gap-2">
                <span className="text-slate-300 truncate min-w-0 flex-1" title={`${item.sareeName} ×${item.quantity}`}>
                  {item.sareeName} <span className="text-slate-500 text-xs">×{item.quantity}</span>
                </span>
                <div className="flex items-center gap-2 text-right flex-shrink-0">
                  <span className="text-slate-500 text-xs">@ {fmtINR(item.pricePerUnit)}</span>
                  <span className="text-slate-200 num font-medium">{fmtINR(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial breakdown */}
        <div className="border-t border-slate-800 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-500 flex-shrink-0">Subtotal</span>
            <span className="text-slate-300 num truncate">{fmtINR(tx.subTotalAmount)}</span>
          </div>
          {tx.gstRate > 0 && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 flex-shrink-0">GST ({tx.gstRate}%)</span>
              <span className="text-slate-300 num truncate">{fmtINR(tx.gstAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center gap-2 font-semibold">
            <span className="text-white flex-shrink-0">Total Amount</span>
            <span className="text-white num truncate">{fmtINR(tx.totalAmount)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-500 flex-shrink-0">Amount Paid</span>
            <span className="text-emerald-400 num truncate">{fmtINR(tx.amountPaid)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-amber-400 font-semibold flex-shrink-0">Pending Due</span>
            <span className={`num font-semibold truncate ${tx.pendingDue > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {fmtINR(tx.pendingDue)}
            </span>
          </div>
          {/* Payment progress bar */}
          {tx.totalAmount > 0 && (
            <div className="pt-1">
              <div className="progress-track h-1.5">
                <div
                  className="progress-fill bg-emerald-500"
                  style={{ width: `${Math.min(100, Math.round((tx.amountPaid / tx.totalAmount) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-600 mt-1 text-right">
                {Math.round((tx.amountPaid / tx.totalAmount) * 100)}% settled
              </p>
            </div>
          )}
        </div>

        {/* Payment history log */}
        {logs.length > 0 && (
          <div className="border-t border-slate-800 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Payment History ({logs.length} payment{logs.length > 1 ? "s" : ""})
            </p>
            <div className="space-y-1.5">
              {logs.map((log, i) => (
                <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-slate-800/40 last:border-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[9px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-slate-500 text-xs truncate">{logDate(log.date)}</span>
                  </div>
                  <span className="text-emerald-400 font-semibold num flex-shrink-0">{fmtINR(log.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tx.notes && (
          <div className="border-t border-slate-800 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-slate-400 text-sm break-words">{tx.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function TransactionHistoryTable({ transactions, loading, error }) {
  const [searchParty, setSearchParty] = useState("");
  const [filterType,  setFilterType]  = useState("All");
  const [filterStatus,setFilterStatus]= useState("All");
  const [expanded,    setExpanded]    = useState(null);
  const [settling,    setSettling]    = useState(null);

  const filtered = transactions.filter((tx) => {
    const q          = searchParty.trim().toLowerCase();
    const matchParty  = !q || tx.partyName?.toLowerCase().includes(q);
    const matchType   = filterType === "All"   || tx.type === filterType;
    const matchStatus = filterStatus === "All" || tx.status === filterStatus;
    return matchParty && matchType && matchStatus;
  });

  const toggleExpand = (id) => setExpanded((v) => (v === id ? null : id));

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ── */}
      <div className="card p-3 sm:p-4 flex flex-col md:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input type="text" value={searchParty} onChange={(e) => setSearchParty(e.target.value)}
            placeholder="Search by party name…"
            className="input-base pl-10 pr-9 py-2 text-sm" />
          {searchParty && (
            <button onClick={() => setSearchParty("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800/60 min-w-0">
            {["All", "Given", "Taken"].map((t) => (
              <button key={t} type="button" onClick={() => setFilterType(t)}
                className={`tab-item py-1.5 px-2 text-xs truncate${filterType === t ? " active" : ""}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800/60 min-w-0">
            {["All", "Pending", "Settled"].map((s) => (
              <button key={s} type="button" onClick={() => setFilterStatus(s)}
                className={`tab-item py-1.5 px-2 text-xs truncate${filterStatus === s ? " active" : ""}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Settlement Modal ── */}
      {settling && (
        <SettleModal transaction={settling} onClose={() => setSettling(null)} />
      )}

      {/* ── States ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading transactions…
        </div>
      ) : error ? (
        <div className="alert-error"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-semibold">No transactions recorded yet</p>
          <p className="text-slate-600 text-sm mt-1">Use the Ledger tab to record your first transaction.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="w-8 h-8 text-slate-600 mb-3" />
          <p className="text-slate-400 font-semibold">No results match your filters</p>
          <p className="text-slate-600 text-sm mt-1">Try clearing the filters above.</p>
        </div>
      ) : (
        <>
          <p className="text-slate-500 text-xs px-1">
            Showing {filtered.length} of {transactions.length} transactions
          </p>

          {/* ── Desktop Table ── */}
          <div className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-slate-900/60 border-b border-slate-800/60">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Party</th>
                    <th className="table-th">Type</th>
                    <th className="table-th text-right">Total</th>
                    <th className="table-th text-right">Paid</th>
                    <th className="table-th text-right">Due</th>
                    <th className="table-th">Status</th>
                    <th className="table-th text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <>
                      <tr key={tx.id} className="table-row">
                        <td className="table-td text-slate-400 text-sm">{formatDate(tx.transactionDate)}</td>
                        <td className="table-td">
                          <p className="text-slate-200 font-medium text-sm">{tx.partyName}</p>
                          {(tx.paymentLogs?.length > 0) && (
                            <p className="text-[10px] text-slate-600">{tx.paymentLogs.length} payment{tx.paymentLogs.length > 1 ? "s" : ""} recorded</p>
                          )}
                        </td>
                        <td className="table-td"><TypeBadge type={tx.type} /></td>
                        <td className="table-td text-right text-slate-200 font-semibold num text-sm">{fmtINR(tx.totalAmount)}</td>
                        <td className="table-td text-right text-emerald-400 num text-sm">{fmtINR(tx.amountPaid)}</td>
                        <td className="table-td text-right num text-sm">
                          <span className={tx.pendingDue > 0 ? "text-amber-400 font-semibold" : "text-slate-500"}>
                            {fmtINR(tx.pendingDue)}
                          </span>
                        </td>
                        <td className="table-td"><StatusBadge status={tx.status} /></td>
                        <td className="table-td text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => toggleExpand(tx.id)} className="btn-icon" title="View details">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {tx.status === "Pending" && (
                              <button onClick={() => setSettling(tx)}
                                className="btn-emerald text-xs py-1.5 px-2.5">
                                <CreditCard className="w-3 h-3" /> Settle
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded === tx.id && (
                        <tr key={`${tx.id}-detail`}>
                          <td colSpan={8} className="p-0">
                            <DetailDrawer tx={tx} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="md:hidden space-y-3">
            {filtered.map((tx) => (
              <div key={tx.id} className="card overflow-hidden">
                <div className="p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-200 font-semibold text-sm truncate" title={tx.partyName}>{tx.partyName}</p>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{formatDate(tx.transactionDate)}</p>
                      {(tx.paymentLogs?.length > 0) && (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {tx.paymentLogs.length} payment{tx.paymentLogs.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <TypeBadge type={tx.type} />
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center mb-3">
                    <div className="bg-slate-800/60 rounded-xl p-1.5 sm:p-2 min-w-0">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider truncate">Total</p>
                      <p className="text-white font-bold text-xs sm:text-sm num truncate" title={fmtINR(tx.totalAmount)}>
                        {fmtINR(tx.totalAmount)}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-1.5 sm:p-2 min-w-0">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider truncate">Paid</p>
                      <p className="text-emerald-400 font-bold text-xs sm:text-sm num truncate" title={fmtINR(tx.amountPaid)}>
                        {fmtINR(tx.amountPaid)}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-1.5 sm:p-2 min-w-0">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider truncate">Due</p>
                      <p className={`font-bold text-xs sm:text-sm num truncate ${tx.pendingDue > 0 ? "text-amber-400" : "text-slate-500"}`} title={fmtINR(tx.pendingDue)}>
                        {fmtINR(tx.pendingDue)}
                      </p>
                    </div>
                  </div>

                  {/* Inline progress bar on mobile */}
                  {tx.totalAmount > 0 && (
                    <div className="mb-3">
                      <div className="progress-track h-1">
                        <div
                          className="progress-fill bg-emerald-500"
                          style={{ width: `${Math.min(100, Math.round((tx.amountPaid / tx.totalAmount) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => toggleExpand(tx.id)}
                      className="btn-secondary flex-1 text-xs py-2 gap-1.5">
                      {expanded === tx.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {expanded === tx.id ? "Hide" : "Details"}
                    </button>
                    {tx.status === "Pending" && (
                      <button onClick={() => setSettling(tx)}
                        className="btn-emerald flex-1 text-xs py-2">
                        <CreditCard className="w-3 h-3" /> Settle
                      </button>
                    )}
                  </div>
                </div>
                {expanded === tx.id && <DetailDrawer tx={tx} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
