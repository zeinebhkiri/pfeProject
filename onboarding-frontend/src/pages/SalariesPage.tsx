import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAllUsersApi } from "../api/authApi";
import { type User } from "../types/auth";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";

const statutConfig: Record<string, { label: string; class: string }> = {
  EN_ATTENTE: { label: "En attente", class: "bg-amber-50 text-amber-700 border border-amber-200" },
  ACCEPTE: { label: "Profil soumis", class: "bg-blue-50 text-blue-700 border border-blue-200" },
  VALIDE: { label: "Validé", class: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  DESACTIVE: { label: "Désactivé", class: "bg-slate-100 text-slate-500 border border-slate-200" },
  EXPIRE: { label: "Expiré", class: "bg-orange-50 text-orange-600 border border-orange-200" },
};

const SalariesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");

  const { data: users, isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: getAllUsersApi,
  });

  const salaries = useMemo(() =>
    (users ?? []).filter((u: User) =>
      u.role === "SALARIE" &&
      (search === "" || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase())) &&
      (filterStatut === "ALL" || u.statutCompte === filterStatut)
    ), [users, search, filterStatut]
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="ADMIN" />
      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav searchValue={search} onSearchChange={setSearch} />

        <div className="px-8 py-8 page-enter space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Salariés
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {salaries.length} salarié{salaries.length > 1 ? "s" : ""} trouvé{salaries.length > 1 ? "s" : ""}
              </p>
            </div>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="input-field w-48"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="ACCEPTE">Profil soumis</option>
              <option value="VALIDE">Validé</option>
              <option value="DESACTIVE">Désactivé</option>
              <option value="EXPIRE">Expiré</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>
                Chargement...
              </div>
            ) : salaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>
                <span className="text-4xl mb-2">👤</span>
                <span className="text-sm">Aucun salarié trouvé</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border)` }}>
                    {["Salarié", "Email", "Statut", "Progression", "Date limite", ""].map((h) => (
                      <th key={h} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salaries.map((u: User) => {
                    const jr = u.dateLimit
                      ? Math.ceil((new Date(u.dateLimit).getTime() - Date.now()) / 86400000)
                      : null;
                    const s = statutConfig[u.statutCompte];
                    return (
                      <tr key={u.id} className="transition hover:opacity-80" style={{ borderBottom: `1px solid var(--border)` }}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                              {u.prenom[0]}{u.nom[0]}
                            </div>
                            <span className="font-semibold" style={{ color: "var(--text)" }}>{u.prenom} {u.nom}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm" style={{ color: "var(--text-muted)" }}>{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`badge ${s?.class}`}>{s?.label}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 min-w-[90px]">
                            <div className="flex-1 rounded-full h-2" style={{ background: "var(--border)" }}>
                              <div
                                className={`h-2 rounded-full ${u.profilCompletion === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                                style={{ width: `${u.profilCompletion}%` }}
                              />
                            </div>
                            <span className="text-xs w-9 text-right font-medium" style={{ color: "var(--text-muted)" }}>
                              {u.profilCompletion}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {jr !== null ? (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${jr <= 0 ? "bg-red-50 text-red-500" : jr <= 1 ? "bg-orange-50 text-orange-500" : "bg-slate-100 text-slate-500"}`}>
                              {jr <= 0 ? "Expiré" : `J-${jr}`}
                            </span>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => navigate(`/admin/salarie/${u.id}`)} className="btn-secondary text-xs px-4 py-2">
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
        </div>
      </main>
    </div>
  );
};

export default SalariesPage;