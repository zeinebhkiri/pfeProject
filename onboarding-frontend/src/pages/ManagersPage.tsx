import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAllUsersApi } from "../api/authApi";
import { type User } from "../types/auth";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";

const ManagersPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: getAllUsersApi,
  });

  const managers = useMemo(() =>
    (users ?? []).filter((u: User) =>
      u.role === "MANAGER" &&
      (search === "" || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
    ), [users, search]
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="ADMIN" />
      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav searchValue={search} onSearchChange={setSearch} />

        <div className="px-8 py-8 page-enter space-y-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Managers
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {managers.length} manager{managers.length > 1 ? "s" : ""} enregistré{managers.length > 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {isLoading ? (
              <div className="col-span-3 flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>
                Chargement...
              </div>
            ) : managers.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>
                <span className="text-4xl mb-2">👔</span>
                <span className="text-sm">Aucun manager trouvé</span>
              </div>
            ) : managers.map((u: User) => (
              <div
                key={u.id}
                className="card p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/salarie/${u.id}`)}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-xl mb-4">
                  {u.prenom[0]}{u.nom[0]}
                </div>
                <h3 className="font-bold text-base" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  {u.prenom} {u.nom}
                </h3>
                <p className="text-xs mt-1 mb-3" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                <span className={`badge ${
                  u.statutCompte === "VALIDE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {u.statutCompte}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagersPage;