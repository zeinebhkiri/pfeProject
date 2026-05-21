import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getCurrentUserApi, getMyTeamApi, getAffectationByUserApi, getPositionsApi, getAllAffectationsApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import { type Position, type User, type Affectation} from "../types/auth";
import Sidebar from "../components/Sidebar";
import CompanyDocumentsWidget from "../components/CompanyDocumentsWidget";
import { useMemo, useState } from "react";


const statutConfig: Record<string, { label: string; color: string; bg: string }> = {
  EN_ATTENTE: { label: "En attente",   color: "#d97706", bg: "#fffbeb" },
  ACCEPTE:    { label: "Profil soumis",color: "#2563eb", bg: "#eff6ff" },
  VALIDE:     { label: "Validé",       color: "#059669", bg: "#ecfdf5" },
  DESACTIVE:  { label: "Désactivé",    color: "#64748b", bg: "#f1f5f9" },
  EXPIRE:     { label: "Expiré",       color: "#ea580c", bg: "#fff7ed" },
};

const ManagerDashboardPage = () => {
  const navigate = useNavigate();
  const { email, userId } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  // ⭐ États pour les messages et filtres
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);


  const { data: manager } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserApi,
  });

  const { data: positions = [] } = useQuery({
  queryKey: ["positions"],
  queryFn: getPositionsApi,
});

  const { data: team, isLoading } = useQuery({
    queryKey: ["myTeam"],
    queryFn: getMyTeamApi,
  });

  const { data: affectation } = useQuery({
    queryKey: ["myAffectation", userId],
    queryFn: () => getAffectationByUserApi(userId!),
    enabled: !!userId,
    retry: false,
  });

// ⭐ Récupérer toutes les affectations pour connaître le poste de chaque salarié
const { data: allAffectations = [] } = useQuery({
  queryKey: ["allAffectations"],
  queryFn: getAllAffectationsApi,
  enabled: true,
});

    // ⭐ Créer un mapping userId -> poste
const userPosteMap = useMemo(() => {
  const map = new Map<string, string>();
  allAffectations.forEach((affectation: Affectation) => {
    const position = positions.find((p: Position) => p.id === affectation.positionId);
    if (position) {
      map.set(affectation.userId, position.titre);
    }
  });
  return map;
}, [allAffectations, positions]);

  const handleRefresh = () => {
    setSuccessMsg("");
    setErrorMsg("");
    queryClient.invalidateQueries({ queryKey: ["myTeam"] });
    setSearchQuery("");
    setShowDisabled(false);
    setSuccessMsg("Tableau actualisé !");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const profileIncomplete = (manager?.profilCompletion ?? 0) < 100;
  const teamList = team ?? [];
  const valides  = teamList.filter((u: User) => u.statutCompte === "VALIDE").length;
  const enCours  = teamList.filter((u: User) => u.statutCompte === "ACCEPTE").length;
  const completion = teamList.length
    ? Math.round(teamList.reduce((acc: number, u: User) => acc + u.profilCompletion, 0) / teamList.length)
    : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="MANAGER" />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* ── Navbar ── */}
        <div className="sticky top-0 z-10 border-b px-8 py-4 flex items-center justify-between"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Manager</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle dark mode */}
            <button type="button" onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition hover:scale-105"
              style={{ background: "var(--border)" }}>
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text)" }}>
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text)" }}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Avatar — Square IT style */}
            <button type="button"
              onClick={() => navigate("/profile")}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm hover:scale-105 transition shadow-md"
              style={{ background: "linear-gradient(135deg, #00AEEF, #1A2B6B)" }}
              title="Mon profil">
              {email?.[0]?.toUpperCase() ?? "M"}
            </button>
          </div>
        </div>

        <div className="px-8 py-8 space-y-8 page-enter">

          {/* ── Alerte profil incomplet ── */}
          {profileIncomplete && (
            <div className="relative overflow-hidden rounded-2xl p-6"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }}>
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
                style={{ background: "white", transform: "translate(20%, -30%)" }} />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background: "rgba(255,255,255,0.2)" }}>
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg" style={{ fontFamily: "Sora" }}>
                      Profil incomplet — Action requise
                    </h3>
                    <p className="text-amber-100 text-sm mt-0.5">
                      Votre profil est complété à <strong>{manager?.profilCompletion ?? 0}%</strong>.
                      Veuillez renseigner vos informations.
                    </p>
                  </div>
                </div>
                <button type="button"
                  onClick={() => navigate("/profile")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm transition hover:scale-105"
                  style={{ background: "white", color: "#d97706" }}>
                  Compléter mon profil →
                </button>
              </div>
            </div>
          )}

          {/* ── Hero greeting — Square IT ── */}
          <div className="relative overflow-hidden rounded-3xl p-8"
            style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 50%, #243580 100%)" }}>
            {/* Orbes */}
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10"
              style={{ background: "radial-gradient(circle, #00AEEF, transparent)", transform: "translate(30%, -30%)" }} />
            <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full opacity-8"
              style={{ background: "radial-gradient(circle, #8DC63F, transparent)", transform: "translateY(50%)" }} />
            {/* Grid */}
            <div className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `linear-gradient(rgba(0,174,239,0.5) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(0,174,239,0.5) 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }} />
            {/* Ligne accent top */}
            <div className="absolute top-0 left-0 right-0 h-0.5"
              style={{ background: "linear-gradient(90deg, #00AEEF, #8DC63F, transparent)" }} />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "rgba(0,174,239,0.8)" }}>
                  {greeting} 👋
                </p>
                <h1 className="text-white text-3xl font-bold mb-2" style={{ fontFamily: "Sora" }}>
                  {manager?.prenom} {manager?.nom}
                </h1>
                <div className="flex items-center gap-3 mt-3">
                  <span className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: "rgba(0,174,239,0.2)", color: "white", border: "1px solid rgba(0,174,239,0.3)" }}>
                    👔 Manager
                  </span>
                  {(positions as Position[]).find(p => p.id === affectation?.positionId)?.titre && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: "rgba(141,198,63,0.2)", color: "white", border: "1px solid rgba(141,198,63,0.3)" }}>
                      💼 {(positions as Position[]).find(p => p.id === affectation?.positionId)?.titre ?? "—"}
                    </span>
                  )}
                </div>
              </div>

              {/* Stat cards dans le hero */}
              <div className="flex gap-4">
                {[
                  { value: teamList.length, label: "Mon équipe", icon: "👥" },
                  { value: valides,         label: "Intégrés",   icon: "✅" },
                  { value: `${completion}%`,label: "Moy. profil",icon: "📊" },
                ].map((s) => (
                  <div key={s.label} className="text-center rounded-2xl px-5 py-4"
                    style={{ background: "rgba(0,174,239,0.12)", backdropFilter: "blur(10px)", border: "1px solid rgba(0,174,239,0.2)" }}>
                    <span className="text-2xl">{s.icon}</span>
                    <p className="text-white text-2xl font-bold mt-1" style={{ fontFamily: "Sora" }}>{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(168,216,234,0.7)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-4 gap-5">
            {[
              { label: "Total équipe",      value: teamList.length, icon: "👥", color: "#00AEEF", bg: "rgba(0,174,239,0.08)"   },
              { label: "Validés",           value: valides,         icon: "✅", color: "#8DC63F", bg: "rgba(141,198,63,0.08)" },
              { label: "Profils en cours",  value: enCours,         icon: "📝", color: "#1A2B6B", bg: "rgba(26,43,107,0.08)"  },
              { label: "Complétion moyenne",value: `${completion}%`,icon: "📈", color: "#00AEEF", bg: "rgba(0,174,239,0.06)"  },
            ].map((s) => (
              <div key={s.label} className="stat-card flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: s.color, fontFamily: "Sora" }}>{s.value}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tableau équipe + Documents ── */}
          <div className="grid grid-cols-2 gap-6">

            {/* Tableau équipe */}
            <div className="card overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(0,174,239,0.1)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                    Mon équipe
                  </h2>
                </div>
                 <div className="flex items-center gap-3 flex-wrap">
                  {/* ⭐ Bouton Actualiser */}
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
                </div>
              
                <button type="button"
                  onClick={() => navigate("/manager/equipe")}
                  className="text-sm font-semibold px-4 py-2 rounded-xl transition hover:scale-105"
                  style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.2)" }}>
                  Voir tout →
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-4 rounded-full animate-spin"
                    style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
                </div>
              ) : teamList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <span className="text-5xl">👥</span>
                  <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Aucun membre dans votre équipe.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Employé", "Statut", "Progression","Poste", ""].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamList.slice(0, 5).map((u: User) => {
                      const s = statutConfig[u.statutCompte];
                      const userPoste = userPosteMap.get(u.id); 
                      return (
                        <tr key={u.id} className="transition hover:bg-[var(--bg)]"
                          style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar Square IT style */}
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                style={{ background: "linear-gradient(135deg, #00AEEF, #1A2B6B)" }}>
                                {u.prenom[0]}{u.nom[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                                  {u.prenom} {u.nom}
                                </p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-5 py-4">
                            <span className="badge text-xs px-2 py-1 rounded-lg font-medium"
                              style={{ background: s?.bg, color: s?.color }}>
                              {s?.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2" style={{ minWidth: "80px" }}>
                              <div className="flex-1 rounded-full h-1.5" style={{ background: "var(--border)" }}>
                                <div className="h-1.5 rounded-full transition-all"
                                  style={{
                                    width: `${u.profilCompletion}%`,
                                    background: u.profilCompletion === 100 ? "#8DC63F" : "#00AEEF",
                                  }} />
                              </div>
                              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                                {u.profilCompletion}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
          {userPoste ? (
            <span className="text-xs px-2 py-1 rounded-lg font-medium"
              style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.15)" }}>
              💼 {userPoste}
            </span>
          ) : (
            <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
              Non affecté
            </span>
          )}
        </td>
                          <td className="px-5 py-4">
                            <button type="button"
                              onClick={() => navigate(`/manager/salarie/${u.id}`)}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition hover:scale-105"
                              style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.15)" }}>
                              Voir →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Documents entreprise */}
            <CompanyDocumentsWidget />
           
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerDashboardPage;