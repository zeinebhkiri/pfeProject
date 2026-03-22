import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordApi } from "../api/authApi";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: resetPasswordApi,
    onSuccess: () => {
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || "Une erreur est survenue.");
    },
  });

  const handleSubmit = () => {
    setErrorMessage("");
    if (!password || !confirmPassword) {
      setErrorMessage("Veuillez remplir tous les champs.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    mutation.mutate({ token, password, confirmPassword });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Lien invalide</h2>
          <p className="text-slate-500 text-sm mb-6">Ce lien de réinitialisation est invalide ou manquant.</p>
          <button type="button" onClick={() => navigate("/login")} className="btn-primary px-6 py-2.5">
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#f8fafc" }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] p-12"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">O</div>
          <span className="text-white font-semibold text-lg" style={{ fontFamily: "Sora" }}>OnboardPro</span>
        </div>
        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4" style={{ fontFamily: "Sora" }}>
            Nouveau mot de passe
          </h2>
          <p className="text-slate-400 text-base leading-relaxed">
            Choisissez un mot de passe fort d'au moins 8 caractères.
          </p>
        </div>
        <p className="text-slate-500 text-xs">© 2025 OnboardPro — Tous droits réservés</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md page-enter">

          {!done ? (
            <>
              <div className="mb-10">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6"
                  style={{ background: "#eef2ff" }}>
                  🔒
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Sora" }}>
                  Nouveau mot de passe
                </h1>
                <p className="text-slate-500 text-sm">
                  Choisissez un nouveau mot de passe sécurisé.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="input-field"
                  />
                  {/* Indicateur force mot de passe */}
                  {password && (
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div key={level} className="flex-1 h-1 rounded-full transition-all"
                          style={{
                            background: password.length >= level * 3
                              ? level <= 1 ? "#ef4444"
                              : level <= 2 ? "#f59e0b"
                              : level <= 3 ? "#3b82f6"
                              : "#10b981"
                              : "var(--border)"
                          }} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className="input-field"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-emerald-600 mt-1">✓ Les mots de passe correspondent</p>
                  )}
                </div>

                {errorMessage && (
                  <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <span>⚠</span> {errorMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={mutation.isPending}
                  className="btn-primary w-full py-3 text-base"
                >
                  {mutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Réinitialisation...
                    </span>
                  ) : "Réinitialiser mon mot de passe →"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full py-3 text-sm font-medium transition"
                  style={{ color: "var(--text-muted)" }}
                >
                  ← Retour à la connexion
                </button>
              </div>
            </>
          ) : (
            /* Succès */
            <div className="text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
                style={{ background: "#ecfdf5", border: "2px solid #a7f3d0" }}>
                ✅
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-3" style={{ fontFamily: "Sora" }}>
                Mot de passe modifié !
              </h1>
              <p className="text-slate-500 text-sm mb-2">
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <p className="text-slate-400 text-xs mb-8">
                Vous allez être redirigé vers la connexion dans 3 secondes...
              </p>
              <button type="button" onClick={() => navigate("/login")} className="btn-primary px-8 py-3">
                Se connecter →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;