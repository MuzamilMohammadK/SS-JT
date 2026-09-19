import { useAuth } from "../context/AuthContext";
import { useParties } from "../hooks/useParties";
import LedgerEntryForm from "../components/transactions/LedgerEntryForm";
import AppShell from "../components/layout/AppShell";
import { Receipt, AlertCircle, Loader2 } from "lucide-react";

export default function LedgerPage() {
  const { currentUser } = useAuth();
  const { parties, loading: partiesLoading, error: partiesError } = useParties(currentUser?.uid);

  return (
    <AppShell>
      <div className="page-content animate-fade-in-up">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="page-title">Ledger Entry</h1>
              <p className="text-slate-500 text-sm">Record saree transactions with GST</p>
            </div>
          </div>
        </div>

        {partiesLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading parties…
          </div>
        ) : partiesError ? (
          <div className="alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {partiesError}
          </div>
        ) : parties.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-300 font-semibold mb-1">No parties registered</p>
            <p className="text-slate-500 text-sm">
              Go to the <strong className="text-indigo-400">Parties</strong> tab and add at least one customer or supplier before recording a transaction.
            </p>
          </div>
        ) : (
          <LedgerEntryForm parties={parties} />
        )}
      </div>
    </AppShell>
  );
}
