import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPostesArchivesApi, restaurerPosteApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import type { Position } from "../types/auth";

const AdminPostesArchivesPage = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [restoreModalId, setRestoreModalId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: positions = [], isLoading } = useQuery<Position[]>({
    queryKey: ["postes-archives"],
    queryFn: getPostesArchivesApi,
  });

  const restaurerMutation = useMutation({
    mutationFn: restaurerPosteApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postes-archives"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setSuccessMsg("✅ Poste restauré avec succès !");
      setRestoreModalId(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error || "Erreur lors de la restauration";
      setErrorMsg(msg);
      setRestoreModalId(null);
      setTimeout(() => setErrorMsg(""), 3000);
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return positions;
    return positions.filter((p) => p.titre.toLowerCase().includes(q));
  }, [positions, search]);

  const handleRestaurer = (id: string) => setRestoreModalId(id);
  const confirmRestaurer = () => {
    if (restoreModalId) restaurerMutation.mutate(restoreModalId);
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#F8FAFC" }}>
      <Sidebar role={role as "ADMIN"} />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <div className="p-8">
          {/* En-tête */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">💼</span>
              <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "Sora" }}>
                Postes archivés
              </h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-600">
                {positions.length} archivé{positions.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Postes désactivés — ils ne sont plus disponibles pour les affectations.
              Vous pouvez les restaurer à tout moment.
            </p>
            <div className="mt-3">
              <a href="/admin/postes" className="text-sm text-[#00AEEF] hover:underline flex items-center gap-1">
                ← Retour aux postes actifs
              </a>
            </div>
          </div>

          {/* Messages */}
          {successMsg && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✅ {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Recherche */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Rechercher un poste archivé..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Liste */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 rounded-full animate-spin"
                style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-slate-500 font-medium">Aucun poste archivé trouvé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((position) => (
                <div key={position.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-slate-100">
                      💼
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800" style={{ fontFamily: "Sora" }}>
                          {position.titre}
                        </p>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600">
                          ARCHIVÉ
                        </span>
                      </div>
                      {position.description && (
                        <p className="text-sm text-slate-500 mt-1">{position.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestaurer(position.id)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:scale-105 flex items-center gap-2"
                    style={{ background: "#f59e0b" }}
                  >
                    🔓 Restaurer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal confirmation restauration */}
      {restoreModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRestoreModalId(null)} />
          <div className="relative rounded-2xl shadow-2xl p-6 w-full mx-4 animate-fadeInUp"
            style={{ background: "var(--surface)", maxWidth: "400px", zIndex: 51 }}>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-orange-100">🔓</div>
            </div>
            <h3 className="text-xl font-bold text-center mb-2">Restaurer le poste</h3>
            <p className="text-sm text-center mb-6 text-slate-500">
              Ce poste redeviendra disponible pour les affectations.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmRestaurer} disabled={restaurerMutation.isPending}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white transition hover:scale-105"
                style={{ background: "#f59e0b" }}>
                {restaurerMutation.isPending ? "Restauration..." : "Oui, restaurer"}
              </button>
              <button onClick={() => setRestoreModalId(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold transition hover:bg-slate-100"
                style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPostesArchivesPage;