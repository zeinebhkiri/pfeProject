import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyTeamApi, getTeamParcoursApi, getAllAffectationsApi, getPositionsApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";
import { computeXP, getLevelForXP, LEVELS } from "../hooks/useGamification";
import type { Task, Parcours, User, Affectation, Position } from "../types/auth";

// ── Helpers ────────────────────────────────────────────────────────────────────

const getInitials = (prenom: string, nom: string) =>
  `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase();

const MEDAL = ["🥇", "🥈", "🥉"];

const BADGE_COUNT_THRESHOLDS = [
  { min: 7, label: "Collectionneur", icon: "🎖️", color: "#B45309" },
  { min: 4, label: "Actif",          icon: "⚡",  color: "#7C3AED" },
  { min: 1, label: "Débutant",       icon: "🌱",  color: "#059669" },
];

const computeBadgeCount = (tasks: Task[], parcours?: Parcours | null): number => {
  let count = 0;
  const doneTasks = tasks.filter((t) => t.statut === "TERMINE");
  if (doneTasks.length >= 1) count++;
  const hasDoc = doneTasks.find((t) => t.taskType === "FORMATION" || t.taskType === "SIMPLE");
  if (hasDoc) count++;
  const perfectQuiz = doneTasks.find((t) => {
    if (t.taskType !== "QUIZ" || !t.config?.questions) return false;
    const max = t.config.questions.reduce((s: number, q: any) => s + q.points, 0);
    return max > 0 && t.scoreObtenu === max;
  });
  if (perfectQuiz) count++;
  const earlyTask = doneTasks.find((t) => t.echeance && t.dateCompletion && new Date(t.dateCompletion) < new Date(t.echeance));
  if (earlyTask) count++;
  if ((parcours?.progression ?? 0) >= 50) count++;
  const passedQuizzes = doneTasks.filter((t) => t.taskType === "QUIZ" && (t.scoreObtenu ?? 0) >= (t.config?.scoreMinimum ?? 0));
  if (passedQuizzes.length >= 3) count++;
  if (earlyTask && parcours?.statut === "TERMINE") count++;
  if (parcours?.statut === "TERMINE") count++;
  const mandatory = tasks.filter((t) => t.obligatoire);
  if (mandatory.length > 0 && mandatory.every((t) => t.statut === "TERMINE")) count++;
  return count;
};

// ── Leaderboard row entry ──────────────────────────────────────────────────────
interface LeaderEntry {
  userId: string;
  displayName: string;  // anonymized: "Collaborateur #N" OR first name only
  initials: string;
  position?: string;
  xp: number;
  level: ReturnType<typeof getLevelForXP>;
  progression: number;
  badgeCount: number;
  tasksCompleted: number;
  totalTasks: number;
  isMe?: boolean;
}

// ── XP mini bar ───────────────────────────────────────────────────────────────
const XPBar = ({ xp, color }: { xp: number; color: string }) => {
  const maxXP = LEVELS[LEVELS.length - 1].minXP + 500;
  const pct = Math.min(100, Math.round((xp / maxXP) * 100));
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
const LeaderboardPage = () => {
  const [anonymized, setAnonymized] = useState(true);
  const [sortBy, setSortBy] = useState<"xp" | "badges" | "progress">("xp");

  const { data: team = [], isLoading: loadingTeam } = useQuery<User[]>({
    queryKey: ["myTeam"],
    queryFn: getMyTeamApi,
  });

  const { data: teamParcours = [], isLoading: loadingParcours } = useQuery<any[]>({
    queryKey: ["teamParcours"],
    queryFn: getTeamParcoursApi,
  });

  const { data: affectations = [] } = useQuery<Affectation[]>({
    queryKey: ["allAffectations"],
    queryFn: getAllAffectationsApi,
  });

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: getPositionsApi,
  });

  const getPosition = (userId: string) => {
    const aff = affectations.find((a) => a.userId === userId);
    return aff ? positions.find((p) => p.id === aff.positionId) : undefined;
  };

  // teamParcours: array of { parcours: Parcours; tasks: Task[]; salarie: User }
  const entries: LeaderEntry[] = useMemo(() => {
    const result: LeaderEntry[] = team
      .filter((u) => u.statutCompte === "VALIDE" || u.statutCompte === "ACCEPTE")
      .map((user, idx) => {
        // Find this user's parcours data
        const parcoursData = teamParcours.find(
          (p: any) => p.salarie?.id === user.id || p.parcours?.userId === user.id
        );
        const tasks: Task[] = parcoursData?.tasks ?? [];
        const parcours: Parcours | null = parcoursData?.parcours ?? null;

        const xp = computeXP(tasks, parcours);
        const level = getLevelForXP(xp);
        const doneTasks = tasks.filter((t) => t.statut === "TERMINE").length;
        const badgeCount = computeBadgeCount(tasks, parcours);
        const progression = parcours?.progression ?? 0;
        const position = getPosition(user.id);

        return {
          userId: user.id,
          displayName: anonymized
            ? `Collaborateur #${idx + 1}`
            : `${user.prenom} ${user.nom}`,
          initials: getInitials(user.prenom, user.nom),
          position: position?.titre,
          xp,
          level,
          progression,
          badgeCount,
          tasksCompleted: doneTasks,
          totalTasks: tasks.length,
        };
      });

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === "xp") return b.xp - a.xp;
      if (sortBy === "badges") return b.badgeCount - a.badgeCount;
      return b.progression - a.progression;
    });
  }, [team, teamParcours, affectations, positions, anonymized, sortBy]);

  const isLoading = loadingTeam || loadingParcours;

  // Team stats
  const teamStats = useMemo(() => {
    if (entries.length === 0) return null;
    const totalXP = entries.reduce((s, e) => s + e.xp, 0);
    const avgXP = Math.round(totalXP / entries.length);
    const avgProg = Math.round(entries.reduce((s, e) => s + e.progression, 0) / entries.length);
    const topLevel = [...entries].sort((a, b) => b.level.rank - a.level.rank)[0];
    return { totalXP, avgXP, avgProg, topLevel };
  }, [entries]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="MANAGER" />

      <main className="flex-1 flex flex-col" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-8 pt-8 pb-0">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--text)", fontFamily: "Sora" }}
              >
                🏆 Classement de l'équipe
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Progression XP, niveaux et badges de vos collaborateurs
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Anonymize toggle */}
              <button
                onClick={() => setAnonymized((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
                style={{
                  background: anonymized ? "var(--navy)" : "var(--surface)",
                  color: anonymized ? "#fff" : "var(--text-muted)",
                  border: "1.5px solid var(--border)",
                }}
              >
                {anonymized ? "🙈 Anonymisé" : "👁️ Noms visibles"}
              </button>

              {/* Sort */}
              <div
                className="flex items-center p-1 rounded-xl gap-1"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {(["xp", "badges", "progress"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    style={{
                      background: sortBy === key ? "var(--navy)" : "transparent",
                      color: sortBy === key ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {key === "xp" ? "⚡ XP" : key === "badges" ? "🏅 Badges" : "📈 Progression"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Team stat cards */}
          {teamStats && (
            <div className="mt-6 grid grid-cols-4 gap-4">
              {[
                { label: "Membres actifs",       value: entries.length,           icon: "👥", color: "#00AEEF" },
                { label: "XP moyen / membre",    value: `${teamStats.avgXP} XP`,  icon: "⚡", color: "#7C3AED" },
                { label: "Progression moyenne",  value: `${teamStats.avgProg}%`,  icon: "📈", color: "#059669" },
                {
                  label: "Meilleur niveau",
                  value: teamStats.topLevel ? `${teamStats.topLevel.level.icon} ${teamStats.topLevel.level.name}` : "—",
                  icon: "🏆",
                  color: "#B45309",
                },
              ].map(({ label, value, icon, color }) => (
                <div
                  key={label}
                  className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: `${color}15` }}
                  >
                    {icon}
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color, fontFamily: "Sora" }}>
                      {value}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Leaderboard table ───────────────────────────────────────────── */}
        <div className="px-8 py-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Table header */}
            <div
              className="grid items-center px-6 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                gridTemplateColumns: "3rem 1fr 10rem 8rem 8rem 8rem",
              }}
            >
              <span>#</span>
              <span>Collaborateur</span>
              <span>Niveau</span>
              <span className="text-center">XP</span>
              <span className="text-center">Badges</span>
              <span className="text-center">Progression</span>
            </div>

            {/* Rows */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--cyan)", borderTopColor: "transparent" }}
                />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <p className="text-4xl">🏜️</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Aucun collaborateur dans l'équipe.
                </p>
              </div>
            ) : (
              entries.map((entry, idx) => {
                const rankLabel = idx < 3 ? MEDAL[idx] : `${idx + 1}`;
                const badgeTier = BADGE_COUNT_THRESHOLDS.find((t) => entry.badgeCount >= t.min);
                const isTop3 = idx < 3;

                return (
                  <div
                    key={entry.userId}
                    className="grid items-center px-6 py-4 transition-colors"
                    style={{
                      gridTemplateColumns: "3rem 1fr 10rem 8rem 8rem 8rem",
                      borderBottom: "1px solid var(--border)",
                      background: isTop3
                        ? `${entry.level.color}08`
                        : entry.isMe
                        ? "rgba(0,174,239,0.05)"
                        : "transparent",
                    }}
                  >
                    {/* Rank */}
                    <div
                      className="text-lg font-bold text-center"
                      style={{ fontFamily: "Sora", color: idx < 3 ? entry.level.color : "var(--text-muted)" }}
                    >
                      {rankLabel}
                    </div>

                    {/* Name + position */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${entry.level.color}, ${entry.level.color}99)` }}
                      >
                        {anonymized ? "?" : entry.initials}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--text)", fontFamily: isTop3 ? "Sora" : undefined }}
                        >
                          {entry.displayName}
                        </p>
                        {entry.position && (
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {entry.position}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Level */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                        style={{ background: entry.level.bg }}
                      >
                        {entry.level.icon}
                      </div>
                      <div>
                        <p
                          className="text-xs font-semibold"
                          style={{ color: entry.level.color, fontFamily: "Sora" }}
                        >
                          {entry.level.name}
                        </p>
                        <XPBar xp={entry.xp} color={entry.level.color} />
                      </div>
                    </div>

                    {/* XP */}
                    <div className="text-center">
                      <p
                        className="text-sm font-bold"
                        style={{ color: entry.level.color, fontFamily: "Sora" }}
                      >
                        {entry.xp}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>XP</p>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-base">🏅</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: badgeTier?.color ?? "var(--text-muted)", fontFamily: "Sora" }}
                        >
                          {entry.badgeCount}
                        </span>
                      </div>
                      {badgeTier && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${badgeTier.color}15`, color: badgeTier.color }}
                        >
                          {badgeTier.icon} {badgeTier.label}
                        </span>
                      )}
                    </div>

                    {/* Progression */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative w-12 h-12">
                        <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                          <circle
                            cx="18" cy="18" r="15"
                            fill="none" stroke="var(--border)" strokeWidth="3"
                          />
                          <circle
                            cx="18" cy="18" r="15"
                            fill="none"
                            stroke={entry.level.color}
                            strokeWidth="3"
                            strokeDasharray={`${(entry.progression / 100) * 94.25} 94.25`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span
                          className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                          style={{ color: entry.level.color, fontFamily: "Sora" }}
                        >
                          {entry.progression}%
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {entry.tasksCompleted}/{entry.totalTasks} tâches
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Legend */}
          <div
            className="mt-4 p-4 rounded-xl flex flex-wrap items-center gap-4 text-xs"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <span className="font-semibold" style={{ color: "var(--text)" }}>Niveaux :</span>
            {LEVELS.map((l) => (
              <span key={l.rank} className="flex items-center gap-1.5">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
                  style={{ background: l.bg }}
                >
                  {l.icon}
                </span>
                <span style={{ color: l.color }}>{l.name}</span>
                <span>({l.minXP}+ XP)</span>
              </span>
            ))}
            <span className="ml-auto text-xs italic">
              {anonymized ? "Mode anonyme activé — les noms sont masqués" : "Les noms sont visibles"}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LeaderboardPage;