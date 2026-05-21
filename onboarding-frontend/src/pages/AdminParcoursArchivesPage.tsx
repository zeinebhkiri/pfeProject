import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getParcoursTerminesApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import type { Task, Parcours, User } from "../types/auth";

type Entry = { parcours: Parcours; salarie: User | null; tasks: Task[] };

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  FORMATION: { label: "Formation", icon: "🎓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)" },
  QUIZ:      { label: "Quiz",      icon: "🧠", color: "#8DC63F", bg: "rgba(141,198,63,0.08)" },
  ENTRETIEN: { label: "Entretien", icon: "🤝", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  SIMPLE:    { label: "Tâche",     icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)" },
};

const AdminParcoursArchivesPage = () => {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: allEntries = [], isLoading } = useQuery<Entry[]>({
    queryKey: ["archive-parcours-termines"],
    queryFn: getParcoursTerminesApi,
  });
  
  // Filtrer pour garder uniquement les entrées avec un salarié existant
  const entries = useMemo(() => {
    return allEntries.filter(entry => entry.salarie !== null);
  }, [allEntries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter((e) => {
      const nom = `${e.salarie?.prenom ?? ""} ${e.salarie?.nom ?? ""}`.toLowerCase();
      return nom.includes(q) || e.salarie?.email?.toLowerCase().includes(q);
    });
  }, [entries, search]);

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("fr-FR") : "—";

  return (
    <div className="flex min-h-screen" style={{ background: "#F8FAFC" }}>
      <Sidebar role={role as "ADMIN"} />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <div className="p-8">
          {/* ── En-tête ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🗂️</span>
              <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "Sora" }}>
                Parcours archivés
              </h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-600">
                {entries.length} terminé{entries.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Tous les parcours dont le statut est <strong className="text-emerald-600">TERMINÉ</strong> — consultables en lecture seule.
            </p>
          </div>

          {/* ── Barre de recherche ── */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Rechercher un collaborateur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#00AEEF] focus:ring-1 focus:ring-[#00AEEF] transition"
              />
            </div>
          </div>

          {/* ── Contenu ── */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 rounded-full animate-spin"
                style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-slate-500 font-medium">Aucun parcours terminé trouvé</p>
              <p className="text-sm text-slate-400 mt-1">Modifiez votre recherche ou revenez plus tard</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((entry) => {
                const { parcours, salarie, tasks } = entry;
                const isOpen = expandedId === parcours.id;
                const done = tasks.filter((t) => t.statut === "TERMINE").length;
                const total = tasks.length;

                return (
                  <div
                    key={parcours.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                  >
                    {/* ── Ligne principale (cliquable) ── */}
                    <div
                      onClick={() => toggle(parcours.id)}
                      className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition"
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1A2B6B, #00AEEF)" }}>
                        {salarie
                          ? `${salarie.prenom?.[0] ?? ""}${salarie.nom?.[0] ?? ""}`
                          : "?"}
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-base" style={{ fontFamily: "Sora" }}>
                          {salarie ? `${salarie.prenom} ${salarie.nom}` : "Salarié inconnu"}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-slate-400">{salarie?.email ?? "—"}</span>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-400">
                            {fmtDate(parcours.dateDebut)} → {fmtDate(parcours.dateFin)}
                          </span>
                        </div>
                      </div>

                      {/* Statistiques */}
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">
                          <span>✅</span> Terminé
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {done}/{total} tâches
                        </p>
                      </div>

                      {/* Chevron */}
                      <div className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {/* ── Détail des tâches (expansible) ── */}
                    {isOpen && (
                      <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                        <p className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                          <span>📋</span> Tâches ({tasks.length})
                        </p>
                        {tasks.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">Aucune tâche enregistrée.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {tasks.map((task) => {
                              const cfg = TASK_TYPE_CONFIG[task.taskType] ?? TASK_TYPE_CONFIG.SIMPLE;
                              const isDone = task.statut === "TERMINE";
                              const statusLabel = isDone ? "Terminée" : task.statut === "EN_COURS" ? "En cours" : "Non commencée";
                              const statusColor = isDone ? "#059669" : task.statut === "EN_COURS" ? "#2563eb" : "#94a3b8";
                              const statusBg = isDone ? "#ecfdf5" : task.statut === "EN_COURS" ? "#eff6ff" : "#f1f5f9";

                              return (
                                <div
                                  key={task.id}
                                  className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3 hover:shadow-sm transition"
                                >
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                                    style={{ background: cfg.bg }}>
                                    {cfg.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 text-sm truncate">
                                      {task.titre}
                                    </p>
                                    <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                                      {cfg.label}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap"
                                    style={{ background: statusBg, color: statusColor }}>
                                    {statusLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminParcoursArchivesPage;