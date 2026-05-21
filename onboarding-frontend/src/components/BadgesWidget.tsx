import { useState } from "react";
import type { Task, Parcours } from "../types/auth.ts";
import { useGamification, LEVELS } from "../hooks/useGamification.ts";
import type { Badge } from "../hooks/useGamification.ts";

// ── Rarity pill ───────────────────────────────────────────────────────────────
const rarityConfig = {
  common:    { label: "Facile",    color: "#64748B", bg: "#F1F5F9" },
  rare:      { label: "Rare",      color: "#2563EB", bg: "#EFF6FF" },
  epic:      { label: "Difficile",    color: "#7C3AED", bg: "#F5F3FF" },
  legendary: { label: "Légendaire",color: "#B45309", bg: "#FFFBEB" },
};

// ── Badge Card ────────────────────────────────────────────────────────────────
const BadgeCard = ({ badge, onClick }: { badge: Badge; onClick: () => void }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-all duration-200 cursor-pointer"
      style={{
        background: badge.unlocked ? badge.bg : "var(--bg)",
        border: `1.5px solid ${badge.unlocked ? badge.border : "var(--border)"}`,
        opacity: badge.unlocked ? 1 : 0.5,
        transform: hovered && badge.unlocked ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered && badge.unlocked
          ? `0 8px 24px ${badge.color}20`
          : "none",
        filter: badge.unlocked ? "none" : "grayscale(1)",
      }}
    >
      {/* Rarity dot */}
      {badge.unlocked && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{ background: rarityConfig[badge.rarity].color }}
        />
      )}

      {/* Icon */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background: badge.unlocked ? `${badge.color}18` : "var(--border)",
        }}
      >
        {badge.unlocked ? badge.icon : "🔒"}
      </div>

      {/* Name */}
      <p
        className="text-xs font-semibold leading-tight"
        style={{
          color: badge.unlocked ? badge.color : "var(--text-muted)",
          fontFamily: "Sora",
        }}
      >
        {badge.name}
      </p>
    </button>
  );
};

// ── Badge Detail Modal ────────────────────────────────────────────────────────
const BadgeModal = ({ badge, onClose }: { badge: Badge; onClose: () => void }) => {
  const rc = rarityConfig[badge.rarity];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,20,60,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center gap-4"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "var(--border)", color: "var(--text-muted)" }}
        >
          ✕
        </button>

        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg"
          style={{
            background: badge.unlocked ? badge.bg : "var(--bg)",
            border: `2px solid ${badge.unlocked ? badge.border : "var(--border)"}`,
            filter: badge.unlocked ? "none" : "grayscale(1) opacity(0.5)",
          }}
        >
          {badge.unlocked ? badge.icon : "🔒"}
        </div>

        {/* Rarity */}
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: rc.bg, color: rc.color }}
        >
          {rc.label}
        </span>

        {/* Title */}
        <h3
          className="text-xl font-bold text-center"
          style={{ color: badge.unlocked ? badge.color : "var(--text-muted)", fontFamily: "Sora" }}
        >
          {badge.name}
        </h3>

        <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
          {badge.description}
        </p>

        {badge.unlocked && badge.unlockedAt && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Débloqué le{" "}
            <strong style={{ color: "var(--text)" }}>
              {new Date(badge.unlockedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </strong>
          </p>
        )}

        {!badge.unlocked && (
          <div
            className="w-full px-4 py-3 rounded-xl text-sm text-center"
            style={{ background: "var(--bg)", color: "var(--text-muted)" }}
          >
            🎯 Complétez les conditions pour débloquer ce badge
          </div>
        )}
      </div>
    </div>
  );
};

