import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getPositionsApi,createPositionApi, updatePositionApi, deletePositionApi} from "../api/authApi";
import { type Position } from "../types/auth";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";


const AdminPostesPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingPoste, setEditingPoste] = useState<Position | null>(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositionsApi,
  });

  const createMutation = useMutation({
    mutationFn: (data: { titre: string; description: string }) =>
  createPositionApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setSuccessMsg("Poste créé avec succès !");
      closeModal();
    },
    onError: (error: any) => {
      setErrorMsg(error.response?.data?.error || "Erreur lors de la création.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; titre: string; description: string }) =>
  updatePositionApi(data.id, { titre: data.titre, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setSuccessMsg("Poste modifié avec succès !");
      closeModal();
    },
    onError: (error: any) => {
      setErrorMsg(error.response?.data?.error || "Erreur lors de la modification.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePositionApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDeleteConfirmId(null);
      setSuccessMsg("Poste désactivé avec succès !");
    },
    onError: () => setErrorMsg("Erreur lors de la suppression."),
  });

  const openCreate = () => {
    setEditingPoste(null);
    setTitre("");
    setDescription("");
    setErrorMsg("");
    setShowModal(true);
  };

  const openEdit = (p: Position) => {
    setEditingPoste(p);
    setTitre(p.titre);
    setDescription(p.description || "");
    setErrorMsg("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPoste(null);
    setTitre("");
    setDescription("");
    setErrorMsg("");
  };

  const handleSubmit = () => {
    if (!titre.trim()) {
      setErrorMsg("Le titre est obligatoire.");
      return;
    }
    if (editingPoste) {
      updateMutation.mutate({ id: editingPoste.id, titre, description });
    } else {
      createMutation.mutate({ titre, description });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto page-enter" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* Header */}
        <div className="border-b px-8 py-5 flex items-center justify-between sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Gestion des postes
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {(positions as Position[]).length} poste{(positions as Position[]).length > 1 ? "s" : ""} configuré{(positions as Position[]).length > 1 ? "s" : ""}
            </p>
          </div>
          <button type="button"
            onClick={openCreate}
            className="btn-primary flex items-center gap-2 px-5 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouveau poste
          </button>
        </div>

        <div className="px-8 py-8 space-y-4">

          {/* Messages */}
          {successMsg && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              ✅ {successMsg}
              <button type="button" onClick={() => setSuccessMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              ⚠️ {errorMsg}
              <button type="button" onClick={() => setErrorMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}

          {/* Liste postes */}
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 rounded-full animate-spin"
                style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            </div>
          ) : (positions as Position[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4"
              style={{ border: "2px dashed var(--border)", borderRadius: "24px" }}>
              <span className="text-6xl">💼</span>
              <p className="text-lg font-semibold" style={{ color: "var(--text-muted)" }}>
                Aucun poste configuré
              </p>
              <button type="button" onClick={openCreate} className="btn-primary px-6 py-2.5">
                Créer le premier poste
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(positions as Position[]).map((p, index) => (
                <div key={p.id} className="card p-5 flex items-start gap-4 hover:shadow-md transition group">
                  {/* Numéro */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                    style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.15)" }}>
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      {p.titre}
                    </h3>
                    {p.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                        {p.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(141,198,63,0.1)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.2)" }}>
                        ✓ Actif
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button"
                      onClick={() => openEdit(p)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:scale-105"
                      style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF" }}
                      title="Modifier">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button type="button"
                      onClick={() => setDeleteConfirmId(p.id)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:scale-105"
                      style={{ background: "#fef2f2", color: "#dc2626" }}
                      title="Désactiver">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal créer / modifier */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "480px", zIndex: 51 }}>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  {editingPoste ? "Modifier le poste" : "Nouveau poste"}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {editingPoste ? "Modifiez les informations du poste" : "Créez un nouveau poste disponible à l'affectation"}
                </p>
              </div>
              <button type="button" onClick={closeModal}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Titre du poste *
                </label>
                <input type="text" value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex: Développeur logiciel"
                  className="input-field" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brève description du poste..."
                  rows={3} className="input-field" style={{ resize: "none" }} />
              </div>

              {errorMsg && (
                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  ⚠ {errorMsg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={handleSubmit}
                  disabled={isPending || !titre.trim()}
                  className="btn-primary flex-1 py-3">
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {editingPoste ? "Modification..." : "Création..."}
                    </span>
                  ) : editingPoste ? "💾 Enregistrer" : "✓ Créer le poste"}
                </button>
                <button type="button" onClick={closeModal} className="btn-secondary px-6 py-3">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4"
            style={{ background: "var(--surface)", maxWidth: "400px", zIndex: 51 }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: "#fef2f2" }}>
                🗑
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Désactiver ce poste ?
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Ce poste ne sera plus disponible lors des affectations. Les affectations existantes ne sont pas affectées.
              </p>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => deleteMutation.mutate(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                  className="btn-danger flex-1 py-3">
                  {deleteMutation.isPending ? "Suppression..." : "Oui, désactiver"}
                </button>
                <button type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="btn-secondary flex-1 py-3">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPostesPage;