import { useMemo } from "react";
import type { Task, Parcours } from "../types/auth";

// ── XP Constants ──────────────────────────────────────────────────────────────
export const XP = {
  TASK_COMPLETE: 50,          // any task completed
  TASK_BEFORE_DEADLINE: 25,   // bonus if finished before echeance
  QUIZ_PERFECT: 75,           // bonus for 100% quiz score
  DOCUMENT_SUBMITTED: 30,     // first document submitted
  PARCOURS_FINISHED: 200,     // whole parcours done
  PARCOURS_EARLY: 100,        // parcours finished before dateFin
} as const;

// ── Levels ────────────────────────────────────────────────────────────────────
export interface Level {
  name: string;
  minXP: number;
  maxXP: number;
  color: string;
  bg: string;
  border: string;
  icon: string;
  rank: number;
}

export const LEVELS: Level[] = [
  { rank: 0, name: "Recrue",    minXP: 0,    maxXP: 299,  color: "#64748B", bg: "#F1F5F9", border: "#E2E8F0", icon: "🌱" },
  { rank: 1, name: "Junior",    minXP: 300,  maxXP: 699,  color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", icon: "⚡" },
  { rank: 2, name: "Intégré",   minXP: 700,  maxXP: 1299, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", icon: "🔥" },
  { rank: 3, name: "Confirmé",  minXP: 1300, maxXP: Infinity, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", icon: "🏆" },
];

export const getLevelForXP = (xp: number): Level =>
  [...LEVELS].reverse().find((l) => xp >= l.minXP) ?? LEVELS[0];

// ── Badge definitions ─────────────────────────────────────────────────────────
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlocked: boolean;
  unlockedAt?: string;   // ISO date string
  xpReward: number;
}

type BadgeDef = Omit<Badge, "unlocked" | "unlockedAt">;

const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first_task",
    name: "Premier pas",
    description: "Compléter votre première tâche d'onboarding",
    icon: "👣",
    color: "#0369A1",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    rarity: "common",
    xpReward: 0,
  },
  
  {
    id: "quiz_perfect",
    name: "Génie du quiz",
    description: "Obtenir 100% à un quiz",
    icon: "🧠",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    rarity: "rare",
    xpReward: 0,
  },
  {
    id: "speed_demon",
    name: "Flash",
    description: "Compléter une tâche avant son échéance",
    icon: "⚡",
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
    rarity: "rare",
    xpReward: 0,
  },
  {
    id: "half_way",
    name: "À mi-chemin",
    description: "Atteindre 50% du parcours d'intégration",
    icon: "🎯",
    color: "#0891B2",
    bg: "#ECFEFF",
    border: "#A5F3FC",
    rarity: "common",
    xpReward: 0,
  },
  {
    id: "quiz_master",
    name: "Quiz Master",
    description: "Réussir 3 quiz de suite",
    icon: "🎓",
    color: "#4F46E5",
    bg: "#EEF2FF",
    border: "#C7D2FE",
    rarity: "epic",
    xpReward: 0,
  },
  {
    id: "early_bird",
    name: "Précurseur",
    description: "Terminer le parcours avant l'échéance",
    icon: "🐦",
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    rarity: "epic",
    xpReward: 0,
  },
  {
    id: "parcours_done",
    name: "Intégré !",
    description: "Terminer l'intégralité du parcours d'onboarding",
    icon: "🏅",
    color: "#B45309",
    bg: "#FFFBEB",
    border: "#FCD34D",
    rarity: "legendary",
    xpReward: 0,
  },
  {
    id: "all_tasks",
    name: "Perfectionniste",
    description: "Compléter toutes les tâches obligatoires",
    icon: "✅",
    color: "#065F46",
    bg: "#ECFDF5",
    border: "#6EE7B7",
    rarity: "epic",
    xpReward: 0,
  },
];

// ── Main hook ─────────────────────────────────────────────────────────────────
export interface GamificationData {
  totalXP: number;
  level: Level;
  nextLevel: Level | null;
  progressToNext: number;    // 0–100 %
  badges: Badge[];
  unlockedBadges: Badge[];
  lockedBadges: Badge[];
}

export function useGamification(
  tasks: Task[],
  parcours: Parcours | null | undefined
): GamificationData {
  return useMemo(() => {
    let xp = 0;
    const unlockedIds = new Set<string>();
    const unlockedAt: Record<string, string> = {};

    const doneTasks = tasks.filter((t) => t.statut === "TERMINE");
    const docTasks  = tasks.filter((t) => t.taskType === "FORMATION" || t.taskType === "SIMPLE");
    const quizTasks = tasks.filter((t) => t.taskType === "QUIZ");

    // ── XP from tasks ──────────────────────────────────────────────────────
    doneTasks.forEach((t) => {
      xp += XP.TASK_COMPLETE;

      // Before deadline bonus
      if (t.echeance && t.dateCompletion) {
        const deadline = new Date(t.echeance);
        const done = new Date(t.dateCompletion);
        if (done < deadline) xp += XP.TASK_BEFORE_DEADLINE;
      }

      // Perfect quiz bonus
      if (t.taskType === "QUIZ" && t.config?.questions) {
        const maxScore = t.config.questions.reduce((s, q) => s + q.points, 0);
        if (maxScore > 0 && t.scoreObtenu === maxScore) {
          xp += XP.QUIZ_PERFECT;
        }
      }
    });

    // Document submitted XP (first doc)
    const firstDocDone = doneTasks.find(
      (t) => t.taskType === "FORMATION" || t.taskType === "SIMPLE"
    );
    if (firstDocDone) xp += XP.DOCUMENT_SUBMITTED;

    // Parcours completed
    if (parcours?.statut === "TERMINE") {
      xp += XP.PARCOURS_FINISHED;
      if (parcours.dateFin && parcours.dateDebut) {
        // Bonus if completed early (dateFin before the expected end — we check progression 100 quickly)
        xp += XP.PARCOURS_EARLY;
      }
    }

    // ── Badge unlocking ────────────────────────────────────────────────────
    const getCompletionDate = (t: Task) => t.dateCompletion ?? new Date().toISOString();

    // first_task
    if (doneTasks.length >= 1) {
      unlockedIds.add("first_task");
      unlockedAt["first_task"] = getCompletionDate(doneTasks[0]);
    }

    // first_doc
    if (firstDocDone) {
      unlockedIds.add("first_doc");
      unlockedAt["first_doc"] = getCompletionDate(firstDocDone);
    }

    // quiz_perfect
    const perfectQuiz = doneTasks.find((t) => {
      if (t.taskType !== "QUIZ" || !t.config?.questions) return false;
      const max = t.config.questions.reduce((s, q) => s + q.points, 0);
      return max > 0 && t.scoreObtenu === max;
    });
    if (perfectQuiz) {
      unlockedIds.add("quiz_perfect");
      unlockedAt["quiz_perfect"] = getCompletionDate(perfectQuiz);
    }

    // speed_demon — any task done before deadline
    const earlyTask = doneTasks.find((t) => {
      if (!t.echeance || !t.dateCompletion) return false;
      return new Date(t.dateCompletion) < new Date(t.echeance);
    });
    if (earlyTask) {
      unlockedIds.add("speed_demon");
      unlockedAt["speed_demon"] = getCompletionDate(earlyTask);
    }

    // half_way
    const progression = parcours?.progression ?? 0;
    if (progression >= 50) {
      unlockedIds.add("half_way");
    }

    // quiz_master — 3 quiz done successfully (any score >= min)
    const passedQuizzes = doneTasks.filter((t) => {
      if (t.taskType !== "QUIZ") return false;
      const minScore = t.config?.scoreMinimum ?? 0;
      return (t.scoreObtenu ?? 0) >= minScore;
    });
    if (passedQuizzes.length >= 3) {
      unlockedIds.add("quiz_master");
    }

    // early_bird + parcours_done
    if (parcours?.statut === "TERMINE") {
      unlockedIds.add("parcours_done");
      // early_bird — finished before dateFin (if set, use today comparison)
      // Since backend may not always set dateFin precisely, we award it if any task finished early
      if (earlyTask) unlockedIds.add("early_bird");
    }

    // all_tasks — all mandatory tasks done
    const mandatoryTasks = tasks.filter((t) => t.obligatoire);
    const mandatoryDone  = mandatoryTasks.filter((t) => t.statut === "TERMINE");
    if (mandatoryTasks.length > 0 && mandatoryDone.length === mandatoryTasks.length) {
      unlockedIds.add("all_tasks");
    }

    // ── Build badge list ───────────────────────────────────────────────────
    const badges: Badge[] = BADGE_DEFS.map((def) => ({
      ...def,
      unlocked: unlockedIds.has(def.id),
      unlockedAt: unlockedAt[def.id],
    }));

    // ── Level computation ──────────────────────────────────────────────────
    const level = getLevelForXP(xp);
    const nextLevel = LEVELS.find((l) => l.rank === level.rank + 1) ?? null;

    let progressToNext = 100;
    if (nextLevel) {
      const range = nextLevel.minXP - level.minXP;
      const earned = xp - level.minXP;
      progressToNext = Math.min(100, Math.round((earned / range) * 100));
    }

    return {
      totalXP: xp,
      level,
      nextLevel,
      progressToNext,
      badges,
      unlockedBadges: badges.filter((b) => b.unlocked),
      lockedBadges: badges.filter((b) => !b.unlocked),
    };
  }, [tasks, parcours]);
}

// ── Utility: compute XP for a list of tasks (used in leaderboard) ─────────────
export function computeXP(tasks: Task[], parcours?: Parcours | null): number {
  let xp = 0;
  const doneTasks = tasks.filter((t) => t.statut === "TERMINE");

  doneTasks.forEach((t) => {
    xp += XP.TASK_COMPLETE;
    if (t.echeance && t.dateCompletion && new Date(t.dateCompletion) < new Date(t.echeance)) {
      xp += XP.TASK_BEFORE_DEADLINE;
    }
    if (t.taskType === "QUIZ" && t.config?.questions) {
      const max = t.config.questions.reduce((s, q) => s + q.points, 0);
      if (max > 0 && t.scoreObtenu === max) xp += XP.QUIZ_PERFECT;
    }
  });

  const firstDoc = doneTasks.find((t) => t.taskType === "FORMATION" || t.taskType === "SIMPLE");
  if (firstDoc) xp += XP.DOCUMENT_SUBMITTED;

  if (parcours?.statut === "TERMINE") {
    xp += XP.PARCOURS_FINISHED + XP.PARCOURS_EARLY;
  }

  return xp;
}