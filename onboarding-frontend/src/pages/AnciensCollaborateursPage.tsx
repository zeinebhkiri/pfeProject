import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAnciensCollaborateursApi, reactiverUserApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import type { Task, Parcours, User } from "../types/auth";

type Entry = { salarie: User; parcours: Parcours | null; tasks: Task[] };

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  FORMATION: { label: "Formation", icon: "🎓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)" },
  QUIZ:      { label: "Quiz",      icon: "🧠", color: "#8DC63F", bg: "rgba(141,198,63,0.08)" },
  ENTRETIEN: { label: "Entretien", icon: "🤝", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  SIMPLE:    { label: "Tâche",     icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)" },
};

const STATUT_PARCOURS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  EN_COURS: { label: "En cours", color: "#2563eb", bg: "#eff6ff" },
  TERMINE:  { label: "Terminé",  color: "#059669", bg: "#ecfdf5" },
  EXPIRE:   { label: "Expiré",   color: "#dc2626", bg: "#fef2f2" },
};

const AnciensCollaborateursPage = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateId, setReactivateId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: entries = [], isLoading } = useQuery<Entry[]>({
    queryKey: ["archive-anciens-collaborateurs"],
    queryFn: getAnciensCollaborateursApi,
  });

  // Mutation de réactivation
  const reactiverMutation = useMutation({
    mutationFn: reactiverUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-anciens-collaborateurs"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      setSuccessMsg("✅ Compte réactivé avec succès ! Un email a été envoyé.");
      setShowReactivateModal(false);
      setReactivateId(null);
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error || "Erreur lors de la réactivation";
      setErrorMsg(msg);
      setShowReactivateModal(false);
      setTimeout(() => setErrorMsg(""), 5000);
    },
  });

  const handleReactivation = (id: string) => {
    setReactivateId(id);
    setShowReactivateModal(true);
  };

  const confirmReactivation = () => {
    if (reactivateId) {
      reactiverMutation.mutate(reactivateId);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter((e) => {
      const nom = `${e.salarie.prenom} ${e.salarie.nom}`.toLowerCase();
      return nom.includes(q) || e.salarie.email?.toLowerCase().includes(q);
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
              <span className="text-3xl">👥</span>
              <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "Sora" }}>
                Anciens collaborateurs
              </h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-600">
                {entries.length} désactivé{entries.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Comptes <strong className="text-red-600">désactivés</strong> — parcours et tâches consultables en lecture seule.
              Aucune connexion n'est possible pour ces utilisateurs. Vous pouvez les réactiver à tout moment.
            </p>
          </div>

          {/* ── Messages ── */}
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

          {/* ── Barre de recherche ── */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Rechercher un ancien collaborateur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition"
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
              <p className="text-slate-500 font-medium">Aucun ancien collaborateur trouvé</p>
              <p className="text-sm text-slate-400 mt-1">Modifiez votre recherche ou revenez plus tard</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((entry) => {
                const { salarie, parcours, tasks } = entry;
                const isOpen = expandedId === salarie.id;
                const statutInfo = parcours
                  ? STATUT_PARCOURS_LABEL[parcours.statut] ?? STATUT_PARCOURS_LABEL.EN_COURS
                  : null;
                const done = tasks.filter((t) => t.statut === "TERMINE").length;
                const total = tasks.length;

                return (
                  <div
                    key={salarie.id}
                    className="bg-white rounded-2xl border border-red-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                  >
                    {/* ── Ligne principale (cliquable) ── */}
                    <div
                      onClick={() => toggle(salarie.id)}
                      className="flex items-center gap-4 p-5 cursor-pointer hover:bg-red-50/50 transition"
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)" }}>
                        {salarie.prenom?.[0] ?? ""}{salarie.nom?.[0] ?? ""}
                      </div>

                      {/* Infos salarié */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-semibold text-slate-800 text-base" style={{ fontFamily: "Sora" }}>
                            {salarie.prenom} {salarie.nom}
                          </p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">
                            DÉSACTIVÉ
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReactivation(salarie.id);
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition hover:scale-105 flex items-center gap-1"
                            style={{ background: "#00AEEF" }}
                          >
                            🔄 Réactiver
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-slate-400">{salarie.email}</span>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-400">Rôle : {salarie.role}</span>
                        </div>
                      </div>

                      {/* Parcours summary */}
                      <div className="text-right">
                        {parcours ? (
                          <>
                            <span
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
                              style={{ background: statutInfo?.bg ?? "#f1f5f9", color: statutInfo?.color ?? "#64748b" }}
                            >
                              {statutInfo?.label ?? parcours.statut}
                            </span>
                            <p className="text-xs text-slate-400 mt-1">
                              {done}/{total} tâches · {parcours.progression}%
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Pas de parcours
                          </span>
                        )}
                      </div>

                      {/* Chevron */}
                      <div className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {/* ── Détail expansible ── */}
                    {isOpen && (
                      <div className="border-t border-red-100 p-5 bg-red-50/30">
                        {/* Infos profil */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                          {[
                            ["📞 Téléphone", salarie.profile?.telephone],
                            ["📍 Adresse", salarie.profile?.adresse],
                            ["📅 Date embauche", fmtDate(salarie.professionalInfo?.dateEmbauche)],
                            ["✉️ Email pro", salarie.professionalInfo?.emailProfessionnel],
                          ].map(([label, val]) => (
                            val ? (
                              <div key={label} className="bg-white rounded-xl border border-red-100 p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                  {label}
                                </p>
                                <p className="text-sm font-medium text-slate-700 truncate">
                                  {val}
                                </p>
                              </div>
                            ) : null
                          ))}
                        </div>

                        {/* Tâches */}
                        <p className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                          <span>📋</span> Tâches du parcours ({tasks.length}) — <span className="text-xs font-normal text-slate-400">lecture seule</span>
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
                                  className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3 hover:shadow-sm transition opacity-90"
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

      {/* ── Modal confirmation réactivation ── */}
      {showReactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReactivateModal(false)} />
          <div className="relative rounded-2xl shadow-2xl p-6 w-full mx-4 animate-fadeInUp"
            style={{ background: "var(--surface)", maxWidth: "400px", zIndex: 51 }}>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-blue-100">
                🔄
              </div>
            </div>
            <h3 className="text-xl font-bold text-center mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Réactiver le compte
            </h3>
            <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
              Ce collaborateur pourra à nouveau se connecter.
              <br />
              Un email de notification lui sera envoyé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmReactivation}
                disabled={reactiverMutation.isPending}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white transition hover:scale-105"
                style={{ background: "#00AEEF" }}
              >
                {reactiverMutation.isPending ? "Réactivation..." : "Oui, réactiver"}
              </button>
              <button
                onClick={() => setShowReactivateModal(false)}
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

export default AnciensCollaborateursPage;