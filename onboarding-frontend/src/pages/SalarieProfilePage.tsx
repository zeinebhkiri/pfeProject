import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  getUserByIdApi,
  validateUserApi,
  createAffectationApi,
  getAffectationByUserApi,
  getAllManagersApi,
  sendCorrectionEmailApi,
  getPositionsApi,
} from "../api/authApi";
import { type User, type Position } from "../types/auth";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import DocumentsReadOnly from "../components/DocumentsReadOnly";

const statutConfig: Record<string, { label: string; class: string }> = {
  EN_ATTENTE: { label: "En attente",   class: "bg-amber-50 text-amber-700 border border-amber-200" },
  ACCEPTE:    { label: "Profil soumis",class: "bg-blue-50 text-blue-700 border border-blue-200" },
  VALIDE:     { label: "Validé",       class: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  DESACTIVE:  { label: "Désactivé",    class: "bg-slate-100 text-slate-500 border border-slate-200" },
  EXPIRE:     { label: "Expiré",       class: "bg-orange-50 text-orange-600 border border-orange-200" },
};

const SalarieProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [successMsg, setSuccessMsg]             = useState("");
  const [errorMsg, setErrorMsg]                 = useState("");
  const [correctionSuccess, setCorrectionSuccess] = useState("");

  const [affectationPositionId, setAffectationPositionId] = useState("");
  const [affectationManagerId, setAffectationManagerId]   = useState("");
  const [modifyAffectation, setModifyAffectation]         = useState(false);

  const [showCorrectionModal, setShowCorrectionModal]   = useState(false);
  const [commentaire, setCommentaire]                   = useState("");
  const [dateLimiteCorrection, setDateLimiteCorrection] = useState("");

  const [professionalEmail, setProfessionalEmail]       = useState("");
  const [professionalPhone, setProfessionalPhone]       = useState("");
  const [professionalHireDate, setProfessionalHireDate] = useState("");
  const [modifyProfessionalInfo, setModifyProfessionalInfo] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: user, isLoading } = useQuery({
    queryKey: ["userById", id],
    queryFn: () => getUserByIdApi(id!),
    enabled: !!id,
  });

  const { data: affectation } = useQuery({
    queryKey: ["affectation", id],
    queryFn: () => getAffectationByUserApi(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: managers } = useQuery({
    queryKey: ["managers"],
    queryFn: getAllManagersApi,
    enabled: !!user && user.statutCompte === "VALIDE" && user.role !== "MANAGER",
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositionsApi,
    enabled: !!user && user.statutCompte === "VALIDE",
  });

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.professionalInfo) {
      setProfessionalEmail(user.professionalInfo.emailProfessionnel || "");
      setProfessionalPhone(user.professionalInfo.telephoneProfessionnel || "");
      setProfessionalHireDate(user.professionalInfo.dateEmbauche || "");
    }
  }, [user?.professionalInfo]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const validateMutation = useMutation({
    mutationFn: () => validateUserApi(id!),
    onSuccess: () => {
      setSuccessMsg("Compte validé avec succès !");
      setErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ["userById", id] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (error: any) => {
      setErrorMsg(error.response?.data?.error || "Erreur lors de la validation.");
    },
  });

  const correctionMutation = useMutation({
    mutationFn: () => sendCorrectionEmailApi(id!, { commentaire, dateLimite: dateLimiteCorrection }),
    onSuccess: () => {
      setCorrectionSuccess("Email de correction envoyé avec succès !");
      setShowCorrectionModal(false);
      setCommentaire("");
      setDateLimiteCorrection("");
    },
    onError: () => setErrorMsg("Erreur lors de l'envoi de l'email."),
  });

  const affectationMutation = useMutation({
    mutationFn: () =>
      createAffectationApi({
        userId: id!,
        positionId: affectationPositionId,
        managerId: user?.role === "MANAGER" ? undefined : affectationManagerId,
      }),
    onSuccess: () => {
      setSuccessMsg("Affectation créée avec succès !");
      setErrorMsg("");
      setModifyAffectation(false);
      queryClient.invalidateQueries({ queryKey: ["affectation", id] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (error: any) => {
      setErrorMsg(error.response?.data?.error || "Erreur lors de l'affectation.");
    },
  });

  const professionalMutation = useMutation({
    mutationFn: (data: any) => fetch(`/api/users/${id}/professional-info`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      setSuccessMsg("Informations professionnelles mises à jour !");
      setModifyProfessionalInfo(false);
      queryClient.invalidateQueries({ queryKey: ["userById", id] });
    },
    onError: () => {
      setErrorMsg("Erreur lors de la mise à jour.");
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleProfessionalInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    professionalMutation.mutate({
      emailProfessionnel: professionalEmail,
      telephoneProfessionnel: professionalPhone,
      dateEmbauche: professionalHireDate,
    });
  };

  const resetProfessionalForm = () => {
    setProfessionalEmail(user?.professionalInfo?.emailProfessionnel || "");
    setProfessionalPhone(user?.professionalInfo?.telephoneProfessionnel || "");
    setProfessionalHireDate(user?.professionalInfo?.dateEmbauche || "");
  };

  // Résoudre le titre du poste depuis positionId
  const getPosteLabel = (positionId: string) =>
    (positions as Position[]).find(p => p.id === positionId)?.titre ?? positionId;

  const selectedManager = managers?.find((m: User) => m.id === affectationManagerId);
  const selectedPosition = (positions as Position[]).find(p => p.id === affectationPositionId);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 rounded-full animate-spin"
              style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  const completion = user.profilCompletion ?? 0;
  const joursRestants = user.dateLimit
    ? Math.ceil((new Date(user.dateLimit).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto page-enter" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* ── Header ── */}
        <div className="border-b px-8 py-5 flex items-center gap-4 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <button type="button"
            onClick={() => navigate("/admin")}
            className="text-sm flex items-center gap-2 px-3 py-2 rounded-lg transition"
            style={{ background: "var(--border)", color: "var(--text-muted)" }}>
            ← Retour
          </button>
          <div className="w-px h-5" style={{ background: "var(--border)" }} />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #00AEEF, #1A2B6B)" }}>
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
            <span className="badge"
              style={user.role === "MANAGER"
                ? { background: "rgba(0,174,239,0.1)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.2)" }
                : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              {user.role}
            </span>
          </div>
        </div>

        <div className="px-8 py-8 max-w-5xl space-y-5">

          {/* ── Messages ── */}
          {correctionSuccess && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              <span className="text-xl">✅</span> {correctionSuccess}
              <button type="button" onClick={() => setCorrectionSuccess("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              <span className="text-xl">✅</span> {successMsg}
              <button type="button" onClick={() => setSuccessMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              <span className="text-xl">⚠️</span> {errorMsg}
              <button type="button" onClick={() => setErrorMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-5">

            {/* ── Colonne gauche ── */}
            <div className="col-span-1 space-y-5">

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
                      stroke={completion === 100 ? "#8DC63F" : "#00AEEF"}
                      strokeWidth="2.5"
                      strokeDasharray={`${completion} 100`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold" style={{
                      color: completion === 100 ? "#8DC63F" : "#00AEEF",
                      fontFamily: "Sora"
                    }}>
                      {completion}%
                    </span>
                  </div>
                </div>
                {completion === 100
                  ? <p className="text-xs font-medium" style={{ color: "#8DC63F" }}>✓ Profil complet</p>
                  : <p className="text-xs" style={{ color: "var(--text-muted)" }}>Profil incomplet</p>}
                {user.dateLimit && (
                  <div className="mt-4 rounded-xl px-3 py-2 text-xs"
                    style={{
                      background: joursRestants !== null && joursRestants <= 0 ? "#fef2f2" : "var(--bg)",
                      border: `1px solid ${joursRestants !== null && joursRestants <= 0 ? "#fecaca" : "var(--border)"}`,
                      color: joursRestants !== null && joursRestants <= 0 ? "#dc2626" : "var(--text-muted)",
                    }}>
                    Date limite :{" "}
                    <span className="font-semibold">
                      {new Date(user.dateLimit).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {joursRestants !== null && joursRestants > 0 && (
                      <span className="ml-1 font-bold text-amber-600">(J-{joursRestants})</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="card p-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "var(--text-muted)" }}>
                  Actions
                </p>

                {user.statutCompte === "ACCEPTE" && completion === 100 && (
                  <button type="button"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                    className="btn-success w-full py-2.5">
                    {validateMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Validation...
                      </span>
                    ) : "✅ Valider le compte"}
                  </button>
                )}

                {user.statutCompte === "ACCEPTE" && completion < 100 && (
                  <div className="rounded-xl px-4 py-3 text-xs"
                    style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
                    ⚠ Profil incomplet. Le salarié doit atteindre 100% avant validation.
                  </div>
                )}

                {user.statutCompte === "ACCEPTE" && (
                  <button type="button"
                    onClick={() => setShowCorrectionModal(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition"
                    style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                    ✉ Demander une correction
                  </button>
                )}

                {user.statutCompte === "VALIDE" && (
                  <div className="rounded-xl px-4 py-3 text-xs text-center"
                    style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
                    ✅ Compte validé. Affectez un poste ci-dessous.
                  </div>
                )}

                {user.statutCompte === "EN_ATTENTE" && (
                  <div className="rounded-xl px-4 py-3 text-xs text-center"
                    style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
                    En attente d'activation par l'employé.
                  </div>
                )}

                {(user.statutCompte === "DESACTIVE" || user.statutCompte === "EXPIRE") && (
                  <div className="rounded-xl px-4 py-3 text-xs text-center"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    Ce compte est désactivé.
                  </div>
                )}
              </div>
            </div>

            {/* ── Colonne droite ── */}
            <div className="col-span-2 space-y-5">

              {/* Coordonnées personnelles */}
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(0,174,239,0.1)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}>
                    Coordonnées personnelles
                  </p>
                </div>
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "Nom complet",       value: `${user.prenom} ${user.nom}` },
                    { label: "Email",              value: user.email },
                    { label: "Adresse",            value: user.profile?.adresse },
                    { label: "RIB",                value: user.profile?.rib },
                    { label: "Banque",             value: user.profile?.nomBanque },
                    { label: "Téléphone",          value: user.profile?.telephone },
                    { label: "CNSS",               value: user.profile?.numeroCnss },
                    { label: "Date de naissance",  value: user.profile?.dateNaissance
                        ? new Date(user.profile.dateNaissance).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                        : undefined },
                    { label: "Lieu de naissance",  value: user.profile?.lieuNaissance },
                    { label: "Genre",              value: user.profile?.genre },
                    { label: "Statut social",      value: user.profile?.statutSocial },
                    { label: "Créé le",            value: user.dateCreation
                        ? new Date(user.dateCreation).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                        : undefined },
                    { label: "Validé le",          value: user.dateValidation
                        ? new Date(user.dateValidation).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                        : undefined },
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

              {/* Informations professionnelles — seulement si VALIDE */}
              {user.statutCompte === "VALIDE" && (
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(141,198,63,0.1)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8DC63F" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2"/>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}>
                          Informations professionnelles
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          Définies par l'administration RH
                        </p>
                      </div>
                    </div>
                    {!modifyProfessionalInfo && (
                      <button type="button"
                        onClick={() => setModifyProfessionalInfo(true)}
                        className="px-4 py-2 text-sm rounded-xl font-semibold transition hover:scale-105"
                        style={{ background: "rgba(141,198,63,0.1)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.2)" }}>
                        ✏️ Modifier
                      </button>
                    )}
                  </div>

                  {!modifyProfessionalInfo ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Email professionnel",      value: user.professionalInfo?.emailProfessionnel,      icon: "✉️" },
                        { label: "Téléphone professionnel",  value: user.professionalInfo?.telephoneProfessionnel,  icon: "📱" },
                        { label: "Date d'embauche",          value: user.professionalInfo?.dateEmbauche
                            ? new Date(user.professionalInfo.dateEmbauche).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                            : undefined,
                          icon: "📅" },
                      ].map((item, index) => (
                        <div key={index} className="p-4 rounded-xl"
                          style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              {item.label}
                            </span>
                          </div>
                          <p className={`text-sm font-medium ${item.value ? "" : "italic"}`}
                            style={{ color: item.value ? "var(--text)" : "var(--text-muted)" }}>
                            {item.value || "Non renseigné"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <form onSubmit={handleProfessionalInfoSubmit}>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                            style={{ color: "var(--text-muted)" }}>
                            Email professionnel
                          </label>
                          <input type="email" value={professionalEmail}
                            onChange={(e) => setProfessionalEmail(e.target.value)}
                            placeholder="exemple@entreprise.com"
                            className="input-field" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                            style={{ color: "var(--text-muted)" }}>
                            Téléphone professionnel
                          </label>
                          <input type="tel" value={professionalPhone}
                            onChange={(e) => setProfessionalPhone(e.target.value)}
                            placeholder="+216 XX XXX XXX"
                            className="input-field" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                            style={{ color: "var(--text-muted)" }}>
                            Date d'embauche
                          </label>
                          <input type="date" value={professionalHireDate}
                            onChange={(e) => setProfessionalHireDate(e.target.value)}
                            className="input-field" />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button type="submit" disabled={professionalMutation.isPending}
                            className="btn-primary flex-1 py-2.5">
                            {professionalMutation.isPending ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Enregistrement...
                              </span>
                            ) : "💾 Enregistrer"}
                          </button>
                          <button type="button"
                            onClick={() => { setModifyProfessionalInfo(false); resetProfessionalForm(); }}
                            className="btn-secondary px-6 py-2.5">
                            Annuler
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Documents RH */}
              <DocumentsReadOnly
                userId={user.id}
                documents={user.profile?.documents ?? []}
              />

              {/* Affectation — seulement si VALIDE */}
              {user.statutCompte === "VALIDE" && (
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(0,174,239,0.1)" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-muted)" }}>
                      Affectation organisationnelle
                    </p>
                  </div>

                  {affectation && !modifyAffectation ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl p-5 space-y-3"
                        style={{ background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.2)" }}>
                        {[
                          { label: "Poste",
                            value: getPosteLabel(affectation.positionId),
                            bold: true },
                          { label: "Manager",
                            value: affectation.managerId
                              ? managers?.find((m: User) => m.id === affectation.managerId)
                                ? `${managers.find((m: User) => m.id === affectation.managerId)!.prenom} ${managers.find((m: User) => m.id === affectation.managerId)!.nom}`
                                : affectation.managerId
                              : "Aucun (Manager)" },
                          { label: "Date d'affectation",
                            value: new Date(affectation.dateAffectation).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) },
                        ].map((f) => (
                          <div key={f.label} className="flex justify-between items-center">
                            <span className="text-sm" style={{ color: "#00AEEF" }}>{f.label}</span>
                            <span className="text-sm" style={{ color: "#0D1B3E", fontWeight: f.bold ? 700 : 500 }}>
                              💼 {f.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button type="button"
                        onClick={() => {
                          setModifyAffectation(true);
                          setAffectationPositionId(affectation.positionId);
                          setAffectationManagerId(affectation.managerId || "");
                        }}
                        className="btn-secondary w-full py-2.5 text-xs">
                        ✏ Modifier l'affectation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!affectation && (
                        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                          style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
                          <span>📌</span>
                          <span>Ce salarié n'a pas encore été affecté à un poste.</span>
                        </div>
                      )}

                      {/* Select poste depuis la collection positions */}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}>
                          Poste <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={affectationPositionId}
                          onChange={(e) => setAffectationPositionId(e.target.value)}
                          className="input-field">
                          <option value="">— Sélectionner un poste —</option>
                          {(positions as Position[]).map((p) => (
                            <option key={p.id} value={p.id}>{p.titre}</option>
                          ))}
                        </select>
                      </div>

                      {/* Select manager — caché pour les managers */}
                      {user.role !== "MANAGER" && (
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                            style={{ color: "var(--text-muted)" }}>
                            Manager superviseur <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={affectationManagerId}
                            onChange={(e) => setAffectationManagerId(e.target.value)}
                            className="input-field">
                            <option value="">— Sélectionner un manager —</option>
                            {(managers ?? []).map((m: User) => (
                              <option key={m.id} value={m.id}>
                                {m.prenom} {m.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Récapitulatif */}
                      {affectationPositionId && (user.role === "MANAGER" || affectationManagerId) && (
                        <div className="rounded-xl p-4 space-y-2"
                          style={{ background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.2)" }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                            style={{ color: "#00AEEF" }}>
                            Récapitulatif de l'affectation
                          </p>
                          {[
                            { label: "Salarié", value: `${user.prenom} ${user.nom}` },
                            { label: "Poste",   value: selectedPosition?.titre ?? "" },
                            ...(user.role !== "MANAGER" && selectedManager
                              ? [{ label: "Manager", value: `${selectedManager.prenom} ${selectedManager.nom}` }]
                              : []),
                            { label: "Date",    value: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) },
                          ].map((f) => (
                            <div key={f.label} className="flex justify-between text-sm">f
                              <span style={{ color: "var(--text-muted)" }}>{f.label}</span>
                              <span className="font-semibold" style={{ color: "#1A2B6B" }}>{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button type="button"
                          onClick={() => {
                            if (affectationPositionId && (user.role === "MANAGER" || affectationManagerId)) {
                              affectationMutation.mutate();
                            }
                          }}
                          disabled={
                            !affectationPositionId ||
                            (user.role !== "MANAGER" && !affectationManagerId) ||
                            affectationMutation.isPending
                          }
                          className="btn-primary flex-1 py-3">
                          {affectationMutation.isPending ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Création...
                            </span>
                          ) : "📌 Confirmer l'affectation →"}
                        </button>
                        {modifyAffectation && (
                          <button type="button"
                            onClick={() => setModifyAffectation(false)}
                            className="btn-secondary px-5 py-3">
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Modal correction ── */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 drawer-overlay"
            onClick={() => setShowCorrectionModal(false)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "480px" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Demander une correction
                </h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Un email sera envoyé à {user.prenom} {user.nom}
                </p>
              </div>
              <button type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Commentaire pour le salarié *
                </label>
                <textarea value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Ex: Votre adresse est incomplète..."
                  rows={4} className="input-field" style={{ resize: "none" }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Date limite de correction *
                </label>
                <input type="date" value={dateLimiteCorrection}
                  onChange={(e) => setDateLimiteCorrection(e.target.value)}
                  className="input-field"
                  min={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={() => correctionMutation.mutate()}
                  disabled={!commentaire.trim() || !dateLimiteCorrection || correctionMutation.isPending}
                  className="btn-primary flex-1 py-3">
                  {correctionMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi...
                    </span>
                  ) : "✉ Envoyer l'email"}
                </button>
                <button type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="btn-secondary px-6 py-3">
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

export default SalarieProfilePage;