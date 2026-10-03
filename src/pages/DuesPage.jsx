import { useAuth } from "../context/AuthContext";
import { useTransactions } from "../hooks/useTransactions";
import { useParties } from "../hooks/useParties";
import PartyDuesChart from "../components/analytics/PartyDuesChart";
import AppShell from "../components/layout/AppShell";
import { Landmark, Loader2, AlertCircle } from "lucide-react";

export default function DuesPage() {
  const { currentUser } = useAuth();
  const { transactions = [], loading: txLoading, error: txError } = useTransactions(currentUser?.uid);
  const { parties = [],      loading: pLoading,  error: pError }  = useParties(currentUser?.uid);

  const loading = txLoading || pLoading;
  const error   = txError   || pError;

  return (
    <AppShell>
      <div className="page-content animate-fade-in-up">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="page-title">Pending Dues</h1>
              <p className="text-slate-500 text-sm">Outstanding balances grouped by party</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading dues…
          </div>
        ) : error ? (
          <div className="alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        ) : (
          <PartyDuesChart transactions={transactions} parties={parties} />
        )}
      </div>
    </AppShell>
  );
}
