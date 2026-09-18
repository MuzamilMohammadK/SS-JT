import Navbar from "../components/layout/Navbar";
import SummaryBanner from "../components/dashboard/SummaryBanner";
import PartyManager from "../components/parties/PartyManager";
import TransactionForm from "../components/transactions/TransactionForm";
import LedgerTable from "../components/transactions/LedgerTable";
import { useParties } from "../hooks/useParties";
import { useTransactions } from "../hooks/useTransactions";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Users, BookOpen } from "lucide-react";

// ── Section divider ────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div className="section-divider">
      <span className="text-slate-700 text-xs font-semibold uppercase tracking-widest px-3">
        {label}
      </span>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, sub, iconColor, iconBg }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <h2 className="section-title">{title}</h2>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const { parties,      loading: pLoading, error: pError } = useParties(uid);
  const { transactions, loading: tLoading }                 = useTransactions(uid);

  return (
    <div className="min-h-dvh bg-slate-950">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-800/25 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/40 p-6 md:p-8">
          {/* Decorative orbs */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
                Dashboard Overview
              </span>
            </div>
            <h1 className="page-title">Shivaayaha Silks &amp; Jari Trades</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl leading-relaxed">
              Track accounts receivable, accounts payable, inventory transactions,
              and party balances — all in real time.
            </p>
          </div>
        </div>

        {/* ── Summary Metrics ── */}
        <section aria-label="Financial Summary">
          <SummaryBanner transactions={transactions} />
        </section>

        <Divider label="Party Management" />

        {/* ── Party Section ── */}
        <section aria-label="Party Management">
          <PartyManager parties={parties} loading={pLoading} error={pError} />
        </section>

        <Divider label="Transaction Ledger" />

        {/* ── Transaction Section ── */}
        <section aria-label="Transaction Ledger">
          <TransactionForm parties={parties} />

          <div className="mt-8">
            <SectionHeader
              icon={BookOpen}
              title="Transaction History"
              sub="Complete ledger of all given and taken transactions"
              iconColor="text-teal-400"
              iconBg="bg-teal-500/15"
            />
            <LedgerTable transactions={transactions} parties={parties} loading={tLoading} />
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="pt-4 pb-6 border-t border-slate-800/50">
          <p className="text-center text-slate-700 text-xs">
            Shivaayaha Silks &amp; Jari Trades · Ledger Management System ·
            Client-Side · Powered by Firebase
          </p>
        </footer>
      </main>
    </div>
  );
}
