import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Wraps any route that requires authentication.
 * Unauthenticated users are redirected to /auth.
 */
export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/auth" replace />;
}
