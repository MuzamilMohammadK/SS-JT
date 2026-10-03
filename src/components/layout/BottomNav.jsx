import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Users, Receipt, BookOpen, BarChart3, Building2, Landmark,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/parties",            icon: Users,     label: "Parties"   },
  { to: "/registered-parties", icon: Building2, label: "Directory" },
  { to: "/ledger",             icon: Receipt,   label: "Ledger"    },
  { to: "/history",            icon: BookOpen,  label: "History"   },
  { to: "/dues",               icon: Landmark,  label: "Dues",     isDues: true },
  { to: "/analytics",          icon: BarChart3, label: "Analytics" },
];

export default function BottomNav() {
  const location = useLocation();
  const navContainerRef = useRef(null);
  const activeItemRef = useRef(null);

  // Auto-scroll to center the active navigation item when route changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [location.pathname]);

  const slideLeft = () => {
    if (navContainerRef.current) {
      navContainerRef.current.scrollBy({ left: -130, behavior: "smooth" });
    }
  };

  const slideRight = () => {
    if (navContainerRef.current) {
      navContainerRef.current.scrollBy({ left: 130, behavior: "smooth" });
    }
  };

  return (
    <nav className="bottom-nav relative group" aria-label="Mobile navigation">
      {/* Slide Left Button */}
      <button
        type="button"
        onClick={slideLeft}
        aria-label="Slide navigation left"
        className="flex-shrink-0 flex items-center justify-center w-7 h-10 ml-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 active:scale-95 transition-all shadow-sm border border-slate-700/50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Slideable navigation container */}
      <div
        ref={navContainerRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 px-1 py-1.5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {NAV_ITEMS.map(({ to, icon: Icon, label, isDues }) => {
          const isActive =
            location.pathname === to ||
            (to !== "/" && location.pathname.startsWith(to));

          return (
            <NavLink
              key={to}
              to={to}
              ref={isActive ? activeItemRef : null}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-xl transition-all duration-200 cursor-pointer flex-shrink-0 min-w-[64px] ${
                isActive
                  ? isDues
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20"
                    : "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/20"
                  : isDues
                  ? "text-amber-400/90 hover:text-amber-300 hover:bg-slate-800/50 border border-amber-500/20 bg-amber-500/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
              aria-label={label}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
                    isActive ? "stroke-[2.2]" : "stroke-[1.75]"
                  }`}
                />
                {isActive && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-2 ring-slate-900 ${
                      isDues ? "bg-amber-400" : "bg-indigo-400"
                    }`}
                  />
                )}
                {isDues && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                )}
              </div>
              <span
                className={`text-[10px] tracking-wide whitespace-nowrap transition-all duration-200 ${
                  isActive ? "opacity-100 font-bold" : "opacity-75 font-semibold"
                }`}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>

      {/* Slide Right Button */}
      <button
        type="button"
        onClick={slideRight}
        aria-label="Slide navigation right"
        className="flex-shrink-0 flex items-center justify-center w-7 h-10 mr-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 active:scale-95 transition-all shadow-sm border border-slate-700/50"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
