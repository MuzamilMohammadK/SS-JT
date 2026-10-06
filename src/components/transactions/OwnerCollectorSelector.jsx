import { UserCheck } from "lucide-react";

// ── Extract registered owners helper ───────────────────────────
export function getRegisteredOwners(parties = []) {
  const set = new Set();
  (parties || []).forEach((p) => {
    if (p.type === "Owner" && p.name?.trim()) {
      set.add(p.name.trim());
    }
    if (p.ownerName?.trim()) {
      set.add(p.ownerName.trim());
    }
    if (p.owner?.trim()) {
      set.add(p.owner.trim());
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ── Owner / Collector Selector Component ───────────────────────
export default function OwnerCollectorSelector({
  value = "",
  onChange,
  registeredOwners = [],
  id = "collector",
  label = "Amount Collected By (Owner)",
  placeholder,
}) {
  return (
    <div className="field">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="label text-xs mb-0 flex items-center gap-1.5 font-semibold text-slate-200">
          <UserCheck className="w-3.5 h-3.5 text-amber-400" /> {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline"
          >
            Clear
          </button>
        )}
      </div>

      {registeredOwners.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {registeredOwners.map((owner) => (
            <button
              key={owner}
              type="button"
              onClick={() => onChange(owner)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                value === owner
                  ? "bg-amber-500/25 border-amber-500 text-amber-300 ring-1 ring-amber-500/40 font-bold shadow-sm"
                  : "bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600"
              }`}
            >
              👤 {owner}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          type="text"
          list={`owners-list-${id}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ||
            (registeredOwners.length > 0
              ? "Pick owner above or type name…"
              : "e.g. Ramesh Bhai (Owner who collected payment)")
          }
          className="input-base text-xs"
        />
        {registeredOwners.length > 0 && (
          <datalist id={`owners-list-${id}`}>
            {registeredOwners.map((owner) => (
              <option key={owner} value={owner} />
            ))}
          </datalist>
        )}
      </div>
    </div>
  );
}