// ── Composant d'explication du système XP ─────────────────────────────────────
const XPSystemInfo = ({ totalXP, levelColor }: { totalXP: number; levelColor: string }) => {
  const [expanded, setExpanded] = useState(false);

  const xpRules = [
    { action: "Tâche complétée", xp: 50, icon: "✅", color: "#10B981", description: "Chaque tâche terminée" },
    { action: "Avant l'échéance", xp: 25, icon: "⏰", color: "#F59E0B", bonus: true, description: "Bonus si terminé avant la date limite" },
    { action: "Quiz parfait", xp: 75, icon: "🧠", color: "#8B5CF6", bonus: true, description: "100% de bonnes réponses" },
    { action: "1er document", xp: 30, icon: "📄", color: "#3B82F6", unique: true, description: "Unique - Premier document soumis" },
    { action: "Parcours terminé", xp: 200, icon: "🏁", color: "#EF4444", description: "Parcours d'intégration complété" },
    { action: "Parcours en avance", xp: 100, icon: "🚀", color: "#06B6D4", bonus: true, description: "Bonus si parcours fini avant la date" },
  ];

  // Calculer le max XP possible pour un parcours parfait
  const maxXPPerTask = 50 + 25 + 75; // 150 XP par tâche (avec bonus)
  const maxTotalXP = (xpRules.reduce((acc, r) => acc + r.xp, 0)) + 50; // environ 480 XP max

  return (
    <div 
      className="mt-5 rounded-xl overflow-hidden transition-all"
      style={{ 
        background: "var(--bg)", 
        border: `1px solid var(--border)`,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left transition-colors hover:opacity-80"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span 
            className="text-sm font-semibold"
            style={{ color: "var(--text)", fontFamily: "Sora" }}
          >
            Comment gagner des XP (eXperience Points) ?
          </span>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: `${levelColor}20`, color: levelColor }}
          >
            {totalXP} XP gagnés
          </span>
        </div>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="p-3 pt-0 space-y-2">
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            Gagnez des points d'expérience (XP) à chaque action pour monter de niveau et débloquer des badges :
          </p>
          
          {xpRules.map((rule, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg transition-all hover:scale-[1.01]"
              style={{ 
                background: `${rule.color}08`,
                borderLeft: `3px solid ${rule.color}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{rule.icon}</span>
                <div>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {rule.action}
                  </span>
                  {rule.bonus && (
                    <span 
                      className="text-xs ml-2 px-1.5 py-0.5 rounded-full"
                      style={{ background: "#FEF3C7", color: "#D97706" }}
                    >
                      Bonus
                    </span>
                  )}
                  {rule.unique && (
                    <span 
                      className="text-xs ml-2 px-1.5 py-0.5 rounded-full"
                      style={{ background: "#DBEAFE", color: "#2563EB" }}
                    >
                      Unique
                    </span>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {rule.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span 
                  className="text-sm font-bold"
                  style={{ color: rule.color }}
                >
                  +{rule.xp}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>XP</span>
              </div>
            </div>
          ))}

          {/* Exemple de calcul */}
          <div 
            className="mt-3 p-3 rounded-lg"
            style={{ background: `${levelColor}10` }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: levelColor }}>
              📊 Exemple : Un quiz parfait avant l'échéance
            </p>
            <div className="flex items-center justify-between text-xs">
              <span>50 XP (tâche)</span>
              <span>+</span>
              <span>25 XP (avance)</span>
              <span>+</span>
              <span>75 XP (parfait)</span>
              <span>=</span>
              <span className="font-bold" style={{ color: levelColor }}>150 XP</span>
            </div>
          </div>

          {/* Message de motivation */}
          <div 
            className="p-2 rounded-lg text-center text-xs"
            style={{ background: `${levelColor}05` }}
          >
            💡 <strong style={{ color: levelColor }}>Astuce :</strong> Faites vos tâches{" "}
            <strong>avant l'échéance</strong> et réussissez les{" "}
            <strong>quiz à 100%</strong> pour maximiser vos gains !
          </div>
        </div>
      )}
    </div>
  );
};

// ── Composant des paliers de niveaux ──────────────────────────────────────────
const LevelRoad = ({ currentLevel, totalXP }: { currentLevel: typeof LEVELS[0]; totalXP: number }) => {
  return (
    <div className="mt-4 flex items-center gap-1">
      {LEVELS.map((l, i) => (
        <div key={l.rank} className="flex items-center gap-1 flex-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
            style={{
              background: totalXP >= l.minXP ? l.color : "var(--border)",
              color: totalXP >= l.minXP ? "#fff" : "var(--text-muted)",
              boxShadow: currentLevel.rank === l.rank ? `0 0 0 3px ${l.color}40` : "none",
            }}
            title={l.name}
          >
            {l.icon}
          </div>
          {i < LEVELS.length - 1 && (
            <div
              className="flex-1 h-1 rounded-full"
              style={{
                background: totalXP >= LEVELS[i + 1].minXP ? l.color : "var(--border)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// ── Main widget ───────────────────────────────────────────────────────────────
interface BadgesWidgetProps {
  tasks: Task[];
  parcours?: Parcours | null;
}

const BadgesWidget = ({ tasks, parcours }: BadgesWidgetProps) => {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showLocked, setShowLocked] = useState(false);

  const { totalXP, level, nextLevel, progressToNext, badges, unlockedBadges } =
    useGamification(tasks, parcours);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* ── Header: Level + XP bar ─────────────────────────────────────── */}
      <div
        className="relative p-6 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${level.color}18, ${level.color}08)` }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: level.color }}
        />
        <div
          className="absolute -bottom-6 right-16 w-20 h-20 rounded-full opacity-5"
          style={{ background: level.color }}
        />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Level icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
              style={{
                background: level.bg,
                border: `2px solid ${level.border}`,
                boxShadow: `0 4px 20px ${level.color}30`,
              }}
            >
              {level.icon}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-xl font-bold"
                  style={{ color: level.color, fontFamily: "Sora" }}
                >
                  {level.name}
                </h2>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: level.bg, color: level.color, border: `1px solid ${level.border}` }}
                >
                  Niv. {level.rank + 1}
                </span>
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                <span className="font-bold" style={{ color: "var(--text)" }}>
                  {totalXP} XP
                </span>{" "}
                {nextLevel ? `— encore ${nextLevel.minXP - totalXP} XP pour ${nextLevel.name}` : "— Niveau maximum atteint 🎉"}
              </p>
            </div>
          </div>

          {/* Unlocked count */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <span className="text-xl">🏅</span>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                {unlockedBadges.length}/{badges.length}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>badges</p>
            </div>
          </div>
        </div>

        {/* XP Progress bar */}
        {nextLevel && (
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
              <span>{level.name}</span>
              <span>{nextLevel.name}</span>
            </div>
            <div
              className="w-full h-3 rounded-full overflow-hidden"
              style={{ background: `${level.color}20` }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressToNext}%`,
                  background: `linear-gradient(90deg, ${level.color}, ${level.color}CC)`,
                  boxShadow: `0 0 8px ${level.color}60`,
                }}
              />
            </div>
            <p className="text-xs mt-1 text-right" style={{ color: "var(--text-muted)" }}>
              {progressToNext}% vers le prochain niveau
            </p>
          </div>
        )}

        {/* 📊 AJOUT : Explication du système XP */}
        <XPSystemInfo totalXP={totalXP} levelColor={level.color} />

        {/* Level road */}
        <LevelRoad currentLevel={level} totalXP={totalXP} />
      </div>

      {/* ── Badges grid ───────────────────────────────────────────────── */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-sm font-bold"
            style={{ color: "var(--text)", fontFamily: "Sora" }}
          >
            Mes badges
          </h3>
          <button
            onClick={() => setShowLocked((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg transition"
            style={{
              background: showLocked ? "var(--navy)" : "var(--bg)",
              color: showLocked ? "#fff" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {showLocked ? "Masquer verrouillés" : "Voir tous les badges"}
          </button>
        </div>

        {/* Unlocked badges */}
        {unlockedBadges.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: "var(--bg)", border: "1px dashed var(--border)" }}
          >
            <p className="text-3xl mb-2">🎮</p>
            <p className="text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Aucun badge encore
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Complétez des tâches pour débloquer vos premiers badges !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {unlockedBadges.map((b) => (
              <BadgeCard key={b.id} badge={b} onClick={() => setSelectedBadge(b)} />
            ))}
          </div>
        )}

        {/* Locked badges (optional) */}
        {showLocked && (
          <>
            <div className="flex items-center gap-3 mt-5 mb-3">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                À débloquer ({badges.filter((b) => !b.unlocked).length})
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {badges
                .filter((b) => !b.unlocked)
                .map((b) => (
                  <BadgeCard key={b.id} badge={b} onClick={() => setSelectedBadge(b)} />
                ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {selectedBadge && (
        <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      )}
    </div>
  );
};

export default BadgesWidget;