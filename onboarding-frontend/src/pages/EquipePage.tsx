// src/pages/EquipePage.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAllUsersApi,
  getAllAffectationsApi,
  getPositionsApi,
  getCurrentUserApi,
} from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";
import type { User, Affectation, Position } from "../types/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const roleConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  ADMIN: {
    label: "RH / Admin",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    icon: "🛡️",
  },
  MANAGER: {
    label: "Manager",
    color: "#0369A1",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    icon: "👔",
  },
  SALARIE: {
    label: "Collaborateur",
    color: "#047857",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    icon: "👤",
  },
};

const getInitials = (prenom: string, nom: string) =>
  `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase();

const getAvatarGradient = (role: string, id: string) => {
  const gradients = {
    ADMIN: ["#7C3AED", "#A855F7"],
    MANAGER: ["#0369A1", "#0EA5E9"],
    SALARIE: ["#047857", "#10B981"],
  };
  const [a, b] = gradients[role as keyof typeof gradients] ?? ["#64748B", "#94A3B8"];
  return `linear-gradient(135deg, ${a}, ${b})`;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

// ── Skill Tags ─────────────────────────────────────────────────────────────
const skillsByPosition: Record<string, string[]> = {
  default: ["Collaboration", "Communication"],
};

const getSkills = (position?: Position): string[] => {
  if (!position) return skillsByPosition.default;
  const titre = position.titre.toLowerCase();
  if (titre.includes("dev") || titre.includes("tech")) return ["React", "TypeScript", "Spring Boot", "Git"];
  if (titre.includes("manager") || titre.includes("chef")) return ["Leadership", "Gestion d'équipe", "Agile", "Reporting"];
  if (titre.includes("rh") || titre.includes("ressource")) return ["Recrutement", "SIRH", "Droit du travail", "Onboarding"];
  if (titre.includes("data") || titre.includes("analyste")) return ["Python", "SQL", "Power BI", "Analyse"];
  if (titre.includes("design") || titre.includes("ux")) return ["Figma", "UX/UI", "Prototypage", "Design System"];
  if (titre.includes("infra") || titre.includes("sys") || titre.includes("devops")) return ["Linux", "Docker", "CI/CD", "Cloud"];
  return skillsByPosition.default;
};

const getBio = (user: User, position?: Position): string => {
  const role = user.role;
  const poste = position?.titre ?? "l'équipe";
  if (role === "ADMIN") return `Responsable RH en charge de l'onboarding et de la gestion des collaborateurs. Point de contact pour toutes les questions administratives.`;
  if (role === "MANAGER") return `Manager expérimenté au sein de l'équipe ${poste}. Accompagne les nouveaux collaborateurs et coordonne les activités de l'équipe.`;
  return `Collaborateur actif au poste de ${poste}. Contribue quotidiennement aux projets de l'équipe avec expertise et engagement.`;
};

// ── Member Card ────────────────────────────────────────────────────────────

interface MemberCardProps {
  user: User;
  affectation?: Affectation;
  position?: Position;
  manager?: User;
  isCurrentUser: boolean;
  onClick: () => void;
}

const MemberCard = ({ user, affectation, position, manager, isCurrentUser, onClick }: MemberCardProps) => {
  const [hovered, setHovered] = useState(false);
  const cfg = roleConfig[user.role] ?? roleConfig.SALARIE;
  const skills = getSkills(position);
  const bio = getBio(user, position);
  const dateEmbauche = user.professionalInfo?.dateEmbauche ?? user.dateValidation;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-2xl cursor-pointer transition-all duration-300"
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${hovered ? cfg.color + "44" : "var(--border)"}`,
        boxShadow: hovered
          ? `0 12px 40px ${cfg.color}18, 0 2px 8px rgba(0,0,0,0.06)`
          : "0 2px 8px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
      }}
    >
      {/* Current user badge */}
      {isCurrentUser && (
        <div
          className="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full z-10"
          style={{ background: "var(--cyan)", color: "#fff", fontFamily: "Sora" }}
        >
          Vous
        </div>
      )}

      {/* Header colored band */}
      <div
        className="h-20 rounded-t-2xl relative overflow-hidden"
        style={{ background: getAvatarGradient(user.role, user.id), opacity: 0.85 }}
      >
        {/* Decorative shapes */}
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20" style={{ background: "#fff" }} />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-10" style={{ background: "#fff" }} />
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center -mt-10 pb-5 px-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 overflow-hidden shadow-lg"
          style={{
            borderColor: "var(--surface)",
            background: user.profile?.photoPoste ? "transparent" : getAvatarGradient(user.role, user.id),
            color: "#fff",
            fontFamily: "Sora",
          }}
        >
          {user.profile?.photoPoste ? (
            <img
              src={user.profile.photoPoste}
              alt={`${user.prenom} ${user.nom}`}
              className="w-full h-full object-cover"
            />
          ) : (
            getInitials(user.prenom, user.nom)
          )}
        </div>

        {/* Role badge */}
        <div
          className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <span>{cfg.icon}</span>
          <span>{cfg.label}</span>
        </div>

        {/* Name */}
        <h3
          className="mt-2 text-base font-bold text-center leading-tight"
          style={{ color: "var(--text)", fontFamily: "Sora" }}
        >
          {user.prenom} {user.nom}
        </h3>

        {/* Position */}
        {position && (
          <p className="text-sm mt-1 text-center font-medium" style={{ color: "var(--cyan)" }}>
            {position.titre}
          </p>
        )}

        {/* Manager info */}
        {manager && user.role === "SALARIE" && (
          <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Manager : <strong style={{ color: "var(--text)" }}>{manager.prenom} {manager.nom}</strong></span>
          </div>
        )}

        {/* Divider */}
        <div className="w-full my-3 border-t" style={{ borderColor: "var(--border)" }} />

        {/* Bio */}
        <p className="text-xs text-center leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {bio}
        </p>

        {/* Skills */}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {skills.slice(0, 4).map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Date embauche */}
        {dateEmbauche && (
          <div
            className="mt-4 w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl"
            style={{ background: "var(--bg)", color: "var(--text-muted)" }}
          >
            <span className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Arrivée
            </span>
            <span className="font-medium" style={{ color: "var(--text)" }}>{formatDate(dateEmbauche)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Member Modal ────────────────────────────────────────────────────────────

const MemberModal = ({
  user,
  affectation,
  position,
  manager,
  colleagues,
  onClose,
}: {
  user: User;
  affectation?: Affectation;
  position?: Position;
  manager?: User;
  colleagues: User[];
  onClose: () => void;
}) => {
  const cfg = roleConfig[user.role] ?? roleConfig.SALARIE;
  const skills = getSkills(position);
  const bio = getBio(user, position);
  const dateEmbauche = user.professionalInfo?.dateEmbauche ?? user.dateValidation;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,20,60,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "var(--surface)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="relative h-36 flex items-end px-6 pb-0"
          style={{ background: getAvatarGradient(user.role, user.id) }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 70% 30%, #fff 0%, transparent 60%)" }} />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div className="mb-[-40px] z-10">
            <div
              className="w-20 h-20 rounded-full border-4 overflow-hidden flex items-center justify-center text-2xl font-bold shadow-xl"
              style={{
                borderColor: "var(--surface)",
                background: user.profile?.photoPoste ? "transparent" : getAvatarGradient(user.role, user.id),
                color: "#fff",
                fontFamily: "Sora",
              }}
            >
              {user.profile?.photoPoste ? (
                <img src={user.profile.photoPoste} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user.prenom, user.nom)
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-14 pb-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                {user.prenom} {user.nom}
              </h2>
              {position && (
                <p className="text-sm font-medium mt-0.5" style={{ color: "var(--cyan)" }}>
                  {position.titre}
                </p>
              )}
            </div>
            <div
              className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
            >
              {cfg.icon} {cfg.label}
            </div>
          </div>

          {/* Info Grid */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {user.email && (
              <div className="col-span-2 flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--bg)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Adresse Email </p>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {user.professionalInfo?.emailProfessionnel ?? user.email}
                  </p>
                </div>
              </div>
            )}

            {dateEmbauche && (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--bg)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Date d'arrivée</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{formatDate(dateEmbauche)}</p>
                </div>
              </div>
            )}

            {manager && (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--bg)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Manager direct</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {manager.prenom} {manager.nom}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              À propos
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{bio}</p>
          </div>

          {/* Skills */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Compétences
            </h4>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span
                  key={s}
                  className="text-xs px-3 py-1 rounded-lg font-medium"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Colleagues */}
          {colleagues.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Collègues ({colleagues.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {colleagues.slice(0, 8).map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                    style={{ background: "var(--bg)", color: "var(--text)" }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                      style={{ background: getAvatarGradient(c.role, c.id), fontSize: "9px" }}>
                      {c.profile?.photoPoste
                        ? <img src={c.profile.photoPoste} alt="" className="w-full h-full object-cover" />
                        : getInitials(c.prenom, c.nom)}
                    </div>
                    {c.prenom} {c.nom}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Org Chart simplified view ──────────────────────────────────────────────

const OrgView = ({
  users,
  affectations,
  positions,
}: {
  users: User[];
  affectations: Affectation[];
  positions: Position[];
}) => {
  const admins = users.filter((u) => u.role === "ADMIN" && u.statutCompte === "VALIDE");
  const managers = users.filter((u) => u.role === "MANAGER" && u.statutCompte === "VALIDE");
  const salaries = users.filter((u) => u.role === "SALARIE" && u.statutCompte === "VALIDE");

  const getPosition = (userId: string) => {
    const aff = affectations.find((a) => a.userId === userId);
    return aff ? positions.find((p) => p.id === aff.positionId) : undefined;
  };

  const getReports = (managerId: string) =>
    affectations.filter((a) => a.managerId === managerId).map((a) => users.find((u) => u.id === a.userId)).filter(Boolean) as User[];

  return (
    <div className="p-6 overflow-x-auto">
      {/* RH Level */}
      <div className="flex flex-col items-center">
        <div className="flex gap-4 justify-center flex-wrap">
          {admins.map((admin) => (
            <div key={admin.id} className="flex flex-col items-center">
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2"
                style={{ background: roleConfig.ADMIN.bg, borderColor: roleConfig.ADMIN.border }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                  style={{ background: getAvatarGradient("ADMIN", admin.id) }}
                >
                  {admin.profile?.photoPoste
                    ? <img src={admin.profile.photoPoste} alt="" className="w-full h-full object-cover" />
                    : getInitials(admin.prenom, admin.nom)}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: roleConfig.ADMIN.color, fontFamily: "Sora" }}>
                    {admin.prenom} {admin.nom}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>RH / Admin</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Connector */}
        {managers.length > 0 && (
          <div className="w-px h-8 mt-1" style={{ background: "var(--border)" }} />
        )}

        {/* Managers Level */}
        {managers.length > 0 && (
          <div className="flex gap-6 justify-center flex-wrap relative">
            <div
              className="absolute top-0 h-px"
              style={{
                background: "var(--border)",
                left: managers.length > 1 ? "12%" : "50%",
                right: managers.length > 1 ? "12%" : "50%",
              }}
            />
            {managers.map((mgr) => {
              const reports = getReports(mgr.id);
              const pos = getPosition(mgr.id);
              return (
                <div key={mgr.id} className="flex flex-col items-center">
                  <div className="w-px h-4 mt-0" style={{ background: "var(--border)" }} />
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2"
                    style={{ background: roleConfig.MANAGER.bg, borderColor: roleConfig.MANAGER.border }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                      style={{ background: getAvatarGradient("MANAGER", mgr.id) }}
                    >
                      {mgr.profile?.photoPoste
                        ? <img src={mgr.profile.photoPoste} alt="" className="w-full h-full object-cover" />
                        : getInitials(mgr.prenom, mgr.nom)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: roleConfig.MANAGER.color, fontFamily: "Sora" }}>
                        {mgr.prenom} {mgr.nom}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {pos?.titre ?? "Manager"} · {reports.length} collaborateur{reports.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Reports */}
                  {reports.length > 0 && (
                    <>
                      <div className="w-px h-4" style={{ background: "var(--border)" }} />
                      <div className="flex gap-3 flex-wrap justify-center">
                        {reports.map((r, i) => (
                          <div key={r.id} className="flex flex-col items-center">
                            {i === 0 && <div className="w-px h-3" style={{ background: "var(--border)" }} />}
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                              style={{ background: roleConfig.SALARIE.bg, borderColor: roleConfig.SALARIE.border }}
                            >
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                                style={{ background: getAvatarGradient("SALARIE", r.id) }}
                              >
                                {r.profile?.photoPoste
                                  ? <img src={r.profile.photoPoste} alt="" className="w-full h-full object-cover" />
                                  : getInitials(r.prenom, r.nom)}
                              </div>
                              <div>
                                <p className="text-xs font-semibold" style={{ color: roleConfig.SALARIE.color, fontFamily: "Sora" }}>
                                  {r.prenom} {r.nom}
                                </p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  {getPosition(r.id)?.titre ?? "Collaborateur"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unassigned employees */}
        {(() => {
          const assignedIds = new Set(affectations.filter(a => a.managerId).map(a => a.userId));
          const unassigned = salaries.filter(s => !assignedIds.has(s.id));
          if (unassigned.length === 0) return null;
          return (
            <div className="mt-8 p-4 rounded-2xl border-dashed border-2 w-full"
              style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold mb-3 text-center" style={{ color: "var(--text-muted)" }}>
                Collaborateurs sans manager assigné ({unassigned.length})
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                {unassigned.map(u => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                      style={{ background: getAvatarGradient("SALARIE", u.id) }}>
                      {getInitials(u.prenom, u.nom)}
                    </div>
                    <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{u.prenom} {u.nom}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

const EquipePage = () => {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterPosition, setFilterPosition] = useState("ALL");
  const [view, setView] = useState<"cards" | "org">("cards");
  const [selected, setSelected] = useState<User | null>(null);

  const sidebarRole = (role as "ADMIN" | "MANAGER" | "SALARIE") ?? "SALARIE";

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["allUsers"],
    queryFn: getAllUsersApi,
  });

  const { data: affectations = [] } = useQuery<Affectation[]>({
    queryKey: ["allAffectations"],
    queryFn: getAllAffectationsApi,
  });

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: getPositionsApi,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserApi,
  });

  // Only active users
  const activeUsers = useMemo(
    () => allUsers.filter((u: User) => u.statutCompte === "VALIDE" || u.statutCompte === "ACCEPTE"),
    [allUsers]
  );

  const getPosition = (userId: string): Position | undefined => {
    const aff = affectations.find((a: Affectation) => a.userId === userId);
    return aff ? positions.find((p: Position) => p.id === aff.positionId) : undefined;
  };

  const getManager = (userId: string): User | undefined => {
    const aff = affectations.find((a: Affectation) => a.userId === userId);
    if (!aff?.managerId) return undefined;
    return activeUsers.find((u: User) => u.id === aff.managerId);
  };

  const getColleagues = (user: User): User[] => {
    if (user.role === "SALARIE") {
      const aff = affectations.find((a: Affectation) => a.userId === user.id);
      if (!aff?.managerId) return [];
      return activeUsers.filter(
        (u: User) =>
          u.id !== user.id &&
          u.role === "SALARIE" &&
          affectations.some((a: Affectation) => a.userId === u.id && a.managerId === aff.managerId)
      );
    }
    if (user.role === "MANAGER") {
      return activeUsers.filter((u: User) => u.id !== user.id && u.role === "MANAGER");
    }
    return activeUsers.filter((u: User) => u.id !== user.id && u.role === "ADMIN");
  };

  const uniquePositions = useMemo(() => {
    const seen = new Set<string>();
    return positions.filter((p: Position) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [positions]);

  const filtered = useMemo(() => {
    return activeUsers.filter((u: User) => {
      const q = search.toLowerCase();
      const matchSearch =
        q === "" ||
        u.prenom.toLowerCase().includes(q) ||
        u.nom.toLowerCase().includes(q) ||
        `${u.prenom} ${u.nom}`.toLowerCase().includes(q) ||
        (getPosition(u.id)?.titre ?? "").toLowerCase().includes(q);
      const matchRole = filterRole === "ALL" || u.role === filterRole;
      const matchPos =
        filterPosition === "ALL" ||
        affectations.some(
          (a: Affectation) => a.userId === u.id && a.positionId === filterPosition
        );
      return matchSearch && matchRole && matchPos;
    });
  }, [activeUsers, search, filterRole, filterPosition, affectations]);

  // Stats
  const stats = useMemo(() => ({
    total: activeUsers.length,
    managers: activeUsers.filter((u: User) => u.role === "MANAGER").length,
    salaries: activeUsers.filter((u: User) => u.role === "SALARIE").length,
    rh: activeUsers.filter((u: User) => u.role === "ADMIN").length,
  }), [activeUsers]);

  const selectedAff = selected ? affectations.find((a: Affectation) => a.userId === selected.id) : undefined;
  const selectedPosition = selected ? getPosition(selected.id) : undefined;
  const selectedManager = selected ? getManager(selected.id) : undefined;
  const selectedColleagues = selected ? getColleagues(selected) : [];

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={sidebarRole} />

      <main className="flex-1 flex flex-col" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav showSearch={false}/>

        {/* Page Header */}
        <div className="px-8 pt-8 pb-0">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Annuaire de l'équipe
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Découvrez vos collègues, leurs rôles et l'organisation de l'entreprise
              </p>
            </div>

            {/* View Toggle */}
            <div
              className="flex items-center p-1 rounded-xl gap-1"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {[
                { key: "cards", label: "Cartes", icon: "▦" },
                { key: "org", label: "Organigramme", icon: "⤴" },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setView(key as "cards" | "org")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: view === key ? "var(--navy)" : "transparent",
                    color: view === key ? "#fff" : "var(--text-muted)",
                    fontFamily: view === key ? "Sora" : undefined,
                  }}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            {[
              { label: "Collaborateurs actifs", value: stats.total, color: "#00AEEF", icon: "👥" },
              { label: "Managers", value: stats.managers, color: "#0369A1", icon: "👔" },
              { label: "Salariés", value: stats.salaries, color: "#047857", icon: "👤" },
              { label: "RH / Admin", value: stats.rh, color: "#7C3AED", icon: "🛡️" },
            ].map(({ label, value, color, icon }) => (
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
                  <p className="text-2xl font-bold" style={{ color, fontFamily: "Sora" }}>{value}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          {view === "cards" && (
            <div className="mt-5 flex gap-3 flex-wrap items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-56">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-muted)" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un collaborateur, un poste…"
                  
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--surface)",
                    border: "1.5px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              {/* Role filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                style={{
                  background: "var(--surface)",
                  border: "1.5px solid var(--border)",
                  color: "var(--text)",
                }}
              >
                <option value="ALL">Tous les rôles</option>
                <option value="ADMIN">RH / Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="SALARIE">Collaborateur</option>
              </select>

              {/* Position filter */}
              {uniquePositions.length > 0 && (
                <select
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                  className="px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                  style={{
                    background: "var(--surface)",
                    border: "1.5px solid var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <option value="ALL">Tous les postes</option>
                  {uniquePositions.map((p: Position) => (
                    <option key={p.id} value={p.id}>{p.titre}</option>
                  ))}
                </select>
              )}

              {/* Result count */}
              {(search || filterRole !== "ALL" || filterPosition !== "ALL") && (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
                </span>
              )}

              {/* Reset */}
              {(search || filterRole !== "ALL" || filterPosition !== "ALL") && (
                <button
                  onClick={() => { setSearch(""); setFilterRole("ALL"); setFilterPosition("ALL"); }}
                  className="text-sm px-3 py-2.5 rounded-xl transition"
                  style={{ color: "var(--cyan)", background: "#00AEEF15" }}
                >
                  Réinitialiser
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-8 py-6">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--cyan)", borderTopColor: "transparent" }}
                />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement de l'équipe…</p>
              </div>
            </div>
          ) : view === "org" ? (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2">
                  <rect x="9" y="1" width="6" height="5" rx="1"/>
                  <rect x="2" y="14" width="6" height="5" rx="1"/>
                  <rect x="16" y="14" width="6" height="5" rx="1"/>
                  <path d="M12 6v4M6 14v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
                </svg>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                  Organisation hiérarchique
                </h2>
              </div>
              <OrgView users={activeUsers} affectations={affectations} positions={positions} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                🔍
              </div>
              <p className="font-semibold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Aucun résultat trouvé
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Essayez avec d'autres filtres ou termes de recherche.
              </p>
            </div>
          ) : (
            <>
              {/* Group by role */}
             {/* Version pour groupes réduits (affichage en ligne) */}
<div className="space-y-12">
  {(["ADMIN", "MANAGER", "SALARIE"] as const).map((roleKey) => {
    const group = filtered.filter((u: User) => u.role === roleKey);
    if (group.length === 0) return null;
    const cfg = roleConfig[roleKey];
    
    // Si c'est ADMIN (généralement 1 personne) ou petit groupe
    const isSmallGroup = group.length <= 2;
    
    return (
      <div key={roleKey} className="relative">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            <span className="text-base">{cfg.icon}</span>
            <span style={{ fontFamily: "Sora" }}>{cfg.label}s</span>
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: cfg.color, color: "#fff" }}>
              {group.length}
            </span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r" style={{ background: `linear-gradient(90deg, ${cfg.color}40, transparent)` }} />
        </div>
        
        <div className={isSmallGroup 
          ? "flex flex-wrap justify-center gap-5"  // Centré pour petits groupes
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"  // Grille normale
        }>
          {group.map((user: User) => (
            <div key={user.id} className={isSmallGroup ? "w-80" : "w-full"}>
              <MemberCard
                user={user}
                affectation={affectations.find((a: Affectation) => a.userId === user.id)}
                position={getPosition(user.id)}
                manager={getManager(user.id)}
                isCurrentUser={currentUser?.id === user.id}
                onClick={() => setSelected(user)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  })}
</div>
            </>
          )}
        </div>
      </main>

      {/* Modal */}
      {selected && (
        <MemberModal
          user={selected}
          affectation={selectedAff}
          position={selectedPosition}
          manager={selectedManager}
          colleagues={selectedColleagues}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default EquipePage;