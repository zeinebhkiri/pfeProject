import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUserApi,
  getMyParcoursApi,
  getMyTasksApi,
  startTaskApi,
  submitQuizApi,
  submitDocumentTaskApi,
  completeTaskApi,
  addCommentTaskApi,
} from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import type { StatutCompte, UserProfile, UserRole, Task, TaskType, Parcours, Question } from "../types/auth";
import TopNav from "../components/TopNav";
import CompanyDocumentsWidget from "../components/CompanyDocumentsWidget";

// ── Configs visuelles ──────────────────────────────────────────────────
const statutConfig: Record<string, { label: string; class: string; icon: string }> = {
  EN_ATTENTE: { label: "En attente d'activation", class: "bg-amber-50 text-amber-700 border border-amber-200",   icon: "⏳" },
  ACCEPTE:    { label: "Profil en cours",          class: "bg-blue-50 text-blue-700 border border-blue-200",     icon: "📝" },
  VALIDE:     { label: "Compte validé ✓",          class: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: "✅" },
  DESACTIVE:  { label: "Compte désactivé",         class: "bg-slate-100 text-slate-500 border border-slate-200", icon: "🔒" },
  EXPIRE:     { label: "Délai expiré",             class: "bg-red-50 text-red-600 border border-red-200",        icon: "⚠️" },
};

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string; bg: string }> = {
  FORMATION:        { label: "Formation",         icon: "🎓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)"   },
  QUIZ:             { label: "Quiz",              icon: "🧠", color: "#8DC63F", bg: "rgba(141,198,63,0.08)"  },
  DOCUMENT_RH:      { label: "Document RH",       icon: "📄", color: "#1A2B6B", bg: "rgba(26,43,107,0.08)"  },
  DOCUMENT_SALARIE: { label: "Document à déposer",icon: "📎", color: "#d97706", bg: "rgba(217,119,6,0.08)"  },
  ENTRETIEN:        { label: "Entretien",         icon: "🤝", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  SIMPLE:           { label: "Tâche simple",      icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)"  },
};

const STATUT_TASK = {
  NON_COMMENCE: { label: "À faire",   color: "#94a3b8", bg: "#f1f5f9" },
  EN_COURS:     { label: "En cours",  color: "#2563eb", bg: "#eff6ff" },
  TERMINE:      { label: "Terminé",   color: "#059669", bg: "#ecfdf5" },
  REJETE:       { label: "Rejeté",    color: "#dc2626", bg: "#fef2f2" },
};

// ── Helpers ────────────────────────────────────────────────────────────
const detectMimeType = (base64: string): string => {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("JVBERi0")) return "application/pdf";
  return "application/octet-stream";
};

