import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadDocumentApi, deleteDocumentApi } from "../api/authApi";
import { type UserDocument } from "../types/auth";

const TYPES_DOCUMENTS = [
  { value: "RIB", label: "💳 RIB bancaire" },
  { value: "CIN", label: "🪪 Carte d'identité" },
  { value: "DIPLOME", label: "🎓 Diplôme" },
  { value: "CONTRAT", label: "📄 Contrat" },
  { value: "PHOTO", label: "📷 Photo" },
  { value: "AUTRE", label: "📎 Autre" },
];

const typeIcon: Record<string, string> = {
  RIB: "💳", CIN: "🪪", DIPLOME: "🎓",
  CONTRAT: "📄", PHOTO: "📷", AUTRE: "📎",
};

interface Props {
  documents: UserDocument[];
  disabled?: boolean;
}
const detectMimeType = (base64: string): string => {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("JVBERi0")) return "application/pdf";
  if (base64.startsWith("UEsDB")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
};
const DocumentsSection = ({ documents, disabled }: Props) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docNom, setDocNom] = useState("");
  const [docType, setDocType] = useState("RIB");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [docToDelete, setDocToDelete] = useState<UserDocument | null>(null);
  const uploadMutation = useMutation({
    mutationFn: uploadDocumentApi,
    onSuccess: () => {
      setSuccessMsg("Document uploadé avec succès !");
      setShowUploadModal(false);
      setDocNom(""); setDocType("RIB"); setDocFile(null);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onError: () => setUploadError("Erreur lors de l'upload."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocumentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  const handleUpload = async () => {
    if (!docFile || !docNom.trim()) {
      setUploadError("Veuillez remplir tous les champs.");
      return;
    }
    if (docFile.size > 5 * 1024 * 1024) {
      setUploadError("Fichier trop volumineux (max 5MB).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        nom: docNom,
        type: docType,
        contenu: base64,
        mimeType: docFile.type,
      });
    };
    reader.readAsDataURL(docFile);
  };

const handlePreview = (doc: UserDocument) => {
  if (!doc.contenu) return;

  let base64 = doc.contenu;
  if (base64.includes(",")) {
    base64 = base64.split(",")[1];
  }

  const padding = base64.length % 4;
  if (padding === 2) base64 += "==";
  else if (padding === 3) base64 += "=";

  const mimeType = detectMimeType(base64);

  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);

  const blob = new Blob([byteArr], { type: mimeType });
  const url = URL.createObjectURL(blob);

  if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nom || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

  return (
    <div className="card">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#eef2ff" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Mes documents
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                RIB, diplômes, CIN, contrats...
              </p>
            </div>
          </div>
          {!disabled && (
            <button
            type="button"
              onClick={() => { setShowUploadModal(true); setUploadError(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition hover:scale-105"
              style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Ajouter
            </button>
          )}
        </div>

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
            ✅ {successMsg}
            <button type="button" onClick={() => setSuccessMsg("")} className="ml-auto opacity-60">✕</button>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3"
            style={{ border: "2px dashed var(--border)", borderRadius: "16px" }}>
            <span className="text-4xl">📂</span>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Aucun document déposé
            </p>
            {!disabled && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Cliquez sur "Ajouter" pour déposer vos documents
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id}
                className="flex items-center gap-4 p-4 rounded-2xl transition"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: "#eef2ff" }}>
                  {typeIcon[doc.type] ?? "📎"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                    {doc.nom}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#eef2ff", color: "#4f46e5" }}>
                      {TYPES_DOCUMENTS.find(t => t.value === doc.type)?.label ?? doc.type}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {new Date(doc.dateUpload).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric"
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.contenu && (
                    <button
                    type="button"
                      onClick={() => handlePreview(doc)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:scale-105"
                      style={{ background: "#ecfdf5", color: "#059669" }}
                      title="Voir le document"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  )}
                  {!disabled && (
                    <button
                    type="button"
                      onClick={() => setDocToDelete(doc)}
                      disabled={deleteMutation.isPending}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:scale-105"
                      style={{ background: "#fef2f2", color: "#dc2626" }}
                      title="Supprimer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal upload */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowUploadModal(false)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4"
            style={{ background: "var(--surface)", maxWidth: "480px", zIndex: 51 }}>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Ajouter un document
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Max 5MB — PDF, image, Word...
                </p>
              </div>
              <button type="button" onClick={() => setShowUploadModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Nom du document *
                </label>
                <input type="text" value={docNom}
                  onChange={(e) => setDocNom(e.target.value)}
                  placeholder="Ex: RIB BIAT, Diplôme Licence..."
                  className="input-field" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Type de document *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES_DOCUMENTS.map((t) => (
                    <button type="button" key={t.value}
                      onClick={() => setDocType(t.value)}
                      className="py-2.5 px-3 rounded-xl text-xs font-semibold transition text-left"
                      style={{
                        background: docType === t.value ? "#eef2ff" : "var(--bg)",
                        border: `1px solid ${docType === t.value ? "#6366f1" : "var(--border)"}`,
                        color: docType === t.value ? "#4f46e5" : "var(--text-muted)",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Fichier *
                </label>
                <label
                  className="flex items-center justify-center gap-3 w-full py-4 rounded-xl cursor-pointer transition hover:scale-[1.01]"
                  style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="text-sm font-medium" style={{ color: "#4f46e5" }}>
                    {docFile ? docFile.name : "Choisir un fichier..."}
                  </span>
                  <input ref={fileInputRef} type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={(e) => {
                      setDocFile(e.target.files?.[0] ?? null);
                      setUploadError("");
                    }}
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
                <button
                type="button"
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending || !docFile || !docNom.trim()}
                  className="btn-primary flex-1 py-3"
                >
                  {uploadMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Upload...
                    </span>
                  ) : "⬆ Déposer le document"}
                </button>
                <button type="button" onClick={() => setShowUploadModal(false)}
                  className="btn-secondary px-6 py-3">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {docToDelete && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div
      className="absolute inset-0 bg-black/60"
      onClick={() => setDocToDelete(null)}
    />

    <div
      className="relative rounded-3xl shadow-2xl p-8 w-full mx-4"
      style={{ background: "var(--surface)", maxWidth: "420px", zIndex: 51 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">⚠️</span>
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--text)", fontFamily: "Sora" }}
        >
          Supprimer le document
        </h3>
      </div>

      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Voulez-vous vraiment supprimer le document{" "}
        <strong>{docToDelete.nom}</strong> ?
        <br />
        Cette action est irréversible.
      </p>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => setDocToDelete(null)}
          className="btn-secondary px-5 py-2.5"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={() => {
            deleteMutation.mutate(docToDelete.id);
            setDocToDelete(null);
          }}
          className="px-5 py-2.5 rounded-xl font-semibold"
          style={{ background: "#dc2626", color: "white" }}
        >
          Supprimer
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default DocumentsSection;