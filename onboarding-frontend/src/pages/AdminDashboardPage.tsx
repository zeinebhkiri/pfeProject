import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createEmployeeApi, disableUserApi, getAllAffectationsApi, getAllUsersApi, getPositionsApi, validateUserApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import { type UserRole, type User , type Affectation, type Position} from "../types/auth";
import Sidebar from "../components/Sidebar";

const statutConfig: Record<string, { label: string; class: string }> = {
  EN_ATTENTE: { label: "En attente", class: "bg-amber-50 text-amber-700 border border-amber-200" },
  ACCEPTE: { label: "Profil soumis", class: "bg-blue-50 text-blue-700 border border-blue-200" },
  VALIDE: { label: "Validé", class: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  DESACTIVE: { label: "Désactivé", class: "bg-slate-100 text-slate-500 border border-slate-200" },
  EXPIRE: { label: "Expiré", class: "bg-orange-50 text-orange-600 border border-orange-200" },
};

interface ToastData {
  nom: string;
  prenom: string;
  userId: string;
}

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { email } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [dateEmbauche, setDateEmbauche] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [role, setRole] = useState<UserRole>("SALARIE");
  const [joursLimite, setJoursLimite] = useState(3);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");

  const [showDisabled, setShowDisabled] = useState(false);

  // Toast après validation
  const [toast, setToast] = useState<ToastData | null>(null);
const [showDisableModal, setShowDisableModal] = useState(false);
const [userToDisable, setUserToDisable] = useState<User | null>(null);
  const { data: users, isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: getAllUsersApi,
  });

  const createMutation = useMutation({
    mutationFn: createEmployeeApi,
    onSuccess: (message: string) => {
      setSuccessMessage(message);
      setErrorMessage("");
      setNom(""); setPrenom(""); setEmployeeEmail("");
      setRole("SALARIE"); setJoursLimite(3);setDateEmbauche("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || "Une erreur est survenue.");
      setSuccessMessage("");
    },
  });

  const validateMutation = useMutation({
    mutationFn: (userId: string) => validateUserApi(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      const user = employees.find((u: User) => u.id === userId);
      if (user) {
        setToast({ nom: user.nom, prenom: user.prenom, userId: user.id });
      }
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || "Erreur lors de la validation.");
    },
  });
  // Ajoutez cette mutation avec les autres useMutation
const disableMutation = useMutation({
  mutationFn: (userId: string) => disableUserApi(userId),
  onSuccess: () => {
    setSuccessMessage("Compte désactivé avec succès");
    queryClient.invalidateQueries({ queryKey: ["allUsers"] });
  },
  onError: (error: any) => {
    setErrorMessage(error.response?.data?.error || "Erreur lors de la désactivation.");
  },
});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(""); setErrorMessage("");
    createMutation.mutate({
      nom, prenom, email: employeeEmail, role, joursLimite,
      dateEmbauche: dateEmbauche
    });
  };

  const handleRefresh = () => {
  setSuccessMessage("");
  setErrorMessage("");
  queryClient.invalidateQueries({ queryKey: ["allUsers"] });
  setSearchQuery("");
  setFilterRole("ALL");
  setFilterStatut("ALL");
  setSuccessMessage("Tableau actualisé !");
  setTimeout(() => setSuccessMessage(""), 3000);
};

// 2. Ajouter les requêtes pour récupérer les affectations et positions
const { data: affectations = [] } = useQuery({
  queryKey: ["affectations"],
  queryFn: getAllAffectationsApi, // À créer dans authApi
  enabled: !!users, // ou true si accessible
});

const { data: positions = [] } = useQuery({
  queryKey: ["positions"],
  queryFn: getPositionsApi,
});

  const employees = useMemo(
    () => (users ?? []).filter((u: User) => u.role !== "ADMIN"),
    [users]
  );

  const salaries = useMemo(() => employees.filter((u: User) => u.role === "SALARIE"), [employees]);
  const managers = useMemo(() => employees.filter((u: User) => u.role === "MANAGER"), [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((u: User) => {
    // ⭐ Exclure les comptes désactivés si showDisabled est false
    if (!showDisabled && u.statutCompte === "DESACTIVE") return false;
      const fullName = `${u.prenom} ${u.nom}`.toLowerCase();
      const fullNameReverse = `${u.nom} ${u.prenom}`.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        fullName.includes(q) ||
        fullNameReverse.includes(q) ||
        u.prenom.toLowerCase().includes(q) ||
        u.nom.toLowerCase().includes(q);
      const matchRole = filterRole === "ALL" || u.role === filterRole;
      const matchStatut = filterStatut === "ALL" || u.statutCompte === filterStatut;
      return matchSearch && matchRole && matchStatut;
    });
  }, [employees, searchQuery, filterRole, filterStatut,showDisabled]);

  const stats = [
    { label: "Salariés", value: salaries.length, icon: "👤", color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Managers", value: managers.length, icon: "👔", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "En attente", value: employees.filter((u: User) => u.statutCompte === "EN_ATTENTE").length, icon: "⏳", color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Validés", value: employees.filter((u: User) => u.statutCompte === "VALIDE").length, icon: "✅", color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="ADMIN" />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* Top Navbar */}
        <div
          className="border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="relative w-80" style={{ display: "flex", alignItems: "center" }}>
            <span
              className="absolute left-3.5 flex items-center justify-center"
              style={{ color: "var(--text-muted)", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 1 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou prénom..."
              style={{
                width: "100%",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "12px",
                padding: "10px 16px 10px 40px",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5">
              <span className="text-lg leading-none">+</span>
              Ajouter un employé
            </button>

            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ background: "var(--border)" }}
              title={isDark ? "Mode clair" : "Mode sombre"}
            >
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text)" }}>
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text)" }}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => navigate("/admin/profil")}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm hover:scale-105 transition-transform shadow-md"
            >
              {email?.[0]?.toUpperCase() ?? "A"}
            </button>
          </div>
        </div>

        <div className="px-8 py-8 space-y-8 page-enter">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Tableau de bord RH
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {successMessage && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              ✅ {successMessage}
              <button onClick={() => setSuccessMessage("")} className="ml-auto opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              ⚠ {errorMessage}
              <button onClick={() => setErrorMessage("")} className="ml-auto opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-5">
            {stats.map((s) => (
              <div key={s.label} className="stat-card flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
                  {s.icon}
                </div>
                <div>
                  <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: "Sora" }}>{s.value}</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
<div className="card overflow-hidden">
  <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
    <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
      Liste des employés
    </h2>
    
    <div className="flex items-center gap-3 flex-wrap">
      {/* Bouton Actualiser */}
      <button
        onClick={handleRefresh}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
        style={{ background: "var(--border)", color: "var(--text)" }}
        title="Actualiser le tableau"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 4v6h-6" />
          <path d="M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
      </button>

      {/* Filtre Rôle */}
      <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
        className="input-field" style={{ width: "150px", padding: "8px 12px" }}>
        <option value="ALL">Tous les rôles</option>
        <option value="SALARIE">Salarié</option>
        <option value="MANAGER">Manager</option>
      </select>
      
      {/* Filtre Statut */}
      <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
        className="input-field" style={{ width: "160px", padding: "8px 12px" }}>
        <option value="ALL">Tous les statuts</option>
        <option value="EN_ATTENTE">En attente</option>
        <option value="ACCEPTE">Profil soumis</option>
        <option value="VALIDE">Validé</option>
        <option value="DESACTIVE">Désactivé</option>
        <option value="EXPIRE">Expiré</option>
      </select>
    </div>
  </div>

  {isLoading ? (
    <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Chargement...</div>
  ) : filteredEmployees.length === 0 ? (
    <div className="flex flex-col items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>
      <span className="text-4xl mb-2">🔍</span>
      <span className="text-sm">Aucun résultat trouvé</span>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Employé", "Rôle", "Statut", "Progression", "Délai", "Poste", "Actions"].map((h) => (
              <th key={h} className="px-6 pb-4 pt-4 text-left text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.map((user: User) => {
            const joursRestants = user.dateLimit
              ? Math.ceil((new Date(user.dateLimit).getTime() - Date.now()) / 86400000)
              : null;
            const statut = statutConfig[user.statutCompte] ?? { label: user.statutCompte, class: "bg-slate-100 text-slate-500" };
            const canValidate = user.statutCompte === "ACCEPTE" && user.profilCompletion === 100;
            
            // ⭐ Récupérer l'affectation et le poste du salarié
            const userAffectation = affectations && Array.isArray(affectations) 
  ? affectations.find((a: Affectation) => a && a.userId === user.id)
  : null;
            const userPoste = userAffectation 
              ? positions?.find((p: Position) => p.id === userAffectation.positionId)?.titre 
              : null;

            return (
              <tr key={user.id} className="transition" style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {user.prenom[0]}{user.nom[0]}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: "var(--text)" }}>{user.prenom} {user.nom}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${user.role === "MANAGER"
                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${statut.class}`}>{statut.label}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2" style={{ minWidth: "90px" }}>
                    <div className="flex-1 rounded-full h-2" style={{ background: "var(--border)" }}>
                      <div
                        className={`h-2 rounded-full transition-all ${user.profilCompletion === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                        style={{ width: `${user.profilCompletion}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--text-muted)", width: "36px", textAlign: "right" }}>
                      {user.profilCompletion}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {joursRestants !== null ? (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                      joursRestants <= 0 ? "bg-red-50 text-red-500"
                      : joursRestants <= 1 ? "bg-orange-50 text-orange-500"
                      : "bg-slate-100 text-slate-500"}`}>
                      {joursRestants <= 0 ? "Expiré" : `J-${joursRestants}`}
                    </span>
                  ) : <span style={{ color: "var(--text-muted)" }} className="text-xs">—</span>}
                </td>
                {/* ⭐ NOUVELLE COLONNE POSTE */}
                <td className="px-6 py-4">
                  {userPoste ? (
                    <span className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.15)" }}>
                      💼 {userPoste}
                    </span>
                  ) : (
                    <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                      Pas d'affectation
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/admin/salarie/${user.id}`)}
                      className="btn-secondary text-xs px-3 py-2"
                    >
                      Voir →
                    </button>
                    {canValidate && (
                      <button
                        onClick={() => validateMutation.mutate(user.id)}
                        disabled={validateMutation.isPending}
                        className="text-xs px-3 py-2 rounded-xl font-semibold transition"
                        style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}
                      >
                        ✅ Valider
                      </button>
                    )}
                    {/* Bouton désactiver - visible pour les comptes actifs (non déjà désactivés) */}
                    {user.statutCompte !== "DESACTIVE" && user.statutCompte !== "EXPIRE" && (
                      <button
                        onClick={() => {
                          setUserToDisable(user);
                          setShowDisableModal(true);
                        }}
                        disabled={disableMutation.isPending}
                        className="text-xs px-3 py-2 rounded-xl font-semibold transition"
                        style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
                        title="Désactiver le compte"
                      >
                        🔒 Désactiver
                      </button>
                    )}
                    
                    {/* Badge pour les comptes déjà désactivés */}
                    {user.statutCompte === "DESACTIVE" && (
                      <span className="text-xs px-3 py-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200">
                        Désactivé
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )}
</div>
        </div>
        {/* Modal de confirmation de désactivation */}
{showDisableModal && userToDisable && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50 drawer-overlay" onClick={() => setShowDisableModal(false)} />
    <div className="relative rounded-3xl shadow-2xl w-full mx-4 p-8 modal-panel"
      style={{ background: "var(--surface)", maxWidth: "440px" }}>
      
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "#fef2f2" }}>
          <span className="text-4xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
          Désactiver le compte
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Êtes-vous sûr de vouloir désactiver le compte de <br />
          <span className="font-semibold" style={{ color: "#dc2626" }}>
            {userToDisable.prenom} {userToDisable.nom}
          </span> ?
        </p>
      </div>

      <div className="rounded-xl p-4 mb-6 text-sm"
        style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-semibold mb-1">Conséquences :</p>
            <ul className="text-xs space-y-1 list-disc pl-4">
              <li>L'utilisateur ne pourra plus se connecter</li>
              <li>Son profil ne sera plus accessible</li>
              <li>Cette action peut être réversible plus tard</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            disableMutation.mutate(userToDisable.id);
            setShowDisableModal(false);
            setUserToDisable(null);
          }}
          disabled={disableMutation.isPending}
          className="flex-1 py-3 rounded-xl font-semibold transition"
          style={{ background: "#dc2626", color: "white" }}
        >
          {disableMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Désactivation...
            </span>
          ) : "✅ Confirmer la désactivation"}
        </button>
        <button
          onClick={() => {
            setShowDisableModal(false);
            setUserToDisable(null);
          }}
          className="btn-secondary px-6 py-3"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
)}
      </main>

      {/* Modal création employé */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 drawer-overlay" onClick={() => setShowForm(false)} />
          <div className="relative rounded-3xl shadow-2xl w-full mx-4 p-8 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "480px" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>Nouvel employé</h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Un email d'invitation sera envoyé</p>
              </div>
              <button onClick={() => setShowForm(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Nom</label>
      <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} required placeholder="Nom" className="input-field" />
    </div>
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Prénom</label>
      <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} required placeholder="Prénom" className="input-field" />
    </div>
  </div>

  <div>
    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Email</label>
    <input type="email" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} required placeholder="employe@gmail.com" className="input-field" />
  </div>

  {/* ── Ligne : Rôle + Délai + Date d'embauche ── */}
  <div className="grid grid-cols-3 gap-3">
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Rôle</label>
      <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input-field">
        <option value="SALARIE">Salarié</option>
        <option value="MANAGER">Manager</option>
      </select>
    </div>
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Délai (jours)</label>
      <input type="number" value={joursLimite} onChange={(e) => setJoursLimite(Number(e.target.value))} min={1} max={30} required className="input-field" />
    </div>
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
        Date d'embauche <span className="text-red-400">*</span>
      </label>
      <input
        type="date"
        value={dateEmbauche}
        onChange={(e) => setDateEmbauche(e.target.value)}
        required
        className="input-field"
        min={new Date().toISOString().split("T")[0]}
      />
    </div>
  </div>

  {errorMessage && (
    <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "#fef2f2", color: "#dc2626" }}>⚠ {errorMessage}</div>
  )}

  <div className="flex gap-3 pt-2">
    <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 py-3">
      {createMutation.isPending ? "Envoi..." : "Envoyer l'invitation →"}
    </button>
    <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-6 py-3">Annuler</button>
  </div>
</form>
          </div>
        </div>
      )}

      {/* Toast validation — professionnel */}
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 drawer-overlay" onClick={() => setToast(null)} />
          <div
            className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel text-center"
            style={{ background: "var(--surface)", maxWidth: "460px" }}
          >
            {/* Icône succès animée */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Compte validé !
            </h2>
            <p className="text-base font-semibold mb-1" style={{ color: "#059669" }}>
              {toast.prenom} {toast.nom}
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Le compte a été validé avec succès.
            </p>

            {/* Alerte affectation */}
            <div
              className="rounded-2xl px-5 py-4 mb-6 text-left"
              style={{ background: "#fffbeb", border: "1px solid #fcd34d" }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">📌</span>
                <div>
                  <p className="font-bold text-sm" style={{ color: "#92400e" }}>
                    Action requise — Affectation obligatoire
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#b45309" }}>
                    Veuillez maintenant affecter un <strong>poste</strong> et un <strong>manager</strong> à ce salarié pour finaliser son intégration.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setToast(null);
                  navigate(`/admin/salarie/${toast.userId}`);
                }}
                className="btn-primary flex-1 py-3"
              >
                📌 Affecter maintenant →
              </button>
              <button
                onClick={() => setToast(null)}
                className="btn-secondary px-6 py-3"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;