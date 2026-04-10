import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllParcoursApi,
  getAssignedTasksApi,
  validateTaskApi,
  addCommentTaskApi,
  planifierEntretienApi,
  getPositionsApi,
  getAllUsersApi,
  getParcoursOfUserApi,
} from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import {
  type Task,
  type TaskType,
  type Parcours,
  type Position,
} from "../types/auth";

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

const AdminParcoursPage = () => {
  const { role, userId } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab]       = useState<"tous" | "taches">("tous");
  const [filterRole, setFilterRole]     = useState<"TOUS" | "SALARIE" | "MANAGER">("TOUS");
  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedUserId, setSelectedUserId]   = useState<string | null>(null);
  const [selectedTask, setSelectedTask]       = useState<Task | null>(null);
  const [parcoursData, setParcoursData]       = useState<{ parcours: Parcours; tasks: Task[] } | null>(null);
  const [loadingParcours, setLoadingParcours] = useState(false);

  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validateComment, setValidateComment]     = useState("");
  const [validateApprouve, setValidateApprouve]   = useState(true);
  const [showEntretienModal, setShowEntretienModal] = useState(false);
  const [entretienDate, setEntretienDate]           = useState("");
  const [entretienFile, setEntretienFile]           = useState<File | null>(null);
  const [commentText, setCommentText] = useState("");
  const [successMsg, setSuccessMsg]   = useState("");
  const [errorMsg, setErrorMsg]       = useState("");

  // ── Helpers multi-acteur ──────────────────────────────────────────
  const rhIsActeur = (task: Task): boolean =>
    task.typeActeurs?.includes("RH") ?? false;

  const rhProgressionDone = (task: Task): boolean => {
    if (!task.acteurProgressions) return false;
    return task.acteurProgressions
      .filter(ap => ap.typeActeur === "RH")
      .some(ap => ap.complete);
  };

  const needsRhAction = (task: Task): boolean => {
    if (task.statut === "TERMINE" || task.statut === "REJETE") return false;
    if (!rhIsActeur(task)) return false;
    if (rhProgressionDone(task)) return false;
    return true;
  };

  // ── Queries ───────────────────────────────────────────────────────
  const { data: allUsers = [],      isLoading: loadingUsers }      = useQuery({ queryKey: ["allUsers"],    queryFn: getAllUsersApi });
  const { data: allParcours = [],   isLoading: loadingAllParcours } = useQuery({ queryKey: ["allParcours"], queryFn: getAllParcoursApi });
  const { data: assignedTasks = [], isLoading: loadingAssigned }   = useQuery({ queryKey: ["assignedTasks"], queryFn: getAssignedTasksApi });
  const { data: positions = [] }                                    = useQuery({ queryKey: ["positions"],   queryFn: getPositionsApi });

  // ── Mutations ─────────────────────────────────────────────────────
  const validateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) => validateTaskApi(taskId, data),
    onSuccess: (updatedTask) => {
      setSelectedTask(updatedTask);
      setShowValidateModal(false);
      setValidateComment("");
      setSuccessMsg(validateApprouve ? "Tâche validée !" : "Tâche rejetée.");
      queryClient.invalidateQueries({ queryKey: ["assignedTasks"] });
      if (parcoursData) {
        setParcoursData({ ...parcoursData, tasks: parcoursData.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) });
      }
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur validation."),
  });

  const entretienMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) => planifierEntretienApi(taskId, data),
    onSuccess: (updatedTask) => {
      setSelectedTask(updatedTask);
      setShowEntretienModal(false);
      setEntretienDate(""); setEntretienFile(null);
      setSuccessMsg("Entretien planifié !");
      queryClient.invalidateQueries({ queryKey: ["assignedTasks"] });
      if (parcoursData) {
        setParcoursData({ ...parcoursData, tasks: parcoursData.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) });
      }
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur planification."),
  });

  const commentMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) => addCommentTaskApi(taskId, data),
    onSuccess: (updatedTask) => {
      setSelectedTask(updatedTask);
      setCommentText("");
      if (parcoursData) {
        setParcoursData({ ...parcoursData, tasks: parcoursData.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) });
      }
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────
  const getPositionTitre = (positionId: string) =>
    (positions as Position[]).find(p => p.id === positionId)?.titre ?? positionId;

  const getUserById = (id: string) => (allUsers as any[]).find(u => u.id === id);

  const getParcoursForUser = (uid: string) => (allParcours as Parcours[]).find(p => p.userId === uid);

  const handleSelectUser = async (uid: string) => {
    setSelectedUserId(uid);
    setSelectedTask(null);
    setParcoursData(null);
    setLoadingParcours(true);
    try {
      const data = await getParcoursOfUserApi(uid);
      setParcoursData(data);
    } catch { setParcoursData(null); }
    finally { setLoadingParcours(false); }
  };

  const handleValidate = (approuve: boolean) => {
    if (!selectedTask) return;
    setValidateApprouve(approuve);
    setShowValidateModal(true);
  };

  const confirmValidate = () => {
    if (!selectedTask) return;
    validateMutation.mutate({
      taskId: selectedTask.id,
      data: { approuve: validateApprouve, commentaire: validateComment, auteurId: userId!, auteurNom: "Admin RH" },
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
          docData.documentContenu = base64; docData.documentNom = entretienFile.name; docData.documentMimeType = entretienFile.type;
          resolve();
        };
        reader.readAsDataURL(entretienFile);
      });
    }
    entretienMutation.mutate({ taskId: selectedTask.id, data: docData });
  };

  // ── Filtres ───────────────────────────────────────────────────────
  const usersWithParcours = (allUsers as any[]).filter(u =>
    u.role !== "ADMIN" &&
    (filterRole === "TOUS" || u.role === filterRole) &&
    (searchQuery === "" || `${u.prenom} ${u.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const adminTasks = assignedTasks as Task[];

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-hidden" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* Header */}
        <div className="border-b px-8 py-5 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>Suivi des parcours</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {(allParcours as Parcours[]).length} parcours actifs ·{" "}
                {adminTasks.filter(t => needsRhAction(t)).length} tâches RH à traiter
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[
              { key: "tous",   label: "Tous les parcours", count: (allParcours as Parcours[]).length },
              { key: "taches", label: "Mes tâches RH",     count: adminTasks.filter(t => needsRhAction(t)).length },
            ].map(tab => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as any)}
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
        <div className="px-8 pt-3 space-y-2">
          {successMsg && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              ✅ {successMsg}<button type="button" onClick={() => setSuccessMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              ⚠️ {errorMsg}<button type="button" onClick={() => setErrorMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
        </div>

        {/* ── Tab Tous les parcours ── */}
        {activeTab === "tous" && (
          <div className="flex" style={{ height: "calc(100vh - 170px)" }}>

            {/* Colonne utilisateurs */}
            <div className="w-80 flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)" }}>
              <div className="p-4 space-y-3 border-b" style={{ borderColor: "var(--border)" }}>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un employé..." className="input-field text-sm" />
                <div className="flex gap-1">
                  {(["TOUS", "SALARIE", "MANAGER"] as const).map(f => (
                    <button key={f} type="button" onClick={() => setFilterRole(f)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                      style={{
                        background: filterRole === f ? "#1A2B6B" : "var(--bg)",
                        color:      filterRole === f ? "white"   : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}>
                      {f === "TOUS" ? "Tous" : f === "SALARIE" ? "Salariés" : "Managers"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingUsers || loadingAllParcours ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-6 h-6 border-4 rounded-full animate-spin"
                      style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
                  </div>
                ) : usersWithParcours.length === 0 ? (
                  <div className="text-center py-8"><span className="text-3xl">👥</span>
                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Aucun résultat</p></div>
                ) : (
                  usersWithParcours.map((user: any) => {
                    const parcours   = getParcoursForUser(user.id);
                    const isSelected = selectedUserId === user.id;
                    return (
                      <div key={user.id} onClick={() => handleSelectUser(user.id)}
                        className="rounded-2xl p-3.5 cursor-pointer transition-all"
                        style={{
                          border: isSelected ? "2px solid #00AEEF" : "1px solid var(--border)",
                          background: isSelected ? "rgba(0,174,239,0.04)" : "var(--surface)",
                        }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                            style={{ background: user.role === "MANAGER" ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "linear-gradient(135deg, #00AEEF, #1A2B6B)" }}>
                            {user.prenom?.[0]}{user.nom?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                              {user.prenom} {user.nom}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: user.role === "MANAGER" ? "rgba(124,58,237,0.1)" : "rgba(0,174,239,0.08)",
                                  color:      user.role === "MANAGER" ? "#7c3aed" : "#00AEEF",
                                }}>
                                {user.role}
                              </span>
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {parcours ? `${parcours.progression}%` : "Aucun parcours"}
                              </span>
                            </div>
                          </div>
                          {parcours && (
                            <div className="w-8 h-8 flex-shrink-0 relative">
                              <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
                                <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="3" />
                                <circle cx="18" cy="18" r="14" fill="none"
                                  stroke={parcours.progression === 100 ? "#8DC63F" : "#00AEEF"}
                                  strokeWidth="3" strokeDasharray={`${parcours.progression} 100`} strokeLinecap="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Colonne tâches */}
            <div className="w-72 flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)" }}>
              {!selectedUserId ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <span className="text-4xl">👈</span>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sélectionnez un employé</p>
                </div>
              ) : loadingParcours ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-4 rounded-full animate-spin"
                    style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
                </div>
              ) : !parcoursData ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
                  <span className="text-4xl">🗂</span>
                  <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                    Aucun parcours pour cet employé
                  </p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b" style={{ borderColor: "var(--border)", background: "rgba(0,174,239,0.03)" }}>
                    {(() => {
                      const user = getUserById(selectedUserId);
                      return (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                            Parcours de
                          </p>
                          <p className="font-bold text-sm" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                            {user?.prenom} {user?.nom}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#00AEEF" }}>
                            💼 {getPositionTitre(parcoursData.parcours.positionId)}
                          </p>
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {parcoursData.tasks.filter(t => t.statut === "TERMINE").length}/{parcoursData.tasks.length} tâches
                              </span>
                              <span className="text-xs font-bold" style={{
                                color: parcoursData.parcours.progression === 100 ? "#8DC63F" : "#00AEEF"
                              }}>
                                {parcoursData.parcours.progression}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                              <div className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${parcoursData.parcours.progression}%`,
                                  background: parcoursData.parcours.progression === 100 ? "#8DC63F" : "#00AEEF",
                                }} />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {parcoursData.tasks.map((task) => {
                      const typeConf   = TASK_TYPE_CONFIG[task.taskType];
                      const statutConf = STATUT_CONFIG[task.statut];
                      const isSelected = selectedTask?.id === task.id;
                      const isLocked   = task.verrouille;
                      // ✅ FIXED: uses typeActeurs (array)
                      const needsAdmin = needsRhAction(task);

                      return (
                        <div key={task.id}
                          onClick={() => setSelectedTask(isLocked ? null : task)}
                          className="rounded-xl p-3 transition-all"
                          style={{
                            cursor: isLocked ? "not-allowed" : "pointer",
                            opacity: isLocked ? 0.5 : 1,
                            border: isSelected ? "2px solid #00AEEF" : "1px solid var(--border)",
                            background: isSelected ? "rgba(0,174,239,0.04)" : "var(--surface)",
                          }}>
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                              style={{ background: typeConf.bg }}>
                              {isLocked ? "🔒" : typeConf.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-xs font-semibold leading-tight" style={{ color: "var(--text)" }}>
                                  {task.titre}
                                </p>
                                {needsAdmin && (
                                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5 animate-pulse"
                                    style={{ background: "#f59e0b" }} />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: statutConf.bg, color: statutConf.color }}>
                                  {statutConf.label}
                                </span>
                                {/* ✅ FIXED: displays typeActeurs array */}
                                {task.typeActeurs?.map(a => (
                                  <span key={a} className="text-xs" style={{ color: "var(--text-muted)" }}>
                                    {ACTEUR_LABELS[a]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Colonne détail tâche */}
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedTask ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <span className="text-4xl">📋</span>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sélectionnez une tâche</p>
                </div>
              ) : (
                <div className="space-y-5 max-w-2xl">

                  {/* Header tâche */}
                  {(() => {
                    const typeConf   = TASK_TYPE_CONFIG[selectedTask.taskType];
                    const statutConf = STATUT_CONFIG[selectedTask.statut];
                    return (
                      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #0D1B3E, #1A2B6B)" }}>
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
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
                            </div>
                            {selectedTask.description && (
                              <p className="text-sm" style={{ color: "rgba(168,216,234,0.7)" }}>{selectedTask.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {/* ✅ FIXED: displays typeActeurs array */}
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

                  {/* Document salarié */}
                  {selectedTask.taskType === "DOCUMENT_SALARIE" && selectedTask.documentNom && (
                    <div className="card p-5 space-y-3">
                      <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                        📎 Document déposé par le salarié
                      </p>
                      <button type="button"
                        onClick={() => selectedTask.documentContenu && openBase64(selectedTask.documentContenu, selectedTask.documentMimeType)}
                        className="flex items-center gap-3 p-4 rounded-xl w-full text-left transition hover:scale-[1.01]"
                        style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", color: "#d97706" }}>
                        <span className="text-2xl">📎</span>
                        <span className="font-medium text-sm flex-1">{selectedTask.documentNom}</span>
                        <span className="text-xs opacity-60">Consulter</span>
                      </button>
                    </div>
                  )}

                  {/* Entretien */}
                  {selectedTask.taskType === "ENTRETIEN" && (
                    <div className="card p-5 space-y-3">
                      <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>🤝 Entretien</p>
                      {selectedTask.dateEntretien && (
                        <div className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
                          <span className="text-xl">📅</span>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: "#7c3aed" }}>Date planifiée</p>
                            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                              {new Date(selectedTask.dateEntretien).toLocaleDateString("fr-FR", {
                                weekday: "long", day: "2-digit", month: "long", year: "numeric",
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
                    </div>
                  )}

                  {/* Score quiz */}
                  {selectedTask.taskType === "QUIZ" && selectedTask.scoreObtenu !== undefined && selectedTask.scoreObtenu > 0 && (
                    <div className="card p-5">
                      <p className="text-sm font-bold mb-3" style={{ color: "var(--text)", fontFamily: "Sora" }}>🧠 Résultat quiz</p>
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16">
                          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
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
                            Min requis : {selectedTask.config?.scoreMinimum ?? 70}% · Tentatives : {selectedTask.nbTentatives}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ✅ FIXED: Actions RH — si typeActeurs includes "RH" */}
                  {rhIsActeur(selectedTask) && !rhProgressionDone(selectedTask) &&
                   selectedTask.statut !== "TERMINE" && selectedTask.statut !== "REJETE" && (
                    <div className="card p-5 space-y-3">
                      <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                        🏢 Action RH requise
                      </p>
                      {selectedTask.taskType === "ENTRETIEN" && (
                        <button type="button"
                          onClick={() => { setEntretienDate(selectedTask.dateEntretien || ""); setEntretienFile(null); setShowEntretienModal(true); }}
                          className="btn-primary w-full py-2.5">
                          {selectedTask.dateEntretien ? "✏️ Modifier l'entretien" : "📅 Planifier l'entretien"}
                        </button>
                      )}
                      <div className="flex gap-3">
                        <button type="button" onClick={() => handleValidate(true)} className="btn-success flex-1 py-2.5">
                          ✅ Valider
                        </button>
                        <button type="button" onClick={() => handleValidate(false)} className="btn-danger flex-1 py-2.5">
                          ❌ Rejeter
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RH déjà validé, en attente d'autres acteurs */}
                  {rhIsActeur(selectedTask) && rhProgressionDone(selectedTask) && selectedTask.statut !== "TERMINE" && (
                    <div className="card p-5">
                      <div className="p-3 rounded-xl text-sm text-center"
                        style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)", color: "#059669" }}>
                        ✅ Validé par RH — en attente des autres acteurs
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
                          <div key={i} className="p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
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
                      <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Ajouter un commentaire..." className="input-field flex-1 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && commentText.trim() &&
                          commentMutation.mutate({ taskId: selectedTask.id, data: { auteurId: userId!, auteurNom: "Admin RH", texte: commentText } })} />
                      <button type="button"
                        onClick={() => commentText.trim() && commentMutation.mutate({ taskId: selectedTask.id, data: { auteurId: userId!, auteurNom: "Admin RH", texte: commentText } })}
                        disabled={!commentText.trim() || commentMutation.isPending}
                        className="btn-primary px-4 py-2 text-sm">Envoyer</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Mes tâches RH ── */}
        {activeTab === "taches" && (
          <div className="px-8 py-6">
            {loadingAssigned ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 rounded-full animate-spin"
                  style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
              </div>
            ) : adminTasks.filter(t => needsRhAction(t)).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <span className="text-6xl">✅</span>
                <p className="text-lg font-semibold" style={{ color: "var(--text-muted)", fontFamily: "Sora" }}>
                  Aucune tâche en attente
                </p>
              </div>
            ) : (
              <div className="max-w-3xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                  {adminTasks.filter(t => needsRhAction(t)).length} tâche(s) assignée(s) à l'équipe RH
                </p>
                {adminTasks.filter(t => needsRhAction(t)).map((task) => {
                  const typeConf   = TASK_TYPE_CONFIG[task.taskType];
                  const statutConf = STATUT_CONFIG[task.statut];
                  return (
                    <div key={task.id} className="card p-5 flex items-center gap-4"
                      style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.02)" }}>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: typeConf.bg }}>{typeConf.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm" style={{ color: "var(--text)", fontFamily: "Sora" }}>{task.titre}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: statutConf.bg, color: statutConf.color }}>
                            {statutConf.label}
                          </span>
                        </div>
                        {task.echeance && (
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            ⏱ {new Date(task.echeance).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>
                      <button type="button"
                        onClick={() => { handleSelectUser(task.parcoursId); setSelectedTask(task); setActiveTab("tous"); }}
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
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{selectedTask?.titre}</p>
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
                    {entretienFile ? entretienFile.name : "Joindre un document (optionnel)"}
                  </span>
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={(e) => setEntretienFile(e.target.files?.[0] ?? null)} className="hidden" />
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handlePlanifierEntretien}
                  disabled={!entretienDate || entretienMutation.isPending} className="btn-primary flex-1 py-3">
                  {entretienMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />...
                    </span>
                  ) : "📅 Confirmer"}
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

export default AdminParcoursPage;