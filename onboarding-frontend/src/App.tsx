import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginPage from "./pages/LoginPage";
import ActivateAccountPage from "./pages/ActivateAccountPage";
import DashboardPage from "./pages/DashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SalarieProfilePage from "./pages/SalarieProfilePage";
import SalariesPage from "./pages/SalariesPage";
import ManagersPage from "./pages/ManagersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AdminProfilPage from "./pages/AdminProfilPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedManagerRoute from "./components/ProtectedManagerRoute";
import ProfilPage from "./pages/ProfilPage";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import ManagerSalariesPage from "./pages/ManagerSalariesPage";
import ManagerAnalyticsPage from "./pages/ManagerAnalyticsPage";
import ManagerSalarieProfilePage from "./pages/ManagerSalarieProfilePage";
import AdminDocumentsPage from "./pages/AdminDocumentsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminPostesPage from "./pages/AdminPostesPage";
import AdminParcoursTemplatesPage from "./pages/AdminParcoursTemplatesPage";
import MonParcoursPage from "./pages/MonParcoursPage";
import ManagerParcoursPage from "./pages/ManagerParcoursPage";
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate-account" element={<ActivateAccountPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Salarié */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilPage /></ProtectedRoute>} />
          <Route path="/parcours" element={<ProtectedRoute><MonParcoursPage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
          <Route path="/admin/salaries" element={<ProtectedAdminRoute><SalariesPage /></ProtectedAdminRoute>} />
          <Route path="/admin/managers" element={<ProtectedAdminRoute><ManagersPage /></ProtectedAdminRoute>} />
          <Route path="/admin/analytics" element={<ProtectedAdminRoute><AnalyticsPage /></ProtectedAdminRoute>} />
          <Route path="/admin/profil" element={<ProtectedAdminRoute><AdminProfilPage /></ProtectedAdminRoute>} />
          <Route path="/admin/salarie/:id" element={<ProtectedAdminRoute><SalarieProfilePage /></ProtectedAdminRoute>} />
          <Route path="/admin/documents" element={<ProtectedAdminRoute><AdminDocumentsPage /></ProtectedAdminRoute>} />
          <Route path="/admin/postes" element={<ProtectedAdminRoute><AdminPostesPage /></ProtectedAdminRoute>} />
          <Route path="/admin/parcours" element={<ProtectedAdminRoute><AdminParcoursTemplatesPage /></ProtectedAdminRoute>} />

          {/* Manager */}
          <Route path="/manager" element={<ProtectedManagerRoute><ManagerDashboardPage /></ProtectedManagerRoute>} />
          <Route path="/manager/equipe" element={<ProtectedManagerRoute><ManagerSalariesPage /></ProtectedManagerRoute>} />
          <Route path="/manager/analytics" element={<ProtectedManagerRoute><ManagerAnalyticsPage /></ProtectedManagerRoute>} />
          <Route path="/manager/salarie/:id" element={<ProtectedManagerRoute><ManagerSalarieProfilePage /></ProtectedManagerRoute>} />
          <Route path="/manager/parcours" element={<ProtectedManagerRoute><ManagerParcoursPage /></ProtectedManagerRoute>} />

          {/* Redirections */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;