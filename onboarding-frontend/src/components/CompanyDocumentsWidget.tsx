import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCompanyDocumentsApi, getCompanyDocumentApi } from "../api/authApi";
import { type CompanyDocument } from "../types/auth";

const TYPES_DOCS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  REGLEMENT:       { label: "Règlement",   color: "#dc2626", bg: "#fef2f2", icon: "📋" },
  MUTUELLE:        { label: "Mutuelle",    color: "#059669", bg: "#ecfdf5", icon: "🏥" },
  INFO_ENTREPRISE: { label: "Entreprise",  color: "#2563eb", bg: "#eff6ff", icon: "🏢" },
  SECTEUR:         { label: "Secteur",     color: "#7c3aed", bg: "#f5f3ff", icon: "🔭" },
  PARTENAIRES:     { label: "Partenaires", color: "#d97706", bg: "#fffbeb", icon: "🤝" },
  AUTRE:           { label: "Autre",       color: "#64748b", bg: "#f8fafc", icon: "📎" },
};

const detectMimeType = (base64: string): string => {
  if (base64.startsWith("/9j/"))         return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("JVBERi0"))     return "application/pdf";
  if (base64.startsWith("UEsDB"))       return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CompanyDocumentsWidget = () => {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["companyDocuments"],
    queryFn: getCompanyDocumentsApi,
  });

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
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mimeType });
      const url  = URL.createObjectURL(blob);
      if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = fullDoc.nom || "document";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoadingDocId(null);
    }
  };

  return (
    <div className="card overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#eef2ff" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Documents entreprise
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {documents.length} document{documents.length !== 1 ? "s" : ""} disponible{documents.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-medium"
          style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
          📖 Lecture seule
        </span>
      </div>

      {/* Liste */}
      <div className="space-y-2 max-h-72 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-28">
            <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">📂</p>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Aucun document disponible
            </p>
          </div>
        ) : (
          (documents as CompanyDocument[]).map((doc) => {
            const conf = TYPES_DOCS[doc.type] ?? TYPES_DOCS.AUTRE;
            return (
              <div key={doc.id} className="p-3.5 rounded-2xl transition-all"
                style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: conf.bg }}>
                      {conf.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>
                        {doc.nom}
                      </p>
                      {doc.description && (
                        <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)", maxWidth: 200 }}>
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: conf.bg, color: conf.color }}>
                    {conf.label}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    📦 {formatSize(doc.taille)} · {new Date(doc.dateUpload).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  <button type="button"
                    onClick={() => handleView(doc)}
                    disabled={loadingDocId === doc.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition hover:scale-105 flex-shrink-0"
                    style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                    {loadingDocId === doc.id ? (
                      <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                    Consulter
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CompanyDocumentsWidget;