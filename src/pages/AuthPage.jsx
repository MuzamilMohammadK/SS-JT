import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthScreen from "../components/auth/AuthScreen";

export default function AuthPage() {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return <AuthScreen />;
}

