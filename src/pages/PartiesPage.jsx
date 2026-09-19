import { useAuth } from "../context/AuthContext";
import { useParties } from "../hooks/useParties";
import PartyManager from "../components/parties/PartyManager";
import AppShell from "../components/layout/AppShell";
import { Users } from "lucide-react";

export default function PartiesPage() {
  const { currentUser } = useAuth();
  const { parties, loading, error } = useParties(currentUser?.uid);

  return (
    <AppShell>
      <div className="page-content animate-fade-in-up">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="page-title">Parties</h1>
              <p className="text-slate-500 text-sm">Manage customers & suppliers</p>
            </div>
          </div>
        </div>

        <PartyManager parties={parties} loading={loading} error={error} />
      </div>
    </AppShell>
  );
}