const openBase64 = (contenu: string, mimeType?: string) => {
  let base64 = contenu;
  if (base64.includes(",")) base64 = base64.split(",")[1];
  const padding = base64.length % 4;
  if (padding === 2) base64 += "==";
  else if (padding === 3) base64 += "=";
  const mime = mimeType || detectMimeType(base64);
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], { type: mime });
  const url = URL.createObjectURL(blob);
  if (mime === "application/pdf" || mime.startsWith("image/")) window.open(url, "_blank");
  else {
    const a = document.createElement("a");
    a.href = url; a.download = "document";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export interface User {
  id: string; nom: string; prenom: string; email: string;
  role: UserRole; statutCompte: StatutCompte; profilCompletion: number;
  profile?: UserProfile & { image?: string };
  dateCreation: string; dateValidation?: string; dateLimit?: string; poste?: string;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTask, setSelectedTask]     = useState<Task | null>(null);
  const [showTaskPanel, setShowTaskPanel]   = useState(false);
  const [quizReponses, setQuizReponses]     = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted]   = useState(false);
  const [quizResult, setQuizResult]         = useState<Task | null>(null);
  const [docFile, setDocFile]               = useState<File | null>(null);
  const [commentText, setCommentText]       = useState("");
  const [successMsg, setSuccessMsg]         = useState("");
  const [errorMsg, setErrorMsg]             = useState("");

  // ── Queries ───────────────────────────────────────────────────────
  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserApi,
  });

  const { data: parcours } = useQuery({
    queryKey: ["myParcours"],
    queryFn: getMyParcoursApi,
    retry: false,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["myTasks"],
    queryFn: getMyTasksApi,
    retry: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: startTaskApi,
    onSuccess: (t) => { queryClient.invalidateQueries({ queryKey: ["myTasks"] }); setSelectedTask(t); },
  });

  const quizMutation = useMutation({
    mutationFn: ({ taskId, reponses }: { taskId: string; reponses: number[] }) =>
      submitQuizApi(taskId, reponses),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["myParcours"] });
      setQuizResult(result); setQuizSubmitted(true); setSelectedTask(result);
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur quiz."),
  });

  const docMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      submitDocumentTaskApi(taskId, data),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      setSelectedTask(t); setDocFile(null);
      setSuccessMsg("Document déposé !");
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeTaskApi,
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["myParcours"] });
      setSelectedTask(t); setSuccessMsg("Tâche terminée !");
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      addCommentTaskApi(taskId, data),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      setSelectedTask(t); setCommentText("");
    },
  });

  // ── Helpers rôle / acteur ─────────────────────────────────────────
  const myTypeActeur = role === "MANAGER" ? "MANAGER" : role === "ADMIN" ? "RH" : "SALARIE";

  const canActOnTask = (task: Task): boolean =>
    task.typeActeurs?.includes(myTypeActeur as any) ?? false;

  const myProgressionDone = (task: Task): boolean => {
    if (!task.acteurProgressions) return false;
    return task.acteurProgressions
      .filter(ap => ap.typeActeur === myTypeActeur)
      .some(ap => ap.complete);
  };

  const canCompleteTask = (task: Task): boolean => {
    const acteurs = task.typeActeurs;
    if (acteurs.includes("SALARIE") && role !== "SALARIE") return false;
    if (acteurs.includes("MANAGER") && role !== "MANAGER") return false;
    if (acteurs.includes("RH") && role !== "ADMIN") return false;
    return true;
  };

  const isQuizLocked = (task: Task): boolean => {
    if (task.taskType !== "QUIZ") return false;
    if (!task.dateOuverture) return false;
    return new Date() < new Date(task.dateOuverture);
  };

  const getDaysUntilOuverture = (task: Task): number | null => {
    if (!task.dateOuverture) return null;
    const diffTime = new Date(task.dateOuverture).getTime() - Date.now();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const ACTEUR_LABELS: Record<string, string> = {
    SALARIE: "👤 Salarié",
    MANAGER: "👔 Manager",
    RH:      "🏢 RH",
  };

  // ── Handlers ──────────────────────────────────────────────────────
  const handleOpenTask = (task: Task) => {
    if (isQuizLocked(task)) {
      setErrorMsg(`Ce quiz sera disponible le ${new Date(task.dateOuverture!).toLocaleDateString('fr-FR')}`);
      return;
    }
    setSelectedTask(task);
    setShowTaskPanel(true);
    setQuizReponses([]); setQuizSubmitted(false); setQuizResult(null);
    setDocFile(null); setSuccessMsg(""); setErrorMsg("");
    if (task.statut === "NON_COMMENCE" && !task.verrouille && canActOnTask(task)) startMutation.mutate(task.id);
  };

  const handleQuizSubmit = () => {
    if (!selectedTask) return;
    const questions = selectedTask.config?.questions ?? [];
    if (quizReponses.length < questions.length) { setErrorMsg("Répondez à toutes les questions."); return; }
    quizMutation.mutate({ taskId: selectedTask.id, reponses: quizReponses });
  };

  const handleDocSubmit = () => {
    if (!selectedTask || !docFile) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      docMutation.mutate({ taskId: selectedTask.id, data: { contenu: base64, nom: docFile.name, mimeType: docFile.type } });
    };
    reader.readAsDataURL(docFile);
  };

  const tasksList    = tasks as Task[];
  const completed    = tasksList.filter(t => t.statut === "TERMINE").length;
  const total        = tasksList.length;
  const joursRestants = user?.dateLimit
    ? Math.ceil((new Date(user.dateLimit).getTime() - Date.now()) / 86400000)
    : null;
  const completion   = user?.profilCompletion ?? 0;
  const missingFields: string[] = [];
  if (!user?.profile?.adresse)   missingFields.push("adresse");
  if (!user?.profile?.rib)       missingFields.push("RIB");
  if (!user?.profile?.telephone) missingFields.push("téléphone");
  const missingCount = missingFields.length;

  if (isLoading) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin"
              style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Chargement...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav showSearch={false} />

        <div className="p-6 lg:p-8 space-y-6">

          {/* ── Hero ── */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            <div className="absolute inset-0 animate-gradient-x"
              style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 50%, #00AEEF 100%)", backgroundSize: "200% 200%" }} />
            <div className="absolute inset-0 opacity-5"
              style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10"
              style={{ background: "radial-gradient(circle, #00AEEF, transparent)", transform: "translate(30%,-30%)" }} />

            <div className="relative px-8 py-8 lg:px-12 lg:py-10">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {user?.profile?.image ? (
                    <img src={user.profile.image} alt="Photo"
                      className="w-24 h-24 rounded-2xl object-cover shadow-2xl ring-4"
                      style={{ "--tw-ring-color": "rgba(0,174,239,0.4)" } as any}
                      onError={(e) => e.currentTarget.style.display = "none"} />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-white font-bold text-4xl shadow-2xl backdrop-blur-sm"
                      style={{ background: "rgba(0,174,239,0.2)", border: "3px solid rgba(0,174,239,0.4)" }}>
                      {user?.prenom?.[0]}{user?.nom?.[0]}
                    </div>
                  )}
                </div>

                {/* Identity */}
                <div className="flex-1 text-white">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Sora" }}>
                      {user?.prenom} {user?.nom}
                    </h1>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.class} shadow-lg`}>
                      {statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.icon}
                      {statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.label}
                    </span>
                  </div>
                  <p className="text-sm flex items-center gap-2 mb-1" style={{ color: "rgba(168,216,234,0.85)" }}>
                    ✉️ {user?.email}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(168,216,234,0.55)" }}>
                    📅 {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>

                {/* Stats rapides si parcours */}
                {parcours && (
                  <div className="flex gap-3">
                    {[
                      { value: `${parcours.progression}%`, label: "Progression",  icon: "📊" },
                      { value: completed,                  label: "Terminées",     icon: "✅" },
                      { value: total - completed,          label: "Restantes",     icon: "⏳" },
                    ].map(s => (
                      <div key={s.label} className="text-center rounded-2xl px-4 py-3"
                        style={{ background: "rgba(0,174,239,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(0,174,239,0.25)" }}>
                        <span className="text-lg">{s.icon}</span>
                        <p className="text-white text-xl font-bold mt-0.5" style={{ fontFamily: "Sora" }}>{s.value}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(168,216,234,0.65)" }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Alertes ── */}
          {missingCount > 0 && user?.statutCompte !== "VALIDE" && user?.statutCompte !== "DESACTIVE" && (
            <div className="rounded-2xl p-5 border-l-4 border-amber-500"
              style={{ background: "linear-gradient(to right, #fffbeb, #fef3c7aa)" }}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-bold text-amber-700">Profil incomplet</p>
                    <p className="text-amber-600 text-sm">Manquant : {missingFields.join(", ")}</p>
                  </div>
                </div>
                <button onClick={() => navigate("/profile")}
                  className="px-4 py-2 bg-white rounded-xl text-sm font-medium text-amber-700 hover:shadow-md transition flex-shrink-0">
                  ✏️ Compléter
                </button>
              </div>
            </div>
          )}

          {joursRestants !== null && user?.statutCompte === "ACCEPTE" && completion < 100 && (
            <div className={`rounded-2xl p-5 border-l-4 ${joursRestants <= 0 ? "border-red-500" : joursRestants <= 1 ? "border-orange-500" : "border-amber-500"}`}
              style={{ background: joursRestants <= 0 ? "linear-gradient(to right,#fef2f2,#fee2e2aa)" : "linear-gradient(to right,#fffbeb,#fef3c7aa)" }}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{joursRestants <= 0 ? "🚨" : "⏰"}</span>
                  <div>
                    <p className={`font-bold ${joursRestants <= 0 ? "text-red-700" : "text-amber-700"}`}>
                      {joursRestants <= 0 ? "Action requise !" : `J-${joursRestants}`}
                    </p>
                    <p className={`text-sm ${joursRestants <= 0 ? "text-red-600" : "text-amber-600"}`}>
                      Date limite : {new Date(user!.dateLimit!).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate("/profile")}
                  className="px-4 py-2 bg-white rounded-xl text-sm font-medium text-slate-700 hover:shadow-md transition flex-shrink-0">
                  ✏️ Compléter
                </button>
              </div>
            </div>
          )}

          {user?.statutCompte === "VALIDE" && !parcours && (
            <div className="rounded-2xl p-5 border border-emerald-200"
              style={{ background: "linear-gradient(to right, #ecfdf5, #d1fae5aa)" }}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎉</span>
                <div>
                  <p className="font-bold text-emerald-800">Félicitations !</p>
                  <p className="text-emerald-700 text-sm">Votre compte a été validé. Bienvenue dans l'équipe ✨</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Layout principal : gauche = Parcours | droite = Documents ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ── Colonne gauche — Parcours ── */}
            <div className="lg:col-span-2">
              {!parcours ? (
                /* Pas de parcours → infos perso */
                <div className="space-y-5">
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF" }}>
                        <span className="text-xl">👤</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Informations personnelles</h2>
                        <p className="text-xs text-slate-400">Aucun parcours assigné pour le moment</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { icon: "👤", label: "Nom complet", value: `${user?.prenom} ${user?.nom}` },
                        { icon: "✉️", label: "Email",        value: user?.email },
                        { icon: "💼", label: "Rôle",         value: user?.role },
                        { icon: "📋", label: "Poste",        value: (user as any)?.poste || "Non affecté" },
                      ].map((f, i) => (
                        <div key={i} className="p-4 rounded-xl"
                          style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                          <span className="text-xl">{f.icon}</span>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{f.label}</p>
                          <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text)" }}>{f.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <button onClick={() => navigate("/profile")}
                        className="text-sm font-medium flex items-center gap-2" style={{ color: "#00AEEF" }}>
                        Voir mon profil complet →
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Parcours existant → timeline */
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-xl overflow-hidden">

                  {/* Header parcours */}
                  <div className="px-7 py-5 border-b flex items-center justify-between"
                    style={{ borderColor: "var(--border)", background: "rgba(0,174,239,0.02)" }}>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                        Mon parcours d'intégration
                      </h2>
                      <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {completed}/{total} tâches · débuté le {new Date(parcours.dateDebut).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    {/* Barre progression */}
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${parcours.progression}%`, background: parcours.progression === 100 ? "#8DC63F" : "#00AEEF" }} />
                      </div>
                      <span className="text-sm font-bold" style={{
                        color: parcours.progression === 100 ? "#8DC63F" : "#00AEEF", fontFamily: "Sora"
                      }}>
                        {parcours.progression}%
                      </span>
                    </div>
                  </div>

                  {/* Timeline des tâches */}
                  <div className="px-7 py-5 space-y-0">
                    {tasksList.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="text-4xl">📋</span>
                        <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>Aucune tâche</p>
                      </div>
                    ) : (
                      tasksList.map((task, index) => {
                        const typeConf   = TASK_TYPE_CONFIG[task.taskType];
                        const statutConf = STATUT_TASK[task.statut];
                        const isLast     = index === tasksList.length - 1;
                        const isLockedQuiz = isQuizLocked(task);
                        const isLocked   = task.verrouille || isLockedQuiz;
                        const isSelected = selectedTask?.id === task.id && showTaskPanel;
                        const iAmActeur  = canActOnTask(task);

                        return (
                          <div key={task.id} className="flex gap-4">
                            {/* Ligne timeline */}
                            <div className="flex flex-col items-center flex-shrink-0">
                              {/* Cercle statut */}
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all"
                                style={{
                                  background: isLocked ? "var(--border)"
                                    : task.statut === "TERMINE" ? "#8DC63F"
                                    : task.statut === "EN_COURS" ? "#00AEEF"
                                    : task.statut === "REJETE" ? "#dc2626"
                                    : typeConf.bg,
                                  border: isSelected ? `3px solid ${typeConf.color}` : "2px solid transparent",
                                  boxShadow: isSelected ? `0 0 0 3px ${typeConf.color}22` : "none",
                                }}>
                                {isLocked ? "🔒"
                                  : task.statut === "TERMINE" ? "✓"
                                  : task.statut === "REJETE" ? "✕"
                                  : typeConf.icon}
                              </div>
                              {/* Ligne verticale */}
                              {!isLast && (
                                <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-full"
                                  style={{ background: task.statut === "TERMINE" ? "#8DC63F" : "var(--border)" }} />
                              )}
                            </div>

                            {/* Contenu tâche */}
                            <div className={`flex-1 pb-5 ${isLast ? "" : ""}`}>
                              <div
                                onClick={() => !isLocked && handleOpenTask(task)}
                                className="rounded-2xl p-4 transition-all duration-200 group"
                                style={{
                                  cursor: isLocked ? "not-allowed" : "pointer",
                                  opacity: isLocked ? 0.5 : 1,
                                  background: isSelected ? `${typeConf.bg}` : "var(--bg)",
                                  border: isSelected
                                    ? `1.5px solid ${typeConf.color}44`
                                    : task.statut === "TERMINE"
                                    ? "1px solid rgba(141,198,63,0.2)"
                                    : "1px solid var(--border)",
                                }}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-semibold text-sm" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                                        {task.titre}
                                      </p>
                                      {task.obligatoire && (
                                        <span className="text-xs" style={{ color: "#dc2626" }}>*</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      <span className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: typeConf.bg, color: typeConf.color }}>
                                        {typeConf.icon} {typeConf.label}
                                      </span>
                                      <span className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: statutConf.bg, color: statutConf.color }}>
                                        {statutConf.label}
                                      </span>
                                      {task.echeance && task.statut !== "TERMINE" && (
                                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                          ⏱ {new Date(task.echeance).toLocaleDateString("fr-FR")}
                                        </span>
                                      )}
                                      {task.taskType === "QUIZ" && task.scoreObtenu !== undefined && task.scoreObtenu > 0 && (
                                        <span className="text-xs font-semibold"
                                          style={{ color: task.scoreObtenu >= (task.config?.scoreMinimum ?? 70) ? "#8DC63F" : "#dc2626" }}>
                                          {task.scoreObtenu}%
                                        </span>
                                      )}
                                      {/* Acteurs de la tâche */}
                                      {task.typeActeurs?.map(a => (
                                        <span key={a} className="text-xs px-1.5 py-0.5 rounded-full"
                                          style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                                          {ACTEUR_LABELS[a]}
                                        </span>
                                      ))}
                                      {!iAmActeur && (
                                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                                          style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }}>
                                          👁 Info
                                        </span>
                                      )}
                                      {isLockedQuiz && (
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">
                                          🔒 Disponible dans {getDaysUntilOuverture(task)} jour(s)
                                        </span>
                                      )}
                                    </div>
                                    {/* Description courte */}
                                    {task.description && (
                                      <p className="text-xs mt-1.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                                        {task.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Bouton action */}
                                  {!isLocked && task.statut !== "TERMINE" && (
                                    <button type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:scale-105"
                                      style={{ background: typeConf.bg, color: typeConf.color, border: `1px solid ${typeConf.color}33` }}>
                                      {task.statut === "EN_COURS" ? "Continuer →" : "Commencer →"}
                                    </button>
                                  )}
                                  {task.statut === "TERMINE" && (
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                      style={{ background: "#8DC63F" }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </div>
                                  )}
                                </div>

                                {/* Barre progression tâche */}
                                {task.statut === "EN_COURS" && task.progression > 0 && task.progression < 100 && (
                                  <div className="mt-3 w-full h-1 rounded-full" style={{ background: "var(--border)" }}>
                                    <div className="h-1 rounded-full transition-all"
                                      style={{ width: `${task.progression}%`, background: "#00AEEF" }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Colonne droite — Documents + Progression profil ── */}
            <div className="space-y-5">

              {/* Progression profil */}
              {completion < 100 && (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(141,198,63,0.1)" }}>
                      <span className="text-lg">📊</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Profil</h3>
                      <p className="text-xs text-slate-400">Complétion</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none"
                          stroke={completion === 100 ? "#8DC63F" : "#00AEEF"}
                          strokeWidth="3"
                          strokeDasharray={`${completion} 100`}
                          strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold" style={{ color: "#00AEEF" }}>{completion}%</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                        {missingCount} champ{missingCount > 1 ? "s" : ""} manquant{missingCount > 1 ? "s" : ""}
                      </p>
                      <button onClick={() => navigate("/profile")}
                        className="text-xs mt-1 font-medium" style={{ color: "#00AEEF" }}>
                        Compléter →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents entreprise */}
              <CompanyDocumentsWidget />
            </div>
          </div>
        </div>
      </main>

      {/* ── Panel tâche — drawer latéral ── */}
      {showTaskPanel && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-stretch justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTaskPanel(false)} />
          <div className="relative w-full lg:w-[520px] h-full overflow-y-auto shadow-2xl flex flex-col"
            style={{ background: "var(--surface)", zIndex: 51 }}>

            {/* Header drawer */}
            {(() => {
              const typeConf   = TASK_TYPE_CONFIG[selectedTask.taskType];
              const statutConf = STATUT_TASK[selectedTask.statut];
              const iAmActeur  = canActOnTask(selectedTask);
              return (
                <div className="px-6 py-5 border-b flex items-start gap-4 sticky top-0 z-10"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: typeConf.bg }}>
                    {typeConf.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      {selectedTask.titre}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: statutConf.bg, color: statutConf.color }}>
                        {statutConf.label}
                      </span>
                      {selectedTask.echeance && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          ⏱ {new Date(selectedTask.echeance).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {selectedTask.typeActeurs?.map(a => (
                        <span key={a} className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                          {ACTEUR_LABELS[a]}
                        </span>
                      ))}
                      {!iAmActeur && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }}>
                          👁 Info
                        </span>
                      )}
                    </div>
                    {/* Progression multi-acteur */}
                    {selectedTask.acteurProgressions && selectedTask.acteurProgressions.length > 1 && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {selectedTask.acteurProgressions.map((ap, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
                            style={{
                              background: ap.complete ? "rgba(141,198,63,0.1)" : "var(--bg)",
                              border: `1px solid ${ap.complete ? "rgba(141,198,63,0.3)" : "var(--border)"}`,
                            }}>
                            <span className="text-xs">{ap.complete ? "✅" : "⏳"}</span>
                            <span className="text-xs" style={{ color: ap.complete ? "#8DC63F" : "var(--text-muted)" }}>
                              {ACTEUR_LABELS[ap.typeActeur]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowTaskPanel(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                    ✕
                  </button>
                </div>
              );
            })()}

            {/* Contenu drawer */}
            <div className="flex-1 p-6 space-y-5">

              {/* Messages */}
              {successMsg && (
                <div className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
                  ✅ {successMsg}
                  <button type="button" onClick={() => setSuccessMsg("")} className="ml-2 opacity-60">✕</button>
                </div>
              )}
              {errorMsg && (
                <div className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                  ⚠️ {errorMsg}
                  <button type="button" onClick={() => setErrorMsg("")} className="ml-2 opacity-60">✕</button>
                </div>
              )}

              {/* Description */}
              {selectedTask.description && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{selectedTask.description}</p>
              )}

              {/* ── Tâche informative (je ne suis pas acteur) ── */}
              {!canActOnTask(selectedTask) && selectedTask.statut !== "TERMINE" && (
                <div className="p-5 rounded-2xl text-center space-y-2"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="text-3xl">👁</span>
                  <p className="font-semibold text-sm" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                    Cette tâche est gérée par {selectedTask.typeActeurs?.map(a => ACTEUR_LABELS[a]).join(" et ")}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Elle contribuera automatiquement à votre progression une fois complétée.
                  </p>
                </div>
              )}

              {/* ── FORMATION ── */}
              {selectedTask.taskType === "FORMATION" && canActOnTask(selectedTask) && (
                <div className="space-y-4">
                  {selectedTask.config?.videoUrl && (
                    selectedTask.config.videoUrl.includes("youtube") || selectedTask.config.videoUrl.includes("youtu.be") ? (
                      <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                        <iframe
                          src={selectedTask.config.videoUrl.replace("watch?v=","embed/").replace("youtu.be/","www.youtube.com/embed/")}
                          className="w-full h-full" allowFullScreen title="Formation" />
                      </div>
                    ) : (
                      <a href={selectedTask.config.videoUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 rounded-xl"
                        style={{ background: "rgba(0,174,239,0.06)", border: "1px solid rgba(0,174,239,0.2)", color: "#00AEEF" }}>
                        <span className="text-2xl">▶️</span>
                        <span className="font-medium text-sm">Regarder la vidéo</span>
                      </a>
                    )
                  )}
                  {selectedTask.config?.fichierContenu && (
                    <button type="button"
                      onClick={() => openBase64(selectedTask.config!.fichierContenu!, selectedTask.config?.fichierMimeType)}
                      className="flex items-center gap-3 p-4 rounded-xl w-full text-left"
                      style={{ background: "rgba(26,43,107,0.06)", border: "1px solid rgba(26,43,107,0.15)", color: "#1A2B6B" }}>
                      <span className="text-2xl">📄</span>
                      <span className="font-medium text-sm flex-1">{selectedTask.config.fichierNom || "Document"}</span>
                      <span className="text-xs opacity-60">Ouvrir</span>
                    </button>
                  )}
                  {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && canCompleteTask(selectedTask) && (
                    <button type="button" onClick={() => completeMutation.mutate(selectedTask.id)}
                      disabled={completeMutation.isPending} className="btn-primary w-full py-3">
                      {completeMutation.isPending ? "..." : "✅ Marquer la formation comme vue"}
                    </button>
                  )}
                  {myProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                    <div className="p-3 rounded-xl text-sm text-center"
                      style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                      ✅ Votre part est complète — en attente des autres acteurs
                    </div>
                  )}
                </div>
              )}

              {/* ── QUIZ ── */}
              {selectedTask.taskType === "QUIZ" && canActOnTask(selectedTask) && (() => {
                if (isQuizLocked(selectedTask)) {
                  const daysLeft = getDaysUntilOuverture(selectedTask);
                  const ouvertureDate = new Date(selectedTask.dateOuverture!);
                  return (
                    <div className="p-6 rounded-2xl text-center space-y-4"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto"
                        style={{ background: "rgba(245,158,11,0.1)" }}>🔒</div>
                      <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>Quiz non disponible</h3>
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        Disponible dans <strong className="text-orange-500">{daysLeft} jour{daysLeft && daysLeft > 1 ? "s" : ""}</strong>
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Ouverture : {ouvertureDate.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                        Score minimum : <span style={{ color: "#8DC63F" }}>{selectedTask.config?.scoreMinimum ?? 70}%</span>
                      </p>
                      {selectedTask.nbTentatives > 0 && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Tentative {selectedTask.nbTentatives} / 3
                        </span>
                      )}
                    </div>

                    {/* Bloqué après 3 tentatives */}
                    {selectedTask.nbTentatives >= 3 && selectedTask.statut !== "TERMINE" && (
                      <div className="p-3 rounded-xl text-sm text-center"
                        style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                        ⚠️ Nombre maximum de tentatives atteint (3/3). Quiz bloqué.
                      </div>
                    )}

                    {/* Résultat précédent */}
                    {selectedTask.scoreObtenu !== undefined && selectedTask.scoreObtenu > 0 && !quizSubmitted && (
                      <div className="rounded-xl p-3"
                        style={{
                          background: selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#ecfdf5" : "#fef2f2",
                          border: `1px solid ${selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#a7f3d0" : "#fecaca"}`,
                        }}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-sm font-semibold"
                            style={{ color: selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#059669" : "#dc2626" }}>
                            {selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70)
                              ? `✅ Réussi — ${selectedTask.scoreObtenu}%`
                              : `❌ ${selectedTask.scoreObtenu}% — Score insuffisant`}
                          </p>
                          {selectedTask.scoreObtenu < (selectedTask.config?.scoreMinimum ?? 70) &&
                           selectedTask.statut !== "TERMINE" &&
                           !myProgressionDone(selectedTask) &&
                           selectedTask.nbTentatives < 3 && (
                            <button type="button"
                              onClick={() => { setQuizReponses([]); setQuizSubmitted(false); setQuizResult(null); setErrorMsg(""); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                              🔄 Réessayer ({selectedTask.nbTentatives + 1}/3)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Questions */}
                    {selectedTask.statut !== "TERMINE" &&
                     !myProgressionDone(selectedTask) &&
                     !quizSubmitted &&
                     (selectedTask.scoreObtenu === undefined || selectedTask.scoreObtenu < (selectedTask.config?.scoreMinimum ?? 70)) &&
                     selectedTask.nbTentatives < 3 && (
                      <>
                        {(selectedTask.config?.questions ?? []).map((q: Question, qIndex: number) => (
                          <div key={q.id} className="p-4 rounded-2xl space-y-3"
                            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                              {qIndex + 1}. {q.texte}
                            </p>
                            <div className="space-y-2">
                              {q.options.map((opt: string, oIndex: number) => (
                                <label key={oIndex}
                                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition"
                                  style={{
                                    background: quizReponses[qIndex] === oIndex ? "rgba(0,174,239,0.08)" : "var(--surface)",
                                    border: `1px solid ${quizReponses[qIndex] === oIndex ? "rgba(0,174,239,0.3)" : "var(--border)"}`,
                                  }}>
                                  <input type="radio" name={`q${qIndex}`}
                                    checked={quizReponses[qIndex] === oIndex}
                                    onChange={() => {
                                      const rep = [...quizReponses]; rep[qIndex] = oIndex; setQuizReponses(rep);
                                    }}
                                    style={{ accentColor: "#00AEEF" }} />
                                  <span className="text-sm" style={{ color: "var(--text)" }}>
                                    <strong style={{ color: "var(--text-muted)" }}>{String.fromCharCode(65 + oIndex)}.</strong> {opt}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={handleQuizSubmit}
                          disabled={quizMutation.isPending || quizReponses.length < (selectedTask.config?.questions?.length ?? 0)}
                          className="btn-primary w-full py-3">
                          {quizMutation.isPending ? "Correction..." : "🚀 Soumettre"}
                        </button>
                      </>
                    )}

                    {/* Résultat soumission */}
                    {quizSubmitted && quizResult && (
                      <div className="rounded-2xl p-5 text-center space-y-2"
                        style={{
                          background: quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#ecfdf5" : "#fef2f2",
                          border: `1px solid ${quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#a7f3d0" : "#fecaca"}`,
                        }}>
                        <div className="text-4xl">{quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "🎉" : "😕"}</div>
                        <p className="text-2xl font-bold" style={{
                          color: quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#059669" : "#dc2626",
                          fontFamily: "Sora"
                        }}>{quizResult.scoreObtenu}%</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Minimum : {quizResult.config?.scoreMinimum ?? 70}% · Tentative {quizResult.nbTentatives}/3
                        </p>
                        {quizResult.statut !== "TERMINE" && !myProgressionDone(quizResult) && quizResult.nbTentatives < 3 && (
                          <button type="button" onClick={() => { setQuizReponses([]); setQuizSubmitted(false); setQuizResult(null); }}
                            className="btn-primary px-5 py-2 mt-2">
                            Réessayer (Tentative {quizResult.nbTentatives + 1}/3)
                          </button>
                        )}
                        {quizResult.nbTentatives >= 3 && quizResult.statut !== "TERMINE" && (
                          <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>
                            ⚠️ Nombre maximum de tentatives atteint.
                          </p>
                        )}
                        {myProgressionDone(quizResult) && quizResult.statut !== "TERMINE" && (
                          <p className="text-sm" style={{ color: "#059669" }}>✅ Votre part est complète — en attente des autres acteurs</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── DOCUMENT_RH ── */}
              {selectedTask.taskType === "DOCUMENT_RH" && canActOnTask(selectedTask) && (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Document mis à disposition par les RH.
                  </p>
                  {selectedTask.config?.documentContenu ? (
                    <button type="button"
                      onClick={() => openBase64(selectedTask.config!.documentContenu!, selectedTask.config?.documentMimeType)}
                      className="flex items-center gap-3 p-4 rounded-xl w-full text-left"
                      style={{ background: "rgba(26,43,107,0.06)", border: "1px solid rgba(26,43,107,0.2)", color: "#1A2B6B" }}>
                      <span className="text-2xl">📄</span>
                      <span className="font-medium text-sm flex-1">{selectedTask.config.documentNom || "Document"}</span>
                      <span className="text-xs opacity-60">Ouvrir</span>
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl text-sm" style={{ background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
                      Document en cours de mise à disposition...
                    </div>
                  )}
                  {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && canCompleteTask(selectedTask) && (
                    <button type="button" onClick={() => completeMutation.mutate(selectedTask.id)}
                      disabled={completeMutation.isPending} className="btn-primary w-full py-3">
                      {completeMutation.isPending ? "..." : "✅ Confirmer la lecture"}
                    </button>
                  )}
                  {myProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                    <div className="p-3 rounded-xl text-sm text-center"
                      style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                      ✅ Lu — en attente des autres acteurs
                    </div>
                  )}
                </div>
              )}

              {/* ── DOCUMENT_SALARIE ── */}
              {selectedTask.taskType === "DOCUMENT_SALARIE" && canActOnTask(selectedTask) && (
                <div className="space-y-3">
                  {selectedTask.config?.typeDocumentAttendu && (
                    <div className="p-3 rounded-xl text-sm"
                      style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", color: "#d97706" }}>
                      📌 Attendu : <strong>{selectedTask.config.typeDocumentAttendu}</strong>
                    </div>
                  )}
                  {selectedTask.documentNom && (
                    <div className="flex items-center gap-2 p-3 rounded-xl"
                      style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                      <span>📎</span>
                      <span className="text-sm font-medium text-emerald-700 flex-1">{selectedTask.documentNom}</span>
                      <span className="text-xs text-emerald-600">Déposé ✓</span>
                    </div>
                  )}
                  {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && (
                    <>
                      <label className="flex items-center justify-center gap-3 w-full py-4 rounded-xl cursor-pointer"
                        style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-sm font-medium" style={{ color: "#00AEEF" }}>
                          {docFile ? docFile.name : "Choisir un fichier"}
                        </span>
                        <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} className="hidden" />
                      </label>
                      <button type="button" onClick={handleDocSubmit}
                        disabled={!docFile || docMutation.isPending} className="btn-primary w-full py-3">
                        {docMutation.isPending ? "Dépôt..." : "⬆ Déposer"}
                      </button>
                      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                        Validé par {selectedTask.typeActeurs?.filter(a => a !== "SALARIE").map(a => ACTEUR_LABELS[a]).join(" / ") || "le responsable"}
                      </p>
                    </>
                  )}
                  {myProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                    <div className="p-3 rounded-xl text-sm text-center"
                      style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                      ✅ Document déposé — en attente de validation
                    </div>
                  )}
                </div>
              )}

              {/* ── ENTRETIEN ── */}
              {selectedTask.taskType === "ENTRETIEN" && (
                <div className="space-y-3">
                  {selectedTask.dateEntretien ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl"
                      style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
                      <span className="text-2xl">📅</span>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#7c3aed" }}>Date planifiée</p>
                        <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                          {new Date(selectedTask.dateEntretien).toLocaleDateString("fr-FR", {
                            weekday: "long", day: "2-digit", month: "long", year: "numeric"
                          })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl text-sm"
                      style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "#d97706" }}>
                      ⏳ En attente de planification par votre manager
                    </div>
                  )}
                  {selectedTask.config?.dureeMinutes && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                      ⏱ Durée : {selectedTask.config.dureeMinutes} min
                      {selectedTask.config?.lieu && ` · 📍 ${selectedTask.config.lieu}`}
                    </div>
                  )}
                  {selectedTask.documentEntretienContenu && (
                    <button type="button"
                      onClick={() => openBase64(selectedTask.documentEntretienContenu!, selectedTask.documentEntretienMimeType)}
                      className="flex items-center gap-3 p-3 rounded-xl w-full text-left"
                      style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)", color: "#7c3aed" }}>
                      <span className="text-xl">📄</span>
                      <span className="text-sm flex-1">{selectedTask.documentEntretienNom}</span>
                      <span className="text-xs opacity-60">Consulter</span>
                    </button>
                  )}
                  <div className="p-3 rounded-xl text-xs text-center"
                    style={{ background: "rgba(124,58,237,0.04)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.15)" }}>
                    {selectedTask.statut === "TERMINE" ? "✅ Entretien validé" : "⏳ Validation par votre manager après l'entretien"}
                  </div>
                </div>
              )}

              {/* ── SIMPLE ── */}
              {selectedTask.taskType === "SIMPLE" && canActOnTask(selectedTask) && (
                <div className="space-y-3">
                  {selectedTask.config?.datePlanifiee && (
                    <div className="p-3 rounded-xl text-sm"
                      style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.15)", color: "#059669" }}>
                      📅 {new Date(selectedTask.config.datePlanifiee).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                  {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && canCompleteTask(selectedTask) && (
                    <button type="button" onClick={() => completeMutation.mutate(selectedTask.id)}
                      disabled={completeMutation.isPending} className="btn-primary w-full py-3">
                      {completeMutation.isPending ? "..." : "✅ Marquer comme effectué"}
                    </button>
                  )}
                  {myProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                    <div className="p-3 rounded-xl text-sm text-center"
                      style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                      ✅ Effectué — en attente des autres acteurs
                    </div>
                  )}
                  {selectedTask.statut === "TERMINE" && (
                    <div className="p-3 rounded-xl text-sm text-center"
                      style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669" }}>
                      ✓ Effectué{selectedTask.dateCompletion
                        ? ` le ${new Date(selectedTask.dateCompletion).toLocaleDateString("fr-FR")}`
                        : ""}
                    </div>
                  )}
                </div>
              )}

              {/* ── Commentaires ── */}
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>💬 Commentaires</p>
                {selectedTask.commentaires.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun commentaire</p>
                ) : (
                  <div className="space-y-2">
                    {selectedTask.commentaires.map((c, i) => (
                      <div key={i} className="p-3 rounded-xl"
                        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{c.auteurNom}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{new Date(c.date).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <p className="text-xs" style={{ color: "var(--text)" }}>{c.texte}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Ajouter un commentaire..."
                    className="input-field flex-1 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && commentText.trim() &&
                      commentMutation.mutate({ taskId: selectedTask.id, data: { auteurId: userId!, auteurNom: "Moi", texte: commentText } })} />
                  <button type="button"
                    onClick={() => commentText.trim() && commentMutation.mutate({ taskId: selectedTask.id, data: { auteurId: userId!, auteurNom: "Moi", texte: commentText } })}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="btn-primary px-4 py-2 text-sm">
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x { animation: gradient-x 15s ease infinite; }
      `}</style>
    </div>
  );
};

export default DashboardPage;