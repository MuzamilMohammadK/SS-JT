import { NavLink } from "react-router-dom";
import { Users, Receipt, BookOpen, BarChart3 } from "lucide-react";

const NAV_ITEMS = [
  { to: "/parties",   icon: Users,     label: "Parties"  },
  { to: "/ledger",    icon: Receipt,   label: "Ledger"   },
  { to: "/history",   icon: BookOpen,  label: "History"  },
  { to: "/analytics", icon: BarChart3, label: "Analytics"},
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? " active" : ""}`
          }
          aria-label={label}
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
                    isActive ? "stroke-[2.5]" : "stroke-[1.75]"
                  }`}
                />
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400 ring-2 ring-slate-900" />
                )}
              </div>
              <span
                className={`bottom-nav-label transition-all duration-200 ${
                  isActive ? "opacity-100" : "opacity-60"
                }`}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
