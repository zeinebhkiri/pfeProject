import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUserApi, updateMyProfileApi, getAllUsersApi } from "../api/authApi";
import { type User } from "../types/auth";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";

const AdminProfilPage = () => {
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: adminUser, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserApi,
  });

  const { data: allUsers } = useQuery({
    queryKey: ["allUsers"],
    queryFn: getAllUsersApi,
  });

  useEffect(() => {
    if (adminUser) {
      setTelephone(adminUser.profile?.telephone || "");
      setAdresse(adminUser.profile?.adresse || "");
      if (adminUser.profile?.image) setPhotoPreview(adminUser.profile.image);
    }
  }, [adminUser]);

  const salariesIntegres = (allUsers ?? []).filter(
    (u: User) => u.role !== "ADMIN" && u.statutCompte === "VALIDE"
  ).length;

  const totalEmployees = (allUsers ?? []).filter((u: User) => u.role !== "ADMIN").length;

  const updateMutation = useMutation({
    mutationFn: () => updateMyProfileApi({ adresse, rib: "", telephone , image: photoPreview || "", numeroCnss: adminUser?.profile?.numeroCnss || "", dateNaissance: adminUser?.profile?.dateNaissance || "", lieuNaissance: adminUser?.profile?.lieuNaissance || "", nomBanque: adminUser?.profile?.nomBanque || "", statutSocial: adminUser?.profile?.statutSocial || "", nationalite: adminUser?.profile?.nationalite || "", genre: adminUser?.profile?.genre || "" }),
    onSuccess: () => {
      setSuccessMsg("Profil mis à jour avec succès !");
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onError: () => setErrorMsg("Erreur lors de la mise à jour."),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role="ADMIN" />
        <main
          className="flex-1 flex items-center justify-center"
          style={{ marginLeft: "var(--sidebar-w)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 rounded-full animate-spin"
style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement...</span>
          </div>
        </main>
      </div>
    );
  }

  const initials = `${adminUser?.prenom?.[0] ?? ""}${adminUser?.nom?.[0] ?? ""}`;
  const matricule = `RH-${adminUser?.id?.slice(-6).toUpperCase() ?? "000000"}`;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="ADMIN" />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav showSearch={false}  />

        <div className="px-8 py-10 page-enter">

          {/* Hero banner */}
          <div
            className="relative rounded-3xl overflow-hidden mb-8"
            style={{
              background: "linear-gradient(135deg, #1A2B6B 0%, #243580 50%, #00AEEF 100%)",
              minHeight: "180px",
            }}
          >
            {/* Decorative circles */}
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
              style={{ background: "white", transform: "translate(30%, -30%)" }}
            />
            <div
              className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-10"
              style={{ background: "white", transform: "translateY(40%)" }}
            />

            <div className="relative px-10 py-8 flex items-center gap-8">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Photo profil"
                    className="w-24 h-24 rounded-2xl object-cover shadow-xl"
                    style={{ border: "4px solid rgba(255,255,255,0.3)" }}
                    onError={() => setPhotoPreview(null)}
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-xl"
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      backdropFilter: "blur(10px)",
                      border: "4px solid rgba(255,255,255,0.3)",
                      fontFamily: "Sora",
                    }}
                  >
                    {initials}
                  </div>
                )}
                <button
                  onClick={() => setShowPhotoModal(true)}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition hover:scale-110"
                  style={{ background: "white" }}
                  title="Changer la photo"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              </div>

              {/* Identity */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "Sora" }}>
                    {adminUser?.prenom} {adminUser?.nom}
                  </h1>
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                  >
                    ADMIN RH
                  </span>
                </div>
                <p className="text-sm mb-4" style={{ color: "rgba(168,216,234,0.75)" }}>{adminUser?.email}</p>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs font-medium" style={{ color: "rgba(168,216,234,0.55)" }}>Matricule</p>
                    <p className="text-white font-bold text-sm">{matricule}</p>
                  </div>
                  <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.2)" }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: "rgba(168,216,234,0.55)" }}>Membre depuis</p>
                    <p className="text-white font-bold text-sm">
                      {adminUser?.dateCreation
                        ? new Date(adminUser.dateCreation).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "long", year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex gap-4">
                {[
                  { label: "Employés total", value: totalEmployees, icon: "👥" },
                  { label: "Intégrés", value: salariesIntegres, icon: "✅" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl px-6 py-4 text-center"
                    style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <p className="text-3xl font-bold text-white mt-1" style={{ fontFamily: "Sora" }}>
                      {s.value}
                    </p>
                    <p className="text-indigo-200 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Messages */}
          {successMsg && (
            <div
              className="mb-6 flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}
            >
              <span className="text-xl">✅</span>
              {successMsg}
              <button onClick={() => setSuccessMsg("")} className="ml-auto opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
          {errorMsg && (
            <div
              className="mb-6 flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-medium"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
            >
              <span className="text-xl">⚠️</span>
              {errorMsg}
              <button onClick={() => setErrorMsg("")} className="ml-auto opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">

            {/* Colonne gauche */}
            <div className="space-y-5">

              {/* Identité */}
              <div className="card p-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>
                  Identité
                </p>
                <div className="space-y-4">
                  {[
                    {
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      ),
                      label: "Nom complet",
                      value: `${adminUser?.prenom} ${adminUser?.nom}`,
                    },
                    {
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                      ),
                      label: "Email",
                      value: adminUser?.email,
                    },
                    {
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2"/>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                      ),
                      label: "Matricule",
                      value: matricule,
                    },
                  ].map((f) => (
                    <div key={f.label} className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF" }}
                      >
                        {f.icon}
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.label}</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                          {f.value || "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="card p-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>
                  Contact
                </p>
                <div className="space-y-4">
                  {[
                    {
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      ),
                      label: "Téléphone",
                      value: adminUser?.profile?.telephone,
                    },
                    {
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                      ),
                      label: "Adresse",
                      value: adminUser?.profile?.adresse,
                    },
                  ].map((f) => (
                    <div key={f.label} className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF" }}
                      >
                        {f.icon}
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.label}</p>
                        <p
                          className={`text-sm font-semibold mt-0.5 ${!f.value ? "italic" : ""}`}
                          style={{ color: f.value ? "var(--text)" : "var(--text-muted)" }}
                        >
                          {f.value || "Non renseigné"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Colonne droite — Formulaire */}
            <div className="col-span-2">
              <div className="card p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                      {editMode ? "Modifier mes informations" : "Informations personnelles"}
                    </h2>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                      {editMode
                        ? "Modifiez vos coordonnées ci-dessous"
                        : "Vos données professionnelles et personnelles"}
                    </p>
                  </div>
                  {!editMode && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition hover:scale-105"
                      style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF", border: "1px solid rgba(0,174,239,0.2)" }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Modifier
                    </button>
                  )}
                </div>

                {!editMode ? (
                  <div className="grid grid-cols-2 gap-5">
                    {[
                      { label: "Prénom", value: adminUser?.prenom, icon: "👤" },
                      { label: "Nom", value: adminUser?.nom, icon: "👤" },
                      { label: "Email professionnel", value: adminUser?.email, icon: "✉️" },
                      { label: "Matricule RH", value: matricule, icon: "🪪" },
                      { label: "Téléphone", value: adminUser?.profile?.telephone, icon: "📞" },
                      { label: "Adresse", value: adminUser?.profile?.adresse, icon: "📍" },
                      {
                        label: "Date de recrutement",
                        value: adminUser?.dateCreation
                          ? new Date(adminUser.dateCreation).toLocaleDateString("fr-FR", {
                              day: "2-digit", month: "long", year: "numeric",
                            })
                          : undefined,
                        icon: "📅",
                      },
                      { label: "Salariés intégrés", value: `${salariesIntegres} validé(s)`, icon: "✅" },
                    ].map((f) => (
                      <div
                        key={f.label}
                        className="rounded-2xl p-4"
                        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                      >
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                          {f.icon} {f.label}
                        </p>
                        <p
                          className={`text-sm font-semibold ${!f.value ? "italic" : ""}`}
                          style={{ color: f.value ? "var(--text)" : "var(--text-muted)" }}
                        >
                          {f.value || "Non renseigné"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          Prénom
                        </label>
                        <input
                          value={adminUser?.prenom ?? ""} disabled
                          className="input-field"
                          style={{ opacity: 0.5, cursor: "not-allowed" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          Nom
                        </label>
                        <input
                          value={adminUser?.nom ?? ""} disabled
                          className="input-field"
                          style={{ opacity: 0.5, cursor: "not-allowed" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Email
                      </label>
                      <input
                        value={adminUser?.email ?? ""} disabled
                        className="input-field"
                        style={{ opacity: 0.5, cursor: "not-allowed" }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Téléphone
                      </label>
                      <div className="relative">
                        <span
                          className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                        </span>
                        <input
                          value={telephone}
                          onChange={(e) => setTelephone(e.target.value)}
                          placeholder="+33 6 12 34 56 78"
                          className="input-field"
                          style={{ paddingLeft: "40px" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Adresse
                      </label>
                      <div className="relative">
                        <span
                          className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                        </span>
                        <input
                          value={adresse}
                          onChange={(e) => setAdresse(e.target.value)}
                          placeholder="12 rue de la Paix, Paris"
                          className="input-field"
                          style={{ paddingLeft: "40px" }}
                        />
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
                      <div className="flex gap-3">
                        <button
                          onClick={() => updateMutation.mutate()}
                          disabled={updateMutation.isPending}
                          className="btn-primary flex-1 py-3"
                        >
                          {updateMutation.isPending ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Enregistrement...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Enregistrer les modifications
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => { setEditMode(false); setErrorMsg(""); }}
                          className="btn-secondary px-8 py-3"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal changement photo */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 drawer-overlay"
            onClick={() => setShowPhotoModal(false)}
          />
          <div
            className="relative rounded-3xl shadow-2xl p-8 w-full mx-4 modal-panel"
            style={{ background: "var(--surface)", maxWidth: "440px" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Changer la photo de profil
              </h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            {/* Aperçu */}
            <div className="flex justify-center mb-6">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Aperçu"
                  className="w-24 h-24 rounded-2xl object-cover shadow-md"
                  onError={() => {}}
                />
              ) : photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Aperçu actuel"
                  className="w-24 h-24 rounded-2xl object-cover shadow-md"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold"
                  style={{
                    background: "var(--bg)",
                    border: "2px dashed var(--border)",
                    color: "var(--text-muted)",
                    fontFamily: "Sora",
                  }}
                >
                  {initials}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Lien de l'image (URL)
                </label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://exemple.com/photo.jpg"
                  className="input-field"
                />
                <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                  Collez un lien direct vers une image (jpg, png, webp...)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                 onClick={async () => {
  if (photoUrl.trim()) {
    setPhotoPreview(photoUrl.trim());
    // Sauvegarder immédiatement en base
    try {
      await updateMyProfileApi({
        adresse: adminUser?.profile?.adresse || "",
        rib: adminUser?.profile?.rib || "",
        telephone: adminUser?.profile?.telephone || "",
        image: photoUrl.trim(),
        numeroCnss: adminUser?.profile?.numeroCnss || "",
        dateNaissance: adminUser?.profile?.dateNaissance || "",
        lieuNaissance: adminUser?.profile?.lieuNaissance || "",
        nomBanque: adminUser?.profile?.nomBanque || "",
        statutSocial: adminUser?.profile?.statutSocial || "",
        nationalite: adminUser?.profile?.nationalite || "",
        genre: adminUser?.profile?.genre || "",});
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setSuccessMsg("Photo de profil mise à jour !");
    } catch {
      setErrorMsg("Erreur lors de la sauvegarde de la photo.");
    }
  }
  setShowPhotoModal(false);
  setPhotoUrl("");
}}
                  disabled={!photoUrl.trim()}
                  className="btn-primary flex-1 py-2.5"
                >
                  ✓ Appliquer
                </button>
                <button
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoUrl("");
                    setShowPhotoModal(false);
                  }}
                  className="btn-danger py-2.5 px-5"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfilPage;