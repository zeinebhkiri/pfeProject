import { type UserRole } from "../types/auth";

export const useAuth = () => {
  const token = localStorage.getItem("jwt_token");
  const email = localStorage.getItem("user_email");
  const role = localStorage.getItem("user_role") as UserRole | null;
  const userId = localStorage.getItem("user_id");

  

  const isAuthenticated = !!token;
  const isAdmin = role === "ADMIN";        // RH
  const isManager = role === "MANAGER";
  const isSalarie = role === "SALARIE";

  const login = (token: string, email: string, role: string, userId: string) => {
    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user_email", email);
    localStorage.setItem("user_role", role);
    localStorage.setItem("user_id", userId);
   
  };

  const logout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_id");
   
  };

  return {
    token,
    email,
    role,
    userId,
    isAuthenticated,
    isAdmin,       // ← NOUVEAU
    isManager,     // ← NOUVEAU
    isSalarie,     // ← NOUVEAU
    login,
    logout,
  };
};