import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePin } from "../../context/PinContext";
import PinEntryScreen from "./PinEntryScreen";

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  const { hasPin, pinVerified } = usePin();

  if (!currentUser) return <Navigate to="/auth" replace />;

  // If a PIN is configured and hasn't been verified this session, show the PIN gate
  if (hasPin && !pinVerified) return <PinEntryScreen />;

  return children;
}
