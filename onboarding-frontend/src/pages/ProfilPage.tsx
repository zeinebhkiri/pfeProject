import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getCurrentUserApi, updateMyProfileApi, getAffectationByUserApi, getAllManagersApi,getPositionsApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import type { StatutCompte, UserProfile, UserRole , ProfessionalInfo, Position} from "../types/auth";
import DocumentsSection from "../components/DocumentsSection";

const statutConfig: Record<string, { label: string; class: string; icon: string }> = {
  EN_ATTENTE: { label: "En attente d'activation", class: "bg-amber-50 text-amber-700 border border-amber-200", icon: "⏳" },
  ACCEPTE:    { label: "Profil en cours",          class: "bg-blue-50 text-blue-700 border border-blue-200",   icon: "📝" },
  VALIDE:     { label: "Compte validé ✓",          class: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: "✅" },
  DESACTIVE:  { label: "Compte désactivé",         class: "bg-slate-100 text-slate-500 border border-slate-200", icon: "🔒" },
  EXPIRE:     { label: "Délai expiré",             class: "bg-red-50 text-red-600 border border-red-200",      icon: "⚠️" },
};

export interface User {
  id: string; nom: string; prenom: string; email: string;
  role: UserRole; statutCompte: StatutCompte; profilCompletion: number;
  profile?: UserProfile;
  dateCreation: string; dateValidation?: string; dateLimit?: string; poste?: string;professionalInfo?: ProfessionalInfo;
}

