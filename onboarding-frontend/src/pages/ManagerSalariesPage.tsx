import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMyTeamApi } from "../api/authApi";
import { type User } from "../types/auth";
import Sidebar from "../components/Sidebar";

const statutConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  EN_ATTENTE: { label: "En attente", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  ACCEPTE: { label: "Profil soumis", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  VALIDE: { label: "Validé", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  DESACTIVE: { label: "Désactivé", color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0" },
  EXPIRE: { label: "Expiré", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
};

const ManagerSalariesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");

  const { data: team, isLoading } = useQuery({
    queryKey: ["myTeam"],
    queryFn: getMyTeamApi,
  });

  const filtered = useMemo(() => {
    return (team ?? []).filter((u: User) => {
      const q = search.toLowerCase();
      const match =
        q === "" ||
        u.prenom.toLowerCase().includes(q) ||
        u.nom.toLowerCase().includes(q) ||
        `${u.prenom} ${u.nom}`.toLowerCase().includes(q);
      const matchStatut = filterStatut === "ALL" || u.statutCompte === filterStatut;
      return match && matchStatut;
    });
  }, [team, search, filterStatut]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="MANAGER" />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <div className="border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/manager")}
              className="text-sm px-3 py-2 rounded-lg"
              style={{ background: "var(--border)", color: "var(--text-muted)" }}>
              ← Retour
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Mon équipe
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..." className="input-field" style={{ paddingLeft: "36px", width: "220px" }} />
            </div>
            <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
              className="input-field" style={{ width: "160px" }}>
              <option value="ALL">Tous les statuts</option>
              <option value="ACCEPTE">Profil soumis</option>
              <option value="VALIDE">Validé</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="DESACTIVE">Désactivé</option>
            </select>
          </div>
        </div>

        <div className="px-8 py-8 page-enter">
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>
                Chargement...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 gap-3">
                <span className="text-5xl">🔍</span>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun résultat trouvé.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Employé", "Statut", "Progression", "Actions"].map((h) => (
                      <th key={h} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u: User) => {
                    const s = statutConfig[u.statutCompte];
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
                              {u.prenom[0]}{u.nom[0]}
                            </div>
                            <div>
                              <p className="font-semibold" style={{ color: "var(--text)" }}>{u.prenom} {u.nom}</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                            style={{ background: s?.bg, color: s?.color, border: `1px solid ${s?.border}` }}>
                            {s?.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2" style={{ minWidth: "100px" }}>
                            <div className="flex-1 rounded-full h-2" style={{ background: "var(--border)" }}>
                              <div className={`h-2 rounded-full ${u.profilCompletion === 100 ? "bg-emerald-500" : "bg-violet-500"}`}
                                style={{ width: `${u.profilCompletion}%` }} />
                            </div>
                            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              {u.profilCompletion}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => navigate(`/manager/salarie/${u.id}`)}
                            className="btn-secondary text-xs px-3 py-2">
                            Voir profil →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerSalariesPage;