import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMyTeamApi } from "../api/authApi";
import { type User } from "../types/auth";
import Sidebar from "../components/Sidebar";

const ManagerAnalyticsPage = () => {
  const navigate = useNavigate();

  const { data: team } = useQuery({
    queryKey: ["myTeam"],
    queryFn: getMyTeamApi,
  });

  const teamList = team ?? [];

  const stats = useMemo(() => {
    const total = teamList.length;
    const valides = teamList.filter((u: User) => u.statutCompte === "VALIDE").length;
    const acceptes = teamList.filter((u: User) => u.statutCompte === "ACCEPTE").length;
    const enAttente = teamList.filter((u: User) => u.statutCompte === "EN_ATTENTE").length;
    const expires = teamList.filter((u: User) => u.statutCompte === "EXPIRE").length;
    const avgCompletion = total
      ? Math.round(teamList.reduce((acc: number, u: User) => acc + u.profilCompletion, 0) / total)
      : 0;
    const completionGroups = [
      { label: "0%", count: teamList.filter((u: User) => u.profilCompletion === 0).length },
      { label: "1–33%", count: teamList.filter((u: User) => u.profilCompletion > 0 && u.profilCompletion <= 33).length },
      { label: "34–66%", count: teamList.filter((u: User) => u.profilCompletion > 33 && u.profilCompletion <= 66).length },
      { label: "67–99%", count: teamList.filter((u: User) => u.profilCompletion > 66 && u.profilCompletion < 100).length },
      { label: "100%", count: teamList.filter((u: User) => u.profilCompletion === 100).length },
    ];
    return { total, valides, acceptes, enAttente, expires, avgCompletion, completionGroups };
  }, [teamList]);

  const maxGroup = Math.max(...stats.completionGroups.map((g) => g.count), 1);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="MANAGER" />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <div className="border-b px-8 py-4 flex items-center gap-3 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <button onClick={() => navigate("/manager")}
            className="text-sm px-3 py-2 rounded-lg"
            style={{ background: "var(--border)", color: "var(--text-muted)" }}>
            ← Retour
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
            Analytics
          </h1>
        </div>

        <div className="px-8 py-8 space-y-6 page-enter">

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-5">
            {[
              { label: "Total équipe", value: stats.total, icon: "👥", color: "#4f46e5", bg: "#eef2ff" },
              { label: "Validés", value: stats.valides, icon: "✅", color: "#059669", bg: "#ecfdf5" },
              { label: "En cours", value: stats.acceptes, icon: "📝", color: "#2563eb", bg: "#eff6ff" },
              { label: "Complétion moy.", value: `${stats.avgCompletion}%`, icon: "📊", color: "#7c3aed", bg: "#f5f3ff" },
            ].map((s) => (
              <div key={s.label} className="stat-card flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: s.color, fontFamily: "Sora" }}>{s.value}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">

            {/* Répartition statuts */}
            <div className="card p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Répartition des statuts
              </h2>
              <div className="space-y-4">
                {[
                  { label: "Validés", value: stats.valides, color: "#10b981", bg: "#ecfdf5" },
                  { label: "Profil soumis", value: stats.acceptes, color: "#3b82f6", bg: "#eff6ff" },
                  { label: "En attente", value: stats.enAttente, color: "#f59e0b", bg: "#fffbeb" },
                  { label: "Expirés", value: stats.expires, color: "#f97316", bg: "#fff7ed" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span style={{ color: "var(--text)" }}>{s.label}</span>
                      <span className="font-bold" style={{ color: s.color }}>{s.value}</span>
                    </div>
                    <div className="h-2.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: stats.total > 0 ? `${(s.value / stats.total) * 100}%` : "0%",
                          background: s.color,
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribution complétion */}
            <div className="card p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Distribution de la complétion
              </h2>
              <div className="flex items-end gap-3 h-36">
                {stats.completionGroups.map((g) => (
                  <div key={g.label} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{g.count}</span>
                    <div className="w-full rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${(g.count / maxGroup) * 100}px`,
                        minHeight: "4px",
                        background: g.label === "100%"
                          ? "linear-gradient(to top, #10b981, #34d399)"
                          : "linear-gradient(to top, #7c3aed, #a78bfa)",
                      }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{g.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tableau membres */}
          <div className="card overflow-hidden">
            <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Détail par membre
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Employé", "Complétion", "Statut"].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamList.map((u: User) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
                          {u.prenom[0]}{u.nom[0]}
                        </div>
                        <span className="font-medium" style={{ color: "var(--text)" }}>
                          {u.prenom} {u.nom}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full" style={{ background: "var(--border)", maxWidth: "120px" }}>
                          <div className={`h-2 rounded-full ${u.profilCompletion === 100 ? "bg-emerald-500" : "bg-violet-500"}`}
                            style={{ width: `${u.profilCompletion}%` }} />
                        </div>
                        <span className="text-xs font-bold"
                          style={{ color: u.profilCompletion === 100 ? "#059669" : "#7c3aed" }}>
                          {u.profilCompletion}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold px-2 py-1 rounded-lg"
                        style={{
                          background: u.statutCompte === "VALIDE" ? "#ecfdf5" : "#eff6ff",
                          color: u.statutCompte === "VALIDE" ? "#059669" : "#2563eb",
                        }}>
                        {u.statutCompte === "VALIDE" ? "✅ Validé" : "📝 En cours"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerAnalyticsPage;