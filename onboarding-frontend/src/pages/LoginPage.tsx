import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loginApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      login(data.token, data.email, data.role, data.userId);
      if (data.role === "ADMIN") navigate("/admin");
      else if (data.role === "MANAGER") navigate("/manager");
      else navigate("/dashboard");
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || "Email ou mot de passe incorrect.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#F0F4FA" }}>

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[520px] p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0D1B3E 0%, #1A2B6B 55%, #111D4A 100%)" }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1"
          style={{ background: "linear-gradient(90deg, #00AEEF, #8DC63F)" }} />

        {/* Background grid decoration */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(0,174,239,0.4) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(0,174,239,0.4) 1px, transparent 1px)`,
            backgroundSize: "40px 40px"
          }} />

        {/* Glowing orbs */}
        <div className="absolute top-1/4 -right-20 w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #00AEEF, transparent)" }} />
        <div className="absolute bottom-1/4 -left-20 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #8DC63F, transparent)" }} />

        {/* Logo */}
        <div className="relative flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 44 44" fill="none" className="w-11 h-11">
              <rect x="2" y="2" width="18" height="18" rx="3" fill="#00AEEF" opacity="0.9"/>
              <rect x="24" y="2" width="18" height="18" rx="3" fill="#8DC63F" opacity="0.9"/>
              <rect x="2" y="24" width="18" height="18" rx="3" fill="#A8D8EA" opacity="0.6"/>
              <rect x="24" y="24" width="18" height="18" rx="3" fill="#00AEEF" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-tight" style={{ fontFamily: "Sora" }}>
              SQUARE <span style={{ color: "#00AEEF" }}>IT</span>
            </p>
            <p className="text-xs font-semibold tracking-widest" style={{ color: "rgba(168,216,234,0.55)" }}>
              CONSULTING
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="relative">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(0,174,239,0.12)", border: "1px solid rgba(0,174,239,0.25)" }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00AEEF" }} />
            <span className="text-xs font-semibold" style={{ color: "#00AEEF" }}>
              Plateforme RH · Onboarding
            </span>
          </div>

          <h2 className="text-white text-4xl font-bold leading-tight mb-5" style={{ fontFamily: "Sora" }}>
            Bienvenue sur votre
            <br />
            <span style={{ color: "#00AEEF" }}>espace onboarding</span>
          </h2>
          <p className="text-base leading-relaxed mb-10" style={{ color: "rgba(168,216,234,0.65)" }}>
            Gérez l'intégration de vos nouveaux collaborateurs de façon simple, rapide et professionnelle.
          </p>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: "⚡", text: "Création de comptes automatisée", color: "#00AEEF" },
              { icon: "📊", text: "Suivi de progression en temps réel", color: "#8DC63F" },
              { icon: "✅", text: "Validation des profils par les RH", color: "#00AEEF" },
              { icon: "🎯", text: "Affectation de postes et parcours", color: "#8DC63F" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                  {f.icon}
                </div>
                <span className="text-sm" style={{ color: "rgba(168,216,234,0.75)" }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs" style={{ color: "rgba(168,216,234,0.3)" }}>
          © 2025 Square IT Consulting — Tous droits réservés
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md page-enter">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <svg viewBox="0 0 36 36" fill="none" className="w-9 h-9">
              <rect x="2" y="2" width="14" height="14" rx="2" fill="#00AEEF"/>
              <rect x="20" y="2" width="14" height="14" rx="2" fill="#8DC63F"/>
              <rect x="2" y="20" width="14" height="14" rx="2" fill="#A8D8EA" opacity="0.7"/>
              <rect x="20" y="20" width="14" height="14" rx="2" fill="#00AEEF" opacity="0.5"/>
            </svg>
            <div>
              <p className="font-bold text-base" style={{ color: "#1A2B6B", fontFamily: "Sora" }}>
                SQUARE <span style={{ color: "#00AEEF" }}>IT</span>
              </p>
              <p className="text-xs tracking-widest font-semibold" style={{ color: "#7A8BB0" }}>CONSULTING</p>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#0D1B3E", fontFamily: "Sora" }}>
              Connexion
            </h1>
            <p className="text-sm" style={{ color: "#7A8BB0" }}>
              Entrez vos identifiants pour accéder à votre espace.
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl p-8 shadow-xl"
            style={{ background: "#fff", border: "1px solid #DDE5F0" }}>
            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#0D1B3E" }}>
                  Adresse email
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: "#7A8BB0" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="vous@squareit.fr"
                    className="input-field"
                    style={{ paddingLeft: "40px" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#0D1B3E" }}>
                  Mot de passe
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#7A8BB0" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="input-field"
                    style={{ paddingLeft: "40px", paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition"
                    style={{ color: "#7A8BB0" }}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Mot de passe oublié */}
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs font-semibold transition hover:underline"
                  style={{ color: "#00AEEF" }}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="btn-primary w-full py-3 text-base mt-1"
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connexion en cours...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Se connecter
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: "#B0BEDB" }}>
            Vous n'avez pas de compte ?{" "}
            <span className="font-semibold" style={{ color: "#7A8BB0" }}>
              Contactez votre service RH.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;