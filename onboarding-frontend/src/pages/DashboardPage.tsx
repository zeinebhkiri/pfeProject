import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getCurrentUserApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import type { StatutCompte, UserProfile, UserRole } from "../types/auth";
import TopNav from "../components/TopNav";
import CompanyDocumentsWidget from "../components/CompanyDocumentsWidget";
const statutConfig: Record<string, { label: string; class: string; icon: string }> = {
  EN_ATTENTE: { 
    label: "En attente d'activation", 
    class: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: "⏳"
  },
  ACCEPTE: { 
    label: "Profil en cours", 
    class: "bg-blue-50 text-blue-700 border border-blue-200",
    icon: "📝"
  },
  VALIDE: { 
    label: "Compte validé ✓", 
    class: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: "✅"
  },
  DESACTIVE: { 
    label: "Compte désactivé", 
    class: "bg-slate-100 text-slate-500 border border-slate-200",
    icon: "🔒"
  },
  EXPIRE: { 
    label: "Délai expiré", 
    class: "bg-red-50 text-red-600 border border-red-200",
    icon: "⚠️"
  },
};

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  statutCompte: StatutCompte;
  profilCompletion: number;
  profile?: UserProfile & {
    image?: string;
  };
  dateCreation: string;
  dateValidation?: string;
  dateLimit?: string;
  poste?: string;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserApi,
  });

  const joursRestants = user?.dateLimit
    ? Math.ceil((new Date(user.dateLimit).getTime() - Date.now()) / 86400000)
    : null;

  const completion = user?.profilCompletion ?? 0;
  
  // Champs manquants
  const missingFields = [];
  if (!user?.profile?.adresse) missingFields.push("adresse");
  if (!user?.profile?.rib) missingFields.push("RIB");
  if (!user?.profile?.telephone) missingFields.push("téléphone");
  
  const missingCount = missingFields.length;

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin"
style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }}></div>
            <div className="text-slate-400 text-sm font-medium">Chargement de votre espace...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Sidebar role={role as any} />

      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav showSearch={false} />
        
        <div className="p-6 lg:p-8 space-y-6">
          {/* Hero Section - Profile Header */}
          <div className="relative rounded-3xl overflow-hidden mb-8 shadow-2xl">
            {/* Animated gradient background */}
            <div 
              className="absolute inset-0 animate-gradient-x"
style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 50%, #00AEEF 100%)", backgroundSize: "200% 200%" }}
            />
            
            {/* Decorative elements */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
            </div>
            
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-5" style={{ 
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "40px 40px"
            }} />

            <div className="relative px-8 py-8 lg:px-12 lg:py-10">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
                {/* Avatar with glow effect */}
                <div className="flex-shrink-0">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-white/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                    {user?.profile?.image ? (
                      <img
                        src={user.profile.image}
                        alt="Photo profil"
                        className="relative w-28 h-28 lg:w-32 lg:h-32 rounded-2xl object-cover shadow-2xl ring-4 ring-white/20 group-hover:ring-white/30 transition-all duration-300"
                        onError={(e) => {
                          // Si l'image ne charge pas, on affiche les initiales
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.classList.add('fallback-active');
                        }}
                      />
                    ) : null}
                    <div className={`relative w-28 h-28 lg:w-32 lg:h-32 rounded-2xl flex items-center justify-center text-white font-bold text-4xl shadow-2xl ring-4 ring-white/20 group-hover:ring-white/30 transition-all duration-300 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm ${user?.profile?.image ? 'hidden' : ''}`}>
                      {user?.prenom?.[0]}{user?.nom?.[0]}
                    </div>
                  </div>
                </div>

                {/* Identity */}
                <div className="flex-1 text-white">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
                      {user?.prenom} {user?.nom}
                    </h1>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.class} shadow-lg`}>
                      <span>{statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.icon}</span>
                      {statutConfig[user?.statutCompte ?? "EN_ATTENTE"]?.label}
                    </span>
                  </div>
                  
                  <p className="text-sm lg:text-base flex items-center gap-2 mb-2" style={{ color: "rgba(168,216,234,0.85)" }}>
                    <span>✉️</span> {user?.email}
                  </p>
                  
                  <p className="text-sm flex items-center gap-2" style={{ color: "rgba(168,216,234,0.75)" }}>
                    <span>👋</span> Bonjour {user?.prenom}, ravi de vous revoir !
                  </p>
                  
                  <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: "rgba(168,216,234,0.55)" }}>
                    <span>📅</span>
                    {new Date().toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Alertes et notifications */}
          <div className="space-y-4">
            {/* Alerte profil incomplet */}
            {missingCount > 0 && user?.statutCompte !== "VALIDE" && user?.statutCompte !== "DESACTIVE" && (
              <div className="rounded-2xl p-6 shadow-lg border-l-4 backdrop-blur-sm transition-all duration-300 bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl animate-bounce text-amber-600">
                      ⚠️
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-amber-700 mb-1">
                        Profil incomplet
                      </h4>
                      <p className="text-amber-600 text-sm">
                        Il vous manque {missingCount} champ{missingCount > 1 ? 's' : ''} à remplir : {missingFields.join(', ')}.
                      </p>
                      <p className="text-amber-500 text-xs mt-2">
                        Complétez votre profil pour finaliser votre inscription.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/profile')}
                    className="px-6 py-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium text-amber-700 flex items-center justify-center gap-2"
                  >
                    <span>✏️</span>
                    Compléter mon profil
                  </button>
                </div>
              </div>
            )}

            {/* Alerte date limite */}
            {joursRestants !== null && user?.statutCompte === "ACCEPTE" && completion < 100 && (
              <div className={`rounded-2xl p-6 shadow-lg border-l-4 backdrop-blur-sm transition-all duration-300 ${
                joursRestants <= 0 ? "bg-gradient-to-r from-red-50 to-red-100/50 border-red-500" :
                joursRestants <= 1 ? "bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-500" :
                "bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-500"
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`text-3xl animate-bounce ${
                      joursRestants <= 0 ? "text-red-600" :
                      joursRestants <= 1 ? "text-orange-600" :
                      "text-amber-600"
                    }`}>
                      {joursRestants <= 0 ? "🚨" : joursRestants <= 1 ? "⚠️" : "⏰"}
                    </div>
                    <div>
                      <h4 className={`font-bold text-lg mb-1 ${
                        joursRestants <= 0 ? "text-red-700" :
                        joursRestants <= 1 ? "text-orange-700" :
                        "text-amber-700"
                      }`}>
                        {joursRestants <= 0 ? "Action requise immédiatement !" :
                         joursRestants === 1 ? "Dernier jour pour compléter votre profil" :
                         `Plus que ${joursRestants} jours`}
                      </h4>
                      <p className={`text-sm ${
                        joursRestants <= 0 ? "text-red-600" :
                        joursRestants <= 1 ? "text-orange-600" :
                        "text-amber-600"
                      }`}>
                        {joursRestants <= 0 ? "Votre compte risque d'être désactivé automatiquement." :
                         joursRestants === 1 ? "Complétez votre profil aujourd'hui pour éviter toute désactivation." :
                         `Il vous reste ${joursRestants} jours pour compléter votre profil.`}
                      </p>
                      <p className="text-xs mt-2 opacity-75">
                        Date limite : {new Date(user!.dateLimit!).toLocaleDateString("fr-FR", { 
                          day: "2-digit", 
                          month: "long", 
                          year: "numeric"
                        })}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/profile')}
                    className="px-6 py-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium text-slate-700 flex items-center justify-center gap-2"
                  >
                    <span>✏️</span>
                    Compléter maintenant
                  </button>
                </div>
              </div>
            )}

            {/* Compte validé */}
            {user?.statutCompte === "VALIDE" && (
              <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="text-4xl animate-bounce">🎉</div>
                  <div>
                    <h4 className="font-bold text-emerald-800 text-lg mb-1">Félicitations !</h4>
                    <p className="text-emerald-700">Votre compte a été validé par les RH. Vous êtes officiellement intégré à l'équipe !</p>
                    <p className="text-emerald-600 text-sm mt-2">Bienvenue parmi nous ✨</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cards info + progression */}
          {/* Layout 2 colonnes : gauche = contenu, droite = progression + documents */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Colonne gauche — Infos + Coordonnées */}
            <div className="lg:col-span-2 space-y-6">

              {/* Informations personnelles */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
  style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF" }}>
                    <span className="text-xl">👤</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Informations personnelles</h2>
                    <p className="text-xs text-slate-400">Vos informations principales</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { icon: "👤", label: "Nom complet", value: `${user?.prenom} ${user?.nom}` },
                    { icon: "✉️", label: "Email", value: user?.email },
                    { icon: "💼", label: "Rôle", value: user?.role },
                    { icon: "📋", label: "Poste", value: (user as any)?.poste || "Non affecté" },
                  ].map((f, index) => (
                    <div key={index} className="group p-4 rounded-xl bg-slate-50 hover:bg-white border border-transparent transition-all duration-300" onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,174,239,0.2)"}
onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"} >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{f.icon}</span>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">{f.label}</p>
                          <p className={`font-medium ${f.value === "Non affecté" ? "text-slate-400 italic" : "text-slate-800"}`}>
                            {f.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => navigate('/profile')}
                    className="text-sm font-medium flex items-center gap-2 transition-colors duration-300"
style={{ color: "#00AEEF" }}
                  >
                    <span>Voir mon profil complet</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Aperçu des coordonnées */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
  style={{ background: "rgba(0,174,239,0.1)", color: "#00AEEF" }}>
                        <span className="text-xl">📍</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Mes coordonnées</h2>
                        <p className="text-xs text-slate-400">Aperçu de vos informations</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/profile')}
                      className="group flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300"
style={{ background: "rgba(0,174,239,0.08)", border: "1px solid rgba(0,174,239,0.2)", color: "#00AEEF" }}
                    >
                      <span className="text-lg">✏️</span>
                      <span>Gérer mes coordonnées</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { icon: "🏠", label: "Adresse", value: user?.profile?.adresse },
                      { icon: "🏦", label: "RIB", value: user?.profile?.rib },
                      { icon: "📱", label: "Téléphone", value: user?.profile?.telephone },
                    ].map((item, index) => (
                      <div key={index} className="group p-5 rounded-xl bg-slate-50 hover:bg-white border border-transparent transition-all duration-300"
onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,174,239,0.2)"}
onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                            <p className={`text-sm font-medium truncate ${item.value ? "text-slate-800" : "text-amber-500 italic"}`}>
                              {item.value || "Non renseigné"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne droite — Progression + Documents */}
            <div className="space-y-6">

              {/* Progression */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <span className="text-xl">📊</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Progression</h2>
                    <p className="text-xs text-slate-400">Complétion du profil</p>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 mb-4">
                    <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                      <circle
                        cx="18" cy="18" r="16" fill="none"
                        stroke={completion === 100 ? "#8DC63F" : "#00AEEF"}
                        strokeWidth="2.5"
                        strokeDasharray={`${completion} 100`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span style={{ color: completion === 100 ? "#8DC63F" : "#00AEEF" }}
className="text-3xl font-bold">
                        {completion}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Profil complété</p>
                  <p className="text-xs text-slate-400 text-center">
                    {completion === 100 ? (
                      <span className="text-emerald-600 flex items-center gap-1">✅ Profil complet - Bravo !</span>
                    ) : (
                      `${missingCount} champ${missingCount > 1 ? 's' : ''} à renseigner`
                    )}
                  </p>
                  {completion < 100 && (
                    <button
                      onClick={() => navigate('/profile')}
                      className="mt-6 w-full px-4 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2"
style={{ background: "rgba(0,174,239,0.08)", border: "1px solid rgba(0,174,239,0.2)", color: "#00AEEF" }}
                    >
                      <span>✏️</span>
                      Compléter mon profil
                    </button>
                  )}
                </div>
              </div>

              {/* Documents entreprise */}
              <CompanyDocumentsWidget />

            </div>
          </div>
          </div>
      </main>

      {/* Styles additionnels */}
      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          animation: gradient-x 15s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;