const ProfilPage = () => {
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const queryClient = useQueryClient();

  const [adresse, setAdresse]           = useState("");
  const [rib, setRib]                   = useState("");
  const [telephone, setTelephone]       = useState("");
  const [editMode, setEditMode]         = useState(false);
  const [successMsg, setSuccessMsg]     = useState("");
  const [errorMsg, setErrorMsg]         = useState("");
  const [numeroCnss, setNumeroCnss]     = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [lieuNaissance, setLieuNaissance] = useState("");
  const [nomBanque, setNomBanque]       = useState("");
  const [statutSocial, setStatutSocial] = useState("");
  const [nationalite, setNationalite]   = useState("");
  const [genre, setGenre]               = useState("");

  const [showPhotoPosteModal, setShowPhotoPosteModal] = useState(false);
  const [photoPosteUrl, setPhotoPosteUrl]             = useState("");
  const [photoPostePreview, setPhotoPostePreview]     = useState<string | null>(null);
  const [photoPosteSuccess, setPhotoPosteSuccess]     = useState("");
  const [photoPosteFile, setPhotoPosteFile]           = useState<File | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserApi,
  });

  const { data: affectation } = useQuery({
    queryKey: ["myAffectation"],
    queryFn: () => getAffectationByUserApi(userId!),
    enabled: !!userId,
    retry: false,
  });

  const { data: managers } = useQuery({
    queryKey: ["managers"],
    queryFn: getAllManagersApi,
    enabled: !!affectation?.managerId,
  });
  
  const { data: positions = [] } = useQuery({
  queryKey: ["positions"],
  queryFn: getPositionsApi,
});

  useEffect(() => {
    if (user?.profile) {
      setAdresse(user.profile.adresse || "");
      setRib(user.profile.rib || "");
      setTelephone(user.profile.telephone || "");
      setNumeroCnss(user.profile.numeroCnss || "");
      setDateNaissance(user.profile.dateNaissance || "");
      setLieuNaissance(user.profile.lieuNaissance || "");
      setNomBanque(user.profile.nomBanque || "");
      setStatutSocial(user.profile.statutSocial || "");
      setNationalite(user.profile.nationalite || "");
      setGenre(user.profile.genre || "");
      if (user.profile.photoPoste) setPhotoPostePreview(user.profile.photoPoste);
    }
  }, [user?.profile]);

  const updateMutation = useMutation({
    mutationFn: updateMyProfileApi,
    onSuccess: () => {
      setSuccessMsg("Profil mis à jour avec succès !");
      setErrorMsg("");
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onError: (error: any) => {
      setErrorMsg(error.response?.data?.error || "Erreur lors de la mise à jour.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      adresse, rib, telephone,
      image: user?.profile?.image || "",
      numeroCnss, dateNaissance, lieuNaissance,
      nomBanque, statutSocial, nationalite, genre,
      photoPoste: photoPostePreview || "",
    });
  };

  const handleSavePhotoPoste = async () => {
    let photoToSave = photoPosteUrl.trim();
    if (!photoToSave && photoPosteFile) {
      const reader = new FileReader();
      photoToSave = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(photoPosteFile);
      });
    }
    if (!photoToSave) return;
    setPhotoPostePreview(photoToSave);
    try {
      await updateMyProfileApi({
        adresse: user?.profile?.adresse || "",
        rib: user?.profile?.rib || "",
        telephone: user?.profile?.telephone || "",
        image: user?.profile?.image || "",
        numeroCnss: user?.profile?.numeroCnss || "",
        dateNaissance: user?.profile?.dateNaissance || "",
        lieuNaissance: user?.profile?.lieuNaissance || "",
        nomBanque: user?.profile?.nomBanque || "",
        statutSocial: user?.profile?.statutSocial || "",
        nationalite: user?.profile?.nationalite || "",
        genre: user?.profile?.genre || "",
        photoPoste: photoToSave,
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setPhotoPosteSuccess("Photo du poste enregistrée !");
    } catch {
      setErrorMsg("Erreur lors de la sauvegarde.");
    }
    setShowPhotoPosteModal(false);
    setPhotoPosteUrl("");
    setPhotoPosteFile(null);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPosteFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPostePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const managerNom = affectation?.managerId
    ? managers?.find((m: any) => m.id === affectation.managerId)
      ? `${managers.find((m: any) => m.id === affectation.managerId)!.prenom} ${managers.find((m: any) => m.id === affectation.managerId)!.nom}`
      : null
    : null;

  const joursRestants = user?.dateLimit
    ? Math.ceil((new Date(user.dateLimit).getTime() - Date.now()) / 86400000)
    : null;

  const completion = user?.profilCompletion ?? 0;

  const fields = [
    { label: "Adresse",          value: user?.profile?.adresse,       state: adresse,       setState: setAdresse,       placeholder: "12 rue de la Paix", type: "text",        icon: "🏠", description: "Votre adresse postale complète" },
    { label: "RIB",              value: user?.profile?.rib,           state: rib,           setState: setRib,           placeholder: "FR76 3000 6000...", type: "text",        icon: "🏦", description: "Format IBAN" },
    { label: "Téléphone",        value: user?.profile?.telephone,     state: telephone,     setState: setTelephone,     placeholder: "+216 XX XXX XXX",   type: "tel",         icon: "📱", description: "Numéro mobile ou fixe" },
    { label: "Numéro CNSS",      value: user?.profile?.numeroCnss,    state: numeroCnss,    setState: setNumeroCnss,    placeholder: "12345678",          type: "text",        icon: "🪪", description: "Numéro de sécurité sociale" },
    { label: "Date de naissance",value: user?.profile?.dateNaissance, state: dateNaissance, setState: setDateNaissance, placeholder: "",                  type: "date",        icon: "🎂", description: "Votre date de naissance" },
    { label: "Lieu de naissance",value: user?.profile?.lieuNaissance, state: lieuNaissance, setState: setLieuNaissance, placeholder: "Tunis",             type: "text",        icon: "📍", description: "Ville de naissance" },
    { label: "Banque",           value: user?.profile?.nomBanque,     state: nomBanque,     setState: setNomBanque,     placeholder: "BIAT",              type: "text",        icon: "🏦", description: "Nom de votre banque" },
    { label: "Statut social",    value: user?.profile?.statutSocial,  state: statutSocial,  setState: setStatutSocial,  placeholder: "",                  type: "radio",       icon: "💍", description: "CELIBATAIRE / MARIE" },
    { label: "Nationalité",      value: user?.profile?.nationalite,   state: nationalite,   setState: setNationalite,   placeholder: "",                  type: "select",      icon: "🌍", description: "Votre nationalité" },
    { label: "Genre",            value: user?.profile?.genre,         state: genre,         setState: setGenre,         placeholder: "",                  type: "radio-genre", icon: "⚧️", description: "HOMME / FEMME" },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 rounded-full animate-spin"
              style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement de votre profil...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* ── Header ── */}
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,174,239,0.1)", border: "2px solid rgba(0,174,239,0.2)" }}>
                <span className="text-lg font-bold" style={{ color: "#00AEEF" }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  {user?.prenom} {user?.nom}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium badge ${statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.class}`}>
              {statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.icon}
              {statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.label}
            </span>
          </div>
        </div>

        <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">

          {/* ── Alertes ── */}
          {joursRestants !== null && user?.statutCompte === "ACCEPTE" && completion < 100 && (
            <div className={`rounded-xl p-4 border flex gap-3 ${
              joursRestants <= 0 ? "bg-red-50 border-red-200" :
              joursRestants <= 1 ? "bg-orange-50 border-orange-200" : "bg-amber-50 border-amber-200"}`}>
              <span className="text-xl">{joursRestants <= 0 ? "🚨" : joursRestants <= 1 ? "⚠️" : "⏰"}</span>
              <div>
                <p className={`font-medium text-sm ${joursRestants <= 0 ? "text-red-800" : joursRestants <= 1 ? "text-orange-800" : "text-amber-800"}`}>
                  {joursRestants <= 0 ? "Action requise immédiatement" :
                   joursRestants === 1 ? "Dernier jour pour compléter votre profil" :
                   `Plus que ${joursRestants} jours`}
                </p>
                <p className={`text-xs mt-0.5 ${joursRestants <= 0 ? "text-red-600" : joursRestants <= 1 ? "text-orange-600" : "text-amber-600"}`}>
                  {joursRestants <= 0 ? "Votre compte risque d'être désactivé." :
                   `Date limite : ${new Date(user!.dateLimit!).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
            </div>
          )}

          {user?.statutCompte === "VALIDE" && (
            <div className="rounded-xl p-4 border bg-emerald-50 border-emerald-200 flex gap-3">
              <span className="text-xl">🎉</span>
              <div>
                <p className="font-medium text-emerald-800 text-sm">Félicitations !</p>
                <p className="text-xs text-emerald-600 mt-0.5">Votre compte a été validé par les RH.</p>
              </div>
            </div>
          )}

          {photoPosteSuccess && (
            <div className="rounded-xl p-4 border bg-emerald-50 border-emerald-200 flex items-center gap-3 text-sm text-emerald-700">
              ✅ {photoPosteSuccess}
              <button type="button" onClick={() => setPhotoPosteSuccess("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}

          {/* ── Carte Poste — TOUJOURS VISIBLE ── */}
          <div className="rounded-2xl p-6 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 50%, #243580 100%)" }}>
            {/* Décoration */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
              style={{ background: "radial-gradient(circle, #00AEEF, transparent)", transform: "translate(20%, -20%)" }} />
            <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full opacity-8"
              style={{ background: "radial-gradient(circle, #8DC63F, transparent)", transform: "translate(-20%, 30%)" }} />
            {/* Grid subtil */}
            <div className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `linear-gradient(rgba(0,174,239,0.5) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(0,174,239,0.5) 1px, transparent 1px)`,
                backgroundSize: "30px 30px",
              }} />

            <div className="relative flex items-center gap-6">
              {/* Photo poste */}
              <div className="relative flex-shrink-0">
                {photoPostePreview ? (
                  <img src={photoPostePreview} alt="Photo poste"
                    className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                    style={{ border: "3px solid rgba(0,174,239,0.4)" }}
                    onError={() => setPhotoPostePreview(null)} />
                ) : (
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
                    style={{ background: "rgba(0,174,239,0.15)", border: "3px solid rgba(0,174,239,0.3)" }}>
                    💼
                  </div>
                )}
                <button type="button"
                  onClick={() => setShowPhotoPosteModal(true)}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg flex items-center justify-center shadow-md hover:scale-110 transition"
                  style={{ background: "white" }}
                  title="Changer la photo du poste"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              </div>

              {/* Infos poste */}
              <div className="flex-1">
                {affectation ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "rgba(0,174,239,0.8)" }}>
                      Poste affecté
                    </p>
                    <h2 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: "Sora" }}>
                      {(positions as Position[]).find(p => p.id === affectation?.positionId)?.titre ?? "—"}
                    </h2>
                    <div className="flex items-center gap-4">
                      {managerNom && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: "rgba(0,174,239,0.3)" }}>
                            M
                          </div>
                          <span className="text-sm" style={{ color: "rgba(168,216,234,0.9)" }}>{managerNom}</span>
                        </div>
                      )}
                      <div className="text-xs" style={{ color: "rgba(168,216,234,0.6)" }}>
                        Depuis le {new Date(affectation.dateAffectation).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "rgba(0,174,239,0.8)" }}>
                      Poste affecté
                    </p>
                    <h2 className="text-xl font-bold mb-2 italic opacity-70 text-white" style={{ fontFamily: "Sora" }}>
                      En attente d'affectation
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8DC63F" }} />
                      <span className="text-xs" style={{ color: "rgba(168,216,234,0.65)" }}>
                        Votre poste sera défini par les RH après validation de votre compte.
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Identité + Progression ── */}
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(0,174,239,0.1)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Informations personnelles
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: "👤", label: "Nom complet",   value: `${user?.prenom} ${user?.nom}` },
                  { icon: "✉️", label: "Email",          value: user?.email },
                  { icon: "💼", label: "Rôle",           value: user?.role },
                  { icon: "📋", label: "Poste", value: (positions as Position[]).find(p => p.id === affectation?.positionId)?.titre || "Non affecté" },
                  { icon: "📅", label: "Membre depuis",  value: user?.dateCreation ? new Date(user.dateCreation).toLocaleDateString("fr-FR") : "N/A" },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: "var(--bg)" }}>
                    <span className="text-xl">{f.icon}</span>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.label}</p>
                      <p className={`text-sm font-medium mt-0.5 ${f.value === "Non affecté" ? "italic" : ""}`}
                        style={{ color: f.value === "Non affecté" ? "var(--text-muted)" : "var(--text)" }}>
                        {f.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progression */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(141,198,63,0.1)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8DC63F" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Progression
                </h2>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28 mb-3">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="2" />
                    <circle cx="18" cy="18" r="16" fill="none"
                      stroke={completion === 100 ? "#8DC63F" : "#00AEEF"}
                      strokeWidth="2"
                      strokeDasharray={`${completion} 100`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold" style={{ color: completion === 100 ? "#8DC63F" : "#00AEEF", fontFamily: "Sora" }}>
                      {completion}%
                    </span>
                  </div>
                </div>
                <div className="w-full space-y-1.5 mt-2">
                  {fields.slice(0, 5).map((f) => (
                    <div key={f.label} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--text-muted)" }}>{f.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${f.value ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {f.value ? "✓" : "○"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Formulaire coordonnées ── */}
          <div className="card">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(0,174,239,0.1)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      Mes coordonnées
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Informations requises par les RH</p>
                  </div>
                </div>
                {!editMode && user?.statutCompte !== "DESACTIVE" && (
                  <button type="button"
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 text-sm rounded-xl font-semibold transition hover:scale-105"
                    style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.2)" }}>
                    ✏️ Modifier
                  </button>
                )}
              </div>

              {!editMode ? (
                <div className="grid grid-cols-3 gap-4">
                  {fields.map((f, index) => (
                    <div key={index} className="p-4 rounded-xl"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">{f.icon}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${f.value ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {f.value ? "✓" : "○"}
                        </span>
                      </div>
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{f.label}</p>
                      <p className={`text-sm ${f.value ? "" : "italic"}`}
                        style={{ color: f.value ? "var(--text)" : "var(--text-muted)" }}>
                        {f.value || "Non renseigné"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {fields.map((f, index) => (
                      <div key={index}>
                        <label className="flex items-center gap-2 text-sm font-medium mb-1.5"
                          style={{ color: "var(--text)" }}>
                          <span>{f.icon}</span> {f.label}
                        </label>
                        {f.type === "radio" ? (
                          <div className="flex gap-4 mt-1">
                            {["CELIBATAIRE", "MARIE"].map((v) => (
                              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" value={v} checked={statutSocial === v}
                                  onChange={(e) => setStatutSocial(e.target.value)}
                                  style={{ accentColor: "#00AEEF" }} />
                                <span style={{ color: "var(--text)" }}>{v}</span>
                              </label>
                            ))}
                          </div>
                        ) : f.type === "radio-genre" ? (
                          <div className="flex gap-4 mt-1">
                            {["HOMME", "FEMME"].map((v) => (
                              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" value={v} checked={genre === v}
                                  onChange={(e) => setGenre(e.target.value)}
                                  style={{ accentColor: "#00AEEF" }} />
                                <span style={{ color: "var(--text)" }}>{v}</span>
                              </label>
                            ))}
                          </div>
                        ) : f.type === "select" ? (
                          <select value={nationalite} onChange={(e) => setNationalite(e.target.value)}
                            className="input-field">
                            <option value="">Sélectionner</option>
                            {["Tunisie","France","Algérie","Maroc","Belgique","Canada","Suisse","Italie","Espagne","Allemagne"].map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        ) : (
                          <input type={f.type} value={f.state}
                            onChange={(e) => f.setState(e.target.value)}
                            placeholder={f.placeholder} className="input-field" />
                        )}
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{f.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1 py-2.5">
                      {updateMutation.isPending ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enregistrement...
                        </span>
                      ) : "💾 Enregistrer"}
                    </button>
                    <button type="button"
                      onClick={() => { setEditMode(false); setSuccessMsg(""); setErrorMsg(""); }}
                      className="btn-secondary px-6 py-2.5">
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* ── Documents ── */}
          <DocumentsSection
            documents={user?.profile?.documents ?? []}
            disabled={user?.statutCompte === "DESACTIVE"}
          />

          {/* ── Messages ── */}
          {successMsg && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              ✅ {successMsg}
              <button type="button" onClick={() => setSuccessMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              ⚠️ {errorMsg}
              <button type="button" onClick={() => setErrorMsg("")} className="ml-auto opacity-60">✕</button>
            </div>
          )}
                      {/* Coordonne professionnelles */}
                  <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-4">
            Informations professionnelles
          </h3>
        
          <div className="grid grid-cols-2 gap-4">
        
            <div>
              <label className="text-sm text-gray-500">Mail professionnel</label>
              <p className="font-medium">
                {user?.professionalInfo?.emailProfessionnel || "-"}
              </p>
            </div>
        
            <div>
              <label className="text-sm text-gray-500">Téléphone professionnel</label>
              <p className="font-medium">
                {user?.professionalInfo?.telephoneProfessionnel || "-"}
              </p>
            </div>
        
            <div>
              <label className="text-sm text-gray-500">Date d'embauche</label>
              <p className="font-medium">
                {user?.professionalInfo?.dateEmbauche || "-"}
              </p>
            </div>
            </div>
          </div>
        </div>
        
      </main>

      {/* ── Modal photo poste ── */}
      {showPhotoPosteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60"
            onClick={() => setShowPhotoPosteModal(false)} />
          <div className="relative rounded-3xl shadow-2xl p-8 w-full mx-4"
            style={{ background: "var(--surface)", maxWidth: "480px", zIndex: 51 }}>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Photo de mon poste
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  URL ou fichier depuis votre appareil
                </p>
              </div>
              <button type="button" onClick={() => setShowPhotoPosteModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            {/* Aperçu */}
            <div className="flex justify-center mb-6">
              {(photoPosteUrl || photoPostePreview) ? (
                <img src={photoPosteUrl || photoPostePreview!} alt="Aperçu"
                  className="w-36 h-36 rounded-2xl object-cover shadow-lg"
                  style={{ border: "3px solid rgba(0,174,239,0.3)" }}
                  onError={() => setPhotoPosteUrl("")} />
              ) : (
                <div className="w-36 h-36 rounded-2xl flex flex-col items-center justify-center gap-2"
                  style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                  <span className="text-4xl">💼</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Aperçu</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Option 1 — Lien URL
                </label>
                <input type="url" value={photoPosteUrl}
                  onChange={(e) => setPhotoPosteUrl(e.target.value)}
                  placeholder="https://exemple.com/image.jpg"
                  className="input-field" />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>OU</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Option 2 — Importer un fichier
                </label>
                <label className="flex items-center justify-center gap-3 w-full py-3 rounded-xl cursor-pointer transition hover:scale-[1.01]"
                  style={{ background: "var(--bg)", border: "2px dashed var(--border)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="text-sm font-medium" style={{ color: "#00AEEF" }}>
                    {photoPosteFile ? photoPosteFile.name : "Choisir une image..."}
                  </span>
                  <input type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" />
                </label>
                <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                  JPG, PNG, WEBP — Depuis votre appareil ou caméra
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={handleSavePhotoPoste}
                  disabled={!photoPosteUrl.trim() && !photoPosteFile}
                  className="btn-primary flex-1 py-3">
                  ✓ Enregistrer la photo
                </button>
                <button type="button"
                  onClick={() => {
                    setPhotoPostePreview(null);
                    setPhotoPosteUrl("");
                    setPhotoPosteFile(null);
                    setShowPhotoPosteModal(false);
                  }}
                  className="btn-danger py-3 px-5">
                  🗑
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilPage;