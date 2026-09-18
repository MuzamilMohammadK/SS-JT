import Navbar from "../components/layout/Navbar";
import SummaryCards from "../components/dashboard/SummaryCards";
import PartyForm from "../components/parties/PartyForm";
import PartyList from "../components/parties/PartyList";
import TransactionForm from "../components/transactions/TransactionForm";
import TransactionTable from "../components/transactions/TransactionTable";
import { useParties } from "../hooks/useParties";
import { useTransactions } from "../hooks/useTransactions";
import { Users, BookOpen, LayoutDashboard } from "lucide-react";

function SectionHeader({ icon: Icon, title, description, iconColor, iconBg }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <h2 className="section-title">{title}</h2>
        {description && (
          <p className="text-slate-500 text-xs mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-4 my-8">
      <div className="flex-1 h-px bg-slate-800/80" />
      <span className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-2">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-800/80" />
    </div>
  );
}

export default function Dashboard() {
  const { parties, loading: pLoading, error: pError } = useParties();
  const { transactions, loading: tLoading } = useTransactions();

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-purple-900/30 border border-indigo-800/30 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard className="w-5 h-5 text-indigo-400" />
              <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
                Dashboard Overview
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Shivaayaha Silks &amp; Jari Trades
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-lg">
              Track accounts receivable, accounts payable, inventory transactions, and party
              balances — all in real time.
            </p>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <section aria-label="Financial Summary">
          <SummaryCards transactions={transactions} />
        </section>

        <Divider label="Party Management" />

        {/* ── Party Section ── */}
        <section aria-label="Party Management">
          <PartyForm />
          <div className="mt-6">
            <SectionHeader
              icon={Users}
              title="Registered Parties"
              description={`${parties.length} parties on record`}
              iconColor="text-purple-400"
              iconBg="bg-purple-500/15"
            />
            <PartyList parties={parties} loading={pLoading} error={pError} />
          </div>
        </section>

        <Divider label="Transaction Ledger" />

        {/* ── Transaction Section ── */}
        <section aria-label="Transaction Ledger">
          <TransactionForm parties={parties} />

          <div className="mt-8">
            <SectionHeader
              icon={BookOpen}
              title="Transaction History"
              description="Complete ledger of all given and taken transactions"
              iconColor="text-teal-400"
              iconBg="bg-teal-500/15"
            />
            <TransactionTable
              transactions={transactions}
              parties={parties}
              loading={tLoading}
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-4 pb-6 border-t border-slate-800/60">
          <p className="text-center text-slate-700 text-xs">
            Shivaayaha Silks &amp; Jari Trades · Ledger Management System · Client-Side · Powered
            by Firebase
          </p>
        </footer>
      </main>
    </div>
  );
}
