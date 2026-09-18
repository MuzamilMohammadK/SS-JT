import { Users, Phone, Loader2, AlertCircle } from "lucide-react";

function TypeBadge({ type }) {
  return type === "Customer" ? (
    <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
      Customer · AR
    </span>
  ) : (
    <span className="badge bg-rose-500/15 text-rose-400 border border-rose-500/20">
      Supplier · AP
    </span>
  );
}

function PartyCard({ party }) {
  const initials = party.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarColor =
    party.type === "Customer"
      ? "from-indigo-600 to-purple-600"
      : "from-rose-600 to-pink-600";

  return (
    <div className="card p-4 flex items-center gap-4 hover:border-slate-700/80 transition-all duration-200 group">
      <div
        className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-100 font-semibold text-sm truncate">{party.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Phone className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <p className="text-slate-500 text-xs font-medium">{party.mobile || "—"}</p>
        </div>
      </div>
      <TypeBadge type={party.type} />
    </div>
  );
}

export default function PartyList({ parties, loading, error }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        <span className="ml-3 text-slate-500 text-sm">Loading parties…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
        <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
        <p className="text-rose-300 text-sm">{error}</p>
      </div>
    );
  }

  if (parties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-slate-600" />
        </div>
        <p className="text-slate-400 font-semibold">No parties registered yet</p>
        <p className="text-slate-600 text-sm mt-1">
          Use the form above to add your first customer or supplier.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
      {parties.map((party) => (
        <PartyCard key={party.id} party={party} />
      ))}
    </div>
  );
}
