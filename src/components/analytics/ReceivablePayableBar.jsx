import { useMemo } from "react";
import { fmtINR } from "../../utils/validators";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Scale } from "lucide-react";

export default function ReceivablePayableBar({ transactions }) {
  const stats = useMemo(() => {
    let totalAR = 0, paidAR = 0, totalAP = 0, paidAP = 0;

    transactions.forEach((tx) => {
      if (tx.type === "Sale" || tx.type === "Given" || tx.type === "Sale Return") {
        totalAR += tx.totalAmount  || 0;
        paidAR  += tx.amountPaid  || 0;
      } else {
        totalAP += tx.totalAmount  || 0;
        paidAP  += tx.amountPaid  || 0;
      }
    });

    const pendingAR  = totalAR - paidAR;
    const pendingAP  = totalAP - paidAP;
    const netBalance = pendingAR - pendingAP; // positive = receivable > payable

    const grand = totalAR + totalAP;
    const arPct = grand > 0 ? Math.round((totalAR / grand) * 100) : 50;

    return { totalAR, paidAR, pendingAR, totalAP, paidAP, pendingAP, netBalance, arPct, apPct: 100 - arPct };
  }, [transactions]);

  const MetricCard = ({ label, total, paid, pending, color, icon: Icon, pct }) => (
    <div className="metric-card flex flex-col gap-3">
      {/* Glow bg */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${
        color === "indigo" ? "bg-indigo-500" : "bg-rose-500"
      }`} />

      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          color === "indigo" ? "bg-indigo-500/15" : "bg-rose-500/15"
        }`}>
          <Icon className={`w-5 h-5 ${color === "indigo" ? "text-indigo-400" : "text-rose-400"}`} />
        </div>
        <span className={`badge ${color === "indigo" ? "badge-indigo" : "badge-rose"}`}>
          {pct}% of total
        </span>
      </div>

      <div>
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`metric-value ${color === "indigo" ? "text-indigo-300" : "text-rose-300"}`}>
          {fmtINR(total)}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center gap-2 text-xs">
          <span className="text-slate-500 flex-shrink-0">Received / Paid</span>
          <span className="text-emerald-400 num truncate">{fmtINR(paid)}</span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill ${color === "indigo" ? "bg-emerald-500" : "bg-emerald-500"}`}
            style={{ width: total > 0 ? `${Math.round((paid / total) * 100)}%` : "0%" }}
          />
        </div>
        <div className="flex justify-between items-center gap-2 text-xs">
          <span className="text-slate-500 flex-shrink-0">Pending Due</span>
          <span className={`num font-semibold truncate ${pending > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {fmtINR(pending)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* AR/AP Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          label="Total Sales (Receivable)"
          total={stats.totalAR}
          paid={stats.paidAR}
          pending={stats.pendingAR}
          color="indigo"
          icon={ArrowUpRight}
          pct={stats.arPct}
        />
        <MetricCard
          label="Total Purchases (Payable)"
          total={stats.totalAP}
          paid={stats.paidAP}
          pending={stats.pendingAP}
          color="rose"
          icon={ArrowDownLeft}
          pct={stats.apPct}
        />
      </div>

      {/* Net Balance Card */}
      <div className="metric-card">
        <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full blur-2xl opacity-15 bg-indigo-500" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-700/60 flex items-center justify-center">
              <Scale className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Balance</p>
              <p className="text-[11px] text-slate-600">Receivable − Payable</p>
            </div>
          </div>
          {stats.netBalance >= 0
            ? <TrendingUp className="w-5 h-5 text-emerald-400" />
            : <TrendingDown className="w-5 h-5 text-rose-400" />
          }
        </div>

        <p className={`text-2xl sm:text-3xl font-bold num truncate ${
          stats.netBalance >= 0 ? "text-emerald-400" : "text-rose-400"
        }`} title={`${stats.netBalance >= 0 ? "+" : ""}${fmtINR(stats.netBalance)}`}>
          {stats.netBalance >= 0 ? "+" : ""}{fmtINR(stats.netBalance)}
        </p>
        <p className="text-slate-600 text-xs mt-1">
          {stats.netBalance >= 0
            ? "More is owed to you than you owe — favourable position."
            : "More is owed by you than owed to you — review payables."}
        </p>

        {/* AR vs AP ratio bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Sales {stats.arPct}%</span>
            <span>Purchases {stats.apPct}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-slate-800 flex">
            <div
              className="bg-indigo-500 h-full rounded-l-full transition-all duration-700"
              style={{ width: `${stats.arPct}%` }}
            />
            <div
              className="bg-rose-500 h-full rounded-r-full transition-all duration-700"
              style={{ width: `${stats.apPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
