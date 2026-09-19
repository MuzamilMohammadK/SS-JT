import { useAuth } from "../context/AuthContext";
import { useTransactions } from "../hooks/useTransactions";
import TransactionHistoryTable from "../components/transactions/TransactionHistoryTable";
import AppShell from "../components/layout/AppShell";
import { BookOpen } from "lucide-react";

export default function HistoryPage() {
  const { currentUser } = useAuth();
  const { transactions, loading, error } = useTransactions(currentUser?.uid);

  return (
    <AppShell>
      <div className="page-content animate-fade-in-up">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="page-title">Transaction History</h1>
              <p className="text-slate-500 text-sm">View, filter & settle all transactions</p>
            </div>
          </div>
        </div>

        <TransactionHistoryTable
          transactions={transactions}
          loading={loading}
          error={error}
        />
      </div>
    </AppShell>
  );
}
