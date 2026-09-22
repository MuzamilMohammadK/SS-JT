import { useAuth } from "../context/AuthContext";
import { useTransactions } from "../hooks/useTransactions";
import { useParties } from "../hooks/useParties";
import ReceivablePayableBar from "../components/analytics/ReceivablePayableBar";
import PartyDuesChart from "../components/analytics/PartyDuesChart";
import AppShell from "../components/layout/AppShell";
import { fmtINR } from "../utils/validators";
import { BarChart3, TrendingUp, Receipt, Loader2, AlertCircle } from "lucide-react";
import { useMemo } from "react";

// Quick stat pill
function StatPill({ label, value, color = "indigo" }) {
  const colors = {
    indigo: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber:  "bg-amber-500/10 text-amber-300 border-amber-500/20",
    rose:   "bg-rose-500/10 text-rose-300 border-rose-500/20",
  };
  return (
    <div className={`card p-4 border ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">{label}</p>
      <p className="text-xl font-bold num">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { currentUser } = useAuth();
  const { transactions = [], loading: txLoading, error: txError } = useTransactions(currentUser?.uid);
  const { parties = [],      loading: pLoading,  error: pError }   = useParties(currentUser?.uid);

  const loading = txLoading || pLoading;
  const error   = txError || pError;

  const stats = useMemo(() => {
    const list        = transactions || [];
    const total       = list.length;
    const pending     = list.filter((t) => t.status === "Pending").length;
    const settled     = list.filter((t) => t.status === "Settled").length;
    const totalVolume = list.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);
    return { total, pending, settled, totalVolume };
  }, [transactions]);

  return (
    <AppShell>
      <div className="page-content animate-fade-in-up">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="page-title">Financial Analytics</h1>
              <p className="text-slate-500 text-sm">Accounts receivable, payable & dues summary</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading analytics…
          </div>
        ) : error ? (
          <div className="alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatPill label="Total Transactions" value={stats.total} color="indigo" />
              <StatPill label="Pending"            value={stats.pending} color="amber" />
              <StatPill label="Settled"            value={stats.settled} color="emerald" />
              <StatPill label="Total Volume"       value={fmtINR(stats.totalVolume)} color="rose" />
            </div>

            {/* AR vs AP */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                <h2 className="section-title text-sm">Receivables & Payables</h2>
              </div>
              <ReceivablePayableBar transactions={transactions} />
            </div>

            {/* Party-wise dues */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-slate-500" />
                <h2 className="section-title text-sm">Pending Dues by Party</h2>
              </div>
              <PartyDuesChart transactions={transactions} parties={parties} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
