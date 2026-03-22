import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ProtectedManagerRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (role !== "MANAGER") return <Navigate to="/dashboard" />;
  return <>{children}</>;
};

export default ProtectedManagerRoute;