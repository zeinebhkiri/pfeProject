import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getTeamParcoursApi,
  validateTaskApi,
  addCommentTaskApi,
  planifierEntretienApi,
  completeTaskApi,
} from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import { type Task, type TaskType, type User, type Parcours, type StatutTask } from "../types/auth";

// ── Configs visuelles ──────────────────────────────────────────────────
const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string; bg: string }> = {
  FORMATION:        { label: "Formation",        icon: "🎓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)"   },
  QUIZ:             { label: "Quiz",             icon: "🧠", color: "#8DC63F", bg: "rgba(141,198,63,0.08)"  },
  DOCUMENT_RH:      { label: "Document RH",      icon: "📄", color: "#1A2B6B", bg: "rgba(26,43,107,0.08)"  },
  DOCUMENT_SALARIE: { label: "Document Salarié", icon: "📎", color: "#d97706", bg: "rgba(217,119,6,0.08)"  },
  ENTRETIEN:        { label: "Entretien",        icon: "🤝", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  SIMPLE:           { label: "Tâche simple",     icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)"  },
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

interface TeamMember {
  salarie: User;
  parcours: Parcours | Record<string, never>;
  tasks: Task[];
}

const ManagerParcoursPage = () => {
  const { role, userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedTask, setSelectedTask]     = useState<Task | null>(null);
  const [activeTab, setActiveTab]           = useState<"parcours" | "taches">("parcours");

  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validateComment, setValidateComment]     = useState("");
  const [validateApprouve, setValidateApprouve]   = useState(true);

  const [showEntretienModal, setShowEntretienModal] = useState(false);
  const [entretienDate, setEntretienDate]           = useState("");
  const [entretienFile, setEntretienFile]           = useState<File | null>(null);
  const [entretienDocPreview, setEntretienDocPreview] = useState<string | null>(null);

  const [commentText, setCommentText] = useState("");
  const [successMsg, setSuccessMsg]   = useState("");
  const [errorMsg, setErrorMsg]       = useState("");

  // ── Helper : le manager est-il acteur de cette tâche ? ─────────────
  const managerIsActeur = (task: Task): boolean =>
    task.typeActeurs?.includes("MANAGER") ?? false;

  /** La part du manager dans cette tâche est-elle déjà faite ? */
  const managerProgressionDone = (task: Task): boolean => {
    if (!task.acteurProgressions) return false;
    return task.acteurProgressions
      .filter(ap => ap.typeActeur === "MANAGER")
      .some(ap => ap.complete);
  };

  /** Une action manager est-elle requise sur cette tâche ? */
  const needsManagerAction = (task: Task): boolean => {
    if (task.statut === "TERMINE" || task.statut === "REJETE") return false;
    if (!managerIsActeur(task)) return false;
    if (managerProgressionDone(task)) return false;
    // Pour DOCUMENT_SALARIE : seulement si le salarié a déjà déposé
    if (task.taskType === "DOCUMENT_SALARIE" && !task.documentNom) return false;
    return true;
  };

  // ── Queries ───────────────────────────────────────────────────────
  const { data: teamData = [], isLoading } = useQuery({
    queryKey: ["teamParcours"],
    queryFn: getTeamParcoursApi,
  });

  const teamList = teamData as TeamMember[];

  // ── Mutations ─────────────────────────────────────────────────────
  const validateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      validateTaskApi(taskId, data),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["teamParcours"] });
      setSelectedTask(updatedTask);
      setShowValidateModal(false);
      setValidateComment("");
      setSuccessMsg(validateApprouve ? "Tâche validée !" : "Tâche rejetée.");
      if (selectedMember) {
        setSelectedMember({
          ...selectedMember,
          tasks: selectedMember.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
        });
      }
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur validation."),
  });

  const completeMutation = useMutation({
    mutationFn: completeTaskApi,
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["teamParcours"] });
      setSelectedTask(updatedTask);
      setSuccessMsg("Tâche marquée comme effectuée !");
      if (selectedMember) {
        setSelectedMember({
          ...selectedMember,
          tasks: selectedMember.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
        });
      }
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur."),
  });

  const entretienMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      planifierEntretienApi(taskId, data),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["teamParcours"] });
      setSelectedTask(updatedTask);
      setShowEntretienModal(false);
      setEntretienDate(""); setEntretienFile(null); setEntretienDocPreview(null);
      setSuccessMsg("Entretien planifié avec succès !");
      if (selectedMember) {
        setSelectedMember({
          ...selectedMember,
          tasks: selectedMember.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
        });
      }
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur planification."),
  });

  const commentMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      addCommentTaskApi(taskId, data),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["teamParcours"] });
      setSelectedTask(updatedTask);
      setCommentText("");
      if (selectedMember) {
        setSelectedMember({
          ...selectedMember,
          tasks: selectedMember.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
        });
      }
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const handleValidate = (approuve: boolean) => {
    if (!selectedTask) return;
    setValidateApprouve(approuve);
    setShowValidateModal(true);
  };

  const confirmValidate = () => {
    if (!selectedTask) return;
    validateMutation.mutate({
      taskId: selectedTask.id,
      data: { approuve: validateApprouve, commentaire: validateComment, auteurId: userId!, auteurNom: "Manager" },
    });
  };

  const handlePlanifierEntretien = async () => {
    if (!selectedTask || !entretienDate) { setErrorMsg("La date est obligatoire."); return; }
    let docData: any = { dateEntretien: entretienDate };
    if (entretienFile) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          docData.documentContenu = base64;
          docData.documentNom = entretienFile.name;
          docData.documentMimeType = entretienFile.type;
          resolve();
        };
        reader.readAsDataURL(entretienFile);
      });
    }
    entretienMutation.mutate({ taskId: selectedTask.id, data: docData });
  };

  // ── Tâches en attente d'action manager ────────────────────────────
  const tasksPendingAction = teamList.flatMap(m =>
    (m.tasks || [])
      .filter(t => needsManagerAction(t))
      .map(t => ({ ...t, _salarie: m.salarie }))
  );

  // ── Loading ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin"
              style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement des parcours...</p>
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
                Suivi des parcours
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {teamList.length} membre{teamList.length > 1 ? "s" : ""} dans votre équipe
              </p>
            </div>
            <button type="button" onClick={() => navigate("/parcours")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition hover:scale-105"
              style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.2)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Mon parcours
            </button>
          </div>

          <div className="flex items-center gap-1 mt-4">
            {[
              { key: "parcours", label: "Parcours équipe",   count: teamList.length },
              { key: "taches",   label: "Tâches à traiter",  count: tasksPendingAction.length },
            ].map(tab => (
              <button key={tab.key} type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: activeTab === tab.key ? "#00AEEF" : "var(--bg)",
                  color:      activeTab === tab.key ? "white"   : "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}>
                {tab.label}
                {tab.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: activeTab === tab.key ? "rgba(255,255,255,0.25)" : "rgba(0,174,239,0.1)",
                      color:      activeTab === tab.key ? "white" : "#00AEEF",
                    }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="px-8 pt-4 space-y-2">
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
        </div>

        {/* ── Tab Parcours équipe ── */}
        {activeTab === "parcours" && (
          <div className="flex h-[calc(100vh-160px)]">

            {/* Membres */}
            <div className="w-80 flex-shrink-0 border-r overflow-y-auto p-4 space-y-2"
              style={{ borderColor: "var(--border)" }}>
              {teamList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span className="text-4xl">👥</span>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun membre dans votre équipe</p>
                </div>
              ) : (
                teamList.map((member) => {
                  const parcours   = member.parcours as Parcours;
                  const isSelected = selectedMember?.salarie?.id === member.salarie?.id;
                  const hasParcours = parcours && "id" in parcours;
                  const progression = hasParcours ? parcours.progression : 0;
                  const completed   = (member.tasks || []).filter(t => t.statut === "TERMINE").length;
                  const total       = (member.tasks || []).length;
                  const pendingCount = (member.tasks || []).filter(t => needsManagerAction(t)).length;

                  return (
                    <div key={member.salarie?.id}
                      onClick={() => { setSelectedMember(member); setSelectedTask(null); }}
                      className="rounded-2xl p-4 cursor-pointer transition-all"
                      style={{
                        border: isSelected ? "2px solid #00AEEF" : "1px solid var(--border)",
                        background: isSelected ? "rgba(0,174,239,0.04)" : "var(--surface)",
                      }}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #00AEEF, #1A2B6B)" }}>
                          {member.salarie?.prenom?.[0]}{member.salarie?.nom?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                              {member.salarie?.prenom} {member.salarie?.nom}
                            </p>
                            {pendingCount > 0 && (
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: "#f59e0b", color: "white" }}>
                                {pendingCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {member.salarie?.email}
                          </p>
                        </div>
                      </div>
                      {hasParcours ? (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{completed}/{total} tâches</span>
                            <span className="text-xs font-bold" style={{ color: progression === 100 ? "#8DC63F" : "#00AEEF" }}>
                              {progression}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                            <div className="h-1.5 rounded-full transition-all"
                              style={{ width: `${progression}%`, background: progression === 100 ? "#8DC63F" : "#00AEEF" }} />
                          </div>
                          <div className="mt-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                background: parcours.statut === "TERMINE" ? "#ecfdf5" : "rgba(0,174,239,0.08)",
                                color: parcours.statut === "TERMINE" ? "#059669" : "#00AEEF",
                              }}>
                              {parcours.statut === "TERMINE" ? "✅ Terminé" :
                               parcours.statut === "EXPIRE"  ? "⚠️ Expiré" : "🔄 En cours"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun parcours</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Tâches + Détail */}
            <div className="flex-1 overflow-y-auto">
              {!selectedMember ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                    style={{ background: "rgba(0,174,239,0.06)" }}>👆</div>
                  <p className="text-lg font-semibold" style={{ color: "var(--text-muted)", fontFamily: "Sora" }}>
                    Sélectionnez un membre
                  </p>
                </div>
              ) : (
                <div className="flex h-full">

                  {/* Liste tâches */}
                  <div className="w-80 flex-shrink-0 border-r overflow-y-auto p-4 space-y-2"
                    style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold uppercase tracking-widest px-1 mb-3"
                      style={{ color: "var(--text-muted)" }}>
                      Tâches de {selectedMember.salarie?.prenom}
                    </p>
                    {(selectedMember.tasks || []).map((task) => {
                      const typeConf   = TASK_TYPE_CONFIG[task.taskType];
                      const statutConf = STATUT_CONFIG[task.statut];
                      const isSelected = selectedTask?.id === task.id;
                      const pending    = needsManagerAction(task);
                      const iAmActeur  = managerIsActeur(task);

                      return (
                        <div key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="rounded-2xl p-3.5 cursor-pointer transition-all"
                          style={{
                            border: isSelected ? "2px solid #00AEEF" : "1px solid var(--border)",
                            background: isSelected ? "rgba(0,174,239,0.04)" : "var(--surface)",
                          }}>
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                              style={{ background: typeConf.bg }}>
                              {typeConf.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-sm font-semibold leading-tight"
                                  style={{ color: "var(--text)", fontFamily: "Sora" }}>
                                  {task.titre}
                                </p>
                                {pending && (
                                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1 animate-pulse"
                                    style={{ background: "#f59e0b" }} />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: statutConf.bg, color: statutConf.color }}>
                                  {statutConf.label}
                                </span>
                                {/* Acteurs */}
                                {task.typeActeurs?.map(a => (
                                  <span key={a} className="text-xs px-1.5 py-0.5 rounded-full"
                                    style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                                    {ACTEUR_LABELS[a]}
                                  </span>
                                ))}
                                {!iAmActeur && (
                                  <span className="text-xs" style={{ color: "#94a3b8" }}>👁</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Détail tâche */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {!selectedTask ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3">
                        <span className="text-4xl">📋</span>
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sélectionnez une tâche</p>
                      </div>
                    ) : (
                      <div className="space-y-5 max-w-2xl">

                        {/* Header */}
                        {(() => {
                          const typeConf   = TASK_TYPE_CONFIG[selectedTask.taskType];
                          const statutConf = STATUT_CONFIG[selectedTask.statut];
                          const iAmActeur  = managerIsActeur(selectedTask);
                          return (
                            <div className="rounded-2xl p-5"
                              style={{ background: "linear-gradient(135deg, #0D1B3E, #1A2B6B)" }}>
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                                  style={{ background: "rgba(255,255,255,0.1)" }}>
                                  {typeConf.icon}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h2 className="text-lg font-bold text-white" style={{ fontFamily: "Sora" }}>
                                      {selectedTask.titre}
                                    </h2>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                      style={{ background: statutConf.bg, color: statutConf.color }}>
                                      {statutConf.label}
                                    </span>
                                    {!iAmActeur && (
                                      <span className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: "rgba(148,163,184,0.2)", color: "#94a3b8" }}>
                                        👁 Informatif
                                      </span>
                                    )}
                                  </div>
                                  {selectedTask.description && (
                                    <p className="text-sm" style={{ color: "rgba(168,216,234,0.7)" }}>
                                      {selectedTask.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    {selectedTask.typeActeurs?.map(a => (
                                      <span key={a} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: "rgba(255,255,255,0.1)", color: "rgba(168,216,234,0.8)" }}>
                                        {ACTEUR_LABELS[a]}
                                      </span>
                                    ))}
                                    {selectedTask.echeance && (
                                      <span className="text-xs" style={{ color: "rgba(168,216,234,0.6)" }}>
                                        ⏱ {new Date(selectedTask.echeance).toLocaleDateString("fr-FR")}
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

                        {/* Document déposé par salarié */}
                        {selectedTask.taskType === "DOCUMENT_SALARIE" && selectedTask.documentNom && (
                          <div className="card p-5 space-y-3">
                            <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                              📎 Document déposé par {selectedMember.salarie?.prenom}
                            </p>
                            <button type="button"
                              onClick={() => selectedTask.documentContenu && openBase64(selectedTask.documentContenu, selectedTask.documentMimeType)}
                              className="flex items-center gap-3 p-4 rounded-xl w-full text-left transition hover:scale-[1.01]"
                              style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", color: "#d97706" }}>
                              <span className="text-2xl">📎</span>
                              <span className="font-medium text-sm flex-1">{selectedTask.documentNom}</span>
                              <span className="text-xs opacity-60">Consulter</span>
                            </button>
                            {needsManagerAction(selectedTask) && (
                              <div className="flex gap-3">
                                <button type="button" onClick={() => handleValidate(true)} className="btn-success flex-1 py-2.5">
                                  ✅ Valider le document
                                </button>
                                <button type="button" onClick={() => handleValidate(false)} className="btn-danger flex-1 py-2.5">
                                  ❌ Rejeter
                                </button>
                              </div>
                            )}
                            {managerProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                              <div className="p-3 rounded-xl text-sm text-center"
                                style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                                ✅ Validé de votre côté — en attente des autres acteurs
                              </div>
                            )}
                          </div>
                        )}

                        {/* Entretien */}
                        {selectedTask.taskType === "ENTRETIEN" && managerIsActeur(selectedTask) && (
                          <div className="card p-5 space-y-4">
                            <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                              🤝 Gestion de l'entretien
                            </p>
                            {selectedTask.dateEntretien && (
                              <div className="flex items-center gap-3 p-3 rounded-xl"
                                style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
                                <span className="text-xl">📅</span>
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: "#7c3aed" }}>Date planifiée</p>
                                  <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                                    {new Date(selectedTask.dateEntretien).toLocaleDateString("fr-FR", {
                                      weekday: "long", day: "2-digit", month: "long", year: "numeric"
                                    })}
                                  </p>
                                </div>
                              </div>
                            )}
                            {selectedTask.documentEntretienContenu && (
                              <button type="button"
                                onClick={() => openBase64(selectedTask.documentEntretienContenu!, selectedTask.documentEntretienMimeType)}
                                className="flex items-center gap-3 p-3 rounded-xl w-full text-left"
                                style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)", color: "#7c3aed" }}>
                                <span className="text-xl">📄</span>
                                <span className="text-sm flex-1">{selectedTask.documentEntretienNom}</span>
                                <span className="text-xs opacity-60">Voir</span>
                              </button>
                            )}
                            {selectedTask.statut !== "TERMINE" && (
                              <button type="button"
                                onClick={() => { setEntretienDate(selectedTask.dateEntretien || ""); setEntretienFile(null); setEntretienDocPreview(null); setShowEntretienModal(true); }}
                                className="btn-primary w-full py-2.5">
                                {selectedTask.dateEntretien ? "✏️ Modifier l'entretien" : "📅 Planifier l'entretien"}
                              </button>
                            )}
                            {selectedTask.dateEntretien && !managerProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                              <button type="button" onClick={() => handleValidate(true)} className="btn-success w-full py-2.5">
                                ✅ Valider — Entretien effectué
                              </button>
                            )}
                            {managerProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                              <div className="p-3 rounded-xl text-sm text-center"
                                style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                                ✅ Validé de votre côté — en attente des autres acteurs
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tâche SIMPLE/FORMATION avec manager comme acteur */}
                        {selectedTask.taskType !== "ENTRETIEN" &&
                         selectedTask.taskType !== "DOCUMENT_SALARIE" &&
                         managerIsActeur(selectedTask) &&
                         selectedTask.statut !== "TERMINE" &&
                         selectedTask.statut !== "REJETE" && (
                          <div className="card p-5 space-y-3">
                            <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                              Actions manager
                            </p>
                            {!managerProgressionDone(selectedTask) ? (
                              <div className="flex gap-3">
                                <button type="button" onClick={() => completeMutation.mutate(selectedTask.id)}
                                  disabled={completeMutation.isPending}
                                  className="btn-success flex-1 py-2.5">
                                  {completeMutation.isPending ? "..." : "✅ Marquer comme effectué"}
                                </button>
                                <button type="button" onClick={() => handleValidate(false)} className="btn-danger flex-1 py-2.5">
                                  ❌ Rejeter
                                </button>
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl text-sm text-center"
                                style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                                ✅ Votre part est complète — en attente des autres acteurs
                              </div>
                            )}
                          </div>
                        )}

                        {/* Score quiz */}
                        {selectedTask.taskType === "QUIZ" && selectedTask.scoreObtenu !== undefined && selectedTask.scoreObtenu > 0 && (
                          <div className="card p-5">
                            <p className="text-sm font-bold mb-3" style={{ color: "var(--text)", fontFamily: "Sora" }}>🧠 Résultat du quiz</p>
                            <div className="flex items-center gap-4">
                              <div className="relative w-16 h-16">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="3" />
                                  <circle cx="18" cy="18" r="16" fill="none"
                                    stroke={selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#8DC63F" : "#dc2626"}
                                    strokeWidth="3" strokeDasharray={`${selectedTask.scoreObtenu} 100`} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-bold"
                                    style={{ color: selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "#8DC63F" : "#dc2626" }}>
                                    {selectedTask.scoreObtenu}%
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                                  {selectedTask.scoreObtenu >= (selectedTask.config?.scoreMinimum ?? 70) ? "✅ Réussi" : "❌ Échoué"}
                                </p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  Minimum requis : {selectedTask.config?.scoreMinimum ?? 70}% · Tentatives : {selectedTask.nbTentatives}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Commentaires */}
                        <div className="card p-5 space-y-3">
                          <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>💬 Commentaires</p>
                          {selectedTask.commentaires.length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun commentaire</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedTask.commentaires.map((c, i) => (
                                <div key={i} className="p-3 rounded-xl"
                                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{c.auteurNom}</span>
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                      {new Date(c.date).toLocaleDateString("fr-FR")}
                                    </span>
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
                                commentMutation.mutate({ taskId: selectedTask.id, data: { auteurId: userId!, auteurNom: "Manager", texte: commentText } })} />
                            <button type="button"
                              onClick={() => commentText.trim() && commentMutation.mutate({ taskId: selectedTask.id, data: { auteurId: userId!, auteurNom: "Manager", texte: commentText } })}
                              disabled={!commentText.trim() || commentMutation.isPending}
                              className="btn-primary px-4 py-2 text-sm">Envoyer</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Tâches à traiter ── */}
        {activeTab === "taches" && (
          <div className="px-8 py-6">
            {tasksPendingAction.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <span className="text-6xl">✅</span>
                <p className="text-lg font-semibold" style={{ color: "var(--text-muted)", fontFamily: "Sora" }}>
                  Aucune tâche en attente
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Toutes les tâches assignées au manager sont traitées.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                  {tasksPendingAction.length} tâche{tasksPendingAction.length > 1 ? "s" : ""} en attente d'action
                </p>
                {tasksPendingAction.map((task: any) => {
                  const typeConf   = TASK_TYPE_CONFIG[task.taskType as TaskType];
                  const statutConf = STATUT_CONFIG[task.statut as StatutTask];
                  return (
                    <div key={task.id} className="card p-5 flex items-center gap-4"
                      style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.02)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: typeConf.bg }}>{typeConf.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm" style={{ color: "var(--text)", fontFamily: "Sora" }}>{task.titre}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: statutConf.bg, color: statutConf.color }}>{statutConf.label}</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          👤 {task._salarie?.prenom} {task._salarie?.nom}
                        </p>
                      </div>
                      <button type="button"
                        onClick={() => {
                          const member = teamList.find(m => m.salarie?.id === task._salarie?.id);
                          if (member) { setSelectedMember(member); setSelectedTask(task); setActiveTab("parcours"); }
                        }}
                        className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition hover:scale-105"
                        style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.2)" }}>
                        Traiter →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Modal Validation ── */}
      {showValidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowValidateModal(false)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "460px", zIndex: 51 }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                {validateApprouve ? "✅ Valider la tâche" : "❌ Rejeter la tâche"}
              </h3>
              <button type="button" onClick={() => setShowValidateModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Commentaire {!validateApprouve && "*"}
                </label>
                <textarea value={validateComment} onChange={(e) => setValidateComment(e.target.value)}
                  placeholder={validateApprouve ? "Commentaire optionnel..." : "Expliquez la raison du rejet..."}
                  rows={3} className="input-field" style={{ resize: "none" }} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={confirmValidate}
                  disabled={validateMutation.isPending || (!validateApprouve && !validateComment.trim())}
                  className={validateApprouve ? "btn-success flex-1 py-3" : "btn-danger flex-1 py-3"}>
                  {validateMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />...
                    </span>
                  ) : validateApprouve ? "Confirmer la validation" : "Confirmer le rejet"}
                </button>
                <button type="button" onClick={() => setShowValidateModal(false)} className="btn-secondary px-6 py-3">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Entretien ── */}
      {showEntretienModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowEntretienModal(false)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "500px", zIndex: 51 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>📅 Planifier l'entretien</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Avec {selectedMember?.salarie?.prenom} {selectedMember?.salarie?.nom}
                </p>
              </div>
              <button type="button" onClick={() => setShowEntretienModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Date de l'entretien *
                </label>
                <input type="datetime-local" value={entretienDate} onChange={(e) => setEntretienDate(e.target.value)}
                  className="input-field" min={new Date().toISOString().slice(0, 16)} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Document de préparation (optionnel)
                </label>
                <label className="flex items-center justify-center gap-3 w-full py-4 rounded-xl cursor-pointer"
                  style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="text-sm font-medium" style={{ color: "#7c3aed" }}>
                    {entretienFile ? entretienFile.name : "Joindre un document (PDF, Word...)"}
                  </span>
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setEntretienFile(file); const r = new FileReader(); r.onloadend = () => setEntretienDocPreview(r.result as string); r.readAsDataURL(file); }
                    }} className="hidden" />
                </label>
                {entretienFile && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: "rgba(124,58,237,0.06)", color: "#7c3aed" }}>
                    📎 {entretienFile.name}
                    <button type="button" onClick={() => { setEntretienFile(null); setEntretienDocPreview(null); }} className="ml-auto opacity-60">✕</button>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handlePlanifierEntretien}
                  disabled={!entretienDate || entretienMutation.isPending} className="btn-primary flex-1 py-3">
                  {entretienMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Planification...
                    </span>
                  ) : "📅 Confirmer l'entretien"}
                </button>
                <button type="button" onClick={() => setShowEntretienModal(false)} className="btn-secondary px-6 py-3">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerParcoursPage;