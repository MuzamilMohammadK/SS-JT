import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";

// Pages
import AuthPage      from "./pages/AuthPage";
import PartiesPage   from "./pages/PartiesPage";
import LedgerPage    from "./pages/LedgerPage";
import HistoryPage   from "./pages/HistoryPage";
import AnalyticsPage from "./pages/AnalyticsPage";

// PWA service-worker hook
import { usePWA } from "./hooks/usePWA";

function PWARegistrar() {
  usePWA();
  return null;
}

const TOAST_STYLE = {
  background:   "#0f172a",
  color:        "#f1f5f9",
  border:       "1px solid rgba(99, 102, 241, 0.2)",
  borderRadius: "14px",
  fontSize:     "13px",
  fontWeight:   "500",
  boxShadow:    "0 8px 32px rgba(0,0,0,0.4)",
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PWARegistrar />
        <Toaster
          position="top-right"
          toastOptions={{
            style:   TOAST_STYLE,
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error:   { iconTheme: { primary: "#f43f5e", secondary: "#fff" } },
            duration: 3500,
          }}
        />

        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected — 4 views */}
          <Route path="/parties"   element={<ProtectedRoute><PartiesPage /></ProtectedRoute>} />
          <Route path="/ledger"    element={<ProtectedRoute><LedgerPage /></ProtectedRoute>} />
          <Route path="/history"   element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />

          {/* Default → Parties */}
          <Route path="/" element={<Navigate to="/parties" replace />} />
          <Route path="*" element={<Navigate to="/parties" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
