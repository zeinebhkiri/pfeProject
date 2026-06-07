import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import {
  getUserByIdApi,
  validateUserApi,
  createAffectationApi,
  getAffectationByUserApi,
  getAllManagersApi,
  sendCorrectionEmailApi,
  getPositionsApi,
  updateProfessionalInfoApi,
  verifierEligibiliteChangementPosteApi,
  changePosteApi,
  getHistoriquePostesApi,
} from "../api/authApi";
import {
  type User,
  type Position,
  type ArchiveParcours,
  type TacheArchivee,
} from "../types/auth";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import DocumentsReadOnly from "../components/DocumentsReadOnly";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statutConfig: Record<string, { label: string; class: string }> = {
  EN_ATTENTE: { label: "En attente",    class: "bg-amber-50 text-amber-700 border border-amber-200" },
  ACCEPTE:    { label: "Profil soumis", class: "bg-blue-50 text-blue-700 border border-blue-200" },
  VALIDE:     { label: "Validé",        class: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  DESACTIVE:  { label: "Désactivé",     class: "bg-slate-100 text-slate-500 border border-slate-200" },
  EXPIRE:     { label: "Expiré",        class: "bg-orange-50 text-orange-600 border border-orange-200" },
};

const fmt = (d?: string | null, opts?: Intl.DateTimeFormatOptions) =>
  d ? new Date(d).toLocaleDateString("fr-FR", opts ?? { day: "2-digit", month: "long", year: "numeric" }) : "—";

const taskTypeLabel: Record<string, string> = {
  FORMATION: "Formation",
  QUIZ:      "Quiz",
  DOCUMENT:  "Document",
  ENTRETIEN: "Entretien",
  SIMPLE:    "Action",
};

const statutTaskIcon: Record<string, string> = {
  TERMINE:      "✅",
  EN_COURS:     "🔄",
  NON_COMMENCE: "⭕",
};

// ─── Sous-composant : carte d'une archive ────────────────────────────────────

function ArchiveCard({ archive, index }: { archive: ArchiveParcours; index: number }) {
  const [open, setOpen] = useState(false);
  const [tachesOpen, setTachesOpen] = useState(false);

  const dureeJours = archive.datePriseDePoste && archive.dateFinPoste
    ? Math.ceil(
        (new Date(archive.dateFinPoste).getTime() - new Date(archive.datePriseDePoste).getTime())
        / 86400000
      )
    : null;

  const tauxReussite = archive.nombreTachesTotal > 0
    ? Math.round((archive.nombreTachesTerminees / archive.nombreTachesTotal) * 100)
    : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      {/* ── En-tête cliquable ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-4 px-5 py-4 hover:bg-opacity-50 transition"
          style={{ background: open ? "rgba(0,174,239,0.03)" : undefined }}>

          {/* Numéro */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: "linear-gradient(135deg,#0D1B3E,#1A2B6B)", color: "white", fontFamily: "Sora" }}>
            {index + 1}
          </div>

          {/* Poste + dates */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              💼 {archive.titrePoste}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {fmt(archive.datePriseDePoste)} → {fmt(archive.dateFinPoste)}
              {dureeJours !== null && (
                <span className="ml-2 font-semibold" style={{ color: "#00AEEF" }}>
                  ({dureeJours} jours)
                </span>
              )}
            </p>
          </div>

          {/* Badge progression */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold" style={{
                color: archive.progressionFinale === 100 ? "#8DC63F" : "#00AEEF",
                fontFamily: "Sora",
              }}>
                {archive.progressionFinale}%
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>parcours</p>
            </div>
            <div className="w-5 h-5 text-gray-400 transition-transform" style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
      </button>

      {/* ── Corps de la carte ── */}
      {open && (
        <div className="px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>

          {/* Section 1 : Informations du poste */}
          <div className="pt-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00AEEF" }}>
              Informations du poste
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "💼", label: "Poste",              value: archive.titrePoste },
                { icon: "🧑‍💼", label: "Manager",           value: archive.nomManager },
                { icon: "📅", label: "Date d'embauche",    value: fmt(archive.dateEmbauche) },
                { icon: "📅", label: "Prise de poste",     value: fmt(archive.datePriseDePoste) },
                { icon: "🏁", label: "Fin de poste",       value: fmt(archive.dateFinPoste) },
                { icon: "➡️", label: "Nouveau poste",      value: archive.titreNouveauPoste ?? "—" },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    {item.icon} {item.label}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            {archive.motifArchivage && (
              <div className="mt-3 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"
                style={{ background: "rgba(141,198,63,0.07)", border: "1px solid rgba(141,198,63,0.2)" }}>
                <span>📝</span>
                <span style={{ color: "var(--text-muted)" }}>
                  Motif : <span className="font-medium" style={{ color: "var(--text)" }}>{archive.motifArchivage}</span>
                </span>
              </div>
            )}
          </div>

          {/* Section 2 : Parcours */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#8DC63F" }}>
              Parcours d'intégration
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { icon: "🗓", label: "Début parcours",  value: fmt(archive.dateDebutParcours) },
                { icon: "🏆", label: "Fin parcours",    value: fmt(archive.dateFinParcours) },
                { icon: "📊", label: "Progression",     value: `${archive.progressionFinale}%` },
                { icon: "🏅", label: "Statut final",    value: archive.statutFinal },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    {item.icon} {item.label}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Barre de progression */}
            <div className="rounded-xl p-4" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                <span>Progression du parcours</span>
                <span className="font-bold" style={{ color: archive.progressionFinale === 100 ? "#8DC63F" : "#00AEEF" }}>
                  {archive.progressionFinale}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${archive.progressionFinale}%`,
                    background: archive.progressionFinale === 100
                      ? "linear-gradient(90deg,#8DC63F,#5fa01e)"
                      : "linear-gradient(90deg,#00AEEF,#1A2B6B)",
                  }} />
              </div>
            </div>
          </div>

          {/* Section 3 : Statistiques */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#1A2B6B" }}>
              Statistiques de complétion
            </p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: archive.nombreTachesTotal,                     label: "Tâches total",      color: "#0D1B3E" },
                { value: archive.nombreTachesTerminees,                 label: "Terminées",          color: "#8DC63F" },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-3 text-center"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <p className="text-2xl font-bold" style={{ color: stat.color, fontFamily: "Sora" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 text-center"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <p className="text-2xl font-bold" style={{ color: "#00AEEF", fontFamily: "Sora" }}>
                  {tauxReussite}%
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Taux de réussite</p>
              </div>
              {archive.scoreTotalObtenu > 0 && (
                <div className="rounded-xl p-3 text-center"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <p className="text-2xl font-bold" style={{ color: "#8DC63F", fontFamily: "Sora" }}>
                    {archive.scoreTotalObtenu}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Score total</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 4 : Tâches archivées (dépliable) */}
          {archive.taches && archive.taches.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setTachesOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition"
                style={{ background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.15)" }}
              >
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#00AEEF" }}>
                  📋 Détail des tâches ({archive.taches.length})
                </span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#00AEEF" strokeWidth="2"
                  style={{ transform: tachesOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {tachesOpen && (
                <div className="mt-2 space-y-2">
                  {archive.taches.map((tache: TacheArchivee) => (
                    <div
                      key={tache.taskOriginalId}
                      className="rounded-xl px-4 py-3 flex items-start gap-3"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">
                        {statutTaskIcon[tache.statut] ?? "⭕"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                            {tache.titre}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                            {taskTypeLabel[tache.taskType] ?? tache.taskType}
                          </span>
                          {tache.phase && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF" }}>
                              {tache.phase}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          {tache.dateCompletion && (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              ✅ {fmt(tache.dateCompletion, { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                          {tache.echeance && (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              ⏰ Échéance : {fmt(tache.echeance, { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                          {tache.scoreObtenu > 0 && (
                            <span className="text-xs font-semibold" style={{ color: "#8DC63F" }}>
                              🏆 Score : {tache.scoreObtenu} pts
                            </span>
                          )}
                          {tache.documentNom && (
                            <span className="text-xs" style={{ color: "#00AEEF" }}>
                              📎 {tache.documentNom}
                            </span>
                          )}
                          {tache.statut === "TERMINE" && (
                            <span className={`text-xs font-semibold ${tache.completeDansLesDelais ? "text-green-600" : "text-red-500"}`}>
                              {tache.completeDansLesDelais ? "✓ Dans les délais" : "⚠ Hors délais"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Méta : date d'archivage */}
          <p className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
            Archivé le {fmt(archive.dateArchivage, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" } as any)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

const SalarieProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const scrollTo = location.state?.scrollTo;

  // ── State ──────────────────────────────────────────────────────────────────
  const [successMsg,   setSuccessMsg]   = useState("");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [correctionSuccess, setCorrectionSuccess] = useState("");

  // Affectation
  const [affectationPositionId, setAffectationPositionId] = useState("");
  const [affectationManagerId,  setAffectationManagerId]  = useState("");
  const [affectationDatePriseDePoste, setAffectationDatePriseDePoste] = useState("");
  const [modifyAffectation, setModifyAffectation] = useState(false);

  // Modal changement de poste
  const [showChangePosteModal, setShowChangePosteModal] = useState(false);
  const [changePositionId,     setChangePositionId]     = useState("");
  const [changeManagerId,      setChangeManagerId]      = useState("");
  const [changeDatePoste,      setChangeDatePoste]      = useState("");
  const [changeMotif,          setChangeMotif]          = useState("");

  // Correction
  const [showCorrectionModal, setShowCorrectionModal]   = useState(false);
  const [commentaire,         setCommentaire]            = useState("");
  const [dateLimiteCorrection, setDateLimiteCorrection]  = useState("");

  // Infos professionnelles
  const [professionalEmail,     setProfessionalEmail]     = useState("");
  const [professionalPhone,     setProfessionalPhone]     = useState("");
  const [professionalHireDate,  setProfessionalHireDate]  = useState("");
  const [datePriseDePoste,      setDatePriseDePoste]      = useState("");
  const [modifyProfessionalInfo, setModifyProfessionalInfo] = useState(false);
  const [isDatePrisePostePersonnalisee, setIsDatePrisePostePersonnalisee] = useState(false);

  // Historique
  const [showHistorique, setShowHistorique] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
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
    enabled: !!user && user.statutCompte === "VALIDE",
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositionsApi,
    enabled: !!user && user.statutCompte === "VALIDE",
  });

  const { data: eligibilite } = useQuery({
    queryKey: ["eligibilite-change-poste", id],
    queryFn: () => verifierEligibiliteChangementPosteApi(id!),
    enabled: !!id && !!affectation,
    retry: false,
  });

  const { data: historique = [], isLoading: historiqueLoading } = useQuery({
    queryKey: ["historique-postes", id],
    queryFn: () => getHistoriquePostesApi(id!),
    enabled: !!id && showHistorique,
  });

  // ── Effets ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.professionalInfo) {
      const hireDate = user.professionalInfo.dateEmbauche || "";
      setProfessionalEmail(user.professionalInfo.emailProfessionnel || "");
      setProfessionalPhone(user.professionalInfo.telephoneProfessionnel || "");
      setProfessionalHireDate(hireDate);
      let prisePoste = user.professionalInfo.datePriseDePoste || "";
      if (!prisePoste && hireDate) { prisePoste = hireDate; setIsDatePrisePostePersonnalisee(false); }
      else if (prisePoste)          { setIsDatePrisePostePersonnalisee(true); }
      setDatePriseDePoste(prisePoste);
      setAffectationDatePriseDePoste(prisePoste);
    }
  }, [user?.professionalInfo]);

  useEffect(() => {
    if (professionalHireDate && !isDatePrisePostePersonnalisee) {
      setDatePriseDePoste(professionalHireDate);
      setAffectationDatePriseDePoste(professionalHireDate);
    }
  }, [professionalHireDate, isDatePrisePostePersonnalisee]);

  useEffect(() => {
    if (scrollTo !== "affectation-section") return;
    const scroll = () => {
      const el = document.getElementById("affectation-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else requestAnimationFrame(scroll);
    };
    scroll();
  }, [scrollTo, user]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const validateMutation = useMutation({
    mutationFn: () => validateUserApi(id!),
    onSuccess: () => {
      setSuccessMsg("Compte validé avec succès !");
      queryClient.invalidateQueries({ queryKey: ["userById", id] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      setTimeout(() => document.getElementById("affectation-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur lors de la validation."),
  });

  const correctionMutation = useMutation({
    mutationFn: () => sendCorrectionEmailApi(id!, { commentaire, dateLimite: dateLimiteCorrection }),
    onSuccess: () => { setCorrectionSuccess("Email envoyé !"); setShowCorrectionModal(false); setCommentaire(""); setDateLimiteCorrection(""); },
    onError: () => setErrorMsg("Erreur lors de l'envoi de l'email."),
  });

  const affectationMutation = useMutation({
    mutationFn: () => {
      const payload: any = { userId: id!, positionId: affectationPositionId, datePriseDePoste: affectationDatePriseDePoste || undefined };
      if (role !== "MANAGER") payload.managerId = affectationManagerId;
      return createAffectationApi(payload);
    },
    onSuccess: () => {
      setSuccessMsg("Affectation créée avec succès !");
      setModifyAffectation(false);
      queryClient.invalidateQueries({ queryKey: ["affectation", id] });
      queryClient.invalidateQueries({ queryKey: ["eligibilite-change-poste", id] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur lors de l'affectation."),
  });

  const changePosteMutation = useMutation({
    mutationFn: () => changePosteApi({
      userId: id!,
      nouveauPositionId: changePositionId,
      nouveauManagerId:  changeManagerId || undefined,
      nouveauDatePriseDePoste: changeDatePoste || undefined,
      motif: changeMotif || undefined,
    }),
    onSuccess: () => {
      setSuccessMsg("Changement de poste effectué. Le parcours précédent a été archivé.");
      setShowChangePosteModal(false);
      setChangePositionId(""); setChangeManagerId(""); setChangeDatePoste(""); setChangeMotif("");
      queryClient.invalidateQueries({ queryKey: ["affectation", id] });
      queryClient.invalidateQueries({ queryKey: ["eligibilite-change-poste", id] });
      queryClient.invalidateQueries({ queryKey: ["historique-postes", id] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur lors du changement de poste."),
  });

  const professionalMutation = useMutation({
    mutationFn: (data: any) => updateProfessionalInfoApi(id!, data),
    onSuccess: () => { setSuccessMsg("Informations mises à jour !"); setModifyProfessionalInfo(false); queryClient.invalidateQueries({ queryKey: ["userById", id] }); },
    onError: (e: any) => setErrorMsg(e.response?.data?.error || "Erreur lors de la mise à jour."),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleProfessionalInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isPersonnalisee = datePriseDePoste !== professionalHireDate;
    setIsDatePrisePostePersonnalisee(isPersonnalisee);
    professionalMutation.mutate({ emailProfessionnel: professionalEmail, telephoneProfessionnel: professionalPhone, datePriseDePoste });
  };

  const resetProfessionalForm = () => {
    const hireDate = user?.professionalInfo?.dateEmbauche || "";
    let prisePoste = user?.professionalInfo?.datePriseDePoste || "";
    if (!prisePoste && hireDate) prisePoste = hireDate;
    setProfessionalEmail(user?.professionalInfo?.emailProfessionnel || "");
    setProfessionalPhone(user?.professionalInfo?.telephoneProfessionnel || "");
    setProfessionalHireDate(hireDate);
    setDatePriseDePoste(prisePoste);
    setAffectationDatePriseDePoste(prisePoste);
    setIsDatePrisePostePersonnalisee(!!user?.professionalInfo?.datePriseDePoste);
  };

  const getPosteLabel = (positionId: string) =>
    (positions as Position[]).find(p => p.id === positionId)?.titre ?? positionId;

  const selectedManager   = managers?.find((m: User) => m.id === affectationManagerId);
  const selectedPosition  = (positions as Position[]).find(p => p.id === affectationPositionId);
  const changePosition    = (positions as Position[]).find(p => p.id === changePositionId);
  const changeManager     = managers?.find((m: User) => m.id === changeManagerId);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) return (
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
  if (!user) return null;

  const completion    = user.profilCompletion ?? 0;
  const joursRestants = user.dateLimit
    ? Math.ceil((new Date(user.dateLimit).getTime() - Date.now()) / 86400000)
    : null;

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto page-enter" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* ── Header ── */}
        <div className="border-b px-8 py-5 flex items-center gap-4 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <button type="button" onClick={() => navigate("/admin")}
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
            <span className="badge" style={user.role === "MANAGER"
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

              {/* Progression profil */}
              <div className="card p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
                  Complétion du profil
                </p>
                <div className="relative w-28 h-28 mx-auto mb-4">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="16" fill="none"
                      stroke={completion === 100 ? "#8DC63F" : "#00AEEF"}
                      strokeWidth="2.5" strokeDasharray={`${completion} 100`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: completion === 100 ? "#8DC63F" : "#00AEEF", fontFamily: "Sora" }}>
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
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Actions</p>
                {user.statutCompte === "ACCEPTE" && completion === 100 && (
                  <button type="button" onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending} className="btn-success w-full py-2.5">
                    {validateMutation.isPending
                      ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Validation...</span>
                      : "✅ Valider le compte"}
                  </button>
                )}
                {user.statutCompte === "ACCEPTE" && completion < 100 && (
                  <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
                    ⚠ Profil incomplet. Le salarié doit atteindre 100% avant validation.
                  </div>
                )}
                {user.statutCompte === "ACCEPTE" && completion === 100 && (
                  <button type="button" onClick={() => setShowCorrectionModal(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition"
                    style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                    ✉ Demander une correction
                  </button>
                )}
                {user.statutCompte === "VALIDE" && (
                  <div className="rounded-xl px-4 py-3 text-xs text-center" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
                    ✅ Compte validé. Affectez un poste ci-dessous.
                  </div>
                )}
                {user.statutCompte === "EN_ATTENTE" && (
                  <div className="rounded-xl px-4 py-3 text-xs text-center" style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
                    En attente d'activation par l'employé.
                  </div>
                )}
                {(user.statutCompte === "DESACTIVE" || user.statutCompte === "EXPIRE") && (
                  <div className="rounded-xl px-4 py-3 text-xs text-center" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,174,239,0.1)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Coordonnées personnelles
                  </p>
                </div>
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "Nom complet", value: `${user.prenom} ${user.nom}` },
                    { label: "Email", value: user.email },
                    { label: "Adresse", value: user.profile?.adresse },
                    { label: "RIB", value: user.profile?.rib },
                    { label: "Banque", value: user.profile?.nomBanque },
                    { label: "Téléphone", value: user.profile?.telephone },
                    { label: "CNSS", value: user.profile?.numeroCnss },
                    { label: "Date de naissance", value: user.profile?.dateNaissance ? fmt(user.profile.dateNaissance as any) : undefined },
                    { label: "Lieu de naissance", value: user.profile?.lieuNaissance },
                    { label: "Genre", value: user.profile?.genre },
                    { label: "Statut social", value: user.profile?.statutSocial },
                    { label: "Créé le", value: user.dateCreation ? fmt(user.dateCreation as any) : undefined },
                    { label: "Validé le", value: user.dateValidation ? fmt(user.dateValidation as any) : undefined },
                  ].map(f => (
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

              {/* Informations professionnelles */}
              {user.statutCompte === "VALIDE" && (
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(141,198,63,0.1)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8DC63F" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          Informations professionnelles
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Définies par l'administration RH</p>
                      </div>
                    </div>
                    {!modifyProfessionalInfo && (
                      <button type="button" onClick={() => setModifyProfessionalInfo(true)}
                        className="px-4 py-2 text-sm rounded-xl font-semibold transition hover:scale-105"
                        style={{ background: "rgba(141,198,63,0.1)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.2)" }}>
                        ✏️ Modifier
                      </button>
                    )}
                  </div>

                  {!modifyProfessionalInfo ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Email professionnel",    value: user.professionalInfo?.emailProfessionnel, icon: "✉️" },
                        { label: "Téléphone professionnel", value: user.professionalInfo?.telephoneProfessionnel, icon: "📱" },
                        { label: "Date d'embauche",         value: user.professionalInfo?.dateEmbauche ? fmt(user.professionalInfo.dateEmbauche as any) : undefined, icon: "📅" },
                        { label: "Date de prise de poste",  value: (() => { const d = user.professionalInfo?.datePriseDePoste || user.professionalInfo?.dateEmbauche; return d ? fmt(d as any) : undefined; })(), icon: "📅", note: !user.professionalInfo?.datePriseDePoste && user.professionalInfo?.dateEmbauche ? "(synchronisée)" : "" },
                      ].map((item, index) => (
                        <div key={index} className="p-4 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                          </div>
                          <p className={`text-sm font-medium ${!item.value ? "italic" : ""}`} style={{ color: item.value ? "var(--text)" : "var(--text-muted)" }}>
                            {item.value || "Non renseigné"}
                            {(item as any).note && <span className="text-xs ml-1" style={{ color: "#8DC63F" }}>{(item as any).note}</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <form onSubmit={handleProfessionalInfoSubmit}>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Email professionnel</label>
                          <input type="email" value={professionalEmail} onChange={e => setProfessionalEmail(e.target.value)} placeholder="exemple@entreprise.com" className="input-field" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Téléphone professionnel</label>
                          <input type="tel" value={professionalPhone} onChange={e => setProfessionalPhone(e.target.value)} placeholder="+216 XX XXX XXX" className="input-field" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            Date d'embauche <span title="Non modifiable" style={{ fontSize: "11px", opacity: 0.6 }}>🔒</span>
                          </label>
                          <div className="input-field flex items-center" style={{ background: "var(--bg)", cursor: "not-allowed", opacity: 0.75 }}>
                            <span style={{ fontSize: "13px", color: "var(--text)" }}>
                              {professionalHireDate ? fmt(professionalHireDate) : "—"}
                            </span>
                          </div>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>🔒 Définie par les RH, non modifiable.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                            Date de prise de poste
                            {!isDatePrisePostePersonnalisee && professionalHireDate && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium normal-case" style={{ background: "rgba(141,198,63,0.1)", color: "#8DC63F" }}>Sync auto</span>
                            )}
                          </label>
                          <input type="date" value={datePriseDePoste}
                            onChange={e => { setDatePriseDePoste(e.target.value); if (e.target.value !== professionalHireDate) setIsDatePrisePostePersonnalisee(true); }}
                            className="input-field" />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button type="submit" disabled={professionalMutation.isPending} className="btn-primary flex-1 py-2.5">
                            {professionalMutation.isPending ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enregistrement...</span> : "💾 Enregistrer"}
                          </button>
                          <button type="button" onClick={() => { setModifyProfessionalInfo(false); resetProfessionalForm(); }} className="btn-secondary px-6 py-2.5">Annuler</button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Documents RH */}
              <DocumentsReadOnly userId={user.id} documents={user.profile?.documents ?? []} />

              {/* ═══════════════════════════════════════════════════════════════
                  AFFECTATION
              ═══════════════════════════════════════════════════════════════ */}
              {user.statutCompte === "VALIDE" && (
                <div id="affectation-section" className="card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,174,239,0.1)" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Affectation organisationnelle
                    </p>
                  </div>

                  {affectation && !modifyAffectation ? (
                    <div className="space-y-4">
                      {/* Résumé poste actuel */}
                      <div className="rounded-2xl p-5 space-y-3"
                        style={{ background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.2)" }}>
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: "#00AEEF" }}>Poste actuel</span>
                          <span className="text-sm font-bold" style={{ color: "#0D1B3E" }}>
                            💼 {getPosteLabel(affectation.positionId)}
                          </span>
                        </div>
                        {role !== "MANAGER" && affectation.managerId && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm" style={{ color: "#00AEEF" }}>Manager</span>
                            <span className="text-sm font-medium" style={{ color: "#0D1B3E" }}>
                              👨‍💼 {managers?.find((m: User) => m.id === affectation.managerId)
                                ? `${managers.find((m: User) => m.id === affectation.managerId)!.prenom} ${managers.find((m: User) => m.id === affectation.managerId)!.nom}`
                                : affectation.managerId}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: "#00AEEF" }}>Prise de poste</span>
                          <span className="text-sm font-medium" style={{ color: "#0D1B3E" }}>
                            📅 {fmt(affectationDatePriseDePoste || professionalHireDate || null)}
                          </span>
                        </div>
                      </div>

                      {/* Statut parcours + boutons */}
                      {eligibilite && (
                        <div>
                          {eligibilite.eligible ? (
                            /* Parcours terminé → changement autorisé */
                            <div className="space-y-3">
                              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                                style={{ background: "rgba(141,198,63,0.07)", border: "1px solid rgba(141,198,63,0.25)" }}>
                                <span className="text-lg">✅</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: "#065f46" }}>
                                    Parcours terminé — changement de poste autorisé
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                                    Le parcours d'intégration est complété à 100%. Vous pouvez affecter ce salarié à un nouveau poste.
                                    L'ancien parcours sera archivé automatiquement.
                                  </p>
                                </div>
                              </div>
                              <button type="button"
                                onClick={() => {
                                  setChangePositionId(affectation.positionId);
                                  setChangeManagerId(affectation.managerId || "");
                                  setShowChangePosteModal(true);
                                }}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition hover:scale-[1.01]"
                                style={{ background: "linear-gradient(135deg,#0D1B3E,#1A2B6B)", color: "white" }}>
                                🔄 Changer de poste
                              </button>
                            </div>
                          ) : (
                            /* Parcours en cours → bloqué */
                            <div className="rounded-xl p-4 space-y-3"
                              style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)" }}>
                              <div className="flex items-start gap-3">
                                <span className="text-xl flex-shrink-0">🔒</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold" style={{ color: "#92400e" }}>
                                    Changement de poste bloqué
                                  </p>
                                  <p className="text-xs mt-1" style={{ color: "#b45309" }}>
                                    Le parcours d'intégration doit être complété à 100% avant tout changement de poste.
                                  </p>
                                </div>
                              </div>
                              {/* Barre de progression */}
                              <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                  <span style={{ color: "var(--text-muted)" }}>Progression du parcours</span>
                                  <span className="font-bold" style={{ color: "#d97706" }}>
                                    {eligibilite.progression ?? 0}%
                                  </span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${eligibilite.progression ?? 0}%`, background: "linear-gradient(90deg,#f59e0b,#d97706)" }} />
                                </div>
                                <p className="text-xs mt-1.5 text-center font-medium" style={{ color: "#92400e" }}>
                                  {eligibilite.progression ?? 0}% complété — {100 - (eligibilite.progression ?? 0)}% restant
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Formulaire première affectation ── */
                    <div className="space-y-4">
                      {!affectation && (
                        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                          style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
                          <span>📌</span>
                          <span>Ce salarié n'a pas encore été affecté à un poste.</span>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          Poste <span className="text-red-400">*</span>
                        </label>
                        <select value={affectationPositionId} onChange={e => setAffectationPositionId(e.target.value)} className="input-field">
                          <option value="">— Sélectionner un poste —</option>
                          {(positions as Position[]).map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
                        </select>
                      </div>
                      {role === "ADMIN" && (
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                            Manager superviseur <span className="text-red-400">*</span>
                          </label>
                          <select value={affectationManagerId} onChange={e => setAffectationManagerId(e.target.value)} className="input-field">
                            <option value="">— Sélectionner un manager —</option>
                            {(managers ?? []).filter((m: User) => m.id !== user.id).map((m: User) => (
                              <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label htmlFor="datePrisePoste" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          Date de prise de poste
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium normal-case" style={{ background: "rgba(0,174,239,0.08)", color: "#00AEEF" }}>
                            Référence parcours
                          </span>
                        </label>
                        <input type="date" id="datePrisePoste"
                          value={affectationDatePriseDePoste || professionalHireDate || ""}
                          onChange={e => setAffectationDatePriseDePoste(e.target.value)}
                          className="input-field" />
                      </div>
                      {affectationPositionId && (role === "MANAGER" || (role === "ADMIN" && affectationManagerId)) && (
                        <div className="rounded-xl p-4 space-y-2"
                          style={{ background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.2)" }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#00AEEF" }}>Récapitulatif</p>
                          <div className="flex justify-between text-sm"><span style={{ color: "var(--text-muted)" }}>Salarié</span><span className="font-semibold" style={{ color: "#1A2B6B" }}>{user.prenom} {user.nom}</span></div>
                          <div className="flex justify-between text-sm"><span style={{ color: "var(--text-muted)" }}>Poste</span><span className="font-semibold" style={{ color: "#1A2B6B" }}>{selectedPosition?.titre ?? ""}</span></div>
                          {role === "ADMIN" && selectedManager && (
                            <div className="flex justify-between text-sm"><span style={{ color: "var(--text-muted)" }}>Manager</span><span className="font-semibold" style={{ color: "#1A2B6B" }}>{selectedManager.prenom} {selectedManager.nom}</span></div>
                          )}
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button type="button"
                          onClick={() => { if (affectationPositionId && (role === "MANAGER" || (role === "ADMIN" && affectationManagerId))) affectationMutation.mutate(); }}
                          disabled={!affectationPositionId || (role === "ADMIN" && !affectationManagerId) || affectationMutation.isPending}
                          className="btn-primary flex-1 py-3">
                          {affectationMutation.isPending
                            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création...</span>
                            : "📌 Confirmer l'affectation →"}
                        </button>
                        {modifyAffectation && (
                          <button type="button" onClick={() => setModifyAffectation(false)} className="btn-secondary px-5 py-3">Annuler</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  HISTORIQUE DES POSTES ARCHIVÉS
              ═══════════════════════════════════════════════════════════════ */}
              {user.statutCompte === "VALIDE" && (
                <div className="card p-6">
                  <button
                    type="button"
                    onClick={() => setShowHistorique(o => !o)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(13,27,62,0.08)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D1B3E" strokeWidth="2">
                          <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          Historique des postes
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          Parcours archivés après changements de poste
                        </p>
                      </div>
                    </div>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-muted)" strokeWidth="2"
                      style={{ transform: showHistorique ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .25s", flexShrink: 0 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showHistorique && (
                    <div className="mt-5">
                      {historiqueLoading ? (
                        <div className="flex items-center justify-center py-8 gap-3">
                          <div className="w-6 h-6 border-2 rounded-full animate-spin"
                            style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement de l'historique...</span>
                        </div>
                      ) : historique.length === 0 ? (
                        <div className="rounded-2xl px-5 py-8 text-center"
                          style={{ background: "var(--bg)", border: "1px dashed var(--border)" }}>
                          <p className="text-2xl mb-2">📭</p>
                          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                            Aucun historique
                          </p>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            Les archives apparaîtront ici après chaque changement de poste.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                            {historique.length} poste{historique.length > 1 ? "s" : ""} archivé{historique.length > 1 ? "s" : ""}
                            — cliquez sur un poste pour voir le détail complet
                          </p>
                          {historique.map((archive: ArchiveParcours, i: number) => (
                            <ArchiveCard key={archive.id} archive={archive} index={i} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL CHANGEMENT DE POSTE
      ═══════════════════════════════════════════════════════════════════════ */}
      {showChangePosteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowChangePosteModal(false)} />
          <div className="relative rounded-3xl shadow-2xl w-full mx-4 flex flex-col"
            style={{ background: "var(--surface)", maxWidth: "560px", zIndex: 51, maxHeight: "90vh" }}>

            {/* Header modal */}
            <div className="px-8 py-6 flex items-center gap-4"
              style={{ background: "linear-gradient(135deg,#0D1B3E,#1A2B6B)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,174,239,0.2)", border: "1px solid rgba(0,174,239,0.3)" }}>
                <span className="text-xl">🔄</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white" style={{ fontFamily: "Sora" }}>
                  Changement de poste
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "rgba(168,216,234,0.7)" }}>
                  {user.prenom} {user.nom} — Le parcours actuel sera archivé automatiquement
                </p>
              </div>
              <button type="button" onClick={() => setShowChangePosteModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                ✕
              </button>
            </div>

            <div className="px-8 py-6 space-y-5 overflow-y-auto flex-1">

              {/* Banner info archivage */}
              <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ background: "rgba(141,198,63,0.07)", border: "1px solid rgba(141,198,63,0.2)" }}>
                <span className="text-base flex-shrink-0 mt-0.5">📦</span>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  L'ancien parcours (poste <strong style={{ color: "var(--text)" }}>{getPosteLabel(affectation?.positionId ?? "")}</strong>)
                  sera archivé avec toutes ses tâches, scores et dates.
                  Un nouveau parcours sera généré pour le nouveau poste.
                </p>
              </div>

              {/* Nouveau poste */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Nouveau poste <span className="text-red-400">*</span>
                </label>
                <select value={changePositionId} onChange={e => setChangePositionId(e.target.value)} className="input-field">
                  <option value="">— Sélectionner le nouveau poste —</option>
                  {(positions as Position[]).filter(p => p.id !== affectation?.positionId).map(p => (
                    <option key={p.id} value={p.id}>{p.titre}</option>
                  ))}
                </select>
              </div>

              {/* Nouveau manager */}
              {role === "ADMIN" && (
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Nouveau manager
                    <span className="ml-2 font-normal normal-case" style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      (laisser vide pour conserver l'actuel)
                    </span>
                  </label>
                  <select value={changeManagerId} onChange={e => setChangeManagerId(e.target.value)} className="input-field">
                    <option value="">— Conserver le manager actuel —</option>
                    {(managers ?? []).filter((m: User) => m.id !== user.id).map((m: User) => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date de prise de poste */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Date de prise du nouveau poste
                </label>
                <input type="date" value={changeDatePoste} onChange={e => setChangeDatePoste(e.target.value)} className="input-field" />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Les échéances du nouveau parcours seront calculées depuis cette date.
                </p>
              </div>

              {/* Motif */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Motif du changement
                  <span className="ml-2 font-normal normal-case" style={{ color: "var(--text-muted)", fontSize: "11px" }}>(optionnel)</span>
                </label>
                <input type="text" value={changeMotif} onChange={e => setChangeMotif(e.target.value)}
                  placeholder="Ex: Promotion interne, restructuration, évolution de carrière..."
                  className="input-field" />
              </div>

              {/* Récapitulatif */}
              {changePositionId && (
                <div className="rounded-xl p-4 space-y-2.5"
                  style={{ background: "rgba(0,174,239,0.04)", border: "1px solid rgba(0,174,239,0.15)" }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#00AEEF" }}>
                    Récapitulatif du changement
                  </p>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Salarié</span>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{user.prenom} {user.nom}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Ancien poste</span>
                    <span className="font-semibold" style={{ color: "#dc2626" }}>
                      {getPosteLabel(affectation?.positionId ?? "")} →
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Nouveau poste</span>
                    <span className="font-semibold" style={{ color: "#8DC63F" }}>
                      → {changePosition?.titre ?? ""}
                    </span>
                  </div>
                  {changeManager && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>Nouveau manager</span>
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{changeManager.prenom} {changeManager.nom}</span>
                    </div>
                  )}
                  {changeDatePoste && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>Prise de poste</span>
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{fmt(changeDatePoste)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      📦 L'ancien parcours sera archivé · 🆕 Un nouveau parcours sera généré
                    </p>
                  </div>
                </div>
              )}

              {/* Boutons */}
              <div className="flex gap-3 pt-1">
                <button type="button"
                  onClick={() => changePosteMutation.mutate()}
                  disabled={!changePositionId || changePosteMutation.isPending}
                  className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  {changePosteMutation.isPending
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Traitement...</>
                    : "🔄 Confirmer le changement de poste"}
                </button>
                <button type="button" onClick={() => setShowChangePosteModal(false)} className="btn-secondary px-6 py-3">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL CORRECTION
      ═══════════════════════════════════════════════════════════════════════ */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCorrectionModal(false)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "480px" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>Demander une correction</h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Un email sera envoyé à {user.prenom} {user.nom}</p>
              </div>
              <button type="button" onClick={() => setShowCorrectionModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Commentaire *
                </label>
                <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
                  placeholder="Ex: Votre adresse est incomplète..."
                  rows={4} className="input-field" style={{ resize: "none" }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => correctionMutation.mutate()}
                  disabled={!commentaire.trim() || correctionMutation.isPending}
                  className="btn-primary flex-1 py-3">
                  {correctionMutation.isPending
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi...</span>
                    : "✉ Envoyer l'email"}
                </button>
                <button type="button" onClick={() => setShowCorrectionModal(false)} className="btn-secondary px-6 py-3">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarieProfilePage;