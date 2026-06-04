import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  submitFeedbackApi,
  getMyFeedbackStatusApi,
  getMyParcoursApi,
} from "../api/authApi";
import Sidebar, { MobileNav } from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";

const C = {
  navy: "#1A2B6B",
  cyan: "#00AEEF",
  green: "#8DC63F",
  violet: "#7C3AED",
  amber: "#F59E0B",
  rose: "#F43F5E",
  muted: "var(--text-muted)",
  border: "var(--border)",
  surface: "var(--surface)",
  text: "var(--text)",
  bg: "var(--bg)",
};

type RadioOption = { label: string; value: number; emoji?: string };

const RadioGroup = ({
  question,
  options,
  value,
  onChange,
  name,
}: {
  question: string;
  options: RadioOption[];
  value: number | null;
  onChange: (v: number) => void;
  name: string;
}) => (
  <div className="mb-6">
    <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
      {question}
    </p>
    <div className="grid gap-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
          style={{
            background: value === opt.value ? `${C.cyan}12` : C.surface,
            border: `1.5px solid ${value === opt.value ? C.cyan : C.border}`,
            boxShadow: value === opt.value ? `0 0 0 3px ${C.cyan}20` : "none",
          }}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="hidden"
          />
          <div
            className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            style={{
              borderColor: value === opt.value ? C.cyan : C.border,
              background: value === opt.value ? C.cyan : "transparent",
            }}
          >
            {value === opt.value && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <span className="text-sm" style={{ color: value === opt.value ? C.cyan : C.text }}>
            {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  </div>
);

const SectionCard = ({
  number,
  title,
  icon,
  children,
  color = C.cyan,
}: {
  number: string;
  title: string;
  icon: string;
  children: React.ReactNode;
  color?: string;
}) => (
  <div
    className="rounded-2xl p-6 mb-6"
    style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
    }}
  >
    <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style={{ background: `${color}15` }}
      >
        {icon}
      </div>
      <div>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
          Section {number}
        </span>
        <h3 className="text-base font-bold" style={{ color: C.text, fontFamily: "Sora" }}>
          {title}
        </h3>
      </div>
    </div>
    {children}
  </div>
);

const ACCUEIL_OPTIONS: RadioOption[] = [
  { label: "Très satisfaisant", value: 4, emoji: "😄" },
  { label: "Satisfaisant", value: 3, emoji: "🙂" },
  { label: "Moyen", value: 2, emoji: "😐" },
  { label: "Insatisfaisant", value: 1, emoji: "😕" },
];

const OUI_NON_OPTIONS: RadioOption[] = [
  { label: "Oui totalement", value: 3, emoji: "✅" },
  { label: "Oui partiellement", value: 2, emoji: "🔶" },
  { label: "Non", value: 1, emoji: "❌" },
];

const ACCOMPAGNEMENT_OPTIONS: RadioOption[] = [
  { label: "Excellent accompagnement", value: 4, emoji: "⭐" },
  { label: "Bon accompagnement", value: 3, emoji: "👍" },
  { label: "Accompagnement moyen", value: 2, emoji: "↔️" },
  { label: "Accompagnement insuffisant", value: 1, emoji: "👎" },
];

const ADAPTATION_OPTIONS: RadioOption[] = [
  { label: "Très adaptées", value: 4, emoji: "🎯" },
  { label: "Adaptées", value: 3, emoji: "✅" },
  { label: "Peu adaptées", value: 2, emoji: "🔶" },
  { label: "Pas adaptées", value: 1, emoji: "❌" },
];

const DELAI_OPTIONS: RadioOption[] = [
  { label: "Oui", value: 3, emoji: "✅" },
  { label: "Partiellement", value: 2, emoji: "🔶" },
  { label: "Non", value: 1, emoji: "❌" },
];

const FACILITE_OPTIONS: RadioOption[] = [
  { label: "Très facile", value: 4, emoji: "🚀" },
  { label: "Facile", value: 3, emoji: "👍" },
  { label: "Moyenne", value: 2, emoji: "↔️" },
  { label: "Difficile", value: 1, emoji: "😓" },
];

const SATISFACTION_OPTIONS: RadioOption[] = [
  { label: "Très satisfait(e)", value: 4, emoji: "🌟" },
  { label: "Satisfait(e)", value: 3, emoji: "😊" },
  { label: "Peu satisfait(e)", value: 2, emoji: "😐" },
  { label: "Insatisfait(e)", value: 1, emoji: "😔" },
];

const FeedbackFormPage = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: parcours } = useQuery({
    queryKey: ["myParcours"],
    queryFn: getMyParcoursApi,
    retry: false,
  });

  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ["myFeedbackStatus"],
    queryFn: getMyFeedbackStatusApi,
  });

  const [poste, setPoste] = useState("");
  const [dateFinIntegration, setDateFinIntegration] = useState("");
  const [qualiteAccueil, setQualiteAccueil] = useState<number | null>(null);
  const [clarteInfos, setClarteInfos] = useState<number | null>(null);
  const [accompagnement, setAccompagnement] = useState<number | null>(null);
  const [adaptationTaches, setAdaptationTaches] = useState<number | null>(null);
  const [delaiSuffisant, setDelaiSuffisant] = useState<number | null>(null);
  const [difficultes, setDifficultes] = useState<boolean | null>(null);
  const [precisionDiff, setPrecisionDiff] = useState("");
  const [faciliteUtilisation, setFaciliteUtilisation] = useState<number | null>(null);
  const [fonctionnalites, setFonctionnalites] = useState<number | null>(null);
  const [problemsTech, setProblemsTech] = useState<boolean | null>(null);
  const [satisfactionGlobale, setSatisfactionGlobale] = useState<number | null>(null);
  const [recommande, setRecommande] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (parcours?.statut === "TERMINE" && parcours?.dateFin) {
      const d = new Date(parcours.dateFin);
      setDateFinIntegration(d.toISOString().split("T")[0]);
    }
  }, [parcours]);

  const submitMutation = useMutation({
    mutationFn: submitFeedbackApi,
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["myFeedbackStatus"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qualiteAccueil || !clarteInfos || !accompagnement || !adaptationTaches ||
      !delaiSuffisant || difficultes === null || !faciliteUtilisation || !fonctionnalites ||
      problemsTech === null || !satisfactionGlobale || recommande === null) {
      alert("Veuillez répondre à toutes les questions obligatoires.");
      return;
    }
    submitMutation.mutate({
      poste,
      dateFinIntegration,
      qualiteAccueil,
      clarteInformations: clarteInfos,
      accompagnementManager: accompagnement,
      adaptationTaches,
      delaiSuffisant,
      difficultesRencontrees: difficultes,
      precisionDifficulties: precisionDiff,
      faciliteUtilisation,
      fonctionnalitesAdaptees: fonctionnalites,
      problemTechniques: problemsTech,
      satisfactionGlobale,
      recommandeProcessus: recommande,
      suggestions,
    });
  };

  const isParcoursTermine = parcours?.statut === "TERMINE";

  if (loadingStatus) {
    return (
      <div className="flex min-h-screen" style={{ background: C.bg }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: C.cyan }} />
            <p className="text-sm" style={{ color: C.muted }}>Chargement...</p>
          </div>
        </main>
      </div>
    );
  }

  const alreadySubmitted = statusData?.submitted || submitted;

  if (alreadySubmitted) {
    return (
      <div className="flex min-h-screen" style={{ background: C.bg }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center p-8" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
              style={{ background: `${C.green}15` }}>
              ✅
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: C.text, fontFamily: "Sora" }}>
              Évaluation soumise !
            </h1>
            <p className="text-sm mb-6" style={{ color: C.muted }}>
              Merci pour votre retour. Votre évaluation a bien été enregistrée et contribuera à améliorer le processus d'intégration.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.navy})` }}
            >
              Retour au tableau de bord
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!isParcoursTermine) {
    return (
      <div className="flex min-h-screen" style={{ background: C.bg }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center p-8" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
              style={{ background: `${C.amber}15` }}>
              🔒
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: C.text, fontFamily: "Sora" }}>
              Parcours en cours
            </h1>
            <p className="text-sm mb-6" style={{ color: C.muted }}>
              Le formulaire d'évaluation sera disponible une fois votre parcours d'intégration terminé.
            </p>
            <button
              onClick={() => navigate("/parcours")}
              className="px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.navy})` }}
            >
              Voir mon parcours
            </button>
          </div>
        </main>
      </div>
    );
  }

  const steps = ["Accueil", "Parcours", "Plateforme", "Satisfaction"];
  const progressPct = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>
      <Sidebar role={role as any} />
      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>

        {/* Header */}
        <div className="sticky top-0 z-10 border-b"
          style={{ background: C.surface, borderColor: C.border }}>
          <div className="px-8 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-1.5 h-5 rounded-full"
                    style={{ background: `linear-gradient(to bottom, ${C.cyan}, ${C.navy})` }} />
                  <h1 className="text-xl font-bold" style={{ color: C.text, fontFamily: "Sora" }}>
                    Évaluation d'intégration
                  </h1>
                </div>
                <p className="text-xs ml-3.5" style={{ color: C.muted }}>
                  Votre retour nous aide à améliorer l'expérience d'onboarding
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium"
                style={{ color: C.muted }}>
                <span className="font-bold text-base" style={{ color: C.cyan, fontFamily: "Sora" }}>
                  {progressPct}%
                </span>
                complété
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: `linear-gradient(to right, ${C.cyan}, ${C.navy})`,
                }} />
            </div>
            {/* Steps */}
            <div className="flex gap-6 mt-3">
              {steps.map((s, i) => (
                <button key={i}
                  onClick={() => setCurrentStep(i)}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-all"
                  style={{ color: i <= currentStep ? C.cyan : C.muted }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{
                      background: i < currentStep ? C.green : i === currentStep ? C.cyan : C.border,
                      color: i <= currentStep ? "white" : C.muted,
                    }}>
                    {i < currentStep ? "✓" : i + 1}
                  </div>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-8 py-8" style={{ maxWidth: 720 }}>

            {/* Informations générales */}
            <div className="rounded-2xl p-6 mb-6"
              style={{ background: `linear-gradient(135deg, ${C.navy}08, ${C.cyan}06)`, border: `1px solid ${C.border}` }}>
              <h2 className="text-base font-bold mb-4" style={{ color: C.text, fontFamily: "Sora" }}>
                📋 Informations générales
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>
                    Poste occupé
                  </label>
                  <input
                    type="text"
                    value={poste}
                    onChange={(e) => setPoste(e.target.value)}
                    placeholder="Ex: Développeur Frontend"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: C.surface,
                      border: `1.5px solid ${C.border}`,
                      color: C.text,
                    }}
                    onFocus={(e) => (e.target.style.borderColor = C.cyan)}
                    onBlur={(e) => (e.target.style.borderColor = C.border)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>
                    Date de fin d'intégration
                  </label>
                  <input
                    type="date"
                    value={dateFinIntegration}
                    onChange={(e) => setDateFinIntegration(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: C.surface,
                      border: `1.5px solid ${C.border}`,
                      color: C.text,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Section 1: Accueil */}
            {currentStep === 0 && (
              <SectionCard number="1" title="Accueil et intégration" icon="👋" color={C.cyan}>
                <RadioGroup
                  question="1. Comment évaluez-vous la qualité de l'accueil reçu lors de votre arrivée ?"
                  options={ACCUEIL_OPTIONS}
                  value={qualiteAccueil}
                  onChange={setQualiteAccueil}
                  name="qualiteAccueil"
                />
                <RadioGroup
                  question="2. Les informations fournies au début de votre intégration étaient-elles claires ?"
                  options={OUI_NON_OPTIONS}
                  value={clarteInfos}
                  onChange={setClarteInfos}
                  name="clarteInfos"
                />
                <RadioGroup
                  question="3. Avez-vous été bien accompagné(e) par votre manager ?"
                  options={ACCOMPAGNEMENT_OPTIONS}
                  value={accompagnement}
                  onChange={setAccompagnement}
                  name="accompagnement"
                />
              </SectionCard>
            )}

            {/* Section 2: Parcours */}
            {currentStep === 1 && (
              <SectionCard number="2" title="Parcours d'intégration" icon="🗺️" color={C.violet}>
                <RadioGroup
                  question="1. Les tâches du parcours d'intégration étaient-elles adaptées à votre poste ?"
                  options={ADAPTATION_OPTIONS}
                  value={adaptationTaches}
                  onChange={setAdaptationTaches}
                  name="adaptationTaches"
                />
                <RadioGroup
                  question="2. Le délai accordé pour réaliser les tâches était-il suffisant ?"
                  options={DELAI_OPTIONS}
                  value={delaiSuffisant}
                  onChange={setDelaiSuffisant}
                  name="delaiSuffisant"
                />
                <div className="mb-6">
                  <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
                    3. Avez-vous rencontré des difficultés pendant votre intégration ?
                  </p>
                  <div className="flex gap-3 mb-3">
                    {[{ label: "Oui", val: true, emoji: "⚠️" }, { label: "Non", val: false, emoji: "✅" }].map((opt) => (
                      <label key={String(opt.val)}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all flex-1"
                        style={{
                          background: difficultes === opt.val ? `${C.violet}12` : C.surface,
                          border: `1.5px solid ${difficultes === opt.val ? C.violet : C.border}`,
                        }}>
                        <input type="radio" name="difficultes" checked={difficultes === opt.val}
                          onChange={() => setDifficultes(opt.val)} className="hidden" />
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: difficultes === opt.val ? C.violet : C.border,
                            background: difficultes === opt.val ? C.violet : "transparent",
                          }}>
                          {difficultes === opt.val && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm" style={{ color: difficultes === opt.val ? C.violet : C.text }}>
                          {opt.emoji} {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {difficultes === true && (
                    <div>
                      <label className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>
                        Si oui, précisez :
                      </label>
                      <textarea
                        value={precisionDiff}
                        onChange={(e) => setPrecisionDiff(e.target.value)}
                        placeholder="Décrivez les difficultés rencontrées..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                        style={{
                          background: C.surface,
                          border: `1.5px solid ${C.border}`,
                          color: C.text,
                        }}
                        onFocus={(e) => (e.target.style.borderColor = C.violet)}
                        onBlur={(e) => (e.target.style.borderColor = C.border)}
                      />
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Section 3: Plateforme */}
            {currentStep === 2 && (
              <SectionCard number="3" title="Plateforme d'onboarding" icon="💻" color={C.amber}>
                <RadioGroup
                  question="1. Comment évaluez-vous l'utilisation de l'application ?"
                  options={FACILITE_OPTIONS}
                  value={faciliteUtilisation}
                  onChange={setFaciliteUtilisation}
                  name="faciliteUtilisation"
                />
                <RadioGroup
                  question="2. Les fonctionnalités de la plateforme répondent-elles à vos besoins ?"
                  options={OUI_NON_OPTIONS}
                  value={fonctionnalites}
                  onChange={setFonctionnalites}
                  name="fonctionnalites"
                />
                <div className="mb-6">
                  <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
                    3. Avez-vous rencontré des problèmes techniques ?
                  </p>
                  <div className="flex gap-3">
                    {[{ label: "Oui", val: true, emoji: "⚠️" }, { label: "Non", val: false, emoji: "✅" }].map((opt) => (
                      <label key={String(opt.val)}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all flex-1"
                        style={{
                          background: problemsTech === opt.val ? `${C.amber}12` : C.surface,
                          border: `1.5px solid ${problemsTech === opt.val ? C.amber : C.border}`,
                        }}>
                        <input type="radio" name="problemsTech" checked={problemsTech === opt.val}
                          onChange={() => setProblemsTech(opt.val)} className="hidden" />
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: problemsTech === opt.val ? C.amber : C.border,
                            background: problemsTech === opt.val ? C.amber : "transparent",
                          }}>
                          {problemsTech === opt.val && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm" style={{ color: problemsTech === opt.val ? C.amber : C.text }}>
                          {opt.emoji} {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Section 4: Satisfaction globale */}
            {currentStep === 3 && (
              <SectionCard number="4" title="Satisfaction globale" icon="⭐" color={C.green}>
                <RadioGroup
                  question="1. Êtes-vous satisfait(e) de votre expérience d'intégration globale ?"
                  options={SATISFACTION_OPTIONS}
                  value={satisfactionGlobale}
                  onChange={setSatisfactionGlobale}
                  name="satisfactionGlobale"
                />
                <div className="mb-6">
                  <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
                    2. Recommanderiez-vous ce processus d'intégration à un nouveau salarié ?
                  </p>
                  <div className="flex gap-3">
                    {[{ label: "Oui", val: true, emoji: "👍" }, { label: "Non", val: false, emoji: "👎" }].map((opt) => (
                      <label key={String(opt.val)}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all flex-1"
                        style={{
                          background: recommande === opt.val ? `${C.green}12` : C.surface,
                          border: `1.5px solid ${recommande === opt.val ? C.green : C.border}`,
                        }}>
                        <input type="radio" name="recommande" checked={recommande === opt.val}
                          onChange={() => setRecommande(opt.val)} className="hidden" />
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: recommande === opt.val ? C.green : C.border,
                            background: recommande === opt.val ? C.green : "transparent",
                          }}>
                          {recommande === opt.val && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm" style={{ color: recommande === opt.val ? C.green : C.text }}>
                          {opt.emoji} {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-2" style={{ color: C.text }}>
                    3. Suggestions d'amélioration <span style={{ color: C.muted, fontWeight: 400 }}>(facultatif)</span>
                  </label>
                  <textarea
                    value={suggestions}
                    onChange={(e) => setSuggestions(e.target.value)}
                    placeholder="Partagez vos idées pour améliorer le processus d'intégration..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                    style={{
                      background: C.surface,
                      border: `1.5px solid ${C.border}`,
                      color: C.text,
                    }}
                    onFocus={(e) => (e.target.style.borderColor = C.green)}
                    onBlur={(e) => (e.target.style.borderColor = C.border)}
                  />
                </div>
              </SectionCard>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: currentStep === 0 ? C.border : C.surface,
                  border: `1.5px solid ${C.border}`,
                  color: currentStep === 0 ? C.muted : C.text,
                  opacity: currentStep === 0 ? 0.5 : 1,
                }}
              >
                ← Précédent
              </button>

              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.navy})` }}
                >
                  Suivant →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 flex items-center gap-2"
                  style={{
                    background: submitMutation.isPending
                      ? C.muted
                      : `linear-gradient(135deg, ${C.green}, #5a9e2a)`,
                  }}
                >
                  {submitMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    "✅ Soumettre mon évaluation"
                  )}
                </button>
              )}
            </div>

            {submitMutation.isError && (
              <div className="mt-4 px-4 py-3 rounded-xl text-sm"
                style={{ background: "#fff1f2", border: `1px solid ${C.rose}30`, color: C.rose }}>
                ⚠️ {(submitMutation.error as any)?.response?.data?.error || "Une erreur est survenue."}
              </div>
            )}

            <div className="h-8" />
          </div>
        </form>
      </main>
      <MobileNav role={role as any} />
    </div>
  );
};

export default FeedbackFormPage;
