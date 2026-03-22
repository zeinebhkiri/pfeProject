import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getCompanyDocumentsApi,
  uploadCompanyDocumentApi,
  deleteCompanyDocumentApi,
  getCompanyDocumentApi,
} from "../api/authApi";
import { type CompanyDocument } from "../types/auth";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";

const TYPES_DOCS = [
  { value: "REGLEMENT", label: "📋 Règlement intérieur", color: "#dc2626", bg: "#fef2f2" },
  { value: "MUTUELLE", label: "🏥 Mutuelle santé", color: "#059669", bg: "#ecfdf5" },
  { value: "INFO_ENTREPRISE", label: "🏢 Info entreprise", color: "#2563eb", bg: "#eff6ff" },
  { value: "SECTEUR", label: "🔭 Secteur", color: "#7c3aed", bg: "#f5f3ff" },
  { value: "PARTENAIRES", label: "🤝 Partenaires", color: "#d97706", bg: "#fffbeb" },
  { value: "AUTRE", label: "📎 Autre", color: "#64748b", bg: "#f8fafc" },
];

const detectMimeType = (base64: string): string => {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("JVBERi0")) return "application/pdf";
  if (base64.startsWith("UEsDB")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AdminDocumentsPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [docNom, setDocNom] = useState("");
  const [docType, setDocType] = useState("REGLEMENT");
  const [docDescription, setDocDescription] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("TOUS");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["companyDocuments"],
    queryFn: getCompanyDocumentsApi,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadCompanyDocumentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyDocuments"] });
      setShowModal(false);
      setDocNom(""); setDocType("REGLEMENT");
      setDocDescription(""); setDocFile(null);
    },
    onError: () => setUploadError("Erreur lors de l'upload."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompanyDocumentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyDocuments"] });
      setDeleteConfirmId(null);
    },
  });

  const handleUpload = () => {
    if (!docFile || !docNom.trim()) {
      setUploadError("Veuillez remplir tous les champs.");
      return;
    }
    if (docFile.size > 10 * 1024 * 1024) {
      setUploadError("Fichier trop volumineux (max 10MB).");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        nom: docNom,
        type: docType,
        description: docDescription,
        contenu: base64,
        mimeType: docFile.type || "application/octet-stream",
        taille: docFile.size,
      });
    };
    reader.readAsDataURL(docFile);
  };

  const handleView = async (doc: CompanyDocument) => {
    setLoadingDocId(doc.id);
    try {
      const fullDoc = await getCompanyDocumentApi(doc.id);
      if (!fullDoc.contenu) return;

      let base64 = fullDoc.contenu;
      if (base64.includes(",")) base64 = base64.split(",")[1];

      const padding = base64.length % 4;
      if (padding === 2) base64 += "==";
      else if (padding === 3) base64 += "=";

      const mimeType = detectMimeType(base64);
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++)
        byteArr[i] = byteChars.charCodeAt(i);

      const blob = new Blob([byteArr], { type: mimeType });
      const url = URL.createObjectURL(blob);

      if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = fullDoc.nom || "document";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoadingDocId(null);
    }
  };

  const filtered = filterType === "TOUS"
    ? documents
    : documents.filter((d: CompanyDocument) => d.type === filterType);

  const getTypeConfig = (type: string) =>
    TYPES_DOCS.find(t => t.value === type) ?? TYPES_DOCS[TYPES_DOCS.length - 1];

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto page-enter" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* Header */}
        <div className="border-b px-8 py-5 flex items-center justify-between sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Documents entreprise
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {documents.length} document{documents.length > 1 ? "s" : ""} déposé{documents.length > 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowModal(true); setUploadError(""); }}
            className="btn-primary flex items-center gap-2 px-5 py-2.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter un document
          </button>
        </div>

        <div className="px-8 py-8 space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-6 gap-4">
            {TYPES_DOCS.map(t => {
              const count = documents.filter((d: CompanyDocument) => d.type === t.value).length;
              return (
                <div key={t.value} className="card p-4 text-center cursor-pointer hover:scale-105 transition"
                  onClick={() => setFilterType(filterType === t.value ? "TOUS" : t.value)}
                  style={{ border: filterType === t.value ? `2px solid ${t.color}` : undefined }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mx-auto mb-2"
                    style={{ background: t.bg }}>
                    {t.label.split(" ")[0]}
                  </div>
                  <p className="text-2xl font-bold" style={{ color: t.color, fontFamily: "Sora" }}>{count}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {t.label.split(" ").slice(1).join(" ")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Filtre */}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button"
              onClick={() => setFilterType("TOUS")}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: filterType === "TOUS" ? "#4f46e5" : "var(--surface)",
                color: filterType === "TOUS" ? "white" : "var(--text-muted)",
                border: "1px solid var(--border)"
              }}>
              Tous ({documents.length})
            </button>
            {TYPES_DOCS.map(t => {
              const count = documents.filter((d: CompanyDocument) => d.type === t.value).length;
              if (count === 0) return null;
              return (
                <button type="button" key={t.value}
                  onClick={() => setFilterType(filterType === t.value ? "TOUS" : t.value)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={{
                    background: filterType === t.value ? t.color : "var(--surface)",
                    color: filterType === t.value ? "white" : "var(--text-muted)",
                    border: "1px solid var(--border)"
                  }}>
                  {t.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Liste documents */}
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4"
              style={{ border: "2px dashed var(--border)", borderRadius: "24px" }}>
              <span className="text-6xl">📂</span>
              <p className="text-lg font-semibold" style={{ color: "var(--text-muted)" }}>
                Aucun document déposé
              </p>
              <button type="button"
                onClick={() => setShowModal(true)}
                className="btn-primary px-6 py-2.5">
                Ajouter le premier document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((doc: CompanyDocument) => {
                const typeConf = getTypeConfig(doc.type);
                return (
                  <div key={doc.id} className="card p-5 flex items-start gap-4 hover:shadow-md transition">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: typeConf.bg }}>
                      {typeConf.label.split(" ")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                        {doc.nom}
                      </h3>
                      {doc.description && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                          {doc.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: typeConf.bg, color: typeConf.color }}>
                          {typeConf.label}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatSize(doc.taille)}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {new Date(doc.dateUpload).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "short", year: "numeric"
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button type="button"
                        onClick={() => handleView(doc)}
                        disabled={loadingDocId === doc.id}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:scale-105"
                        style={{ background: "#eef2ff", color: "#4f46e5" }}
                        title="Voir">
                        {loadingDocId === doc.id ? (
                          <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                      <button type="button"
                        onClick={() => setDeleteConfirmId(doc.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:scale-105"
                        style={{ background: "#fef2f2", color: "#dc2626" }}
                        title="Supprimer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal upload */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 overflow-y-auto"
            style={{ background: "var(--surface)", maxWidth: "520px", maxHeight: "90vh", zIndex: 51 }}>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Nouveau document
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Visible par tous les salariés et managers
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Nom du document *
                </label>
                <input type="text" value={docNom}
                  onChange={(e) => setDocNom(e.target.value)}
                  placeholder="Ex: Règlement intérieur 2025..."
                  className="input-field" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Catégorie *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES_DOCS.map(t => (
                    <button type="button" key={t.value}
                      onClick={() => setDocType(t.value)}
                      className="py-2.5 px-3 rounded-xl text-xs font-semibold transition text-left"
                      style={{
                        background: docType === t.value ? t.bg : "var(--bg)",
                        border: `1px solid ${docType === t.value ? t.color : "var(--border)"}`,
                        color: docType === t.value ? t.color : "var(--text-muted)",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="Brève description du document..."
                  rows={3} className="input-field" style={{ resize: "none" }} />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Fichier * (max 10MB)
                </label>
                <label className="flex items-center justify-center gap-3 w-full py-5 rounded-xl cursor-pointer transition hover:scale-[1.01]"
                  style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: "#4f46e5" }}>
                      {docFile ? docFile.name : "Choisir un fichier"}
                    </p>
                    {docFile && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {formatSize(docFile.size)}
                      </p>
                    )}
                    {!docFile && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        PDF, image, Word...
                      </p>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={(e) => { setDocFile(e.target.files?.[0] ?? null); setUploadError(""); }}
                    className="hidden" />
                </label>
              </div>

              {uploadError && (
                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  ⚠ {uploadError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending || !docFile || !docNom.trim()}
                  className="btn-primary flex-1 py-3">
                  {uploadMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Upload...
                    </span>
                  ) : "⬆ Publier le document"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="btn-secondary px-6 py-3">
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
                Supprimer ce document ?
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Ce document ne sera plus visible par les salariés et managers.
              </p>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => deleteMutation.mutate(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                  className="btn-danger flex-1 py-3">
                  {deleteMutation.isPending ? "Suppression..." : "Oui, supprimer"}
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

export default AdminDocumentsPage;