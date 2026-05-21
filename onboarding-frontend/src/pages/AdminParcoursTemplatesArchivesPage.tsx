import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getModelesArchivesApi, restaurerModeleApi, getTaskTemplatesApi ,getPositionsApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import type { ParcoursTemplate, TaskTemplate } from "../types/auth";

const AdminParcoursTemplatesArchivesPage = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoreModalId, setRestoreModalId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: templates = [], isLoading } = useQuery<ParcoursTemplate[]>({
    queryKey: ["modeles-archives"],
    queryFn: getModelesArchivesApi,
  });

  // 🔥 Récupérer les tâches pour TOUS les modèles au chargement
  const { data: allTasksMap = {}, refetch } = useQuery({
    queryKey: ["archives-all-tasks"],
    queryFn: async () => {
      const tasksMap: Record<string, TaskTemplate[]> = {};
      for (const template of templates) {
        try {
          const tasks = await getTaskTemplatesApi(template.id);
          tasksMap[template.id] = tasks;
        } catch (error) {
          console.error(`Erreur chargement tâches pour ${template.id}:`, error);
          tasksMap[template.id] = [];
        }
      }
      return tasksMap;
    },
    enabled: templates.length > 0, // Ne charger que quand les templates sont disponibles
  });
  const { data: positions = [] } = useQuery({
  queryKey: ["positions"],
  queryFn: getPositionsApi,
});
  const getPositionTitre = (positionId: string) => {
    const position = positions.find((p: any) => p.id === positionId);
    return position?.titre || "Poste inconnu";
  };

  const restaurerMutation = useMutation({
    mutationFn: restaurerModeleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modeles-archives"] });
      queryClient.invalidateQueries({ queryKey: ["parcoursTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["archives-all-tasks"] });
      setSuccessMsg("✅ Modèle restauré avec succès !");
      setRestoreModalId(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error || "Erreur lors de la restauration";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4000);
      setRestoreModalId(null);
    },
  });

  const handleRestaurer = (id: string) => {
    setRestoreModalId(id);
  };

  const confirmRestaurer = () => {
    if (restoreModalId) {
      restaurerMutation.mutate(restoreModalId);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter((t) => t.titre.toLowerCase().includes(q));
  }, [templates, search]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // 🔥 Récupérer les tâches pour un modèle (depuis le cache)
  const getTasksForTemplate = (templateId: string): TaskTemplate[] => {
    return allTasksMap[templateId] || [];
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#F8FAFC" }}>
      <Sidebar role={role as "ADMIN"} />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <div className="p-8">
          {/* En-tête */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🗂️</span>
              <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "Sora" }}>
                Modèles de parcours archivés
              </h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-600">
                {templates.length} archivé{templates.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Modèles désactivés — ils ne sont plus disponibles pour créer de nouveaux parcours.
              Vous pouvez les restaurer à tout moment.
            </p>
            <div className="mt-3">
              <a
                href="/admin/parcours"
                className="text-sm text-[#00AEEF] hover:underline flex items-center gap-1"
              >
                ← Retour aux modèles actifs
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
                placeholder="Rechercher un modèle archivé..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition"
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
              <p className="text-slate-500 font-medium">Aucun modèle archivé trouvé</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((template) => {
                const tasks = getTasksForTemplate(template.id);
                const tasksCount = tasks.length;

                return (
                  <div
                    key={template.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                  >
                    {/* Ligne principale */}
                    <div
                      onClick={() => toggleExpand(template.id)}
                      className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition"
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-slate-100">
                        📋
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-semibold text-slate-800 text-base" style={{ fontFamily: "Sora" }}>
                            {template.titre}
                          </p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600">
                            ARCHIVÉ
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
      💼 {getPositionTitre(template.positionId)} • {template.description || "Aucune description"}
    </p>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        {tasksCount} tâche{tasksCount > 1 ? "s" : ""}
                      </div>
                      <div className={`text-slate-400 transition-transform duration-200 ${expandedId === template.id ? "rotate-180" : ""}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {/* Détail expansible avec les tâches */}
                    {expandedId === template.id && (
                      <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-slate-600 mb-2">📋 Description</p>
                          <p className="text-sm text-slate-600">{template.description || "Aucune description"}</p>
                        </div>

                        {/* Affichage des tâches */}
                        {tasks.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-semibold text-slate-600 mb-2">📌 Tâches du modèle ({tasks.length})</p>
                            <div className="space-y-2">
                              {tasks.map((task, idx) => (
                                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100">
                                  <span className="text-sm font-medium text-slate-400 w-6">{idx + 1}</span>
                                  <span className="text-sm text-slate-700">{task.titre}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-auto">
                                    {task.taskType}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-3 border-t border-slate-100">
                          <button
                            onClick={() => handleRestaurer(template.id)}
                            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition hover:scale-105 flex items-center gap-2"
                            style={{ background: "#f59e0b" }}
                          >
                            🔓 Restaurer ce modèle
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal de confirmation restauration */}
      {restoreModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRestoreModalId(null)} />
          <div className="relative rounded-2xl shadow-2xl p-6 w-full mx-4 animate-fadeInUp"
            style={{ background: "var(--surface)", maxWidth: "400px", zIndex: 51 }}>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-orange-100">
                🔓
              </div>
            </div>
            <h3 className="text-xl font-bold text-center mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Restaurer le modèle
            </h3>
            <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
              Ce modèle redeviendra disponible pour créer de nouveaux parcours.
              <br />
              Les parcours existants ne seront pas affectés.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmRestaurer}
                disabled={restaurerMutation.isPending}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white transition hover:scale-105"
                style={{ background: "#f59e0b" }}
              >
                {restaurerMutation.isPending ? "Restauration..." : "Oui, restaurer"}
              </button>
              <button
                onClick={() => setRestoreModalId(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold transition hover:bg-slate-100"
                style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AdminParcoursTemplatesArchivesPage;