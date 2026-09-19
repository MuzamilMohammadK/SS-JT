import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

/**
 * AppShell — wraps every authenticated page.
 * - Desktop: sticky top Navbar
 * - Mobile:  sticky top Navbar (brand only) + fixed bottom BottomNav
 * - Main content is padded so it's never hidden behind the bottom bar.
 */
export default function AppShell({ children }) {
  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
