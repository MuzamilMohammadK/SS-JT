import { TrendingUp, TrendingDown, Clock, CheckCircle2, IndianRupee, Activity } from "lucide-react";

function MetricCard({ title, value, subtitle, icon: Icon, colorClass, bgClass, glowColor, delay }) {
  return (
    <div
      className={`metric-card animate-fade-in-up ${delay}`}
      style={{ "--glow": glowColor }}
    >
      {/* Ambient glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glowColor}08, transparent 70%)` }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${bgClass}`}>
            <Icon className={`w-5 h-5 ${colorClass}`} />
          </div>
          <IndianRupee className="w-3.5 h-3.5 text-slate-700" />
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
          {title}
        </p>
        <p className={`metric-value ${colorClass}`}>{value}</p>
        {subtitle && (
          <p className="text-slate-600 text-xs mt-1.5 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function SummaryBanner({ transactions }) {
  const totalGiven   = transactions.filter((t) => t.type === "Given").reduce((s, t) => s + (t.totalAmount || 0), 0);
  const totalTaken   = transactions.filter((t) => t.type === "Taken").reduce((s, t) => s + (t.totalAmount || 0), 0);
  const totalPending = transactions.filter((t) => t.status === "Pending").reduce((s, t) => s + (t.pendingDue || 0), 0);
  const settledCount = transactions.filter((t) => t.status === "Settled").length;

  const cards = [
    {
      title: "Accounts Receivable",
      value: fmt(totalGiven),
      subtitle: "Total credit extended",
      icon: TrendingUp,
      colorClass: "text-indigo-400",
      bgClass: "bg-indigo-500/15",
      glowColor: "#6366f1",
      delay: "stagger-1",
    },
    {
      title: "Accounts Payable",
      value: fmt(totalTaken),
      subtitle: "Total amount owed",
      icon: TrendingDown,
      colorClass: "text-rose-400",
      bgClass: "bg-rose-500/15",
      glowColor: "#f43f5e",
      delay: "stagger-2",
    },
    {
      title: "Total Pending Due",
      value: fmt(totalPending),
      subtitle: "Outstanding balance",
      icon: Clock,
      colorClass: "text-amber-400",
      bgClass: "bg-amber-500/15",
      glowColor: "#f59e0b",
      delay: "stagger-3",
    },
    {
      title: "Settled Transactions",
      value: settledCount.toString(),
      subtitle: "Fully cleared",
      icon: CheckCircle2,
      colorClass: "text-emerald-400",
      bgClass: "bg-emerald-500/15",
      glowColor: "#10b981",
      delay: "stagger-4",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c) => <MetricCard key={c.title} {...c} />)}
    </div>
  );
}
