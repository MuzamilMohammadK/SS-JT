import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  IndianRupee,
} from "lucide-react";

function MetricCard({ title, value, subtitle, icon: Icon, colorClass, bgClass, glowClass }) {
  return (
    <div className={`card p-5 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200`}>
      {/* Background glow */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${glowClass}`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${bgClass}`}>
            <Icon className={`w-5 h-5 ${colorClass}`} />
          </div>
          <IndianRupee className="w-4 h-4 text-slate-600" />
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
          {title}
        </p>
        <p className={`text-2xl font-bold ${colorClass} tracking-tight`}>{value}</p>
        {subtitle && (
          <p className="text-slate-500 text-xs mt-1 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default function SummaryCards({ transactions }) {
  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  const totalSales = transactions
    .filter((t) => t.type === "Sale" || t.type === "Given")
    .reduce((s, t) => s + (t.totalAmount || 0), 0);

  const totalPurchases = transactions
    .filter((t) => t.type === "Purchase" || t.type === "Taken")
    .reduce((s, t) => s + (t.totalAmount || 0), 0);

  const totalPending = transactions
    .filter((t) => t.status === "Pending")
    .reduce((s, t) => s + (t.pendingDue || 0), 0);

  const settledCount = transactions.filter((t) => t.status === "Settled").length;

  const cards = [
    {
      title: "Total Sales",
      value: fmt(totalSales),
      subtitle: "Total sales made to customers",
      icon: TrendingUp,
      colorClass: "text-indigo-400",
      bgClass: "bg-indigo-500/15",
      glowClass: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    },
    {
      title: "Total Purchases",
      value: fmt(totalPurchases),
      subtitle: "Total purchases from suppliers",
      icon: TrendingDown,
      colorClass: "text-rose-400",
      bgClass: "bg-rose-500/15",
      glowClass: "bg-gradient-to-br from-rose-500/5 to-transparent",
    },
    {
      title: "Total Pending Due",
      value: fmt(totalPending),
      subtitle: "Outstanding balance across all parties",
      icon: Clock,
      colorClass: "text-amber-400",
      bgClass: "bg-amber-500/15",
      glowClass: "bg-gradient-to-br from-amber-500/5 to-transparent",
    },
    {
      title: "Settled Transactions",
      value: settledCount.toString(),
      subtitle: "Fully cleared transactions",
      icon: CheckCircle2,
      colorClass: "text-emerald-400",
      bgClass: "bg-emerald-500/15",
      glowClass: "bg-gradient-to-br from-emerald-500/5 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.title} {...card} />
      ))}
    </div>
  );
}
