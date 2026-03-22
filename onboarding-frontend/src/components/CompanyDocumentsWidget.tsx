import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCompanyDocumentsApi, getCompanyDocumentApi } from "../api/authApi";
import { type CompanyDocument } from "../types/auth";

const TYPES_DOCS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  REGLEMENT:      { label: "Règlement",     color: "#dc2626", bg: "#fef2f2",  icon: "📋" },
  MUTUELLE:       { label: "Mutuelle",      color: "#059669", bg: "#ecfdf5",  icon: "🏥" },
  INFO_ENTREPRISE:{ label: "Entreprise",    color: "#2563eb", bg: "#eff6ff",  icon: "🏢" },
  SECTEUR:        { label: "Secteur",       color: "#7c3aed", bg: "#f5f3ff",  icon: "🔭" },
  PARTENAIRES:    { label: "Partenaires",   color: "#d97706", bg: "#fffbeb",  icon: "🤝" },
  AUTRE:          { label: "Autre",         color: "#64748b", bg: "#f8fafc",  icon: "📎" },
};

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

const CompanyDocumentsWidget = () => {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("TOUS");

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

  const filtered = activeFilter === "TOUS"
    ? documents
    : documents.filter((d: CompanyDocument) => d.type === activeFilter);

  const uniqueTypes = [...new Set(documents.map((d: CompanyDocument) => d.type))];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#eef2ff" }}>
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
              {documents.length} document{documents.length > 1 ? "s" : ""} disponible{documents.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-medium"
          style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
          📖 Lecture seule
        </span>
      </div>

      {/* Filtres */}
      {uniqueTypes.length > 1 && (
        <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <button type="button"
            onClick={() => setActiveFilter("TOUS")}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            style={{
              background: activeFilter === "TOUS" ? "#4f46e5" : "var(--bg)",
              color: activeFilter === "TOUS" ? "white" : "var(--text-muted)",
              border: "1px solid var(--border)"
            }}>
            Tous
          </button>
          {uniqueTypes.map(type => {
            const conf = TYPES_DOCS[type] ?? TYPES_DOCS.AUTRE;
            return (
              <button type="button" key={type}
                onClick={() => setActiveFilter(activeFilter === type ? "TOUS" : type)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={{
                  background: activeFilter === type ? conf.bg : "var(--bg)",
                  color: activeFilter === type ? conf.color : "var(--text-muted)",
                  border: `1px solid ${activeFilter === type ? conf.color : "var(--border)"}`
                }}>
                {conf.icon} {conf.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Liste */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-4xl">📂</span>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Aucun document disponible
            </p>
          </div>
        ) : (
          filtered.map((doc: CompanyDocument) => {
            const conf = TYPES_DOCS[doc.type] ?? TYPES_DOCS.AUTRE;
            return (
              <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg)] transition">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: conf.bg }}>
                  {conf.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                    {doc.nom}
                  </p>
                  {doc.description && (
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {doc.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: conf.bg, color: conf.color }}>
                      {conf.label}
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
                <button type="button"
                  onClick={() => handleView(doc)}
                  disabled={loadingDocId === doc.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition hover:scale-105 flex-shrink-0"
                  style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                  {loadingDocId === doc.id ? (
                    <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                  Consulter
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CompanyDocumentsWidget;