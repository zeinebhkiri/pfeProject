import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getParcoursTemplatesApi,
  createParcoursTemplateApi,
  updateParcoursTemplateApi,
  deleteParcoursTemplateApi,
  getTaskTemplatesApi,
  createTaskTemplateApi,
  updateTaskTemplateApi,
  deleteTaskTemplateApi,
  reorderTaskTemplatesApi,
  getPositionsApi,
  getTemplatesSalariesActifsApi,
  applyTemplateToUsersApi,
} from "../api/authApi";
import {
  type ParcoursTemplate,
  type TaskTemplate,
  type TaskType,
  type TypeActeur,
  type Position,
  type Question,
} from "../types/auth";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";

// ── Configs visuelles ──────────────────────────────────────────────────
const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string; bg: string }> = {
  FORMATION:        { label: "Formation",         icon: "🎓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)"   },
  QUIZ:             { label: "Quiz",              icon: "🧠", color: "#8DC63F", bg: "rgba(141,198,63,0.08)"  },
  ENTRETIEN:        { label: "Entretien",         icon: "🤝", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  SIMPLE:           { label: "Tâche simple",      icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)"  },
};

const ACTEUR_CONFIG: Record<TypeActeur, { label: string; icon: string }> = {
  SALARIE: { label: "Salarié",  icon: "👤" },
  MANAGER: { label: "Manager",  icon: "👔" },
  RH:      { label: "RH / Admin", icon: "🏢" },
};

const PHASES = [
  { value: "PHASE_1", label: "Phase 1 — Pré-onboarding",       color: "#1A2B6B", bg: "rgba(26,43,107,0.08)"  },
  { value: "PHASE_2", label: "Phase 2 — Intégration",           color: "#00AEEF", bg: "rgba(0,174,239,0.08)"  },
  { value: "PHASE_3", label: "Phase 3 — Montée en compétence",  color: "#8DC63F", bg: "rgba(141,198,63,0.08)" },
  { value: "PHASE_4", label: "Phase 4 — Validation",            color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
];

// ── Formulaire tâche vide ──────────────────────────────────────────────
const emptyTask = (): Partial<TaskTemplate> => ({
  titre: "",
  description: "",
  taskType: "SIMPLE",
  typeActeurs: ["SALARIE"],
  obligatoire: true,
  delaiJours: 0,
  config: {},
});

const AdminParcoursTemplatesPage = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  // ── États globaux ──────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<ParcoursTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ParcoursTemplate | null>(null);
  const [templateTitre, setTemplateTitre] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templatePositionId, setTemplatePositionId] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  const [taskForm, setTaskForm] = useState<Partial<TaskTemplate>>(emptyTask());

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Propagation modal
  const [showPropagateModal, setShowPropagateModal] = useState(false);
  const [propagateTemplateId, setPropagateTemplateId] = useState<string | null>(null);
  const [propagateSalaries, setPropagateSalaries] = useState<{ userId: string; prenom: string; nom: string; email: string; progression: number }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [propagateLoading, setPropagateLoading] = useState(false);
  const [propagateResult, setPropagateResult] = useState<{ applied: number; errors: string[] } | null>(null);

  // Drag & drop
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Recherche
const [searchTerm, setSearchTerm] = useState("");

  // ── Queries ───────────────────────────────────────────────────────
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["parcoursTemplates"],
    queryFn: getParcoursTemplatesApi,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositionsApi,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["taskTemplates", selectedTemplate?.id],
    queryFn: () => getTaskTemplatesApi(selectedTemplate!.id),
    enabled: !!selectedTemplate?.id,
  });


  // ── Mutations Templates ───────────────────────────────────────────
  const createTemplateMutation = useMutation({
    mutationFn: createParcoursTemplateApi,
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["parcoursTemplates"] });
      setSelectedTemplate(t);
      setSuccessMsg("Parcours template créé !");
      closeTemplateModal();
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur création template."),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateParcoursTemplateApi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcoursTemplates"] });
      setSuccessMsg("Template modifié !");
      closeTemplateModal();
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur modification."),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: deleteParcoursTemplateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcoursTemplates"] });
      if (selectedTemplate?.id === deleteConfirmId) setSelectedTemplate(null);
      setDeleteConfirmId(null);
      setSuccessMsg("Template archivé !");
    },
  });

  // ── Mutations Tasks ───────────────────────────────────────────────
  // Helper: open propagate modal after a task change
  const openPropagateModal = async (templateId: string) => {
    setPropagateTemplateId(templateId);
    setPropagateResult(null);
    setPropagateLoading(true);
    setShowPropagateModal(true);
    try {
      const sal = await getTemplatesSalariesActifsApi(templateId);
      setPropagateSalaries(sal);
      setSelectedUserIds(new Set(sal.map(s => s.userId)));
    } catch {
      setPropagateSalaries([]);
    } finally {
      setPropagateLoading(false);
    }
  };

  const createTaskMutation = useMutation({
    mutationFn: ({ ptId, data }: { ptId: string; data: Partial<TaskTemplate> }) =>
      createTaskTemplateApi(ptId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["taskTemplates", selectedTemplate?.id] });
      setSuccessMsg("Tâche ajoutée !");
      closeTaskModal();
      if (selectedTemplate?.id) openPropagateModal(selectedTemplate.id);
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur ajout tâche."),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ ptId, taskId, data }: { ptId: string; taskId: string; data: Partial<TaskTemplate> }) =>
      updateTaskTemplateApi(ptId, taskId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["taskTemplates", selectedTemplate?.id] });
      setSuccessMsg("Tâche modifiée !");
      closeTaskModal();
      if (selectedTemplate?.id) openPropagateModal(selectedTemplate.id);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: ({ ptId, taskId }: { ptId: string; taskId: string }) =>
      deleteTaskTemplateApi(ptId, taskId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["taskTemplates", selectedTemplate?.id] });
      setDeleteTaskId(null);
      setSuccessMsg("Tâche supprimée !");
      if (selectedTemplate?.id) openPropagateModal(selectedTemplate.id);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ ptId, orders }: { ptId: string; orders: { taskId: string; ordre: number }[] }) =>
      reorderTaskTemplatesApi(ptId, orders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskTemplates", selectedTemplate?.id] });
    },
  });

  const getActeursLabel = (typeActeurs?: TypeActeur[]) => {
  if (!typeActeurs || typeActeurs.length === 0) return "Aucun acteur";
  return typeActeurs.map(a => `${ACTEUR_CONFIG[a]?.icon} ${ACTEUR_CONFIG[a]?.label}`).join(" / ");
};


  // ── Helpers modals ────────────────────────────────────────────────
  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateTitre("");
    setTemplateDescription("");
    setTemplatePositionId("");
    setErrorMsg("");
    setShowTemplateModal(true);
  };

  const openEditTemplate = (t: ParcoursTemplate) => {
    setEditingTemplate(t);
    setTemplateTitre(t.titre);
    setTemplateDescription(t.description || "");
    setTemplatePositionId(t.positionId);
    setErrorMsg("");
    setShowTemplateModal(true);
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
    setErrorMsg("");
  };

  const handleTemplateSubmit = () => {
    if (!templateTitre.trim() || !templatePositionId) {
      setErrorMsg("Titre et poste sont obligatoires.");
      return;
    }
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: { titre: templateTitre, description: templateDescription },
      });
    } else {
      createTemplateMutation.mutate({
        titre: templateTitre,
        description: templateDescription,
        positionId: templatePositionId,
      });
    }
  };

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm(emptyTask());
    setErrorMsg("");
    setShowTaskModal(true);
  };

  const openEditTask = (t: TaskTemplate) => {
    setEditingTask(t);
    setTaskForm({ ...t ,
    typeActeurs: t.typeActeurs || ["SALARIE"] });
    setErrorMsg("");
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setEditingTask(null);
    setTaskForm(emptyTask());
    setErrorMsg("");
  };

  const handleTaskSubmit = () => {
    if (!taskForm.titre?.trim()) {
      setErrorMsg("Le titre est obligatoire.");
      return;
    }
    if (!taskForm.typeActeurs || taskForm.typeActeurs.length === 0) {
    setErrorMsg("Veuillez sélectionner au moins un acteur responsable.");
    return;
  }
    if (!selectedTemplate) return;

    if (editingTask) {
      updateTaskMutation.mutate({
        ptId: selectedTemplate.id,
        taskId: editingTask.id,
        data: taskForm,
      });
    } else {
      createTaskMutation.mutate({
        ptId: selectedTemplate.id,
        data: taskForm,
      });
    }
  };

  const updateConfig = (key: string, value: any) => {
    setTaskForm(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  // ── Drag & Drop ───────────────────────────────────────────────────
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex || !selectedTemplate) return;

    const reordered = [...tasks];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    const orders = reordered.map((t, i) => ({ taskId: t.id, ordre: i + 1 }));
    reorderMutation.mutate({ ptId: selectedTemplate.id, orders });

    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── Quiz helpers ──────────────────────────────────────────────────
  const addQuestion = () => {
    const questions = taskForm.config?.questions ?? [];
    const newQ: Question = {
      id: Date.now().toString(),
      texte: "",
      options: ["", "", "", ""],
      bonneReponse: 0,
      points: 10,
    };
    updateConfig("questions", [...questions, newQ]);
  };

  const updateQuestion = (qIndex: number, field: string, value: any) => {
    const questions = [...(taskForm.config?.questions ?? [])];
    questions[qIndex] = { ...questions[qIndex], [field]: value };
    updateConfig("questions", questions);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const questions = [...(taskForm.config?.questions ?? [])];
    const opts = [...questions[qIndex].options];
    opts[oIndex] = value;
    questions[qIndex] = { ...questions[qIndex], options: opts };
    updateConfig("questions", questions);
  };

  const removeQuestion = (qIndex: number) => {
    const questions = [...(taskForm.config?.questions ?? [])];
    questions.splice(qIndex, 1);
    updateConfig("questions", questions);
  };

  // ── Résoudre le titre du poste ────────────────────────────────────
  const getPositionTitre = (positionId: string) =>
    (positions as Position[]).find(p => p.id === positionId)?.titre ?? positionId;
  // Filtrer les templates par recherche
const filteredTemplates = (templates as ParcoursTemplate[]).filter(template =>
  template.titre.toLowerCase().includes(searchTerm.toLowerCase())
);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto page-enter" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* Header */}
        <div className="border-b px-8 py-5 flex items-center justify-between sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Parcours d'onboarding
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Configurez les templates de parcours par poste
            </p>
            <a
              href="/admin/archives/parcours-templates"
             className="text-sm text-[#00AEEF] hover:underline flex items-center gap-1"
            >
              🗂️ Voir les modèles archivés →
            </a>
          </div>
          <button type="button" onClick={openCreateTemplate} className="btn-primary flex items-center gap-2 px-5 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouveau modèle de parcours 
          </button>
        </div>

        {/* Messages */}
        <div className="px-8 pt-4 space-y-2">
          {successMsg && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              ✅ {successMsg}
              <button type="button" onClick={() => setSuccessMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              ⚠️ {errorMsg}
              <button type="button" onClick={() => setErrorMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
        </div>

        <div className="px-8 py-6 flex gap-6 items-start">

          {/* ── Colonne gauche — Liste templates ── */}
     <div className="w-80 flex-shrink-0 space-y-3">
  {/* Barre de recherche */}
  <div className="relative">
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="   Rechercher un parcours..."
      className="input-field pl-9"
      style={{ background: "var(--surface)", fontSize: "13px" }}
    />
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40"
      style={{ color: "var(--text-muted)" }}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    {searchTerm && (
      <button
        type="button"
        onClick={() => setSearchTerm("")}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100 transition"
        style={{ color: "var(--text-muted)" }}
      >
        ✕
      </button>
    )}
  </div>

  <p className="text-xs font-semibold uppercase tracking-widest px-1"
    style={{ color: "var(--text-muted)" }}>
    {filteredTemplates.length} / {(templates as ParcoursTemplate[]).length} parcours configurés
  </p>

  {loadingTemplates ? (
    <div className="flex items-center justify-center h-32">
      <div className="w-6 h-6 border-4 rounded-full animate-spin"
        style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
    </div>
  ) : filteredTemplates.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-2xl"
      style={{ border: "2px dashed var(--border)" }}>
      <span className="text-4xl">🔍</span>
      <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
        {searchTerm 
          ? `Aucun parcours ne correspond à "${searchTerm}"`
          : "Aucun parcours. Créez le premier."}
      </p>
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm("")}
          className="text-xs underline transition hover:opacity-80"
          style={{ color: "#00AEEF" }}
        >
          Effacer la recherche
        </button>
      )}
    </div>
  ) : (
    filteredTemplates.map(t => (
      <div key={t.id}
        onClick={() => setSelectedTemplate(t)}
        className="card p-4 cursor-pointer transition hover:shadow-md"
        style={{
          border: selectedTemplate?.id === t.id
            ? "2px solid #00AEEF"
            : "1px solid var(--border)",
          background: selectedTemplate?.id === t.id
            ? "rgba(0,174,239,0.04)"
            : "var(--surface)",
        }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              {t.titre}
            </p>
            <p className="text-xs mt-1 truncate" style={{ color: "#00AEEF" }}>
              💼 {getPositionTitre(t.positionId)}
            </p>
            {t.description && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                {t.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button type="button"
              onClick={(e) => { e.stopPropagation(); openEditTemplate(t); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:scale-110 transition"
              style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(t.id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:scale-110 transition"
              style={{ background: "#fef2f2", color: "#dc2626" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    ))
  )}
</div>

          {/* ── Colonne droite — Tâches du template sélectionné ── */}
          <div className="flex-1 min-w-0">
            {!selectedTemplate ? (
              <div className="flex flex-col items-center justify-center h-96 gap-4 rounded-3xl"
                style={{ border: "2px dashed var(--border)" }}>
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                  style={{ background: "rgba(0,174,239,0.06)" }}>
                  🗂
                </div>
                <p className="text-lg font-semibold" style={{ color: "var(--text-muted)", fontFamily: "Sora" }}>
                  Sélectionnez un parcours
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Cliquez sur un parcours pour gérer ses tâches
                </p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Header template sélectionné */}
                <div className="rounded-2xl p-5 flex items-center justify-between"
                  style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 100%)" }}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "rgba(0,174,239,0.8)" }}>
                      Parcours sélectionné
                    </p>
                    <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Sora" }}>
                      {selectedTemplate.titre}
                    </h2>
                    <p className="text-sm mt-1" style={{ color: "rgba(168,216,234,0.7)" }}>
                      💼 {getPositionTitre(selectedTemplate.positionId)}
                      {selectedTemplate.description && ` · ${selectedTemplate.description}`}
                    </p>
                  </div>
                  <button type="button" onClick={openCreateTask}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition hover:scale-105"
                    style={{ background: "rgba(0,174,239,0.2)", color: "white", border: "1px solid rgba(0,174,239,0.3)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Ajouter une tâche
                  </button>
                </div>

                {/* Info drag & drop */}
                {tasks.length > 1 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
                    style={{ background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.15)", color: "#00AEEF" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Glissez-déposez les tâches pour réordonner le parcours
                  </div>
                )}

                {/* Liste des tâches */}
                {loadingTasks ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-4 rounded-full animate-spin"
                      style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl"
                    style={{ border: "2px dashed var(--border)" }}>
                    <span className="text-4xl">📋</span>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                      Aucune tâche dans ce parcours
                    </p>
                    <button type="button" onClick={openCreateTask} className="btn-primary px-5 py-2">
                      Ajouter la première tâche
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(tasks as TaskTemplate[]).map((task, index) => {
                      const typeConf = TASK_TYPE_CONFIG[task.taskType];
                      const acteurConf = ACTEUR_CONFIG[task.typeActeurs.includes("SALARIE") ? "SALARIE" : task.typeActeurs.includes("MANAGER") ? "MANAGER" : "RH" ];
                      const isDragging = dragIndex === index;
                      const isDragOver = dragOverIndex === index;
                      const isEntretien = task.taskType === "ENTRETIEN";

                      return (
                        <div key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={() => handleDrop(index)}
                          onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                          className="card p-4 flex items-center gap-4 transition-all duration-200"
                          style={{
                            opacity: isDragging ? 0.5 : 1,
                            border: isDragOver ? "2px solid #00AEEF" : "1px solid var(--border)",
                            transform: isDragOver ? "scale(1.01)" : "scale(1)",
                            cursor: "grab",
                          }}>

                          {/* Drag handle + ordre */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="cursor-grab" style={{ color: "var(--text-muted)" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                              </svg>
                            </div>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background: typeConf.bg, color: typeConf.color }}>
                              {task.ordre}
                            </div>
                          </div>

                          {/* Icône type */}
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: typeConf.bg }}>
                            {typeConf.icon}
                          </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                                {task.titre}
                              </p>
                              {isEntretien && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: "#faf5ff", color: "#7c3aed", border: "1px solid #e9d5ff" }}>
                                  🔒 Déverrouillage auto
                                </span>
                              )}
                              {/* Ajouter dans le badge row de chaque tâche */}
{task.phase && (() => {
  const phaseConf = PHASES.find(p => p.value === task.phase);
  return phaseConf ? (
    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: phaseConf.bg, color: phaseConf.color }}>
      {phaseConf.label.split("—")[0].trim()}
    </span>
  ) : null;
})()}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: typeConf.bg, color: typeConf.color }}>
                                {typeConf.icon} {typeConf.label}
                              </span>
<span className="text-xs" style={{ color: "var(--text-muted)" }}>
  {getActeursLabel(task.typeActeurs)}
</span>
                              {task.delaiJours > 0  && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  ⏱ J+{task.delaiJours}
                                </span>
                              )}
                               {  task.delaiJours < 0 && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  ⏱ J{task.delaiJours}
                                </span>
                              )}
                              {task.taskType === "QUIZ" && task.config?.scoreMinimum && (
                                <span className="text-xs" style={{ color: "#8DC63F" }}>
                                  🎯 Score min: {task.config.scoreMinimum}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button type="button" onClick={() => openEditTask(task)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:scale-110 transition"
                              style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button type="button" onClick={() => setDeleteTaskId(task.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:scale-110 transition"
                              style={{ background: "#fef2f2", color: "#dc2626" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14H6L5 6"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Modal Template ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeTemplateModal} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "500px", zIndex: 51 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  {editingTemplate ? "Modifier le parcours" : "Nouveau parcours template"}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {editingTemplate ? "Modifiez les informations" : "Créez un nouveau parcours pour un poste"}
                </p>
              </div>
              <button type="button" onClick={closeTemplateModal}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Titre du parcours *
                </label>
                <input type="text" value={templateTitre}
                  onChange={(e) => setTemplateTitre(e.target.value)}
                  placeholder="Ex: Parcours Développeur Logiciel"
                  className="input-field" />
              </div>
              {!editingTemplate && (
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Poste associé *
                  </label>
                  <select value={templatePositionId}
                    onChange={(e) => setTemplatePositionId(e.target.value)}
                    className="input-field">
                    <option value="">— Sélectionner un poste —</option>
                    {(positions as Position[]).map((p) => (
                      <option key={p.id} value={p.id}>{p.titre}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Décrivez ce parcours d'onboarding..."
                  rows={3} className="input-field" style={{ resize: "none" }} />
              </div>
              {errorMsg && (
                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  ⚠ {errorMsg}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleTemplateSubmit}
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  className="btn-primary flex-1 py-3">
                  {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enregistrement...
                    </span>
                  ) : editingTemplate ? "💾 Enregistrer" : "✓ Créer"}
                </button>
                <button type="button" onClick={closeTemplateModal} className="btn-secondary px-6 py-3">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Tâche ── */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeTaskModal} />
          <div className="relative rounded-3xl shadow-2xl w-full mx-4 modal-panel overflow-hidden"
            style={{ background: "var(--surface)", maxWidth: "680px", zIndex: 51, maxHeight: "90vh" }}>

            {/* Header modal tâche */}
            <div className="flex items-center justify-between px-8 py-6 border-b"
              style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  {editingTask ? "Modifier la tâche" : "Nouvelle tâche"}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {selectedTemplate?.titre}
                </p>
              </div>
              <button type="button" onClick={closeTaskModal}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>✕</button>
            </div>

            <div className="overflow-y-auto px-8 py-6 space-y-5" style={{ maxHeight: "calc(90vh - 140px)" }}>

              {/* Titre */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Titre de la tâche *
                </label>
                <input type="text" value={taskForm.titre || ""}
                  onChange={(e) => setTaskForm(p => ({ ...p, titre: e.target.value }))}
                  placeholder="Ex: Formation Java Fondamentaux"
                  className="input-field" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea value={taskForm.description || ""}
                  onChange={(e) => setTaskForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Décrivez cette tâche..."
                  rows={2} className="input-field" style={{ resize: "none" }} />
              </div>
              {/* Phase */}
<div>
  <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
    style={{ color: "var(--text-muted)" }}>
    Phase du parcours
  </label>
  <div className="grid grid-cols-2 gap-2">
    {PHASES.map(p => (
      <label key={p.value}
        className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition"
        style={{
          background: taskForm.phase === p.value ? p.bg : "var(--bg)",
          border: `1px solid ${taskForm.phase === p.value ? p.color : "var(--border)"}`,
        }}>
        <input
          type="radio"
          name="phase"
          value={p.value}
          checked={taskForm.phase === p.value}
          onChange={() => setTaskForm(prev => ({ ...prev, phase: p.value }))}
          style={{ accentColor: p.color }}
        />
        <span className="text-xs font-semibold" style={{ color: taskForm.phase === p.value ? p.color : "var(--text-muted)" }}>
          {p.label}
        </span>
      </label>
    ))}
  </div>
</div>

              {/* Type + Acteur */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Type de tâche *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(TASK_TYPE_CONFIG) as [TaskType, any][]).map(([type, conf]) => (
                      <button type="button" key={type}
                        onClick={() => setTaskForm(p => ({ ...p, taskType: type, config: {} }))}
                        className="py-2 px-3 rounded-xl text-xs font-semibold transition text-left flex items-center gap-2"
                        style={{
                          background: taskForm.taskType === type ? conf.bg : "var(--bg)",
                          border: `1px solid ${taskForm.taskType === type ? conf.color : "var(--border)"}`,
                          color: taskForm.taskType === type ? conf.color : "var(--text-muted)",
                        }}>
                        <span>{conf.icon}</span>
                        <span>{conf.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

<div className="space-y-3">
  <div>
    <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
      Acteurs responsables <span className="text-blue-400">(plusieurs choix possibles)</span>
    </label>
    <div className="space-y-2">
      {(Object.entries(ACTEUR_CONFIG) as [TypeActeur, any][]).map(([type, conf]) => {
        const isChecked = taskForm.typeActeurs?.includes(type) || false;
        
        return (
          <label key={type} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition group"
            style={{
              background: isChecked ? "rgba(0,174,239,0.06)" : "var(--bg)",
              border: `1px solid ${isChecked ? "rgba(0,174,239,0.3)" : "var(--border)"}`,
            }}>
            <input 
              type="checkbox" 
              checked={isChecked}
              onChange={() => {
                if (isChecked) {
                  setTaskForm(prev => ({
                    ...prev,
                    typeActeurs: (prev.typeActeurs || []).filter(t => t !== type)
                  }));
                } else {
                  setTaskForm(prev => ({
                    ...prev,
                    typeActeurs: [...(prev.typeActeurs || []), type]
                  }));
                }
              }}
              className="w-4 h-4 rounded transition"
              style={{ accentColor: "#00AEEF" }}
            />
            <span className="text-sm flex-1">{conf.icon} {conf.label}</span>
            {isChecked && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#00AEEF", color: "white" }}>
                ✓
              </span>
            )}
          </label>
        );
      })}
    </div>
  </div>
</div>
              </div>

              {/* Délai + Obligatoire */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Délai (jours depuis début)
                  </label>
                  <input type="number" min={-7}
                    value={taskForm.delaiJours || 0}
                    onChange={(e) => setTaskForm(p => ({ ...p, delaiJours: parseInt(e.target.value) || 0 }))}
                    className="input-field" />
                </div>
              </div>

              {/* ── Config selon le type ── */}

              {/* FORMATION */}
              {taskForm.taskType === "FORMATION" && (
                <div className="rounded-2xl p-5 space-y-4"
                  style={{ background: "rgba(0,174,239,0.04)", border: "1px solid rgba(0,174,239,0.15)" }}>
                  <p className="text-sm font-bold" style={{ color: "#00AEEF" }}>🎓 Configuration Formation</p>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      URL Vidéo (YouTube, Vimeo...)
                    </label>
                    <input type="url" value={taskForm.config?.videoUrl || ""}
                      onChange={(e) => updateConfig("videoUrl", e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Ou uploader un fichier PDF/Vidéo
                    </label>
                    <label className="flex items-center justify-center gap-3 w-full py-4 rounded-xl cursor-pointer"
                      style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span className="text-sm font-medium" style={{ color: "#00AEEF" }}>
                        {taskForm.config?.fichierNom || "Choisir un fichier PDF ou vidéo"}
                      </span>
                      <input type="file" accept=".pdf,.mp4,.mov,.avi,.webm"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                            // ✅ AJOUT ICI
  if (file.size > 3 * 1024 * 1024) {
    setErrorMsg("Fichier trop lourd (max 3MB)");
    return;
  }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64 = (reader.result as string).split(",")[1];
                            updateConfig("fichierContenu", base64);
                            updateConfig("fichierNom", file.name);
                            updateConfig("fichierMimeType", file.type);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden" />
                    </label>
                  </div>
                </div>
              )}

              {/* QUIZ */}
              {taskForm.taskType === "QUIZ" && (
                <div className="rounded-2xl p-5 space-y-4"
                  style={{ background: "rgba(141,198,63,0.04)", border: "1px solid rgba(141,198,63,0.2)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold" style={{ color: "#8DC63F" }}>🧠 Configuration Quiz</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Score minimum pour valider (%)
                    </label>
                    <input type="number" min={0} max={100}
                      value={taskForm.config?.scoreMinimum || 70}
                      onChange={(e) => updateConfig("scoreMinimum", parseInt(e.target.value))}
                      className="input-field" style={{ maxWidth: "120px" }} />
                  </div>

                  {/* Questions */}
                  <div className="space-y-4">
                    {(taskForm.config?.questions ?? []).map((q, qIndex) => (
                      <div key={q.id} className="p-4 rounded-xl space-y-3"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold" style={{ color: "#8DC63F" }}>
                            Question {qIndex + 1}
                          </span>
                          <button type="button" onClick={() => removeQuestion(qIndex)}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{ background: "#fef2f2", color: "#dc2626" }}>
                            Supprimer
                          </button>
                        </div>
                        <input type="text" value={q.texte}
                          onChange={(e) => updateQuestion(qIndex, "texte", e.target.value)}
                          placeholder="Texte de la question"
                          className="input-field" />
                        <div className="grid grid-cols-2 gap-2">
                          {q.options.map((opt, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <input type="radio" name={`q${qIndex}`}
                                checked={q.bonneReponse === oIndex}
                                onChange={() => updateQuestion(qIndex, "bonneReponse", oIndex)}
                                style={{ accentColor: "#8DC63F" }} />
                              <input type="text" value={opt}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                                className="input-field text-xs py-1.5" />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs" style={{ color: "var(--text-muted)" }}>Points :</label>
                          <input type="number" min={1} value={q.points}
                            onChange={(e) => updateQuestion(qIndex, "points", parseInt(e.target.value))}
                            className="input-field text-xs py-1.5" style={{ maxWidth: "80px" }} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addQuestion}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition"
                      style={{ background: "rgba(141,198,63,0.08)", color: "#8DC63F", border: "1px dashed rgba(141,198,63,0.3)" }}>
                      + Ajouter une question
                    </button>
                  </div>
                </div>
              )}

              {/* SIMPLE — pièce jointe optionnelle */}
              {taskForm.taskType === "SIMPLE" && (
                <div className="rounded-2xl p-5 space-y-4"
                  style={{ background: "rgba(5,150,105,0.04)", border: "1px solid rgba(5,150,105,0.15)" }}>
                  <p className="text-sm font-bold" style={{ color: "#059669" }}>✅ Options de la tâche simple</p>

                  {/* Date planifiée */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Date planifiée (optionnel)
                    </label>
                    <input type="date"
                      value={taskForm.config?.datePlanifiee || ""}
                      onChange={(e) => updateConfig("datePlanifiee", e.target.value)}
                      className="input-field" />
                  </div>

                  {/* Document mis à disposition par l'admin (lu par salarié/manager) */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Document à mettre à disposition (optionnel)
                    </label>
                    <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                      Ce document sera visible par le salarié et le manager dans la tâche (ex : consigne, formulaire, guide…)
                    </p>
                    <label className="flex items-center justify-center gap-3 w-full py-4 rounded-xl cursor-pointer transition hover:opacity-80"
                      style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span className="text-sm font-medium" style={{ color: "#059669" }}>
                        {taskForm.config?.documentNom || "Choisir un fichier (PDF, image, Word…)"}
                      </span>
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64 = (reader.result as string).split(",")[1];
                            updateConfig("documentContenu", base64);
                            updateConfig("documentNom", file.name);
                            updateConfig("documentMimeType", file.type);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden" />
                    </label>
                    {taskForm.config?.documentNom && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 mt-2 rounded-xl text-sm"
                        style={{ background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", color: "#059669" }}>
                        <span>📎 {taskForm.config.documentNom}</span>
                        <button type="button"
                          onClick={() => {
                            updateConfig("documentContenu", undefined);
                            updateConfig("documentNom", undefined);
                            updateConfig("documentMimeType", undefined);
                          }}
                          className="text-xs opacity-60 hover:opacity-100 transition">
                          ✕ Retirer
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Document à joindre par le salarié */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Document à joindre par le salarié (optionnel)
                    </label>
                    <input type="text"
                      value={taskForm.config?.typeDocumentAttendu || ""}
                      onChange={(e) => updateConfig("typeDocumentAttendu", e.target.value)}
                      placeholder="Ex: Contrat signé, attestation de formation..."
                      className="input-field" />
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Si renseigné, le salarié pourra joindre un document pour compléter la tâche.
                    </p>
                  </div>
                </div>
              )}

              {/* ENTRETIEN */}
              {taskForm.taskType === "ENTRETIEN" && (
                <div className="rounded-2xl p-5 space-y-3"
                  style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)" }}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: "#7c3aed" }}>🤝 Configuration Entretien</p>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#faf5ff", color: "#7c3aed", border: "1px solid #e9d5ff" }}>
                      🔒 Se déverrouille automatiquement
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Cette tâche sera déverrouillée uniquement lorsque toutes les tâches précédentes seront terminées.
                    L'acteur est automatiquement le manager.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Durée (minutes)
                      </label>
                      <input type="number" min={15}
                        value={taskForm.config?.dureeMinutes || 30}
                        onChange={(e) => updateConfig("dureeMinutes", parseInt(e.target.value))}
                        className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Lieu
                      </label>
                      <input type="text"
                        value={taskForm.config?.lieu || ""}
                        onChange={(e) => updateConfig("lieu", e.target.value)}
                        placeholder="Salle de réunion, Teams..."
                        className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Notes / Objectifs
                    </label>
                    <textarea value={taskForm.config?.notesEntretien || ""}
                      onChange={(e) => updateConfig("notesEntretien", e.target.value)}
                      placeholder="Objectifs de l'entretien..."
                      rows={2} className="input-field" style={{ resize: "none" }} />
                  </div>
                </div>
              )}

              {/* SIMPLE */}
                            {errorMsg && (
                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  ⚠ {errorMsg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleTaskSubmit}
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                  className="btn-primary flex-1 py-3">
                  {createTaskMutation.isPending || updateTaskMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enregistrement...
                    </span>
                  ) : editingTask ? "💾 Enregistrer" : "✓ Ajouter la tâche"}
                </button>
                <button type="button" onClick={closeTaskModal} className="btn-secondary px-6 py-3">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm supprimer template ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4"
            style={{ background: "var(--surface)", maxWidth: "400px", zIndex: 51 }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: "#fef2f2" }}>🗑</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
               Désactiver ce parcours  ?
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Toutes les tâches associées seront supprimées. Les parcours déjà générés ne seront pas affectés.
              </p>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => deleteTemplateMutation.mutate(deleteConfirmId)}
                  disabled={deleteTemplateMutation.isPending}
                  className="btn-danger flex-1 py-3">
                  {deleteTemplateMutation.isPending ? "Suppression..." : "Oui, supprimer"}
                </button>
                <button type="button" onClick={() => setDeleteConfirmId(null)}
                  className="btn-secondary flex-1 py-3">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Modal Propagation ── */}
      {showPropagateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { if (!propagateLoading) { setShowPropagateModal(false); setPropagateResult(null); } }} />
          <div className="relative rounded-3xl shadow-2xl w-full mx-4 flex flex-col"
            style={{ background: "var(--surface)", maxWidth: "520px", maxHeight: "80vh", zIndex: 51 }}>

            {/* Header */}
            <div className="px-7 py-6 flex items-center gap-4 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--border)", background: "linear-gradient(135deg,#00AEEF15,#1A2B6B08)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "rgba(0,174,239,0.12)", border: "1px solid rgba(0,174,239,0.2)" }}>
                🔄
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Appliquer les modifications
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Sélectionnez les salariés dont le parcours sera mis à jour
                </p>
              </div>
              <button type="button" onClick={() => { setShowPropagateModal(false); setPropagateResult(null); }}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-7 py-5 space-y-4">
              {propagateResult ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto"
                    style={{ background: "#ecfdf5" }}>✅</div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      Modifications appliquées
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                      {propagateResult.applied} parcours mis à jour avec succès
                    </p>
                  </div>
                  {propagateResult.errors.length > 0 && (
                    <div className="rounded-xl px-4 py-3 text-left"
                      style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                      <p className="text-xs font-bold text-red-600 mb-1">Erreurs :</p>
                      {propagateResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-500">{e}</p>
                      ))}
                    </div>
                  )}
                  <button type="button"
                    onClick={() => { setShowPropagateModal(false); setPropagateResult(null); }}
                    className="btn-primary px-8 py-2.5">Fermer</button>
                </div>
              ) : propagateLoading ? (
                <div className="flex items-center justify-center py-10 gap-3">
                  <div className="w-6 h-6 border-4 rounded-full animate-spin"
                    style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement des salariés...</span>
                </div>
              ) : propagateSalaries.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">👤</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    Aucun salarié n'a ce parcours actif
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Les modifications seront appliquées aux prochaines affectations.
                  </p>
                  <button type="button" onClick={() => { setShowPropagateModal(false); }}
                    className="btn-secondary px-6 py-2.5 mt-4">Fermer</button>
                </div>
              ) : (
                <>
                  <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
                    style={{ background: "rgba(0,174,239,0.06)", border: "1px solid rgba(0,174,239,0.15)" }}>
                    <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                    <p style={{ color: "var(--text-muted)" }}>
                      Les tâches déjà complétées ne seront pas supprimées. Seules les{" "}
                      <strong style={{ color: "var(--text)" }}>nouvelles tâches</strong> du template seront ajoutées.
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      {propagateSalaries.length} salarié{propagateSalaries.length > 1 ? "s" : ""} avec ce parcours actif
                    </p>
                    <button type="button"
                      onClick={() => selectedUserIds.size === propagateSalaries.length
                        ? setSelectedUserIds(new Set())
                        : setSelectedUserIds(new Set(propagateSalaries.map(s => s.userId)))}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      {selectedUserIds.size === propagateSalaries.length ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {propagateSalaries.map(s => {
                      const checked = selectedUserIds.has(s.userId);
                      return (
                        <div key={s.userId}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition"
                          style={{
                            background: checked ? "rgba(0,174,239,0.06)" : "var(--bg)",
                            border: `1.5px solid ${checked ? "rgba(0,174,239,0.25)" : "var(--border)"}`,
                          }}
                          onClick={() => {
                            const next = new Set(selectedUserIds);
                            checked ? next.delete(s.userId) : next.add(s.userId);
                            setSelectedUserIds(next);
                          }}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: checked ? "#00AEEF" : "var(--surface)", border: `2px solid ${checked ? "#00AEEF" : "var(--border)"}` }}>
                            {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#00AEEF,#1A2B6B)" }}>
                            {s.prenom[0]}{s.nom[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{s.prenom} {s.nom}</p>
                            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{s.email}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-xs font-bold" style={{ color: "#00AEEF" }}>{s.progression}%</span>
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                              <div className="h-full rounded-full" style={{ width: `${s.progression}%`, background: "#00AEEF" }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!propagateResult && !propagateLoading && propagateSalaries.length > 0 && (
              <div className="px-7 py-5 flex gap-3 flex-shrink-0"
                style={{ borderTop: "1px solid var(--border)" }}>
                <button type="button"
                  disabled={selectedUserIds.size === 0}
                  onClick={async () => {
                    if (!propagateTemplateId || selectedUserIds.size === 0) return;
                    setPropagateLoading(true);
                    try {
                      const res = await applyTemplateToUsersApi(propagateTemplateId, Array.from(selectedUserIds));
                      setPropagateResult(res);
                    } catch (e: any) {
                      setErrorMsg(e.response?.data?.error || "Erreur lors de l'application.");
                      setShowPropagateModal(false);
                    } finally {
                      setPropagateLoading(false);
                    }
                  }}
                  className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  🔄 Appliquer à {selectedUserIds.size} salarié{selectedUserIds.size > 1 ? "s" : ""}
                </button>
                <button type="button"
                  onClick={() => { setShowPropagateModal(false); setPropagateResult(null); }}
                  className="btn-secondary px-6 py-3">
                  Ignorer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm supprimer tâche ── */}
      {deleteTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTaskId(null)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4"
            style={{ background: "var(--surface)", maxWidth: "400px", zIndex: 51 }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: "#fef2f2" }}>🗑</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Supprimer cette tâche ?
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Les autres tâches seront réordonnées automatiquement.
              </p>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => deleteTaskMutation.mutate({ ptId: selectedTemplate!.id, taskId: deleteTaskId })}
                  disabled={deleteTaskMutation.isPending}
                  className="btn-danger flex-1 py-3">
                  {deleteTaskMutation.isPending ? "Suppression..." : "Oui, supprimer"}
                </button>
                <button type="button" onClick={() => setDeleteTaskId(null)}
                  className="btn-secondary flex-1 py-3">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminParcoursTemplatesPage;