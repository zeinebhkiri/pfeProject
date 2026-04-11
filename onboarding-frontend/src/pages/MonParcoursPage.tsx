import { useState, type JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
import {
  type Task,
  type TaskType,
  type Question,
} from "../types/auth";

// ── Configs visuelles ──────────────────────────────────────────────────
const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string; bg: string }> = {
  FORMATION:        { label: "Formation",         icon: "🎓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)"   },
  QUIZ:             { label: "Quiz",              icon: "🧠", color: "#8DC63F", bg: "rgba(141,198,63,0.08)"  },
  DOCUMENT_RH:      { label: "Document RH",       icon: "📄", color: "#1A2B6B", bg: "rgba(26,43,107,0.08)"  },
  DOCUMENT_SALARIE: { label: "Document à déposer",icon: "📎", color: "#d97706", bg: "rgba(217,119,6,0.08)"  },
  ENTRETIEN:        { label: "Entretien",         icon: "🤝", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  SIMPLE:           { label: "Tâche simple",      icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)"  },
};

const STATUT_CONFIG = {
  NON_COMMENCE: { label: "À faire",  color: "#94a3b8", bg: "#f1f5f9" },
  EN_COURS:     { label: "En cours", color: "#2563eb", bg: "#eff6ff" },
  TERMINE:      { label: "Terminé",  color: "#059669", bg: "#ecfdf5" },
  REJETE:       { label: "Rejeté",   color: "#dc2626", bg: "#fef2f2" },
};

const ACTEUR_LABELS: Record<string, string> = {
  SALARIE: "👤 Salarié",
  MANAGER: "👔 Manager",
  RH:      "🏢 RH",
};
const PHASES = [
  { value: "PHASE_1", label: "Phase 1 — Pré-onboarding",      color: "#1A2B6B", bg: "rgba(26,43,107,0.08)"  },
  { value: "PHASE_2", label: "Phase 2 — Intégration",          color: "#00AEEF", bg: "rgba(0,174,239,0.08)"  },
  { value: "PHASE_3", label: "Phase 3 — Montée en compétence", color: "#8DC63F", bg: "rgba(141,198,63,0.08)" },
  { value: "PHASE_4", label: "Phase 4 — Validation",           color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
];
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

const MonParcoursPage = () => {
  const { role, userId } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [quizReponses, setQuizReponses] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<Task | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [commentText, setCommentText] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Déterminer le typeActeur courant selon le rôle ─────────────────
  const myTypeActeur = role === "MANAGER" ? "MANAGER" : role === "ADMIN" ? "RH" : "SALARIE";

  // ── Queries ───────────────────────────────────────────────────────
  const { data: parcours, isLoading: loadingParcours } = useQuery({
    queryKey: ["myParcours"],
    queryFn: getMyParcoursApi,
    retry: false,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["myTasks"],
    queryFn: getMyTasksApi,
    retry: false,
  });
const getEcheanceConfig = (echeance?: string, statut?: string) => {
  if (!echeance || statut === "TERMINE" || statut === "REJETE") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(echeance);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0)  return { label: `Retard J+${Math.abs(diff)}`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", pulse: false, blink: true  };
  if (diff === 0) return { label: "Aujourd'hui",                color: "#dc2626", bg: "#fef2f2", border: "#fecaca", pulse: true,  blink: false };
  if (diff === 1) return { label: "Demain J-1",                 color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", pulse: true,  blink: false };
  if (diff <= 2)  return { label: `J-${diff}`,                  color: "#d97706", bg: "#fffbeb", border: "#fde68a", pulse: false, blink: false };
  if (diff <= 6)  return { label: `J-${diff}`,                  color: "#ca8a04", bg: "#fefce8", border: "#fef08a", pulse: false, blink: false };
  return           { label: `J-${diff}`,                        color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", pulse: false, blink: false };
};
  // ── Mutations ─────────────────────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: startTaskApi,
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      setSelectedTask(updatedTask);
    },
  });

  const quizMutation = useMutation({
    mutationFn: ({ taskId, reponses }: { taskId: string; reponses: number[] }) =>
      submitQuizApi(taskId, reponses),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["myParcours"] });
      setQuizResult(result);
      setQuizSubmitted(true);
      setSelectedTask(result);
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur soumission quiz."),
  });

  const docMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      submitDocumentTaskApi(taskId, data),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["myParcours"] });
      setSelectedTask(updatedTask);
      setDocFile(null);
      setSuccessMsg("Document déposé avec succès !");
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur dépôt document."),
  });

  const completeMutation = useMutation({
    mutationFn: completeTaskApi,
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["myParcours"] });
      setSelectedTask(updatedTask);
      setSuccessMsg("Tâche marquée comme terminée !");
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      addCommentTaskApi(taskId, data),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      setSelectedTask(updatedTask);
      setCommentText("");
    },
  });


  // ── Helpers ───────────────────────────────────────────────────────

  /** Est-ce que l'utilisateur courant est un acteur de cette tâche ? */
  const canActOnTask = (task: Task): boolean => {
    return task.typeActeurs?.includes(myTypeActeur as any) ?? false;
  };

  /**
   * Est-ce que la part du salarié dans cette tâche est déjà faite ?
   * Utilisé pour éviter de re-soumettre un quiz déjà réussi.
   */
  const myProgressionDone = (task: Task): boolean => {
    if (!task.acteurProgressions) return false;
    return task.acteurProgressions
      .filter(ap => ap.typeActeur === myTypeActeur)
      .some(ap => ap.complete);
  };
  // ── Vérifier si un quiz est verrouillé (date d'ouverture non atteinte) ──
const isQuizLocked = (task: Task): boolean => {
  if (task.taskType !== "QUIZ") return false;
  if (!task.dateOuverture) return false;
  
  const now = new Date();
  const ouverture = new Date(task.dateOuverture);
  return now < ouverture;
};

const getDaysUntilOuverture = (task: Task): number | null => {
  if (!task.dateOuverture) return null;
  const now = new Date();
  const ouverture = new Date(task.dateOuverture);
  const diffTime = ouverture.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

  // ── Handlers ──────────────────────────────────────────────────────
  const handleOpenTask = (task: Task) => {
      // ⭐ Vérifier si le quiz est verrouillé
  if (isQuizLocked(task)) {
    setErrorMsg(`Ce quiz sera disponible le ${new Date(task.dateOuverture!).toLocaleDateString('fr-FR')}`);
    return;
  }
    setSelectedTask(task);
    setQuizReponses([]);
    setQuizSubmitted(false);
    setQuizResult(null);
    setDocFile(null);
    setSuccessMsg("");
    setErrorMsg("");
    // Démarrer automatiquement si NON_COMMENCE et que je suis acteur
    if (task.statut === "NON_COMMENCE" && !task.verrouille && canActOnTask(task)) {
      startMutation.mutate(task.id);
    }
  };

  const handleQuizSubmit = () => {
    if (!selectedTask) return;
    const questions = selectedTask.config?.questions ?? [];
    if (quizReponses.length < questions.length) {
      setErrorMsg("Veuillez répondre à toutes les questions.");
      return;
    }
    quizMutation.mutate({ taskId: selectedTask.id, reponses: quizReponses });
  };

  const handleDocSubmit = () => {
    if (!selectedTask || !docFile) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      docMutation.mutate({
        taskId: selectedTask.id,
        data: { contenu: base64, nom: docFile.name, mimeType: docFile.type },
      });
    };
    reader.readAsDataURL(docFile);
  };

  const handleAddComment = () => {
    if (!selectedTask || !commentText.trim()) return;
    commentMutation.mutate({
      taskId: selectedTask.id,
      data: { auteurId: userId!, auteurNom: "Moi", texte: commentText },
    });
  };

  const tasksList = tasks as Task[];
  const completed = tasksList.filter(t => t.statut === "TERMINE").length;
  const total = tasksList.length;

const canCompleteTask = (task: Task): boolean => {
  const userRole = role; // "SALARIE", "MANAGER", "RH"
  const acteurs = task.typeActeurs; // C'est un tableau maintenant !
  
  // Vérifier si le rôle de l'utilisateur est dans le tableau
  if (acteurs.includes("SALARIE") && userRole !== "SALARIE") return false;
  if (acteurs.includes("MANAGER") && userRole !== "MANAGER") return false;
  if (acteurs.includes("RH") && userRole !== "ADMIN") return false;
  
  return true;
};

  // ── Loading ───────────────────────────────────────────────────────
  if (loadingParcours || loadingTasks) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin"
              style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement de votre parcours...</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Pas de parcours ───────────────────────────────────────────────
  if (!parcours) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="text-center space-y-4">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mx-auto"
              style={{ background: "rgba(0,174,239,0.06)", border: "2px dashed rgba(0,174,239,0.2)" }}>
              🗂
            </div>
            <h2 className="text-2xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Aucun parcours assigné
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Votre parcours d'intégration sera disponible après votre affectation à un poste.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto page-enter" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* ── Header ── */}
        <div className="border-b px-8 py-5 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Mon parcours d'intégration
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {completed} / {total} tâches complétées
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-40 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${parcours.progression}%`,
                      background: parcours.progression === 100 ? "#8DC63F" : "#00AEEF",
                    }} />
                </div>
                <span className="text-sm font-bold" style={{
                  color: parcours.progression === 100 ? "#8DC63F" : "#00AEEF",
                  fontFamily: "Sora",
                }}>
                  {parcours.progression}%
                </span>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                style={{
                  background: parcours.statut === "TERMINE" ? "#ecfdf5" : "rgba(0,174,239,0.08)",
                  color: parcours.statut === "TERMINE" ? "#059669" : "#00AEEF",
                  border: `1px solid ${parcours.statut === "TERMINE" ? "#a7f3d0" : "rgba(0,174,239,0.2)"}`,
                }}>
                {parcours.statut === "TERMINE" ? "✅ Terminé" :
                 parcours.statut === "EXPIRE" ? "⚠️ Expiré" : "🔄 En cours"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100vh-73px)]">

          {/* ── Bandeau récapitulatif échéances ── */}
{(() => {
  const retard   = tasksList.filter(t => {
    const c = getEcheanceConfig(t.echeance, t.statut);
    return c && c.blink;
  });
  const urgent   = tasksList.filter(t => {
    const c = getEcheanceConfig(t.echeance, t.statut);
    return c && c.pulse && !c.blink;
  });
  const warning  = tasksList.filter(t => {
    if (!t.echeance || t.statut === "TERMINE") return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(t.echeance); due.setHours(0,0,0,0);
    const diff  = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    return diff >= 3 && diff <= 6;
  });

  if (retard.length === 0 && urgent.length === 0 && warning.length === 0) return null;

  return (
    <div className="rounded-2xl p-4 mb-4 space-y-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-2"
        style={{ color: "var(--text-muted)" }}>
        ⏰ Récapitulatif des échéances
      </p>
      <div className="flex flex-wrap gap-2">
        {retard.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl badge-blink"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "#dc2626" }} />
            <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>
              {retard.length} tâche{retard.length > 1 ? "s" : ""} en retard
            </span>
          </div>
        )}
        {urgent.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl badge-pulse"
            style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "#ea580c" }} />
            <span className="text-xs font-semibold" style={{ color: "#ea580c" }}>
              {urgent.length} tâche{urgent.length > 1 ? "s" : ""} urgente{urgent.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
        {warning.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "#fefce8", border: "1px solid #fef08a" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "#ca8a04" }} />
            <span className="text-xs font-semibold" style={{ color: "#ca8a04" }}>
              {warning.length} tâche{warning.length > 1 ? "s" : ""} à surveiller
            </span>
          </div>
        )}
      </div>
      {/* Liste des tâches en retard */}
      {retard.length > 0 && (
        <div className="mt-2 space-y-1">
          {retard.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs"
              style={{ color: "#dc2626" }}>
              <span>→</span>
              <span className="font-medium">{t.titre}</span>
              <span className="opacity-60">
                {new Date(t.echeance!).toLocaleDateString("fr-FR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
})()}

         {/* ── Colonne gauche — Liste tâches groupées par phase ── */}
<div className="w-96 flex-shrink-0 border-r overflow-y-auto"
  style={{ borderColor: "var(--border)" }}>
  <div className="p-4 space-y-6">
    {(() => {
      // Définition des phases
      const PHASES_CONFIG = [
        { value: "PHASE_1", label: "Phase 1 — Découverte", color: "#00AEEF", bg: "rgba(0,174,239,0.08)" },
        { value: "PHASE_2", label: "Phase 2 — Intégration", color: "#8DC63F", bg: "rgba(141,198,63,0.08)" },
        { value: "PHASE_3", label: "Phase 3 — Formation", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
        { value: "PHASE_4", label: "Phase 4 — Évaluation", color: "#d97706", bg: "rgba(217,119,6,0.08)" },
      ];

      // Grouper les tâches par phase
      const groupedTasks = new Map<string, Task[]>();
      
      tasksList.forEach((task: Task) => {
        const phase = task.phase || "AUTRE";
        if (!groupedTasks.has(phase)) {
          groupedTasks.set(phase, []);
        }
        groupedTasks.get(phase)!.push(task);
      });

      // Si pas de tâches
      if (tasksList.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl">📋</span>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune tâche</p>
          </div>
        );
      }

      // Afficher les phases dans l'ordre
      const phaseOrder = ["PHASE_1", "PHASE_2", "PHASE_3", "PHASE_4", "AUTRE"];
      const result: JSX.Element[] = [];

      for (const phaseValue of phaseOrder) {
        const phaseTasks = groupedTasks.get(phaseValue);
        if (!phaseTasks || phaseTasks.length === 0) continue;

        const phaseConfig = PHASES_CONFIG.find(p => p.value === phaseValue) || {
          value: "AUTRE", label: "Autres tâches", color: "#94a3b8", bg: "rgba(148,163,184,0.08)"
        };
        
        const phaseCompleted = phaseTasks.filter(t => t.statut === "TERMINE").length;
        const phaseProgress = Math.round((phaseCompleted / phaseTasks.length) * 100);

        result.push(
          <div key={phaseValue} className="mb-6 last:mb-0">
            {/* Header phase */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: phaseConfig.bg, color: phaseConfig.color }}>
                {phaseValue === "PHASE_1" ? "1" :
                 phaseValue === "PHASE_2" ? "2" :
                 phaseValue === "PHASE_3" ? "3" :
                 phaseValue === "PHASE_4" ? "4" : "•"}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold" style={{ color: phaseConfig.color, fontFamily: "Sora" }}>
                    {phaseConfig.label}
                  </p>
                  <span className="text-xs font-semibold" style={{ color: phaseProgress === 100 ? "#8DC63F" : phaseConfig.color }}>
                    {phaseCompleted}/{phaseTasks.length}
                  </span>
                </div>
                {/* Barre progression phase */}
                <div className="w-full h-1 rounded-full mt-1" style={{ background: "var(--border)" }}>
                  <div className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: `${phaseProgress}%`,
                      background: phaseProgress === 100 ? "#8DC63F" : phaseConfig.color,
                    }} />
                </div>
              </div>
            </div>

            {/* Tâches de cette phase */}
            <div className="pl-2 space-y-2">
              {phaseTasks.map((task) => {
                const typeConf = TASK_TYPE_CONFIG[task.taskType];
                const statutConf = STATUT_CONFIG[task.statut];
                const isSelected = selectedTask?.id === task.id;
                const iAmActeur = canActOnTask(task);
                const isLockedQuiz = isQuizLocked(task);
                const isLocked = task.verrouille || isLockedQuiz;

                return (
                  <div key={task.id}
                    onClick={() => !isLocked && handleOpenTask(task)}
                    className="rounded-xl p-3 transition-all duration-200 cursor-pointer"
                    style={{
                      opacity: isLocked ? 0.5 : 1,
                      border: isSelected
                        ? `2px solid ${typeConf.color}`
                        : task.statut === "TERMINE"
                        ? "1px solid rgba(141,198,63,0.3)"
                        : "1px solid var(--border)",
                      background: isSelected
                        ? `${typeConf.bg}`
                        : task.statut === "TERMINE"
                        ? "rgba(141,198,63,0.03)"
                        : "var(--surface)",
                         borderLeft: (() => {
    const ec = getEcheanceConfig(task.echeance, task.statut);
    if (!ec || isSelected) return undefined;
    if (ec.blink || ec.pulse) return `3px solid ${ec.color}`;
    return undefined;
  })(),
                    }}>
                    <div className="flex items-start gap-2">
                      {/* Icône */}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: typeConf.bg }}>
                        {isLocked ? "🔒" : typeConf.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold leading-tight truncate"
                            style={{ color: "var(--text)", fontFamily: "Sora" }}>
                            {task.titre}
                          </p>
                          {task.statut === "TERMINE" && (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: "#8DC63F" }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {(() => {
    const ec = getEcheanceConfig(task.echeance, task.statut);
    if (!ec) return null;
    return (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
          ec.pulse ? "badge-pulse" : ec.blink ? "badge-blink" : ""
        }`}
        style={{ background: ec.bg, color: ec.color, border: `1px solid ${ec.border}` }}>
        {ec.pulse || ec.blink ? "⚠ " : "⏱ "}{ec.label}
      </span>
    );
  })()}
</div>

                        {task.taskType === "QUIZ" && task.scoreObtenu !== undefined && task.scoreObtenu > 0 && (
                          <p className="text-[10px] mt-1" style={{
                            color: task.scoreObtenu >= (task.config?.scoreMinimum ?? 70) ? "#8DC63F" : "#dc2626"
                          }}>
                            Score: {task.scoreObtenu}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      return result;
    })()}
  </div>
</div>

          {/* ── Colonne droite — Détail tâche ── */}
          <div className="flex-1 overflow-y-auto">
            {!selectedTask ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                  style={{ background: "rgba(0,174,239,0.06)" }}>
                  👆
                </div>
                <p className="text-lg font-semibold" style={{ color: "var(--text-muted)", fontFamily: "Sora" }}>
                  Sélectionnez une tâche
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Cliquez sur une tâche pour voir les détails
                </p>
              </div>
            ) : (
              <div className="p-8 space-y-6 max-w-3xl">

                {/* Messages */}
                {successMsg && (
                  <div className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm"
                    style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
                    ✅ {successMsg}
                    <button type="button" onClick={() => setSuccessMsg("")} className="ml-auto opacity-60">✕</button>
                  </div>
                )}
                {errorMsg && (
                  <div className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm"
                    style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                    ⚠️ {errorMsg}
                    <button type="button" onClick={() => setErrorMsg("")} className="ml-auto opacity-60">✕</button>
                  </div>
                )}

                {/* Header tâche */}
                {(() => {
                  const typeConf   = TASK_TYPE_CONFIG[selectedTask.taskType];
                  const statutConf = STATUT_CONFIG[selectedTask.statut];
                  const iAmActeur  = canActOnTask(selectedTask);
                  return (
                    <div className="rounded-2xl p-6"
                      style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 100%)" }}>
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                          style={{ background: "rgba(255,255,255,0.1)" }}>
                          {typeConf.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Sora" }}>
                              {selectedTask.titre}
                            </h2>
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{ background: statutConf.bg, color: statutConf.color }}>
                              {statutConf.label}
                            </span>
                            {/* Badge info si pas acteur */}
                            {!iAmActeur && (
                              <span className="text-xs px-2 py-1 rounded-full font-medium"
                                style={{ background: "rgba(148,163,184,0.2)", color: "#94a3b8" }}>
                                👁 Tâche à titre informatif
                              </span>
                            )}
                          </div>
                          {selectedTask.description && (
                            <p className="text-sm" style={{ color: "rgba(168,216,234,0.75)" }}>
                              {selectedTask.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3 flex-wrap">
                            <span className="text-xs px-2 py-1 rounded-full"
                              style={{ background: "rgba(0,174,239,0.2)", color: "#00AEEF" }}>
                              {typeConf.label}
                            </span>
                            {/* Acteurs */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {selectedTask.typeActeurs?.map(a => (
                                <span key={a} className="text-xs px-2 py-1 rounded-full"
                                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(168,216,234,0.8)" }}>
                                  {ACTEUR_LABELS[a]}
                                </span>
                              ))}
                            </div>
                            {selectedTask.echeance && (
                              <span className="text-xs" style={{ color: "rgba(168,216,234,0.6)" }}>
                                ⏱ Échéance : {new Date(selectedTask.echeance).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                            {selectedTask.obligatoire && (
                              <span className="text-xs" style={{ color: "rgba(239,68,68,0.8)" }}>
                                * Obligatoire
                              </span>
                            )}
                          </div>

                          {/* Progression multi-acteur */}
                          {selectedTask.acteurProgressions && selectedTask.acteurProgressions.length > 1 && (
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              {selectedTask.acteurProgressions.map((ap, i) => (
                                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                                  style={{
                                    background: ap.complete ? "rgba(141,198,63,0.15)" : "rgba(255,255,255,0.06)",
                                    border: `1px solid ${ap.complete ? "rgba(141,198,63,0.3)" : "rgba(255,255,255,0.1)"}`,
                                  }}>
                                  <span className="text-xs">{ap.complete ? "✅" : "⏳"}</span>
                                  <span className="text-xs" style={{ color: ap.complete ? "#8DC63F" : "rgba(168,216,234,0.6)" }}>
                                    {ACTEUR_LABELS[ap.typeActeur]}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Contenu selon le type — affiché seulement si je suis acteur ── */}

                {/* Tâche informative (je ne suis pas acteur) */}
                {!canActOnTask(selectedTask) && selectedTask.statut !== "TERMINE" && (
                  <div className="card p-6 text-center space-y-3">
                    <span className="text-4xl">👁</span>
                    <p className="font-semibold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      Cette tâche est gérée par {selectedTask.typeActeurs?.map(a => ACTEUR_LABELS[a]).join(" et ")}
                    </p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Elle contribuera automatiquement à votre progression une fois complétée par le responsable.
                    </p>
                  </div>
                )}

                {/* FORMATION */}
                {selectedTask.taskType === "FORMATION" && canActOnTask(selectedTask) && (
                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>🎓 Formation</h3>

                    {selectedTask.config?.videoUrl && (
                      <div>
                        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          Vidéo de formation
                        </p>
                        {selectedTask.config.videoUrl.includes("youtube") || selectedTask.config.videoUrl.includes("youtu.be") ? (
                          <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                            <iframe
                              src={selectedTask.config.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")}
                              className="w-full h-full" allowFullScreen title="Formation vidéo" />
                          </div>
                        ) : (
                          <a href={selectedTask.config.videoUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 p-4 rounded-xl transition hover:scale-[1.01]"
                            style={{ background: "rgba(0,174,239,0.06)", border: "1px solid rgba(0,174,239,0.2)", color: "#00AEEF" }}>
                            <span className="text-2xl">▶️</span>
                            <span className="font-medium text-sm">Regarder la vidéo</span>
                          </a>
                        )}
                      </div>
                    )}

                    {selectedTask.config?.fichierContenu && (
                      <button type="button"
                        onClick={() => openBase64(selectedTask.config!.fichierContenu!, selectedTask.config?.fichierMimeType)}
                        className="flex items-center gap-3 p-4 rounded-xl w-full text-left transition hover:scale-[1.01]"
                        style={{ background: "rgba(26,43,107,0.06)", border: "1px solid rgba(26,43,107,0.15)", color: "#1A2B6B" }}>
                        <span className="text-2xl">📄</span>
                        <span className="font-medium text-sm flex-1">{selectedTask.config.fichierNom || "Document"}</span>
                        <span className="text-xs opacity-60">Ouvrir</span>
                      </button>
                    )}

                    {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && canCompleteTask(selectedTask) && (
                      <button type="button"
                        onClick={() => completeMutation.mutate(selectedTask.id)}
                        disabled={completeMutation.isPending}
                        className="btn-primary w-full py-3">
                        {completeMutation.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Enregistrement...
                          </span>
                        ) : "✅ Marquer la formation comme vue"}
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

{selectedTask.taskType === "QUIZ" && canActOnTask(selectedTask) && (() => {
  // Vérifier si le quiz est verrouillé par date d'ouverture
  if (isQuizLocked(selectedTask)) {
    const daysLeft = getDaysUntilOuverture(selectedTask);
    const ouvertureDate = new Date(selectedTask.dateOuverture!);
    
    return (
      <div className="card p-6 text-center space-y-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto"
          style={{ background: "rgba(245,158,11,0.1)" }}>
          🔒
        </div>
        <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
          Quiz non disponible
        </h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Ce quiz sera disponible dans <strong className="text-orange-500">{daysLeft} jour{daysLeft && daysLeft > 1 ? 's' : ''}</strong>
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Date d'ouverture : {ouvertureDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
        <button
          type="button"
          onClick={() => setSelectedTask(null)}
          className="btn-secondary px-6 py-2"
        >
          Retour à la liste
        </button>
      </div>
    );
  }
  
  // Affichage normal du quiz
  return (
    <div className="card p-6 space-y-5">
      {/* En-tête avec nombre de tentatives */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>🧠 Quiz</h3>
          {selectedTask.nbTentatives > 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Tentative {selectedTask.nbTentatives} / 3
            </p>
          )}
        </div>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Score minimum : <strong style={{ color: "#8DC63F" }}>{selectedTask.config?.scoreMinimum ?? 70}%</strong>
        </span>
      </div>

      {/* Message si plus de tentatives (bloqué) */}
      {selectedTask.nbTentatives >= 3 && selectedTask.statut !== "TERMINE" && (
        <div className="p-3 rounded-xl text-sm text-center"
          style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          ⚠️ Vous avez atteint le nombre maximum de 3 tentatives. Quiz bloqué.
        </div>
      )}

      {/* Affichage du résultat si déjà soumis (réussi ou échoué) */}
      {selectedTask.scoreObtenu !== undefined && selectedTask.scoreObtenu > 0 && !quizSubmitted && (
        <div className="rounded-xl p-4"
          style={{
            background: selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#a7f3d0" : "#fecaca"}`,
          }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold"
                style={{ color: selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#059669" : "#dc2626" }}>
                {selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70)
                  ? `✅ Quiz réussi — Score : ${selectedTask.scoreObtenu}%`
                  : `❌ Score insuffisant : ${selectedTask.scoreObtenu}%`}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Tentative n°{selectedTask.nbTentatives} / 3
              </p>
            </div>
            
            {/* Bouton réessayer - seulement si pas réussi et tentatives restantes */}
            {selectedTask.scoreObtenu < (selectedTask.config?.scoreMinimum ?? 70) && 
             selectedTask.statut !== "TERMINE" && 
             !myProgressionDone(selectedTask) &&
             selectedTask.nbTentatives < 3 && (
              <button type="button"
                onClick={() => { 
                  setQuizReponses([]); 
                  setQuizSubmitted(false); 
                  setQuizResult(null);
                  setErrorMsg("");
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                🔄 Réessayer (Tentative {selectedTask.nbTentatives + 1}/3)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Formulaire du quiz - affiché seulement si :
          - Pas encore terminé 
          - Pas déjà complété par l'acteur 
          - Pas déjà soumis en cours
          - Pas déjà réussi (score < score minimum ou pas encore soumis)
          - Tentatives restantes (< 3) */}
      {selectedTask.statut !== "TERMINE" && 
       !myProgressionDone(selectedTask) && 
       !quizSubmitted &&
       (selectedTask.scoreObtenu === undefined || selectedTask.scoreObtenu < (selectedTask.config?.scoreMinimum ?? 70)) &&
       selectedTask.nbTentatives < 3 && (
        <div className="space-y-5">
          {(selectedTask.config?.questions ?? []).map((q: Question, qIndex: number) => (
            <div key={q.id} className="p-5 rounded-2xl space-y-3"
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
                        const rep = [...quizReponses];
                        rep[qIndex] = oIndex;
                        setQuizReponses(rep);
                      }}
                      style={{ accentColor: "#00AEEF" }} />
                    <span className="text-sm" style={{ color: "var(--text)" }}>
                      <strong style={{ color: "var(--text-muted)" }}>{String.fromCharCode(65 + oIndex)}.</strong>{" "}{opt}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          
          <button type="button" onClick={handleQuizSubmit}
            disabled={quizMutation.isPending || quizReponses.length < (selectedTask.config?.questions?.length ?? 0)}
            className="btn-primary w-full py-3">
            {quizMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Correction en cours...
              </span>
            ) : "🚀 Soumettre le quiz"}
          </button>
        </div>
      )}

      {/* Résultat après soumission */}
      {quizSubmitted && quizResult && (
        <div className="rounded-2xl p-6 text-center space-y-3"
          style={{
            background: quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#a7f3d0" : "#fecaca"}`,
          }}>
          <div className="text-5xl">
            {quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "🎉" : "😕"}
          </div>
          <h3 className="text-xl font-bold"
            style={{ fontFamily: "Sora", color: quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#059669" : "#dc2626" }}>
            {quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "Bravo !" : "Score insuffisant"}
          </h3>
          <p className="text-2xl font-bold"
            style={{ color: quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#059669" : "#dc2626", fontFamily: "Sora" }}>
            {quizResult.scoreObtenu}%
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Score minimum requis : {quizResult.config?.scoreMinimum ?? 70}%
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Tentative n°{quizResult.nbTentatives} / 3
          </p>
          {quizResult.statut !== "TERMINE" && !myProgressionDone(quizResult) && quizResult.nbTentatives < 3 && (
            <button type="button"
              onClick={() => { setQuizReponses([]); setQuizSubmitted(false); setQuizResult(null); }}
              className="btn-primary px-6 py-2.5">
              Réessayer (Tentative {quizResult.nbTentatives + 1}/3)
            </button>
          )}
          {quizResult.nbTentatives >= 3 && quizResult.statut !== "TERMINE" && (
            <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>
              ⚠️ Nombre maximum de tentatives atteint (3/3). Quiz bloqué.
            </p>
          )}
          {myProgressionDone(quizResult) && quizResult.statut !== "TERMINE" && (
            <p className="text-sm" style={{ color: "#059669" }}>
              ✅ Votre part est complète — en attente des autres acteurs
            </p>
          )}
        </div>
      )}
    </div>
  );
})()}

                {/* DOCUMENT_RH */}
                {selectedTask.taskType === "DOCUMENT_RH" && canActOnTask(selectedTask) && (
                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>📄 Document à consulter</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Ce document a été mis à disposition par votre équipe RH. Consultez-le attentivement.
                    </p>
                    {selectedTask.config?.documentContenu ? (
                      <button type="button"
                        onClick={() => openBase64(selectedTask.config!.documentContenu!, selectedTask.config?.documentMimeType)}
                        className="flex items-center gap-3 p-4 rounded-xl w-full text-left transition hover:scale-[1.01]"
                        style={{ background: "rgba(26,43,107,0.06)", border: "1px solid rgba(26,43,107,0.2)", color: "#1A2B6B" }}>
                        <span className="text-2xl">📄</span>
                        <span className="font-medium text-sm flex-1">{selectedTask.config.documentNom || "Document RH"}</span>
                        <span className="text-xs opacity-60">Ouvrir</span>
                      </button>
                    ) : (
                      <div className="p-4 rounded-xl text-sm"
                        style={{ background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
                        Document en cours de mise à disposition...
                      </div>
                    )}
                    {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && canCompleteTask(selectedTask) && (
                      <button type="button"
                        onClick={() => completeMutation.mutate(selectedTask.id)}
                        disabled={completeMutation.isPending}
                        className="btn-primary w-full py-3">
                        ✅ Confirmer la lecture
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

                {/* DOCUMENT_SALARIE */}
                {selectedTask.taskType === "DOCUMENT_SALARIE" && canActOnTask(selectedTask) && (
                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>📎 Document à déposer</h3>
                    {selectedTask.config?.typeDocumentAttendu && (
                      <div className="p-3 rounded-xl text-sm"
                        style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", color: "#d97706" }}>
                        📌 Document attendu : <strong>{selectedTask.config.typeDocumentAttendu}</strong>
                      </div>
                    )}
                    {selectedTask.documentNom && (
                      <div className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                        <span className="text-xl">📎</span>
                        <span className="text-sm font-medium text-emerald-700 flex-1">{selectedTask.documentNom}</span>
                        <span className="text-xs text-emerald-600">Déposé ✓</span>
                      </div>
                    )}
                    {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && (
                      <>
                        <label className="flex items-center justify-center gap-3 w-full py-4 rounded-xl cursor-pointer transition hover:scale-[1.01]"
                          style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span className="text-sm font-medium" style={{ color: "#00AEEF" }}>
                            {docFile ? docFile.name : "Choisir un fichier..."}
                          </span>
                          <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                        <button type="button" onClick={handleDocSubmit}
                          disabled={!docFile || docMutation.isPending}
                          className="btn-primary w-full py-3">
                          {docMutation.isPending ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Dépôt en cours...
                            </span>
                          ) : "⬆ Déposer le document"}
                        </button>
                        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                          Le document sera validé par {selectedTask.typeActeurs?.filter(a => a !== "SALARIE").map(a => ACTEUR_LABELS[a]).join(" / ") || "le responsable"}
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

                {/* ENTRETIEN */}
                {selectedTask.taskType === "ENTRETIEN" && (
                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      🤝 Entretien avec votre manager
                    </h3>
                    {selectedTask.dateEntretien ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl"
                        style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
                        <span className="text-2xl">📅</span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#7c3aed" }}>
                            Date planifiée
                          </p>
                          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                            {new Date(selectedTask.dateEntretien).toLocaleDateString("fr-FR", {
                              weekday: "long", day: "2-digit", month: "long", year: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl text-sm"
                        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "#d97706" }}>
                        ⏳ En attente de planification par votre manager
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {selectedTask.config?.dureeMinutes && (
                        <div className="p-3 rounded-xl text-center"
                          style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}>
                          <p className="text-2xl font-bold" style={{ color: "#7c3aed", fontFamily: "Sora" }}>
                            {selectedTask.config.dureeMinutes}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>minutes</p>
                        </div>
                      )}
                      {selectedTask.config?.lieu && (
                        <div className="p-3 rounded-xl text-center"
                          style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}>
                          <p className="text-sm font-semibold" style={{ color: "#7c3aed" }}>
                            📍 {selectedTask.config.lieu}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedTask.config?.notesEntretien && (
                      <div className="p-4 rounded-xl text-sm"
                        style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)", color: "var(--text)" }}>
                        <p className="font-semibold text-xs mb-2 uppercase tracking-wide" style={{ color: "#7c3aed" }}>Objectifs</p>
                        {selectedTask.config.notesEntretien}
                      </div>
                    )}
                    {selectedTask.documentEntretienContenu && (
                      <button type="button"
                        onClick={() => openBase64(selectedTask.documentEntretienContenu!, selectedTask.documentEntretienMimeType)}
                        className="flex items-center gap-3 p-4 rounded-xl w-full text-left transition hover:scale-[1.01]"
                        style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", color: "#7c3aed" }}>
                        <span className="text-2xl">📄</span>
                        <span className="font-medium text-sm flex-1">{selectedTask.documentEntretienNom || "Document entretien"}</span>
                        <span className="text-xs opacity-60">Consulter</span>
                      </button>
                    )}
                    {selectedTask.statut !== "TERMINE" && (
                      <div className="p-3 rounded-xl text-xs text-center"
                        style={{ background: "rgba(124,58,237,0.04)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.15)" }}>
                        ⏳ La validation sera effectuée par votre manager après l'entretien
                      </div>
                    )}
                    {selectedTask.statut === "TERMINE" && (
                      <div className="p-3 rounded-xl text-xs text-center"
                        style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669" }}>
                        ✅ Entretien validé
                      </div>
                    )}
                  </div>
                )}

                {/* SIMPLE */}
                {selectedTask.taskType === "SIMPLE" && canActOnTask(selectedTask) && (
                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>✅ Tâche à réaliser</h3>
                    {selectedTask.config?.datePlanifiee && (
                      <div className="p-3 rounded-xl text-sm"
                        style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.15)", color: "#059669" }}>
                        📅 Planifiée le : {new Date(selectedTask.config.datePlanifiee).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                    {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && canCompleteTask(selectedTask) && (
                      <button type="button"
                        onClick={() => completeMutation.mutate(selectedTask.id)}
                        disabled={completeMutation.isPending}
                        className="btn-primary w-full py-3">
                        {completeMutation.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />...
                          </span>
                        ) : "✅ Marquer comme effectué"}
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
                        ✓ Tâche effectuée le {selectedTask.dateCompletion
                          ? new Date(selectedTask.dateCompletion).toLocaleDateString("fr-FR") : ""}
                      </div>
                    )}
                  </div>
                )}

                {/* Commentaires */}
                <div className="card p-6 space-y-4">
                  <h3 className="font-bold text-sm" style={{ color: "var(--text)", fontFamily: "Sora" }}>💬 Commentaires</h3>
                  {selectedTask.commentaires.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun commentaire</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedTask.commentaires.map((c, i) => (
                        <div key={i} className="p-3 rounded-xl"
                          style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{c.auteurNom}</span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {new Date(c.date).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: "var(--text)" }}>{c.texte}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Ajouter un commentaire..."
                      className="input-field flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()} />
                    <button type="button" onClick={handleAddComment}
                      disabled={!commentText.trim() || commentMutation.isPending}
                      className="btn-primary px-4 py-2">
                      {commentMutation.isPending ? "..." : "Envoyer"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <style>{`
  @keyframes pulse-badge {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.7; transform: scale(1.08); }
  }
  @keyframes blink-badge {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
  .badge-pulse { animation: pulse-badge 1.4s ease-in-out infinite; }
  .badge-blink { animation: blink-badge 1s ease-in-out infinite; }
`}</style>
    </div>
    
  );
};

export default MonParcoursPage;