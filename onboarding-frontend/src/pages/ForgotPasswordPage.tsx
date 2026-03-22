import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { forgotPasswordApi } from "../api/authApi";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: forgotPasswordApi,
    onSuccess: () => setSent(true),
  });

  return (
    <div className="min-h-screen flex" style={{ background: "#f8fafc" }}>
      {/* Left panel — identique à LoginPage */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] p-12"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">
            O
          </div>
          <span className="text-white font-semibold text-lg" style={{ fontFamily: "Sora" }}>
            OnboardPro
          </span>
        </div>
        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4" style={{ fontFamily: "Sora" }}>
            Mot de passe oublié ?
          </h2>
          <p className="text-slate-400 text-base leading-relaxed">
            Pas de panique. Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>
        </div>
        <p className="text-slate-500 text-xs">© 2025 OnboardPro — Tous droits réservés</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md page-enter">

          {!sent ? (
            <>
              <div className="mb-10">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6"
                  style={{ background: "#eef2ff" }}>
                  🔑
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Sora" }}>
                  Mot de passe oublié
                </h1>
                <p className="text-slate-500 text-sm">
                  Entrez votre adresse email pour recevoir un lien de réinitialisation.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="input-field"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && email.trim()) mutation.mutate(email);
                    }}
                  />
                </div>

                {mutation.isError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <span>⚠</span>
                    Une erreur est survenue. Réessayez.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { if (email.trim()) mutation.mutate(email); }}
                  disabled={mutation.isPending || !email.trim()}
                  className="btn-primary w-full py-3 text-base"
                >
                  {mutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi...
                    </span>
                  ) : "Envoyer le lien →"}
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
            /* État succès */
            <div className="text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
                style={{ background: "#ecfdf5", border: "2px solid #a7f3d0" }}>
                ✉️
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-3" style={{ fontFamily: "Sora" }}>
                Email envoyé !
              </h1>
              <p className="text-slate-500 text-sm mb-2">
                Si <strong>{email}</strong> correspond à un compte, vous recevrez un lien de réinitialisation.
              </p>
              <p className="text-slate-400 text-xs mb-8">
                Le lien est valable 30 minutes. Vérifiez vos spams si vous ne le trouvez pas.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="btn-primary px-8 py-3"
              >
                Retour à la connexion
              </button>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => { setSent(false); mutation.reset(); }}
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Renvoyer un email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;