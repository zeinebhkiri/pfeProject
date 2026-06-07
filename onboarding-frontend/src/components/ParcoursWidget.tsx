import { useState, type JSX, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyParcoursApi,
  getMyTasksApi,
  startTaskApi,
  submitQuizApi,
  submitDocumentTaskApi,
  completeTaskApi,
  addCommentTaskApi,
  getCurrentUserApi,
  deleteTaskDocumentApi
} from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import { useGamification, computeBadgesFromTasks, type Badge } from "../hooks/useGamification";
import { BadgeUnlockToast } from "./Badgeunlocktoast";
import { type Task, type TaskType, type Question } from "../types/auth";

// ── Configs visuelles ──────────────────────────────────────────────────
const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string; bg: string }> = {
  FORMATION:        { label: "Formation",          icon: "🎓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)"   },
  QUIZ:             { label: "Quiz",               icon: "🧠", color: "#8DC63F", bg: "rgba(141,198,63,0.08)"  },
  ENTRETIEN:        { label: "Entretien",          icon: "🤝", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  SIMPLE:           { label: "Tâche simple",       icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)"  },
};

const STATUT_CONFIG = {
  NON_COMMENCE: { label: "À faire",  color: "#94a3b8", bg: "#f1f5f9" },
  EN_COURS:     { label: "En cours", color: "#2563eb", bg: "#eff6ff" },
  TERMINE:      { label: "Terminé",  color: "#059669", bg: "#ecfdf5" },
};

const ACTEUR_LABELS: Record<string, string> = {
  SALARIE: "👤 Salarié",
  MANAGER: "👔 Manager",
  RH:      "🏢 RH",
};

const PHASES_CONFIG = [
  { value: "PHASE_1", label: "Phase 1 —  Pré-onboarding",        color: "#00AEEF", bg: "rgba(0,174,239,0.08)"   },
  { value: "PHASE_2", label: "Phase 2 — Intégration",       color: "#8DC63F", bg: "rgba(141,198,63,0.08)"  },
  { value: "PHASE_3", label: "Phase 3 — Montée en compétence",         color: "#7c3aed", bg: "rgba(124,58,237,0.08)"  },
  { value: "PHASE_4", label: "Phase 4 —  Validation",        color: "#d97706", bg: "rgba(217,119,6,0.08)"   },
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

export const getEcheanceConfig = (echeance?: string, statut?: string) => {
  if (!echeance || statut === "TERMINE") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(echeance);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0)   return { label: `Retard J+${Math.abs(diff)}`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", pulse: false, blink: true  };
  if (diff === 0) return { label: "Aujourd'hui",                 color: "#dc2626", bg: "#fef2f2", border: "#fecaca", pulse: true,  blink: false };
  if (diff === 1) return { label: "Demain J-1",                  color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", pulse: true,  blink: false };
  if (diff <= 2)  return { label: `J-${diff}`,                   color: "#d97706", bg: "#fffbeb", border: "#fde68a", pulse: false, blink: false };
  if (diff <= 6)  return { label: `J-${diff}`,                   color: "#ca8a04", bg: "#fefce8", border: "#fef08a", pulse: false, blink: false };
  return            { label: `J-${diff}`,                        color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", pulse: false, blink: false };
};

// ── Props ──────────────────────────────────────────────────────────────
interface ParcoursWidgetProps {
  initialSelectedTaskId?: string | null;
}

// ── Composant principal ────────────────────────────────────────────────
const ParcoursWidget = ({ initialSelectedTaskId }: ParcoursWidgetProps) => {
  const { role, userId} = useAuth();
  const queryClient = useQueryClient();
  

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [quizReponses, setQuizReponses] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<Task | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  //const [commentText, setCommentText] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationShown, setCelebrationShown] = useState(false);
 
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
   const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserApi,
  });
  const currentUserId = currentUser?.id || userId;
  const myTypeActeur = role === "MANAGER" ? "MANAGER" : role === "ADMIN" ? "RH" : "SALARIE";

  // ── Gamification ──────────────────────────────────────────────────────────
  const [pendingBadges, setPendingBadges] = useState<Badge[]>([]);
  const [showBadgeToast, setShowBadgeToast] = useState(false);
  // Snapshot des badges débloqués AVANT la complétion (pour comparer après refetch)
  const prevUnlockedIdsRef = useRef<Set<string>>(new Set());


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
    mutationFn: (taskId: string) => {
      // Snapshot des badges actuellement débloqués AVANT la mutation
      prevUnlockedIdsRef.current = new Set(
        (tasks as Task[])
          .filter(t => t.statut === "TERMINE")
          .map(t => t.id)
      );
      return completeTaskApi(taskId);
    },
    onSuccess: async (updatedTask) => {
      setSelectedTask(updatedTask);
      setSuccessMsg("Tâche marquée comme terminée !");
      // 1. Lire les badges déjà vus AVANT le refetch
      const SEEN_KEY = "gamification_seen_badges";
      let seenIdsBefore: string[] = [];
      try { seenIdsBefore = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); } catch {}
      // 2. Refetch
      await queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      await queryClient.invalidateQueries({ queryKey: ["myParcours"] });
      // 3. Attendre que le cache soit mis à jour puis comparer
      setTimeout(() => {
        const freshTasks = queryClient.getQueryData<Task[]>(["myTasks"]) ?? [];
        const freshParcours = queryClient.getQueryData<any>(["myParcours"]);
        console.log("[BADGE] freshTasks count:", freshTasks.length);
        console.log("[BADGE] seenIdsBefore:", seenIdsBefore);
        const { unlockedBadges } = computeBadgesFromTasks(freshTasks, freshParcours);
        console.log("[BADGE] unlockedBadges:", unlockedBadges.map(b => b.id));
        const newBadges = unlockedBadges.filter(b => !seenIdsBefore.includes(b.id));
        console.log("[BADGE] newBadges:", newBadges.map(b => b.id));
        if (newBadges.length > 0) {
          setPendingBadges(newBadges);
          setShowBadgeToast(true);
        } else {
          // Force affichage pour test — tous les badges débloqués
          const allUnlocked = unlockedBadges;
          if (allUnlocked.length > 0) {
            console.log("[BADGE] forcing toast with all unlocked badges");
            setPendingBadges(allUnlocked);
            setShowBadgeToast(true);
          }
        }
      }, 800);
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      addCommentTaskApi(taskId, data),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      setSelectedTask(updatedTask);
      
    },
  });
  const deleteDocumentMutation = useMutation({
  mutationFn: ({ taskId }: { taskId: string }) => deleteTaskDocumentApi(taskId),
  onSuccess: (updatedTask) => {
    queryClient.invalidateQueries({ queryKey: ["myTasks"] });
    setSelectedTask(updatedTask);
    setDocFile(null);
    setSuccessMsg("Document supprimé avec succès ! Vous pouvez en déposer un nouveau.");
  },
  onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur lors de la suppression."),
});


  // ── Helpers ───────────────────────────────────────────────────────
  const canActOnTask = (task: Task): boolean => {
    // Toujours utiliser typeActeurs comme source principale
    if (task.typeActeurs?.includes(myTypeActeur as any)) return true;
    // Fallback : si acteurIds contient l'utilisateur courant
    if (currentUserId && task.acteurIds && task.acteurIds.length > 0) {
      return task.acteurIds.includes(currentUserId);
    }
    return false;
  };

  const myProgressionDone = (task: Task): boolean => {
    if (!task.acteurProgressions) return false;
    // Si acteurIds disponible → chercher par id
    if (task.acteurIds && task.acteurIds.length > 0 && currentUserId) {
      const myIndex = task.acteurIds.findIndex(id => id === currentUserId);
      if (myIndex !== -1) return task.acteurProgressions[myIndex]?.complete ?? false;
    }
    // Fallback : chercher par typeActeur
    const myProg = task.acteurProgressions.find(ap => ap.typeActeur === myTypeActeur);
    return myProg?.complete ?? false;
  };
  const isQuizLocked = (task: Task): boolean => {
    if (task.taskType !== "QUIZ" || !task.dateOuverture) return false;
    return new Date() < new Date(task.dateOuverture);
  };

  const getDaysUntilOuverture = (task: Task): number | null => {
    if (!task.dateOuverture) return null;
    return Math.ceil((new Date(task.dateOuverture).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const canCompleteTask = (task: Task): boolean => {
    if (task.statut === "TERMINE") return false;
    if (myProgressionDone(task)) return false;
    return canActOnTask(task);
  };

  // ── Handlers ──────────────────────────────────────────────────────
  const handleOpenTask = (task: Task) => {
    if (isQuizLocked(task)) {
      setErrorMsg(`Ce quiz sera disponible le ${new Date(task.dateOuverture!).toLocaleDateString("fr-FR")}`);
      return;
    }
    setSelectedTask(task);
    setQuizReponses([]);
    setQuizSubmitted(false);
    setQuizResult(null);
    setDocFile(null);
    setSuccessMsg("");
    setErrorMsg("");

  

    if (task.statut === "NON_COMMENCE" && !task.verrouille && canActOnTask(task)) {
      startMutation.mutate(task.id);
    }
  };

  // 🔥 Ouvrir automatiquement la tâche si initialSelectedTaskId est fourni
  const tasksList = tasks as Task[];
  const { newlyUnlockedBadges, markBadgesSeen } = useGamification(tasksList, parcours ?? undefined);
  
  useEffect(() => {
    if (initialSelectedTaskId && tasksList.length > 0 && !selectedTask) {
      const taskToOpen = tasksList.find(t => t.id === initialSelectedTaskId);
      if (taskToOpen) {
        setTimeout(() => {
          handleOpenTask(taskToOpen);
        }, 100);
      }
    }
  }, [initialSelectedTaskId, tasksList]);

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

  {/*/const handleAddComment = () => {
    if (!selectedTask || !commentText.trim()) return;

      const fullName = currentUser 
      ? `${currentUser.prenom || ""} ${currentUser.nom || ""}`.trim()
      : "Utilisateur";

    commentMutation.mutate({
      taskId: selectedTask.id,
      data: { auteurId: userId!, auteurNom: fullName, texte: commentText },
    });
  };*/}
const handleDeleteDocument = () => {
  if (!selectedTask) return;
  if (confirm("Supprimer ce document ? Vous pourrez en déposer un nouveau.")) {
    deleteDocumentMutation.mutate({ taskId: selectedTask.id });
  }
};
  const completed = tasksList.filter(t => t.statut === "TERMINE").length;
  const total = tasksList.length;

  // ── Déclenchement de la célébration à 100% ────────────────────────
  useEffect(() => {
    if (parcours && parcours.progression === 100 && !celebrationShown) {
      setShowCelebration(true);
      setCelebrationShown(true);
    }
  }, [parcours?.progression, celebrationShown]);

  // ── Génération du certificat HTML (imprimable/téléchargeable) ─────
  const handleDownloadCertificat = () => {
    const prenom = currentUser?.prenom || "Prénom";
    const nom = currentUser?.nom || "Nom";
    const fullName = `${prenom} ${nom}`;
    const dateFin = parcours?.dateFin
      ? new Date(parcours.dateFin).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const nomEntreprise = "OnboardingPro";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Certificat d'achèvement — ${fullName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 40px; }
  .cert { width: 794px; min-height: 562px; padding: 48px 60px; border: 6px solid #00AEEF; border-radius: 16px; position: relative; background: #fff; box-shadow: 0 0 0 2px #0D1B3E, 0 20px 60px rgba(0,0,0,0.15); }
  .cert::before { content: ""; position: absolute; inset: 10px; border: 1.5px solid rgba(0,174,239,0.25); border-radius: 10px; pointer-events: none; }
  .logo-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px; }
  .brand { font-size: 22px; font-weight: bold; color: #0D1B3E; letter-spacing: 1px; }
  .brand span { color: #00AEEF; }
  .badge { background: linear-gradient(135deg,#00AEEF,#8DC63F); color: #fff; padding: 6px 18px; border-radius: 20px; font-size: 12px; font-family: sans-serif; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  h1 { text-align: center; font-size: 13px; font-family: sans-serif; color: #64748b; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; }
  h2 { text-align: center; font-size: 38px; color: #0D1B3E; margin-bottom: 32px; font-weight: bold; }
  .attestation { text-align: center; font-size: 15px; color: #475569; line-height: 1.9; font-family: sans-serif; }
  .name { font-size: 32px; color: #00AEEF; font-weight: bold; display: block; margin: 10px 0; }
  .divider { width: 80px; height: 3px; background: linear-gradient(90deg,#00AEEF,#8DC63F); margin: 24px auto; border-radius: 2px; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
  .footer-block { text-align: center; }
  .footer-label { font-size: 11px; font-family: sans-serif; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .footer-value { font-size: 14px; font-family: sans-serif; color: #0D1B3E; font-weight: 600; }
  .seal { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg,#0D1B3E,#1A2B6B); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px; box-shadow: 0 4px 20px rgba(0,174,239,0.3); }
  @media print { body { background: white; padding: 0; } .cert { box-shadow: none; } }
</style>
</head>
<body>
<div class="cert">
  <div class="logo-bar">
    <div class="brand">Onboarding<span>Pro</span></div>
    <div class="badge">✓ Certifié</div>
  </div>
  <h1>Certificat d'achèvement</h1>
  <h2>Parcours d'Intégration</h2>
  <div class="attestation">
    Ce certificat atteste que<br/>
    <span class="name">${fullName}</span>
    a complété avec succès l'intégralité du<br/>
    <strong>parcours d'intégration</strong> au sein de <strong>${nomEntreprise}</strong>
  </div>
  <div class="divider"></div>
  <div class="footer">
    <div class="footer-block">
      <div class="footer-label">Date de fin</div>
<div class="footer-value">
  ${dateFin}
</div>
    </div>
    <div class="seal">🏆</div>
    <div class="footer-block">
      <div class="footer-label">DIRECTEUR</div>
      <div class="footer-value">Haythem Haddar</div>
    </div>
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificat_Integration_${fullName.replace(/\s+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (loadingParcours || loadingTasks) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 rounded-full animate-spin"
            style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement du parcours...</p>
        </div>
      </div>
    );
  }

  if (!parcours) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
          style={{ background: "rgba(0,174,239,0.06)", border: "2px dashed rgba(0,174,239,0.2)" }}>
          🗂
        </div>
        <p className="text-base font-semibold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
          Aucun parcours assigné
        </p>
        <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
          Votre parcours d'intégration sera disponible après votre affectation.
        </p>
      </div>
    );
  }

  // ── Bandeau récapitulatif échéances ──
  const EcheancesBanner = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    const retard  = tasksList.filter(t => { const c = getEcheanceConfig(t.echeance, t.statut); return c && c.blink; });
    const urgent  = tasksList.filter(t => { const c = getEcheanceConfig(t.echeance, t.statut); return c && c.pulse && !c.blink; });
    const warning = tasksList.filter(t => {
      if (!t.echeance || t.statut === "TERMINE") return false;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const due = new Date(t.echeance); due.setHours(0, 0, 0, 0);
      const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      return diff >= 3 && diff <= 6;
    });

    const totalAlerts = retard.length + urgent.length + warning.length;
    if (totalAlerts === 0) return null;

    return (
      <div className="mb-4 rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between px-4 py-3 cursor-pointer transition-all hover:bg-opacity-80"
          style={{ background: totalAlerts > 0 ? (retard.length > 0 ? "#fef2f2" : "#fff7ed") : "var(--surface)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: retard.length > 0 ? "#fee2e2" : "#ffedd5", border: `1px solid ${retard.length > 0 ? "#fecaca" : "#fed7aa"}` }}>
              {retard.length > 0 ? "🚨" : "⚠️"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Alertes échéances
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${retard.length > 0 ? "badge-blink" : urgent.length > 0 ? "badge-pulse" : ""}`}
                  style={{ background: retard.length > 0 ? "#fee2e2" : "#ffedd5", color: retard.length > 0 ? "#dc2626" : "#ea580c", border: `1px solid ${retard.length > 0 ? "#fecaca" : "#fed7aa"}` }}>
                  {totalAlerts}
                </span>
              </div>
              {!isOpen && (
                <p className="text-xs mt-0.5" style={{ color: retard.length > 0 ? "#dc2626" : "#ea580c" }}>
                  {retard.length > 0 
                    ? `🚨 ${retard.length} tâche${retard.length > 1 ? 's' : ''} en retard`
                    : urgent.length > 0
                    ? `⚠️ ${urgent.length} tâche${urgent.length > 1 ? 's' : ''} urgente${urgent.length > 1 ? 's' : ''}`
                    : `📅 ${warning.length} tâche${warning.length > 1 ? 's' : ''} à surveiller`}
                </p>
              )}
            </div>
          </div>
          <button 
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
            style={{ background: "rgba(0,0,0,0.05)" }}
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
        
        {isOpen && (
          <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: "var(--border)" }}>
            {retard.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: "#dc2626" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#dc2626" }}>
                    En retard ({retard.length})
                  </span>
                </div>
                {retard.map(t => (
                  <div key={t.id}
                    onClick={() => handleOpenTask(t)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition hover:scale-[1.01] mb-1"
                    style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 badge-blink"
                      style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}>
                      <span className="text-xs">🚨</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "#991b1b", fontFamily: "Sora" }}>
                        {t.titre}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>
                        {new Date(t.echeance!).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full badge-blink"
                      style={{ background: "#fee2e2", color: "#dc2626" }}>
                      {getEcheanceConfig(t.echeance, t.statut)?.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {urgent.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: "#ea580c" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#ea580c" }}>
                    Urgent ({urgent.length})
                  </span>
                </div>
                {urgent.map(t => (
                  <div key={t.id}
                    onClick={() => handleOpenTask(t)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition hover:scale-[1.01] mb-1"
                    style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 badge-pulse"
                      style={{ background: "#ffedd5", border: "1px solid #fdba74" }}>
                      <span className="text-xs">⚡</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "#9a3412", fontFamily: "Sora" }}>
                        {t.titre}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#ea580c" }}>
                        {getEcheanceConfig(t.echeance, t.statut)?.label}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full badge-pulse"
                      style={{ background: "#ffedd5", color: "#ea580c" }}>
                      {getEcheanceConfig(t.echeance, t.statut)?.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {warning.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: "#ca8a04" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#ca8a04" }}>
                    À surveiller ({warning.length})
                  </span>
                </div>
                {warning.map(t => (
                  <div key={t.id}
                    onClick={() => handleOpenTask(t)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition hover:scale-[1.01] mb-1"
                    style={{ background: "#fefce8", border: "1px solid #fef08a" }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "#fef9c3", border: "1px solid #fde047" }}>
                      <span className="text-xs">🕐</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "#713f12", fontFamily: "Sora" }}>
                        {t.titre}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#ca8a04" }}>
                        {new Date(t.echeance!).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#fef9c3", color: "#ca8a04" }}>
                      {getEcheanceConfig(t.echeance, t.statut)?.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Liste tâches groupées par phase ───────────────────────────────
  const TaskList = () => {
    const groupedTasks = new Map<string, Task[]>();
    tasksList.forEach((task: Task) => {
      const phase = task.phase || "AUTRE";
      if (!groupedTasks.has(phase)) groupedTasks.set(phase, []);
      groupedTasks.get(phase)!.push(task);
    });

    if (tasksList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-4xl">📋</span>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune tâche</p>
        </div>
      );
    }

    const phaseOrder = ["PHASE_1", "PHASE_2", "PHASE_3", "PHASE_4", "AUTRE"];
    const result: JSX.Element[] = [];

    for (const phaseValue of phaseOrder) {
      const phaseTasks = groupedTasks.get(phaseValue);
      if (!phaseTasks || phaseTasks.length === 0) continue;

      const phaseConfig = PHASES_CONFIG.find(p => p.value === phaseValue) || {
        value: "AUTRE", label: "Autres tâches", color: "#94a3b8", bg: "rgba(148,163,184,0.08)"
      };

      const phaseCompleted = phaseTasks.filter(t => t.statut === "TERMINE").length;
      const phaseProgress  = Math.round((phaseCompleted / phaseTasks.length) * 100);

      result.push(
        <div key={phaseValue} className="mb-6 last:mb-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: phaseConfig.bg, color: phaseConfig.color }}>
              {phaseValue.replace("PHASE_", "")}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold" style={{ color: phaseConfig.color, fontFamily: "Sora" }}>
                  {phaseConfig.label}
                </p>
                <span className="text-xs font-semibold"
                  style={{ color: phaseProgress === 100 ? "#8DC63F" : phaseConfig.color }}>
                  {phaseCompleted}/{phaseTasks.length}
                </span>
              </div>
              <div className="w-full h-1 rounded-full mt-1" style={{ background: "var(--border)" }}>
                <div className="h-1 rounded-full transition-all duration-500"
                  style={{ width: `${phaseProgress}%`, background: phaseProgress === 100 ? "#8DC63F" : phaseConfig.color }} />
              </div>
            </div>
          </div>

          <div className="pl-2 space-y-2">
            {phaseTasks.map((task) => {
              const typeConf   = TASK_TYPE_CONFIG[task.taskType];
              const isSelected = selectedTask?.id === task.id;
              const isLockedQuiz = isQuizLocked(task);
              const isLocked = task.verrouille || isLockedQuiz;
              const ec = getEcheanceConfig(task.echeance, task.statut);

              return (
                <div key={task.id}
                  onClick={() => !isLocked && handleOpenTask(task)}
                  className="rounded-xl p-3 transition-all duration-200 cursor-pointer relative"
                  style={{
                    opacity: isLocked ? 0.5 : 1,
                    border: isSelected
                      ? `2px solid ${typeConf.color}`
                      : task.statut === "TERMINE"
                      ? "1px solid rgba(141,198,63,0.3)"
                      : "1px solid var(--border)",
                    background: isSelected
                      ? typeConf.bg
                      : task.statut === "TERMINE"
                      ? "rgba(141,198,63,0.03)"
                      : "var(--surface)",
                    borderLeft: (() => {
                      if (isSelected) return undefined;
                      if (!ec || (!ec.blink && !ec.pulse)) return undefined;
                      return `3px solid ${ec.color}`;
                    })(),
                  }}>
                  <div className="flex items-start gap-2">
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
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px]">
                        {task.typeActeurs?.map(a => (
                          <span key={a} className="px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(0,0,0,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                            {ACTEUR_LABELS[a]}
                          </span>
                        ))}
                        {task.echeance && (
                          <span style={{ color: "var(--text-muted)" }}>
                            📅 {new Date(task.echeance).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                      </div>
                      {task.config?.datePlanifiee && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          📌 Planifiée : {new Date(task.config.datePlanifiee).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {ec && (
                        <div className="mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ec.pulse ? "badge-pulse" : ec.blink ? "badge-blink" : ""}`}
                            style={{ background: ec.bg, color: ec.color, border: `1px solid ${ec.border}` }}>
                            {ec.pulse || ec.blink ? "⚠ " : "⏱ "}{ec.label}
                          </span>
                        </div>
                      )}
                      {task.taskType === "QUIZ" && task.scoreObtenu !== undefined && task.scoreObtenu > 0 && (
                        <p className="text-[10px] mt-1" style={{
                          color: task.scoreObtenu >= (task.config?.scoreMinimum ?? 70) ? "#8DC63F" : "#dc2626"
                        }}>
                          Score: {task.scoreObtenu}%
                        </p>
                      )}
                    </div>
                    
                    {task.typeActeurs?.includes("SALARIE") && task.statut !== "TERMINE" && (
                      <div className="mt-2 flex">
                        <button
                          className="ml-auto text-[11px] px-3 py-1 rounded-lg font-medium transition"
                          style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)" }}
                          onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}>
                          ▶ Commencer
                        </button>
                      </div>
                    )}
                    {(task.verrouille || isQuizLocked(task)) && (
                      <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1"
                        style={{ background: "rgba(245,158,11,0.10)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", backdropFilter: "blur(4px)" }}>
                        🔒 {isQuizLocked(task)
                          ? `Ouverture ${new Date(task.dateOuverture!).toLocaleDateString("fr-FR")}`
                          : "Verrouillé"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return <>{result}</>;
  };
  
  // ── Panneau détail tâche (utilisé uniquement en mode "full") ──────
  const TaskDetail = () => {
      const [localCommentText, setLocalCommentText] = useState("");
  
  const handleLocalAddComment = () => {
    if (!selectedTask || !localCommentText.trim()) return;
    const fullName = currentUser 
      ? `${currentUser.prenom || ""} ${currentUser.nom || ""}`.trim()
      : "Utilisateur";
    commentMutation.mutate({
      taskId: selectedTask.id,
      data: { auteurId: userId!, auteurNom: fullName, texte: localCommentText },
    });
    setLocalCommentText("");
  };
    if (!selectedTask) {
      return (
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
      );
    }

    const typeConf   = TASK_TYPE_CONFIG[selectedTask.taskType];
    const statutConf = STATUT_CONFIG[selectedTask.statut];
    const iAmActeur  = canActOnTask(selectedTask);
    const ec         = getEcheanceConfig(selectedTask.echeance, selectedTask.statut);

    return (
      <div className="p-8 space-y-6 max-w-3xl">
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

        <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 100%)" }}>
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
                {!iAmActeur && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: "rgba(148,163,184,0.2)", color: "#94a3b8" }}>
                    👁 Tâche à titre informatif
                  </span>
                )}
              </div>
              {/* descri 
              {selectedTask.description && (
                <p className="text-sm" style={{ color: "rgba(168,216,234,0.75)" }}>
                  {selectedTask.description}
                </p>
              )}*/}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{ background: "rgba(0,174,239,0.2)", color: "#00AEEF" }}>
                  {typeConf.label}
                </span>
                {selectedTask.typeActeurs?.map(a => (
                  <span key={a} className="text-xs px-2 py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.1)", color: "rgba(168,216,234,0.8)" }}>
                    {ACTEUR_LABELS[a]}
                  </span>
                ))}
                {ec && (
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${ec.pulse ? "badge-pulse" : ec.blink ? "badge-blink" : ""}`}
                    style={{ background: ec.bg, color: ec.color, border: `1px solid ${ec.border}` }}>
                    {ec.pulse || ec.blink ? "⚠ " : "⏱ "}{ec.label} · {new Date(selectedTask.echeance!).toLocaleDateString("fr-FR")}
                  </span>
                )}
                {selectedTask.config?.datePlanifiee && (
                  <span className="text-xs px-2 py-1 rounded-full"
                    style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF" }}>
                    📅 Planifiée : {new Date(selectedTask.config.datePlanifiee).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>

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
        
        {!canActOnTask(selectedTask) && selectedTask.statut !== "TERMINE" && (
          <div className="card p-6 text-center space-y-3">
            {selectedTask.description && (
  <div className="p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
      Description
    </p>
    <p className="text-sm whitespace-pre-line" style={{ color: "var(--text)" }}>
      {selectedTask.description}
    </p>
  </div>
)}
            <span className="text-4xl">👁</span>
            <p className="font-semibold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Cette tâche est gérée par {selectedTask.typeActeurs?.map(a => ACTEUR_LABELS[a]).join(" et ")}
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Elle contribuera automatiquement à votre progression une fois complétée.
            </p>
          </div>
        )}

        {/* FORMATION */}
        {selectedTask.taskType === "FORMATION" && canActOnTask(selectedTask) && (
          <div className="card p-6 space-y-4">
            <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>🎓 Formation</h3>
            {selectedTask.description && (
  <div className="p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
      Description
    </p>
    <p className="text-sm whitespace-pre-line" style={{ color: "var(--text)" }}>
      {selectedTask.description}
    </p>
  </div>
)}
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

        {/* QUIZ */}
        {selectedTask.taskType === "QUIZ" && canActOnTask(selectedTask) && (() => {
          if (isQuizLocked(selectedTask)) {
            const daysLeft = getDaysUntilOuverture(selectedTask);
            return (
              <div className="card p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto"
                  style={{ background: "rgba(245,158,11,0.1)" }}>🔒</div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>Quiz non disponible</h3>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Disponible dans <strong className="text-orange-500">{daysLeft} jour{daysLeft && daysLeft > 1 ? "s" : ""}</strong>
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Date d'ouverture : {new Date(selectedTask.dateOuverture!).toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
                <button type="button" onClick={() => setSelectedTask(null)} className="btn-secondary px-6 py-2">Retour</button>
              </div>
              
            );
          }
          return (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>🧠 Quiz</h3>
                  {selectedTask.description && (
  <div className="p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
      Description
    </p>
    <p className="text-sm whitespace-pre-line" style={{ color: "var(--text)" }}>
      {selectedTask.description}
    </p>
  </div>
)}
                  {selectedTask.nbTentatives > 0 && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Tentative {selectedTask.nbTentatives} / 3</p>
                  )}
                </div>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Score minimum : <strong style={{ color: "#8DC63F" }}>{selectedTask.config?.scoreMinimum ?? 70}%</strong>
                </span>
              </div>
              {selectedTask.nbTentatives >= 3 && selectedTask.statut !== "TERMINE" && (
                <div className="p-3 rounded-xl text-sm text-center"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  ⚠️ Nombre maximum de tentatives atteint. Quiz bloqué.Contacter votre manager pour débloquer .
                </div>
              )}
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
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Tentative n°{selectedTask.nbTentatives} / 3</p>
                    </div>
                    {selectedTask.scoreObtenu < (selectedTask.config?.scoreMinimum ?? 70) &&
                     selectedTask.statut !== "TERMINE" &&
                     !myProgressionDone(selectedTask) &&
                     selectedTask.nbTentatives < 3 && (
                      <button type="button"
                        onClick={() => { setQuizReponses([]); setQuizSubmitted(false); setQuizResult(null); setErrorMsg(""); }}
                        className="px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                        🔄 Réessayer ({selectedTask.nbTentatives + 1}/3)
                      </button>
                    )}
                  </div>
                </div>
              )}
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
                          <label key={`${qIndex}-${oIndex}`}
                            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition"
                            style={{
                              background: quizReponses[qIndex] === oIndex ? "rgba(0,174,239,0.08)" : "var(--surface)",
                              border: `1px solid ${quizReponses[qIndex] === oIndex ? "rgba(0,174,239,0.3)" : "var(--border)"}`,
                            }}>
                            <input type="radio" name={`q${qIndex}`}
                              checked={quizReponses[qIndex] === oIndex}
                              onChange={() => { const rep = [...quizReponses]; rep[qIndex] = oIndex; setQuizReponses(rep); }}
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
                        Correction...
                      </span>
                    ) : "🚀 Soumettre le quiz"}
                  </button>
                </div>
              )}
              {quizSubmitted && quizResult && (
                <div className="rounded-2xl p-6 text-center space-y-3"
                  style={{
                    background: quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "#a7f3d0" : "#fecaca"}`,
                  }}>
                  <div className="text-5xl">{quizResult.scoreObtenu! >= (quizResult.config?.scoreMinimum ?? 70) ? "🎉" : "😕"}</div>
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
                  {quizResult.statut !== "TERMINE" && !myProgressionDone(quizResult) && quizResult.nbTentatives < 3 && (
                    <button type="button"
                      onClick={() => { setQuizReponses([]); setQuizSubmitted(false); setQuizResult(null); }}
                      className="btn-primary px-6 py-2.5">
                      Réessayer ({quizResult.nbTentatives + 1}/3)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

   {/* SIMPLE — avec pièce jointe optionnelle */}
{selectedTask.taskType === "SIMPLE" && canActOnTask(selectedTask) && (
  <div className="card p-6 space-y-4">
    <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>✅ Tâche à réaliser</h3>
    {/*  Description à l'intérieur du cadre */}
   {selectedTask.description && (
    <div className="p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
     <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
      Description
      </p>
     <div className="text-sm" style={{ color: "var(--text)" }}>
      {selectedTask.description.split(/[.!?]+/).filter(phrase => phrase.trim().length > 0).map((phrase, index) => (
        <p key={index} className="mb-1">
          {phrase.trim()}.
        </p>
      ))}
    </div>
  </div>
)}
    {/* Document mis à disposition par l'admin */}
    {selectedTask.config?.documentNom && (
      <div className="p-4 rounded-xl space-y-2"
        style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)" }}>
        <p className="text-xs font-semibold" style={{ color: "#059669" }}>📄 Document mis à disposition</p>
        <button type="button"
          onClick={() => openBase64(selectedTask.config!.documentContenu!, selectedTask.config?.documentMimeType)}
          className="flex items-center gap-3 p-3 rounded-xl w-full text-left transition hover:opacity-80"
          style={{ background: "var(--bg)", border: "1px solid rgba(5,150,105,0.2)" }}>
          <span className="text-xl">📄</span>
          <span className="text-sm font-medium flex-1" style={{ color: "var(--text)" }}>
            {selectedTask.config.documentNom}
          </span>
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(5,150,105,0.12)", color: "#059669" }}>
            Ouvrir
          </span>
        </button>
      </div>
    )}

    {/* Indication du document attendu du salarié */}
    {selectedTask.config?.typeDocumentAttendu && (
      <div className="p-3 rounded-xl text-sm"
        style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", color: "#d97706" }}>
        📌 Document à joindre : <strong>{selectedTask.config.typeDocumentAttendu}</strong>
      </div>
    )}

    {/* 🔥 Document déposé par le salarié (avec bouton supprimer) */}
    {selectedTask.documentNom && (
      <div className="flex items-center gap-3 p-3 rounded-xl"
        style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
        <span className="text-xl">📎</span>
        <button type="button"
          className="text-sm font-medium text-emerald-700 flex-1 text-left"
          onClick={() => openBase64(selectedTask.documentContenu!, selectedTask.documentMimeType)}>
          {selectedTask.documentNom}
        </button>
        <span className="text-xs text-emerald-600">Déposé</span>
        <button
          onClick={handleDeleteDocument}
          disabled={deleteDocumentMutation.isPending}
          className="text-xs px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 transition"
          title="Supprimer et remplacer le document">
          🗑️ Supprimer
        </button>
      </div>
    )}

    {/* Formulaire d'upload (visible seulement si pas de document OU après suppression) */}
    {selectedTask.statut !== "TERMINE" && !myProgressionDone(selectedTask) && (
      <>                
        {selectedTask.config?.typeDocumentAttendu?.trim() && (
          <>
            <label className="flex items-center justify-center gap-3 w-full py-4 rounded-xl cursor-pointer transition hover:scale-[1.01]"
              style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="text-sm font-medium" style={{ color: "#00AEEF" }}>
                {docFile ? docFile.name : `📎 ${selectedTask.documentNom ? "Remplacer le document" : `Joindre ${selectedTask.config.typeDocumentAttendu}`}`}
              </span>
              <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
            {docFile && (
              <button type="button" onClick={handleDocSubmit}
                disabled={docMutation.isPending}
                className="btn-primary w-full py-3">
                {docMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Dépôt en cours...
                  </span>
                ) : selectedTask.documentNom ? "📁 Remplacer le document" : "⬆ Déposer le document"}
              </button>
            )}
          </>
        )}
        
        {/* Marquer comme effectué - seulement si AUCUN document n'est attendu */}
        {!selectedTask.config?.typeDocumentAttendu?.trim() && canCompleteTask(selectedTask) && (
          <button type="button"
            onClick={() => completeMutation.mutate(selectedTask.id)}
            disabled={completeMutation.isPending}
            className="btn-primary w-full py-3">
            {completeMutation.isPending ? "..." : "✅ Marquer comme effectué"}
          </button>
        )}
      </>
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
        ✓ Effectué
      </div>
    )}
  </div>
)}

  {/* ENTRETIEN */}
{selectedTask.taskType === "ENTRETIEN" && (
  <div className="card p-6 space-y-4">
    <h3 className="font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>🤝 Entretien</h3>
    
    {selectedTask.dateEntretien ? (
      <>
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <span className="text-2xl">📅</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#7c3aed" }}>Date planifiée</p>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
              {new Date(selectedTask.dateEntretien).toLocaleDateString("fr-FR", { 
                weekday: "long", 
                day: "2-digit", 
                month: "long", 
                year: "numeric", 
                hour: "2-digit", 
                minute: "2-digit" 
              })}
            </p>
          </div>
        </div>
        
        {/* ✅ AJOUTER L'AFFICHAGE DURÉE ET LIEU POUR LE SALARIÉ */}
        {(selectedTask.config?.dureeMinutes || selectedTask.config?.lieu) && (
          <div className="flex flex-wrap gap-4 p-3 rounded-xl"
            style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)" }}>
            
            {selectedTask.config?.dureeMinutes && (
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#7c3aed" }}>Durée</p>
                  <p className="text-sm" style={{ color: "var(--text)" }}>{selectedTask.config.dureeMinutes} min</p>
                </div>
              </div>
            )}
            
            {selectedTask.config?.dureeMinutes && selectedTask.config?.lieu && (
              <div className="w-px h-8" style={{ background: "rgba(124,58,237,0.2)" }}></div>
            )}
            
            {selectedTask.config?.lieu && (
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#7c3aed" }}>Lieu</p>
                  <p className="text-sm" style={{ color: "var(--text)" }}>{selectedTask.config.lieu}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    ) : (
      <div className="p-4 rounded-xl text-sm"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "#d97706" }}>
        ⏳ En attente de planification
      </div>
    )}
    
    {selectedTask.statut === "TERMINE" ? (
      <div className="p-3 rounded-xl text-xs text-center"
        style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669" }}>
        ✅ Entretien validé
      </div>
    ) : (
      <div className="p-3 rounded-xl text-xs text-center"
        style={{ background: "rgba(124,58,237,0.04)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.15)" }}>
        ⏳ La validation sera effectuée par votre manager
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
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{new Date(c.date).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text)" }}>{c.texte}</p>
                </div>
              ))}
            </div>
          )}
         <div className="flex gap-2">
  <input
    type="text"
    value={localCommentText}
    onChange={(e) => setLocalCommentText(e.target.value)}
    placeholder="Ajouter un commentaire..."
    className="input-field flex-1"
    onKeyDown={(e) => e.key === "Enter" && handleLocalAddComment()}
  />
  <button type="button" onClick={handleLocalAddComment}
    disabled={!localCommentText.trim() || commentMutation.isPending}
    className="btn-primary px-4 py-2">
    {commentMutation.isPending ? "..." : "Envoyer"}
  </button>
</div>
        </div>
      </div>
    );
  };

  // ── Rendu ─────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-73px)]">
      <div className="w-96 flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: "var(--border)" }}>
        <div className="p-4">
          <EcheancesBanner />
        </div>
        <div className="px-4 pb-4 space-y-6">
          <TaskList />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <TaskDetail />
      </div>

      {/* ── Modal de célébration 100% ─────────────────────────────── */}
      {showCelebration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowCelebration(false)}
        >
          {/* Confettis SVG animés */}
          <svg
            className="pointer-events-none"
            style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 51 }}
            viewBox="0 0 800 600"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {[
              { cx: 100, cy: -20, color: "#00AEEF", delay: 0, dur: 2.8 },
              { cx: 200, cy: -30, color: "#8DC63F", delay: 0.3, dur: 3.1 },
              { cx: 320, cy: -10, color: "#f59e0b", delay: 0.5, dur: 2.6 },
              { cx: 450, cy: -25, color: "#ec4899", delay: 0.1, dur: 3.3 },
              { cx: 580, cy: -15, color: "#00AEEF", delay: 0.7, dur: 2.9 },
              { cx: 680, cy: -35, color: "#8DC63F", delay: 0.4, dur: 3.0 },
              { cx: 750, cy: -5,  color: "#f59e0b", delay: 0.2, dur: 2.7 },
              { cx: 50,  cy: -40, color: "#a855f7", delay: 0.6, dur: 3.2 },
              { cx: 140, cy: -20, color: "#ec4899", delay: 0.9, dur: 2.5 },
              { cx: 260, cy: -30, color: "#00AEEF", delay: 0.8, dur: 3.4 },
              { cx: 390, cy: -10, color: "#8DC63F", delay: 0.15, dur: 2.8 },
              { cx: 510, cy: -25, color: "#f59e0b", delay: 0.55, dur: 3.1 },
              { cx: 620, cy: -15, color: "#a855f7", delay: 0.35, dur: 2.6 },
              { cx: 720, cy: -30, color: "#ec4899", delay: 0.75, dur: 3.0 },
            ].map((c, i) => (
              <rect
                key={i}
                x={c.cx} y={c.cy}
                width="10" height="14" rx="2"
                fill={c.color}
                opacity="0.9"
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from={`${c.cx} ${c.cy}`}
                  to={`${c.cx + (Math.sin(i) * 60)} 700`}
                  dur={`${c.dur}s`}
                  begin={`${c.delay}s`}
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur={`${c.dur * 0.6}s`}
                  begin={`${c.delay}s`}
                  repeatCount="indefinite"
                  additive="sum"
                />
                <animate
                  attributeName="opacity"
                  from="0.9" to="0"
                  dur={`${c.dur}s`}
                  begin={`${c.delay}s`}
                  repeatCount="indefinite"
                />
              </rect>
            ))}
          </svg>

          {/* Carte de félicitations */}
          <div
            className="relative rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 100%)",
              border: "2px solid rgba(0,174,239,0.4)",
              maxWidth: 480,
              width: "90%",
              zIndex: 52,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Icône trophée */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{
                background: "linear-gradient(135deg, #00AEEF, #8DC63F)",
                boxShadow: "0 0 40px rgba(0,174,239,0.5)",
              }}
            >
              🏆
            </div>

            {/* Titre */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "Sora" }}>
                Félicitations !
              </h2>
              <div
                className="text-sm font-semibold px-3 py-1 rounded-full inline-block mb-3"
                style={{ background: "rgba(141,198,63,0.2)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.3)" }}
              >
                Parcours complété à 100 %
              </div>
            </div>

            {/* Message personnalisé */}
            <p className="text-center text-sm leading-relaxed" style={{ color: "rgba(168,216,234,0.85)", fontFamily: "Sora" }}>
              Bravo{" "}
              <span className="font-bold text-white">
                {currentUser?.prenom ? `${currentUser.prenom} ${currentUser.nom || ""}`.trim() : ""}
              </span>{" "}
              ! Vous avez achevé avec succès votre parcours d'intégration au sein de{" "}
              <span className="font-bold" style={{ color: "#00AEEF" }}>OnboardingPro</span>.
              {parcours?.dateFin && (
                <>
                  {" "}Parcours validé le{" "}
                  <span className="font-semibold text-white">
                    {new Date(parcours.dateFin).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "long", year: "numeric"
                    })}
                  </span>
                  .
                </>
              )}
            </p>

            {/* Séparateur */}
            <div className="w-16 h-0.5 rounded-full" style={{ background: "linear-gradient(90deg,#00AEEF,#8DC63F)" }} />

            {/* Boutons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={handleDownloadCertificat}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #00AEEF, #8DC63F)",
                  color: "#fff",
                  fontFamily: "Sora",
                  boxShadow: "0 4px 20px rgba(0,174,239,0.35)",
                }}
              >
                <span>⬇️</span>
                Télécharger mon certificat
              </button>
              <button
                onClick={() => setShowCelebration(false)}
                className="flex-1 py-3 px-5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(168,216,234,0.8)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontFamily: "Sora",
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-badge { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.08)} }
        @keyframes blink-badge { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .badge-pulse { animation: pulse-badge 1.4s ease-in-out infinite; }
        .badge-blink { animation: blink-badge 1s ease-in-out infinite; }
      `}</style>
      {/* Badge unlock toast */}
      {showBadgeToast && pendingBadges.length > 0 && (
        <BadgeUnlockToast
          badges={pendingBadges}
          onAllDone={(ids) => {
            markBadgesSeen(ids);
            setShowBadgeToast(false);
            setPendingBadges([]);
          }}
        />
      )}
    </div>
  );
};

export default ParcoursWidget;