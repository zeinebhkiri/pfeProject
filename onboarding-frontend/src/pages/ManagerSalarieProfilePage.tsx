import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getUserByIdApi, getAffectationByUserApi ,getPositionsApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import DocumentsReadOnly from "../components/DocumentsReadOnly";
import { type Position } from "../types/auth";
const statutConfig: Record<string, { label: string; class: string }> = {
  EN_ATTENTE: { label: "En attente", class: "bg-amber-50 text-amber-700 border border-amber-200" },
  ACCEPTE: { label: "Profil soumis", class: "bg-blue-50 text-blue-700 border border-blue-200" },
  VALIDE: { label: "Validé", class: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  DESACTIVE: { label: "Désactivé", class: "bg-slate-100 text-slate-500 border border-slate-200" },
  EXPIRE: { label: "Expiré", class: "bg-orange-50 text-orange-600 border border-orange-200" },
};

const ManagerSalarieProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

const { data: user, isLoading } = useQuery({
  queryKey: ["managerUserView", id], // ← clé unique
  queryFn: () => getUserByIdApi(id!),
  enabled: !!id,
  staleTime: 0,
});

const { data: positions = [] } = useQuery({
  queryKey: ["positions"],
  queryFn: getPositionsApi,
});

const { data: affectation } = useQuery({
  queryKey: ["managerAffectationView", id], // ← clé unique
  queryFn: () => getAffectationByUserApi(id!),
  enabled: !!id,
  retry: false,
  staleTime: 0,
});

  if (isLoading) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role="MANAGER" />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!user) return null;

  const completion = user.profilCompletion ?? 0;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="MANAGER" />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* Header */}
        <div className="border-b px-8 py-5 flex items-center gap-4 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <button onClick={() => navigate("/manager/equipe")}
            className="text-sm flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "var(--border)", color: "var(--text-muted)" }}>
            ← Retour
          </button>
          <div className="w-px h-5" style={{ background: "var(--border)" }} />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              {user.prenom[0]}{user.nom[0]}
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                {user.prenom} {user.nom}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`badge ${statutConfig[user.statutCompte]?.class}`}>
              {statutConfig[user.statutCompte]?.label}
            </span>
            <span className="badge bg-slate-100 text-slate-600 border border-slate-200">
              {user.role}
            </span>
          </div>
        </div>

        <div className="px-8 py-8 max-w-5xl space-y-5 page-enter">

          <div className="grid grid-cols-3 gap-5">

            {/* Colonne gauche */}
            <div className="space-y-5">

              {/* Progression */}
              <div className="card p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide mb-4"
                  style={{ color: "var(--text-muted)" }}>
                  Complétion du profil
                </p>
                <div className="relative w-28 h-28 mx-auto mb-4">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="16" fill="none"
                      stroke={completion === 100 ? "#10b981" : "#7c3aed"}
                      strokeWidth="2.5"
                      strokeDasharray={`${completion} 100`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-2xl font-bold ${completion === 100 ? "text-emerald-600" : "text-violet-600"}`}
                      style={{ fontFamily: "Sora" }}>
                      {completion}%
                    </span>
                  </div>
                </div>
                {completion === 100
                  ? <p className="text-xs font-medium text-emerald-600">✓ Profil complet</p>
                  : <p className="text-xs" style={{ color: "var(--text-muted)" }}>Profil incomplet</p>}
              </div>

              {/* Info statut */}
              <div className="card p-6">
                <p className="text-xs font-semibold uppercase tracking-wide mb-4"
                  style={{ color: "var(--text-muted)" }}>
                  Statut du compte
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Statut</span>
                    <span className={`badge text-xs ${statutConfig[user.statutCompte]?.class}`}>
                      {statutConfig[user.statutCompte]?.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Rôle</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{user.role}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Membre depuis</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                      {new Date(user.dateCreation).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {user.dateValidation && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Validé le</span>
                      <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                        {new Date(user.dateValidation).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Colonne droite */}
            <div className="col-span-2 space-y-5">

              {/* Coordonnées — lecture seule */}
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "#f5f3ff" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      Coordonnées
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lecture seule</p>
                  </div>
                  <span className="ml-auto text-xs px-3 py-1 rounded-full"
                    style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ede9fe" }}>
                    👁 Vue manager
                  </span>
                </div>
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "Nom complet", value: `${user.prenom} ${user.nom}` },
                    { label: "Email", value: user.email },
                    { label: "Téléphone", value: user.profile?.telephone },
                    { label: "Adresse", value: user.profile?.adresse },
                    { label: "Date de naissance", value: user.profile?.dateNaissance },
                    { label: "Lieu de naissance", value: user.profile?.lieuNaissance },
                    { label: "Nationalité", value: user.profile?.nationalite },
                    { label: "Genre", value: user.profile?.genre },
                    { label: "Statut social", value: user.profile?.statutSocial },
                  ].map((f) => (
                    <div key={f.label} className="flex justify-between items-center py-3"
                      style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{f.label}</span>
                      <span className={`text-sm font-medium ${!f.value ? "italic" : ""}`}
                        style={{ color: f.value ? "var(--text)" : "var(--text-muted)" }}>
                        {f.value || "Non renseigné"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
{/* Documents — lecture seule pour RH */}
<DocumentsReadOnly
  userId={user.id}
  documents={user.profile?.documents ?? []}
/>
              {/* Affectation — lecture seule */}
              {affectation && (
                <div className="card p-6">
                  <h2 className="text-base font-bold mb-5" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                    Affectation
                  </h2>
                  <div className="rounded-2xl p-5 space-y-3"
                    style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                    {[
                      { label: "Poste", value: (positions as Position[]).find(p => p.id === affectation?.positionId)?.titre || "Non affecté" },
                      {
                        label: "Date d'affectation",
                        value: new Date(affectation.dateAffectation).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "long", year: "numeric",
                        }),
                      },
                    ].map((f) => (
                      <div key={f.label} className="flex justify-between">
                        <span className="text-sm" style={{ color: "#059669" }}>{f.label}</span>
                        <span className="text-sm font-semibold" style={{ color: "#065f46" }}>💼 {f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerSalarieProfilePage;