import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDocumentApi } from "../api/authApi";
import { type UserDocument } from "../types/auth";

const typeIcon: Record<string, string> = {
  RIB: "💳", CIN: "🪪", DIPLOME: "🎓",
  CONTRAT: "📄", PHOTO: "📷", AUTRE: "📎",
};

const TYPES_LABELS: Record<string, string> = {
  RIB: "RIB bancaire", CIN: "Carte d'identité",
  DIPLOME: "Diplôme", CONTRAT: "Contrat",
  PHOTO: "Photo", AUTRE: "Autre",
};

interface Props {
  userId: string;
  documents: UserDocument[];
}
const detectMimeType = (base64: string): string => {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("JVBERi0")) return "application/pdf";
  if (base64.startsWith("UEsDB")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
};
const DocumentsReadOnly = ({ userId, documents }: Props) => {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);



const handleView = async (doc: UserDocument) => {
  setLoadingDocId(doc.id);
  try {
    const fullDoc = await getDocumentApi(userId, doc.id);

    if (!fullDoc.contenu) return;

    let base64 = fullDoc.contenu;
    if (base64.includes(",")) {
      base64 = base64.split(",")[1];
    }

    const padding = base64.length % 4;
    if (padding === 2) base64 += "==";
    else if (padding === 3) base64 += "=";

    // Détecter le vrai mimeType depuis le contenu
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
    console.error("Erreur document:", err);
  } finally {
    setLoadingDocId(null);
  }
};
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "#f5f3ff" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
            Documents déposés
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lecture seule</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full"
            style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ede9fe" }}>
            👁 {documents.length} document{documents.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3"
          style={{ border: "2px dashed var(--border)", borderRadius: "16px" }}>
          <span className="text-3xl">📂</span>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun document déposé par ce salarié
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id}
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "#f5f3ff" }}>
                {typeIcon[doc.type] ?? "📎"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                  {doc.nom}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                    {TYPES_LABELS[doc.type] ?? doc.type}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(doc.dateUpload).toLocaleDateString("fr-FR", {
                      day: "2-digit", month: "short", year: "numeric"
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleView(doc)}
                disabled={loadingDocId === doc.id}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition hover:scale-105"
                style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}
              >
                {loadingDocId === doc.id ? (
                  <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
                Voir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsReadOnly;