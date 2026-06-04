import { useState, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   ARIA — Assistant virtuel d'onboarding (version hors-ligne)
   Réponses prédéfinies, aucune clé API requise
   ═══════════════════════════════════════════════════════════════ */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QA {
  keywords: string[];
  question: string;
  answer: string;
  icon: string;
}

// ── Base de connaissances ──────────────────────────────────────
const KNOWLEDGE_BASE: QA[] = [
  {
    icon: "✅",
    question: "Comment valider une tâche ?",
    keywords: ["valider", "validation", "terminer", "finir", "completer", "compléter", "tâche", "tache", "done"],
    answer: "Pour valider une tâche :\n1. Allez dans **Mon Parcours**\n2. Cliquez sur la tâche concernée\n3. Effectuez l'action demandée (lire, déposer un document, etc.)\n4. Cliquez sur le bouton ✅ **Marquer comme terminé**\n\nPour les **quiz**, vous devez obtenir le score minimum requis. Pour les **documents**, vous devez télécharger le fichier demandé.",
  },
  {
    icon: "🎓",
    question: "Où trouver mes formations ?",
    keywords: ["formation", "formations", "video", "vidéo", "apprendre", "cours", "module", "trouver", "acceder", "accéder"],
    answer: "Vos formations sont dans **Mon Parcours** :\n1. Cliquez sur **Mon Parcours** dans le menu\n2. Repérez les tâches avec l'icône 🎓 (Formation)\n3. Cliquez sur la tâche pour accéder à la vidéo ou au document PDF\n4. Après avoir regardé/lu, cliquez sur ✅ pour valider\n\nLes formations sont organisées par phase : Intégration, Montée en compétence, puis Validation.",
  },
  {
    icon: "🧠",
    question: "Que faire si je suis bloqué sur un quiz ?",
    keywords: ["quiz", "bloqué", "bloque", "score", "echoue", "échoué", "rate", "raté", "tentative", "minimum", "echec", "échec"],
    answer: "Si vous êtes bloqué sur un quiz :\n- Vous avez **3 tentatives** maximum\n- Relisez la formation associée avant de réessayer\n- Le score minimum est indiqué sur le quiz (généralement 70-80%)\n- Après 3 échecs, **contactez votre manager** qui peut débloquer la situation\n\nConseil : prenez le temps de bien lire toutes les options avant de répondre !",
  },
  {
    icon: "📄",
    question: "Comment déposer un document ?",
    keywords: ["déposer", "deposer", "document", "fichier", "upload", "envoyer", "transmettre", "rh", "contrat", "piece"],
    answer: "Pour déposer un document :\n1. Allez dans **Mon Parcours**\n2. Trouvez la tâche 📎 **Document à déposer**\n3. Cliquez sur la tâche pour l'ouvrir\n4. Cliquez sur **Choisir un fichier**\n5. Sélectionnez votre document (PDF, image...)\n6. Cliquez sur **⬆ Déposer le document**\n\nFormats acceptés : PDF, JPG, PNG. Taille maximale recommandée : 5 Mo.",
  },
  {
    icon: "👔",
    question: "Comment contacter mon manager ?",
    keywords: ["manager", "contacter", "contact", "joindre", "rh", "responsable", "aide", "help", "question", "probleme", "problème"],
    answer: "Pour contacter votre manager ou les RH :\n- **Annuaire** : cliquez sur *Annuaire* dans le menu pour trouver les coordonnées\n- **Email** : visible sur la fiche de votre manager dans l'annuaire\n- **En personne** : n'hésitez pas à frapper à leur porte !\n\nPour les questions RH administratives, contactez directement l'équipe RH via l'annuaire.",
  },
  {
    icon: "📅",
    question: "Comment voir mes échéances ?",
    keywords: ["échéance", "echeance", "deadline", "planning", "date", "retard", "urgent", "j-", "délai", "delai", "calendrier"],
    answer: "Vos échéances sont visibles :\n- Sur le **Tableau de bord** : section *Alertes échéances* avec les tâches urgentes\n- Dans **Mon Parcours** : chaque tâche affiche un badge coloré :\n  - 🟢 Vert = à temps\n  - 🟡 Jaune = J-3 à J-6\n  - 🟠 Orange = J-1 ou J-2\n  - 🔴 Rouge clignotant = en retard\n\nPrivilégiez les tâches en rouge en priorité !",
  },
  {
    icon: "🗂",
    question: "Comment consulter un document RH ?",
    keywords: ["consulter", "lire", "voir", "document rh", "charte", "règlement", "reglement", "policy", "politique"],
    answer: "Pour consulter un document RH :\n1. Allez dans **Mon Parcours**\n2. Trouvez la tâche 📄 **Document RH**\n3. Cliquez dessus pour l'ouvrir\n4. Cliquez sur le bouton **Ouvrir** pour lire le document\n5. Après lecture, cliquez sur ✅ **Confirmer la lecture**\n\nLes documents s'ouvrent dans un nouvel onglet (PDF) ou s'affichent directement.",
  },
  {
    icon: "📊",
    question: "Comment voir ma progression ?",
    keywords: ["progression", "avancement", "progrès", "progres", "pourcentage", "statistique", "stat", "bilan"],
    answer: "Votre progression est visible sur :\n- **Tableau de bord** : barre de progression globale en haut\n- **Mon Parcours** : barre de progression par phase\n- Chaque phase affiche X/Y tâches complétées\n\nVotre score global est calculé automatiquement au fur et à mesure de vos validations.",
  },
  {
    icon: "🔒",
    question: "Pourquoi une tâche est verrouillée ?",
    keywords: ["verrouillé", "verrouille", "bloqué", "bloque", "cadenas", "lock", "inaccessible", "grisé", "grise"],
    answer: "Une tâche peut être verrouillée pour plusieurs raisons :\n- **Quiz** : une date d'ouverture est définie (ex: disponible après J+7)\n- **Ordre** : certaines tâches nécessitent d'en compléter d'autres avant\n- **Rôle** : la tâche est assignée à votre manager ou aux RH\n\nSi une tâche reste bloquée sans raison apparente, contactez votre manager.",
  },
  {
    icon: "👤",
    question: "Comment modifier mon profil ?",
    keywords: ["profil", "profile", "modifier", "changer", "photo", "information", "coordonnée", "coordonnee", "téléphone", "telephone"],
    answer: "Pour modifier votre profil :\n1. Cliquez sur **Mon Profil** dans le menu\n2. Cliquez sur **Modifier** ou l'icône crayon ✏️\n3. Mettez à jour vos informations\n4. Cliquez sur **Enregistrer**\n\nCertaines informations (email, rôle) ne peuvent être modifiées que par les RH.",
  },
  {
    icon: "🏢",
    question: "Qu'est-ce que le parcours d'onboarding ?",
    keywords: ["parcours", "onboarding", "intégration", "integration", "phase", "c'est quoi", "comment ça marche", "fonctionnement"],
    answer: "Votre parcours d'intégration dure **30 jours** et se compose de 4 phases :\n\n**Phase 1** — Pré-onboarding (avant J0) : documents à signer\n**Phase 2** — Intégration (J0-J7) : accueil, culture, outils\n**Phase 3** — Montée en compétence (J8-J21) : formations techniques\n**Phase 4** — Validation (J22-J30) : quiz final, entretien bilan\n\nChaque phase contient des tâches à accomplir pour valider votre intégration.",
  },
  {
    icon: "🤝",
    question: "Qu'est-ce qu'un entretien dans le parcours ?",
    keywords: ["entretien", "interview", "rencontre", "meeting", "réunion", "reunion", "rdv", "rendez-vous"],
    answer: "Les entretiens dans votre parcours sont des moments d'échange planifiés :\n- **Déjeuner d'équipe** (J+5) : rencontre informelle avec l'équipe\n- **Point mi-parcours** (J+21) : bilan avec votre manager\n- **Entretien final** (J+30) : validation officielle avec Manager + RH\n\nLa date est planifiée par votre manager. Vous serez informé(e) à l'avance.",
  },
  {
    icon: "🏆",
    question: "Comment fonctionne le classement ?",
    keywords: ["classement", "leaderboard", "points", "badge", "gamification", "score", "rang", "classé"],
    answer: "Le classement récompense votre progression :\n- Chaque tâche validée rapporte des points\n- Les quiz réussis avec un bon score donnent des bonus\n- Votre rang s'affiche dans la section **Classement**\n\nC'est un système de motivation — concentrez-vous d'abord sur la qualité de votre apprentissage !",
  },
  {
    icon: "👥",
    question: "Comment connaître mon équipe ?",
    keywords: ["equipe", "équipe", "collegues", "collègues", "collaborateurs", "membres", "qui sont", "team", "coequipiers"],
    answer: "Pour découvrir votre équipe :\n1. Cliquez sur **Mon Équipe** dans le menu latéral\n2. Vous verrez tous les membres avec leur photo, poste et coordonnées\n3. Cliquez sur un collaborateur pour voir son profil détaillé\n\nVous pouvez aussi consulter l'**Annuaire** pour trouver un collègue.\n\n💡 Le **déjeuner d'équipe** prévu dans votre parcours (J+5) est aussi une excellente occasion de rencontrer vos collègues en personne !",
  },
  {
    icon: "🧑‍💼",
    question: "Comment connaître mon manager ?",
    keywords: ["manager", "responsable", "superieur", "chef", "encadrant", "qui est mon manager", "mon responsable"],
    answer: "Votre manager est visible à plusieurs endroits :\n\n1. **Mon Profil** → section *Informations professionnelles* : le nom de votre manager est affiché\n2. **Mon Équipe** : votre manager apparaît avec un badge spécial\n3. **Annuaire** : recherchez son nom pour ses coordonnées complètes\n\nVotre manager est votre premier point de contact pour les questions sur vos missions, les blocages dans votre parcours, et pour planifier les entretiens.",
  },
  {
    icon: "⏱️",
    question: "Combien de jours pour terminer mon parcours ?",
    keywords: ["jours", "duree", "durée", "terminer parcours", "finir parcours", "temps restant", "combien", "reste", "délai", "delai", "quand terminer"],
    answer: "Le nombre de jours restants est affiché sur votre **Tableau de bord** et dans **Mon Profil** sous forme de compteur coloré :\n\n- 🟢 Vert : vous avez le temps\n- 🟡 Jaune : moins de 6 jours\n- 🟠 Orange : 1-2 jours restants\n- 🔴 Rouge : délai dépassé !\n\nLe parcours standard dure **30 jours** à partir de votre date d'arrivée. Si vous avez des tâches en retard, contactez votre manager — il peut ajuster les délais si nécessaire.",
  },
  {
    icon: "📋",
    question: "Quelles sont les phases de mon parcours ?",
    keywords: ["phases", "phase", "etapes", "étapes", "organisation parcours", "structure", "comment organisé"],
    answer: "Votre parcours est divisé en **4 phases** :\n\n**📌 Phase 1 — Pré-onboarding** (avant J0)\nDocuments administratifs à signer avant votre arrivée.\n\n**🤝 Phase 2 — Intégration** (J0 → J7)\nAccueil, découverte de l'entreprise, outils, équipe.\n\n**📚 Phase 3 — Montée en compétence** (J8 → J21)\nFormations techniques et métier, quiz de validation.\n\n**✅ Phase 4 — Validation** (J22 → J30)\nQuiz final, entretien bilan avec manager et RH.",
  },
  {
    icon: "🎯",
    question: "Que se passe-t-il si je termine mon parcours en avance ?",
    keywords: ["avance", "tot", "tôt", "avant terme", "finir tot", "avant la fin", "anticiper"],
    answer: "Bravo si vous avancez vite ! Si vous terminez toutes vos tâches avant la date limite :\n\n- Votre **progression affiche 100%** sur le tableau de bord\n- Vos **badges et votre score** sont calculés automatiquement\n\n- L'**entretien de validation final** peut être planifié plus tôt\n\nPour les entretiens (J+21, J+30), discutez directement avec votre manager pour les avancer.",
  },
  {
    icon: "📌",
    question: "Quelle est ma prochaine tâche prioritaire ?",
    keywords: ["prochaine", "priorité", "prioritaire", "suivante", "quoi faire", "par où commencer", "première", "premiere", "commencer"],
    answer: "Pour trouver votre prochaine tâche prioritaire :\n\n1. Allez dans **Mon Parcours**\n2. Les tâches sont classées par urgence :\n   - 🔴 **En retard** → à faire immédiatement\n   - 🟠 **Urgent** → J-1 ou J-2\n   - 🟡 **Bientôt** → J-3 à J-6\n3. Votre **Tableau de bord** affiche aussi la section *Alertes échéances*\n\nCommencez toujours par les tâches rouges !",
  },
  {
    icon: "🏢",
    question: "Comment connaître mon poste ?",
    keywords: ["poste", "service", "direction", "titre", "intitule", "intitulé", "fonction"],
    answer: "Vos informations de poste sont visibles dans **Mon Profil** :\n\n- **Intitulé du poste** : affiché dans votre fiche profil\n- **Date de prise de poste** : visible dans votre profil\n- **Photo de votre poste** : vous pouvez en ajouter une\n\nSi ces informations sont incorrectes, contactez votre **manager** ou les **RH**.",
  },
];

const FALLBACK_RESPONSES = [
  "Je ne suis pas sûre de comprendre votre question. Pouvez-vous la reformuler ? Vous pouvez aussi consulter les **questions fréquentes** ci-dessous ou contacter directement votre manager via l'annuaire.",
  "Cette question dépasse mes connaissances actuelles. Je vous recommande de consulter votre **manager** ou l'équipe **RH** via l'annuaire de l'application.",
  "Je n'ai pas de réponse précise à cette question. N'hésitez pas à contacter votre manager — ils sont là pour vous aider dans votre intégration !",
];

const QUICK_QUESTIONS = [
  ...KNOWLEDGE_BASE.slice(0, 4),           // valider tâche, formation, quiz, document
  KNOWLEDGE_BASE.find(q => q.icon === "👥")!,  // mon équipe
  KNOWLEDGE_BASE.find(q => q.icon === "🧑‍💼")!, // mon manager
  KNOWLEDGE_BASE.find(q => q.icon === "⏱️")!,  // jours restants
  KNOWLEDGE_BASE.find(q => q.icon === "📌")!,  // prochaine tâche
].filter(Boolean);

// ── Moteur de recherche par mots-clés ─────────────────────────
function findAnswer(userInput: string): string {
  const input = userInput.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let bestMatch: QA | null = null;
  let bestScore = 0;

  for (const qa of KNOWLEDGE_BASE) {
    let score = 0;
    for (const keyword of qa.keywords) {
      const kw = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (input.includes(kw)) {
        score += kw.length > 4 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = qa;
    }
  }

  if (bestMatch && bestScore >= 1) {
    return bestMatch.answer;
  }

  // Salutations
  if (/^(bonjour|salut|hello|bonsoir|coucou|hi\b|hey)/.test(input)) {
    return "Bonjour ! Comment puis-je vous aider dans votre parcours d'intégration ? 😊\nUtilisez les questions rapides ci-dessous ou posez directement votre question.";
  }

  // Merci
  if (/merci|thank|super|parfait|nickel|cool/.test(input)) {
    return "De rien, c'est avec plaisir ! 😊 N'hésitez pas si vous avez d'autres questions sur votre parcours.";
  }

  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

// ── Composant principal ────────────────────────────────────────
export default function OnboardingAssistant() {
  const [isOpen, setIsOpen]         = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [isTyping, setIsTyping]     = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [showQuick, setShowQuick]   = useState(true);
  const messagesEndRef              = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      if (!hasGreeted) {
        setHasGreeted(true);
        addMessage("assistant",
          "Bonjour ! Je suis **ARIA**, votre assistante d'intégration Square IT 👋\n\nJe suis disponible 24h/24 pour répondre à vos questions sur votre parcours d'onboarding. Comment puis-je vous aider ?"
        );
      }
    }
  }, [isOpen, hasGreeted]);

  const addMessage = (role: "user" | "assistant", content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      role, content,
      timestamp: new Date(),
    }]);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setShowQuick(false);
    setInput("");
    addMessage("user", trimmed);
    setIsTyping(true);

    // Simule un délai de réflexion naturel (300-900ms)
    const delay = 300 + Math.random() * 600;
    setTimeout(() => {
      const answer = findAnswer(trimmed);
      setIsTyping(false);
      addMessage("assistant", answer);
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatMessage = (content: string) =>
    content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const panelW = isExpanded ? "400px" : "340px";
  const panelH = isExpanded ? "580px" : "480px";

  return (
    <>
      {/* ── Bulle flottante ── */}
      <div className="fixed z-50" style={{ bottom: "24px", right: "24px" }}>

        {/* Tooltip */}
        {!isOpen && (
          <div style={{
            position: "absolute", bottom: "68px", right: "0",
            background: "linear-gradient(135deg, #0D1B3E, #1A2B6B)",
            color: "white", padding: "7px 12px",
            borderRadius: "12px 12px 4px 12px",
            fontSize: "12px", fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
            border: "1px solid rgba(0,174,239,0.25)",
            fontFamily: "Sora, sans-serif",
            animation: "ariaTooltip 0.3s ease",
            pointerEvents: "none",
          }}>
            Besoin d'aide ? 💬
            <div style={{
              position: "absolute", bottom: "-5px", right: "14px",
              width: 0, height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #1A2B6B",
            }} />
          </div>
        )}

        {/* Bouton */}
        <button
          onClick={() => setIsOpen(o => !o)}
          style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: isOpen
              ? "linear-gradient(135deg, #dc2626, #b91c1c)"
              : "linear-gradient(135deg, #00AEEF, #1A2B6B)",
            border: "none", cursor: "pointer",
            boxShadow: isOpen
              ? "0 4px 14px rgba(220,38,38,0.4)"
              : "0 4px 18px rgba(0,174,239,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            position: "relative",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)")}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
        >
          {!isOpen && (
            <>
              <div style={{ position: "absolute", inset: "-5px", borderRadius: "50%", border: "2px solid rgba(0,174,239,0.35)", animation: "ariaRing 2.5s ease-in-out infinite" }} />
              <div style={{ position: "absolute", inset: "-10px", borderRadius: "50%", border: "1px solid rgba(0,174,239,0.15)", animation: "ariaRing 2.5s ease-in-out infinite 0.5s" }} />
            </>
          )}
          {isOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <span style={{ fontSize: "22px", lineHeight: 1 }}>🤖</span>
          )}
        </button>
      </div>

      {/* ── Panneau chat ── */}
      {isOpen && (
        <div style={{
          position: "fixed", bottom: "88px", right: "24px",
          width: panelW, height: panelH, zIndex: 49,
          display: "flex", flexDirection: "column",
          borderRadius: "18px", overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,174,239,0.12)",
          animation: "ariaOpen 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          background: "var(--surface, #ffffff)",
          transition: "width 0.3s ease, height 0.3s ease",
        }}>

          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #0D1B3E 0%, #1A2B6B 100%)",
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: "10px",
            flexShrink: 0, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: "-15px", right: "-15px", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(0,174,239,0.1)" }} />

            {/* Avatar */}
            <div style={{
              width: "38px", height: "38px", borderRadius: "10px",
              background: "rgba(0,174,239,0.15)",
              border: "1.5px solid rgba(0,174,239,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px", flexShrink: 0, position: "relative",
            }}>
              🤖
              <div style={{
                position: "absolute", bottom: "-2px", right: "-2px",
                width: "9px", height: "9px", background: "#8DC63F",
                borderRadius: "50%", border: "2px solid #0D1B3E",
                animation: "ariaOnline 2s ease-in-out infinite",
              }} />
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ color: "white", fontWeight: 700, fontSize: "13px", fontFamily: "Sora, sans-serif", margin: 0, lineHeight: 1 }}>ARIA</p>
              <p style={{ color: "rgba(168,216,234,0.65)", fontSize: "11px", margin: "3px 0 0" }}>Assistante · En ligne</p>
            </div>

            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={() => setIsExpanded(e => !e)}
                style={{ width: "26px", height: "26px", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "7px", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title={isExpanded ? "Réduire" : "Agrandir"}>
                {isExpanded
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                }
              </button>
              <button
                onClick={() => { setMessages([]); setHasGreeted(false); setShowQuick(true); }}
                style={{ width: "26px", height: "26px", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "7px", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Nouvelle conversation">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg, #f8fafc)" }}>

            {messages.map(msg => (
              <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-end", gap: "7px", animation: "ariaMsg 0.2s ease" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "linear-gradient(135deg, #0D1B3E, #1A2B6B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>🤖</div>
                )}
                <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "2px" }}>
                  <div
                    style={{
                      padding: "9px 13px",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: msg.role === "user" ? "linear-gradient(135deg, #00AEEF, #1A2B6B)" : "var(--surface, white)",
                      color: msg.role === "user" ? "white" : "var(--text, #1e293b)",
                      fontSize: "12.5px", lineHeight: "1.55",
                      boxShadow: msg.role === "user" ? "0 2px 10px rgba(0,174,239,0.25)" : "0 1px 3px rgba(0,0,0,0.07)",
                      border: msg.role === "assistant" ? "1px solid var(--border, #e2e8f0)" : "none",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                  <span style={{ fontSize: "10px", color: "var(--text-muted, #94a3b8)", padding: "0 3px" }}>{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "7px", animation: "ariaMsg 0.2s ease" }}>
                <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "linear-gradient(135deg, #0D1B3E, #1A2B6B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>🤖</div>
                <div style={{ padding: "11px 15px", borderRadius: "14px 14px 14px 4px", background: "var(--surface, white)", border: "1px solid var(--border, #e2e8f0)", display: "flex", gap: "4px", alignItems: "center" }}>
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00AEEF", animation: `ariaBounce 0.7s ease-in-out infinite ${d}s` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Questions rapides */}
            {showQuick && messages.length <= 1 && !isTyping && (
              <div style={{ marginTop: "4px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Questions fréquentes
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {QUICK_QUESTIONS.map(q => (
                    <button key={q.question} onClick={() => sendMessage(q.question)}
                      style={{
                        display: "flex", alignItems: "center", gap: "9px",
                        padding: "8px 11px", borderRadius: "9px",
                        background: "var(--surface, white)",
                        border: "1px solid var(--border, #e2e8f0)",
                        cursor: "pointer", textAlign: "left",
                        fontSize: "12px", color: "var(--text, #1e293b)",
                        fontFamily: "DM Sans, sans-serif", fontWeight: 500,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "rgba(0,174,239,0.4)"; b.style.background = "rgba(0,174,239,0.04)"; b.style.transform = "translateX(3px)"; }}
                      onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--border, #e2e8f0)"; b.style.background = "var(--surface, white)"; b.style.transform = "translateX(0)"; }}
                    >
                      <span style={{ fontSize: "14px", flexShrink: 0 }}>{q.icon}</span>
                      <span style={{ flex: 1 }}>{q.question}</span>
                      <svg style={{ opacity: 0.3, flexShrink: 0 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border, #e2e8f0)", background: "var(--surface, white)", display: "flex", gap: "7px", alignItems: "center", flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              disabled={isTyping}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: "9px",
                border: "1.5px solid var(--border, #e2e8f0)",
                background: "var(--bg, #f8fafc)",
                color: "var(--text, #1e293b)",
                fontSize: "12.5px", fontFamily: "DM Sans, sans-serif", outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,174,239,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,174,239,0.1)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border, #e2e8f0)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              style={{
                width: "34px", height: "34px", borderRadius: "9px",
                background: input.trim() && !isTyping ? "linear-gradient(135deg, #00AEEF, #1A2B6B)" : "var(--border, #e2e8f0)",
                border: "none", cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease", flexShrink: 0,
                boxShadow: input.trim() && !isTyping ? "0 2px 8px rgba(0,174,239,0.3)" : "none",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() && !isTyping ? "white" : "#94a3b8"} strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          {/* Branding */}
          <div style={{ padding: "5px", background: "var(--surface, white)", borderTop: "1px solid var(--border, #e2e8f0)", textAlign: "center" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted, #94a3b8)" }}>Propulsé par </span>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#00AEEF", fontFamily: "Sora, sans-serif" }}>SQUARE IT</span>
            <span style={{ fontSize: "10px", color: "var(--text-muted, #94a3b8)" }}> · Assistant virtuel</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ariaOpen    { from{opacity:0;transform:scale(0.85) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes ariaMsg     { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ariaRing    { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:0;transform:scale(1.35)} }
        @keyframes ariaOnline  { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes ariaBounce  { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes ariaTooltip { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </>
  );
}