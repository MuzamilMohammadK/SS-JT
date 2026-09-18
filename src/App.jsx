import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import { usePWA } from "./hooks/usePWA";

function PWARegistrar() {
  usePWA();
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PWARegistrar />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0f172a",
              color:      "#f1f5f9",
              border:     "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: "14px",
              fontSize:   "13px",
              fontWeight: "500",
              boxShadow:  "0 8px 32px rgba(0,0,0,0.4)",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error:   { iconTheme: { primary: "#f43f5e", secondary: "#fff" } },
            duration: 3500,
          }}
        />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
