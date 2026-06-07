import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAllUsersApi,
  getAllParcoursApi,
  getPositionsApi,
  getParcoursTerminesApi,
  getFeedbackStatisticsApi,
  getAllFeedbacksApi,
  getAllAffectationsApi, 
} from "../api/authApi";
import { type User, type Parcours, type Position, type Task } from "../types/auth";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";

// ─── utils ───────────────────────────────────────────────────────────────────
const daysBetween = (a: string, b?: string) =>
  Math.max(0, Math.round((new Date(b ?? Date.now()).getTime() - new Date(a).getTime()) / 86_400_000));

const isActif = (u: User) =>
  u.role !== "ADMIN" && u.statutCompte !== "DESACTIVE" && u.statutCompte !== "EXPIRE";

// Brand palette (matches index.css)
const C = {
  navy: "#1A2B6B",
  navyDark: "#111D4A",
  cyan: "#00AEEF",
  cyanLight: "#33C0F3",
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

// ─── useCountUp ──────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}


// ─── AnimatedNumber ───────────────────────────────────────────────────────────
const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const v = useCountUp(value);
  return <>{v}{suffix}</>;
};

// ─── DonutChart ──────────────────────────────────────────────────────────────
const DonutChart = ({
  segments, size = 160, stroke = 22, centerLabel, centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number; stroke?: number;
  centerLabel?: string | number; centerSub?: string;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = segments.reduce((s, d) => s + d.value, 0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const arcs = segments.map((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const gap = circ - dash;
    const arc = { ...seg, dash, gap, offset: offset * circ, index: i };
    offset += pct;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {arcs.map((arc, i) => (
            <circle key={i}
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={hovered === i ? stroke + 4 : stroke}
              strokeDasharray={`${arc.dash - 2} ${arc.gap + 2}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="round"
              style={{
                transition: "stroke-width 0.2s ease, stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)",
                cursor: "pointer", opacity: hovered !== null && hovered !== i ? 0.4 : 1,
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {total === 0 && (
            <circle cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={C.border} strokeWidth={stroke} />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {hovered !== null ? (
            <>
              <span className="font-bold text-xl leading-none" style={{ color: segments[hovered].color, fontFamily: "Sora" }}>
                {segments[hovered].value}
              </span>
              <span className="text-xs mt-1" style={{ color: C.muted }}>{segments[hovered].label}</span>
            </>
          ) : (
            <>
              <span className="font-bold leading-none" style={{ fontSize: size * 0.19, color: C.navy, fontFamily: "Sora" }}>
                {centerLabel ?? total}
              </span>
              {centerSub && <span className="text-xs mt-1" style={{ color: C.muted }}>{centerSub}</span>}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <button key={i}
            className="flex items-center gap-1.5 transition-opacity"
            style={{ opacity: hovered !== null && hovered !== i ? 0.4 : 1 }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <span className="text-xs" style={{ color: C.text }}>{seg.label}</span>
            <span className="text-xs font-bold" style={{ color: seg.color }}>
              {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── AreaChart ────────────────────────────────────────────────────────────────
const AreaChart = ({
  data, color, height = 120, width = 400, label,
}: {
  data: { x: string; y: number }[]; color: string; height?: number; width?: number; label?: string;
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; val: number; lbl: string } | null>(null);
  const pad = { top: 12, bottom: 28, left: 8, right: 8 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.y), 1);

  const pts = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * W,
    y: pad.top + (1 - d.y / max) * H,
    val: d.y, lbl: d.x,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${pad.top + H} L${pts[0].x},${pad.top + H} Z`;
  const gId = `ag${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="relative" style={{ position: "relative" }}>
      {label && <p className="text-xs font-semibold mb-2" style={{ color: C.muted }}>{label}</p>}
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
        style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad.left} x2={pad.left + W}
            y1={pad.top + (1 - t) * H} y2={pad.top + (1 - t) * H}
            stroke={C.border} strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
        ))}
        <path d={areaPath} fill={`url(#${gId})`} style={{ transition: "d 0.8s" }} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d 0.8s" }} />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="10" fill="transparent"
              onMouseEnter={() => setTooltip({ x: p.x, y: p.y, val: p.val, lbl: p.lbl })}
              onMouseLeave={() => setTooltip(null)} style={{ cursor: "pointer" }} />
            <circle cx={p.x} cy={p.y} r={tooltip?.lbl === p.lbl ? 5 : 3}
              fill={color} stroke={C.surface} strokeWidth="2"
              style={{ transition: "r 0.15s", pointerEvents: "none" }} />
            <text x={p.x} y={pad.top + H + 16} textAnchor="middle"
              fontSize="10" fill={C.muted}>{p.lbl}</text>
          </g>
        ))}
        {tooltip && (
          <g>
            <rect x={tooltip.x - 28} y={tooltip.y - 32} width={56} height={24}
              rx="6" fill={C.navy} opacity="0.92" />
            <text x={tooltip.x} y={tooltip.y - 16} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#fff" fontFamily="Sora">
              {tooltip.val}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

// ─── BarChart ────────────────────────────────────────────────────────────────
const BarChart = ({
  data, height = 160, horizontal = false,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number; horizontal?: boolean;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    return (
      <div className="space-y-3">
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={i} className="flex items-center gap-3"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <span className="text-xs w-24 text-right truncate flex-shrink-0"
                style={{ color: C.text }}>{d.label}</span>
              <div className="flex-1 h-7 rounded-lg overflow-hidden relative"
                style={{ background: C.border }}>
                <div className="h-full rounded-lg flex items-center"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${d.color}cc, ${d.color})`,
                    transition: "width 0.9s cubic-bezier(.4,0,.2,1)",
                    boxShadow: hovered === i ? `0 0 12px ${d.color}60` : "none",
                  }}>
                  {pct > 20 && (
                    <span className="ml-2 text-xs font-bold text-white">{d.value}</span>
                  )}
                </div>
                {pct <= 20 && d.value > 0 && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-bold"
                    style={{ color: C.text }}>{d.value}</span>
                )}
              </div>
              <span className="text-xs font-bold w-10 flex-shrink-0"
                style={{ color: d.color }}>{Math.round(pct)}%</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 w-full" style={{ height }}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * (height - 36), d.value > 0 ? 6 : 0);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <span className="text-xs font-bold transition-all"
              style={{ color: d.color, minHeight: 18, opacity: d.value > 0 ? 1 : 0 }}>
              {d.value}
            </span>
            <div className="w-full relative" style={{ height: height - 36 }}>
              <div className="absolute bottom-0 w-full rounded-t-xl"
                style={{
                  height: barH,
                  background: hovered === i
                    ? `linear-gradient(to top, ${d.color}, ${d.color}cc)`
                    : `linear-gradient(to top, ${d.color}cc, ${d.color}99)`,
                  transition: "height 0.9s cubic-bezier(.4,0,.2,1), background 0.2s",
                  boxShadow: hovered === i ? `0 -4px 16px ${d.color}50` : "none",
                }} />
            </div>
            <span className="text-center leading-tight"
              style={{ color: C.muted, fontSize: 10 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── GaugeArc ─────────────────────────────────────────────────────────────────
const GaugeArc = ({ value, max = 100, color, size = 140 }: {
  value: number; max?: number; color: string; size?: number;
}) => {
  const pct = max > 0 ? value / max : 0;
  const r = (size - 20) / 2;
  const circ = Math.PI * r; // half circle
  const dash = pct * circ;

  return (
    <div className="relative flex items-end justify-center" style={{ width: size, height: size / 2 + 24 }}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <path d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none" stroke={C.border} strokeWidth="16" strokeLinecap="round" />
        <path d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
        <span className="text-3xl font-bold leading-none" style={{ color, fontFamily: "Sora" }}>
          <AnimatedNumber value={Math.round(value)} suffix="%" />
        </span>
      </div>
    </div>
  );
};

// ─── ProgressRing ─────────────────────────────────────────────────────────────
const ProgressRing = ({ value, color, size = 48, stroke = 5 }: {
  value: number; color: string; size?: number; stroke?: number;
}) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
};

// ─── KpiCard ─────────────────────────────────────────────────────────────────
const KpiCard = ({
  icon, label, value, sub, color, bg, suffix = "", delta,
}: {
  icon: string; label: string; value: number; sub?: string;
  color: string; bg: string; suffix?: string; delta?: string;
}) => (
  <div className="stat-card group cursor-default">
    <div className="flex items-start justify-between mb-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110"
        style={{ background: bg }}>{icon}</div>
      {delta && (
        <span className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ background: `${color}15`, color }}>
          {delta}
        </span>
      )}
    </div>
    <p className="text-4xl font-bold leading-none tabular-nums"
      style={{ color, fontFamily: "Sora" }}>
      <AnimatedNumber value={value} suffix={suffix} />
    </p>
    <p className="text-sm font-semibold mt-2" style={{ color: C.text }}>{label}</p>
    {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
  </div>
);

// ─── SectionHeader ────────────────────────────────────────────────────────────
const SectionHeader = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-6">
    <h2 className="text-lg font-bold" style={{ color: C.text, fontFamily: "Sora" }}>{title}</h2>
    {sub && <p className="text-sm mt-0.5" style={{ color: C.muted }}>{sub}</p>}
  </div>
);

// ─── Card ────────────────────────────────────────────────────────────────────
const Card = ({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) => (
  <div className={`card p-6 ${className}`} style={style}>{children}</div>
);

// ─── Divider ─────────────────────────────────────────────────────────────────
const Divider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3">
    <div className="h-px flex-1" style={{ background: C.border }} />
    <span className="text-xs font-bold uppercase tracking-widest"
      style={{ color: C.muted, fontFamily: "Sora" }}>{label}</span>
    <div className="h-px flex-1" style={{ background: C.border }} />
  </div>
);

// ─── ManagerChampionship ─────────────────────────────────────────────────────

type MgrStat = {
  mgr: User;
  total: number;
  terminesEnTemps: number;
  taux: number;
  progMoy: number;
  teamSize: number;
};

// Palettes podium
const PODIUM_META = [
  { rank: 1, medal: "🥇", height: 140, gradient: "linear-gradient(180deg,#F59E0B,#d97706)", ring: "#F59E0B", avatar: "linear-gradient(135deg,#F59E0B,#92400e)", label: "#1 MEILLEUR", glow: "0 0 40px #F59E0B50" },
  { rank: 2, medal: "🥈", height: 95,  gradient: "linear-gradient(180deg,#94a3b8,#64748b)", ring: "#94a3b8",  avatar: "linear-gradient(135deg,#94a3b8,#475569)", label: "#2",          glow: "0 0 24px #94a3b830" },
  { rank: 3, medal: "🥉", height: 60,  gradient: "linear-gradient(180deg,#cd7f32,#a0522d)", ring: "#cd7f32",  avatar: "linear-gradient(135deg,#cd7f32,#78350f)", label: "#3",          glow: "0 0 16px #cd7f3220" },
];

// Order: 2nd left, 1st center, 3rd right
const PODIUM_ORDER = [1, 0, 2];

const PodiumCard = ({ item, meta, scoreGlobal }: { item: MgrStat; meta: typeof PODIUM_META[0]; scoreGlobal: number }) => {
  const isFirst = meta.rank === 1;

  return (
    <div className="flex flex-col items-center" style={{ width: isFirst ? 200 : 168 }}>

      {/* Medal */}
      <div style={{ fontSize: isFirst ? 36 : 28, marginBottom: isFirst ? 6 : 4, filter: isFirst ? "drop-shadow(0 0 12px #f59e0b80)" : undefined }}>
        {meta.medal}
      </div>

      {/* #1 label */}
      {isFirst && (
        <div className="mb-3 px-3 py-1 rounded-full text-xs font-black tracking-widest"
          style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.35)", letterSpacing: "0.1em" }}>
          ★ MEILLEUR MANAGER
        </div>
      )}

      {/* Avatar */}
      <div className="relative mb-3">
        {isFirst && (
          <div className="absolute inset-0 rounded-full blur-xl scale-125 opacity-60"
            style={{ background: "#F59E0B" }} />
        )}
        <div
          className="relative flex items-center justify-center text-white font-black rounded-full"
          style={{
            width: isFirst ? 68 : 56,
            height: isFirst ? 68 : 56,
            fontSize: isFirst ? 22 : 18,
            background: meta.avatar,
            boxShadow: `0 0 0 3px ${meta.ring}40, ${meta.glow}`,
            fontFamily: "Sora",
          }}
        >
          {item.mgr.prenom?.[0]}{item.mgr.nom?.[0]}
        </div>
        {/* Rank badge */}
        <div className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-white font-black"
          style={{
            width: isFirst ? 24 : 20,
            height: isFirst ? 24 : 20,
            fontSize: isFirst ? 11 : 9,
            background: meta.gradient,
          }}>
          {meta.rank}
        </div>
      </div>

      {/* Name */}
      <p className="font-black text-center leading-tight mb-0.5"
        style={{ fontSize: isFirst ? 15 : 13, fontFamily: "Sora", color: C.text }}>
        {item.mgr.prenom} {item.mgr.nom}
      </p>
      <p className="text-xs mb-4" style={{ color: C.muted }}>
        {item.teamSize} membre{item.teamSize > 1 ? "s" : ""}
      </p>

      {/* Stats card */}
      <div className="w-full rounded-2xl px-4 py-3 mb-0 text-center"
        style={{
          background: isFirst ? `${C.amber}0d` : "var(--bg)",
          border: `1.5px solid ${meta.ring}35`,
        }}>
        {/* Taux */}
        <p style={{ fontSize: isFirst ? 28 : 22, fontFamily: "Sora", color: meta.ring, fontWeight: 900, lineHeight: 1 }}>
          {item.taux}%
        </p>
        <p className="text-xs mt-0.5 mb-3" style={{ color: C.muted }}>réussite J+30</p>

        {/* Score global */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: C.muted }}>Score</span>
          <span className="text-xs font-black" style={{ color: meta.ring }}>{scoreGlobal}/100</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--border)" }}>
          <div className="h-full rounded-full" style={{ width: `${scoreGlobal}%`, background: meta.gradient }} />
        </div>

        {/* Progression équipe */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: C.muted }}>Équipe</span>
          <span className="text-xs font-bold" style={{ color: C.cyan }}>{item.progMoy}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div className="h-full rounded-full" style={{ width: `${item.progMoy}%`, background: `linear-gradient(90deg,${C.cyan},${C.green})` }} />
        </div>

        {/* Parcours */}
        <p className="text-xs mt-2" style={{ color: C.muted }}>
          {item.terminesEnTemps}/{item.total} parcours terminés
        </p>
      </div>

      {/* Podium block */}
      <div className="w-full rounded-t-2xl flex items-center justify-center relative overflow-hidden"
        style={{ height: meta.height, background: meta.gradient, boxShadow: `0 -6px 24px ${meta.ring}30` }}>
        {/* Shine */}
        <div className="absolute inset-0 opacity-20"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
        <span className="relative font-black opacity-20 text-white"
          style={{ fontSize: isFirst ? 40 : 30, fontFamily: "Sora" }}>
          {meta.rank}
        </span>
      </div>
    </div>
  );
};

const ManagerChampionship = ({ managers }: { managers: MgrStat[] }) => {
  const tauxMoyen = managers.length > 0
    ? Math.round(managers.reduce((a, m) => a + m.taux, 0) / managers.length)
    : 0;

  return (
    <div className="mt-6 mb-6 space-y-5">

      {/* ── Banner ── */}
      <div className="relative rounded-3xl overflow-hidden px-8 py-7"
        style={{
          background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.navyDark} 60%, #0a2a4a 100%)`,
          border: `1px solid ${C.cyan}40`,
        }}>

        {/* Particles */}
        {[...Array(28)].map((_, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              background: i % 4 === 0 ? C.green : "white",
              opacity: 0.07 + (i % 5) * 0.05,
              top: `${(i * 31) % 100}%`,
              left: `${(i * 67) % 100}%`,
            }} />
        ))}

        {/* Glow blobs */}
        <div className="absolute -top-10 -left-10 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: C.cyan, opacity: 0.18, filter: "blur(50px)" }} />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: C.green, opacity: 0.12, filter: "blur(50px)" }} />

        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", fontSize: 20 }}>
                🏆
              </div>
              <div>
                <h2 className="text-xl font-black text-white" style={{ fontFamily: "Sora", letterSpacing: "-0.3px" }}>
                  Manager Championship
                </h2>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Classé par score global · 60% réussite J+30 + 40% progression équipe
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {[
              { value: managers.length, label: "managers",   color: "white", bg: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.2)" },
              { value: `${tauxMoyen}%`, label: "taux moyen", color: C.green, bg: `${C.green}25`,           border: `${C.green}40`          },
            ].map((stat, i) => (
              <div key={i} className="text-center px-5 py-3 rounded-2xl"
                style={{ background: stat.bg, border: `1px solid ${stat.border}`, backdropFilter: "blur(8px)" }}>
                <p className="text-2xl font-black leading-none" style={{ color: stat.color, fontFamily: "Sora" }}>
                  {stat.value}
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Podium ── */}
      {managers.length >= 1 && (
        <div className="relative rounded-3xl overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}>

          {/* Color strip top */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl pointer-events-none"
            style={{ background: `linear-gradient(90deg, ${C.violet}, ${C.cyan}, ${C.green}, ${C.amber})` }} />

          {/* Glow blobs */}
          <div className="absolute bottom-0 left-1/4 w-48 h-32 pointer-events-none"
            style={{ background: C.amber, opacity: 0.05, filter: "blur(50px)" }} />
          <div className="absolute bottom-0 right-1/4 w-48 h-32 pointer-events-none"
            style={{ background: C.cyan, opacity: 0.05, filter: "blur(50px)" }} />
          <div className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
            style={{ background: C.violet, opacity: 0.04, filter: "blur(40px)" }} />

          <div className="relative z-10 px-8 pt-8 pb-0">

            {/* Podium top 3 */}
            <div className="flex items-end justify-center gap-5" style={{ minHeight: 380 }}>
              {PODIUM_ORDER.map((idx) => {
                const item = managers[idx];
                if (!item) return <div key={idx} style={{ width: 168 }} />;
                const meta = PODIUM_META[idx];
                const scoreGlobal = Math.round(item.taux * 0.6 + item.progMoy * 0.4);
                return <PodiumCard key={item.mgr.id} item={item} meta={meta} scoreGlobal={scoreGlobal} />;
              })}
            </div>

            {/* Stage floor */}
            <div className="h-4 -mx-8"
              style={{ background: "linear-gradient(to right, transparent, rgba(0,174,239,0.15) 30%, rgba(245,158,11,0.1) 50%, rgba(0,174,239,0.15) 70%, transparent)" }} />
          </div>

          {/* Rest of ranking (4th+) inline pills */}
          {managers.length > 3 && (
            <div className="relative z-10 px-8 py-4 flex flex-wrap gap-2"
              style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs font-bold uppercase tracking-widest mr-2" style={{ color: C.muted }}>
                Autres
              </span>
              {managers.slice(3).map((item, i) => {
                const score = Math.round(item.taux * 0.6 + item.progMoy * 0.4);
                const scoreColor = score >= 70 ? C.green : score >= 45 ? C.amber : C.rose;
                return (
                  <div key={item.mgr.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                    <span className="text-xs font-bold" style={{ color: C.muted }}>#{i + 4}</span>
                    <span className="text-xs font-semibold" style={{ color: C.text }}>{item.mgr.prenom} {item.mgr.nom}</span>
                    <span className="text-xs font-black px-1.5 py-0.5 rounded-lg"
                      style={{ background: `${scoreColor}18`, color: scoreColor }}>
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Leaderboard table ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: C.text, fontFamily: "Sora" }}>Classement complet</h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              Score = 60% taux réussite J+30 + 40% progression moyenne équipe
            </p>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                {["Rang", "Manager", "Équipe", "Terminés J+30", "Taux réussite", "Prog. moy.", "Score"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide"
                    style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managers.map((item, idx) => {
                const medals = ["🥇", "🥈", "🥉"];
                const tauxColor = item.taux >= 80 ? C.green : item.taux >= 50 ? C.amber : C.rose;
                const score = Math.round(item.taux * 0.6 + item.progMoy * 0.4);
                const scoreColor = score >= 80 ? C.green : score >= 50 ? C.cyan : C.amber;
                const isTop = idx === 0;
                return (
                  <tr key={item.mgr.id}
                    style={{ borderBottom: `1px solid ${C.border}`, background: isTop ? "rgba(245,158,11,0.03)" : "transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isTop ? "rgba(245,158,11,0.03)" : "transparent"; }}>
                    <td className="px-5 py-4">
                      {idx < 3
                        ? <span className="text-xl">{medals[idx]}</span>
                        : <span className="text-sm font-bold" style={{ color: C.muted }}>#{idx + 1}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{
                            background: isTop ? "linear-gradient(135deg,#F59E0B,#d97706)" : `linear-gradient(135deg,${C.violet},${C.navy})`,
                            boxShadow: isTop ? "0 0 12px #F59E0B40" : "none",
                          }}>
                          {item.mgr.prenom?.[0]}{item.mgr.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: C.text }}>{item.mgr.prenom} {item.mgr.nom}</p>
                          <p className="text-xs" style={{ color: C.muted }}>{item.mgr.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: "#e0f7ff", color: C.cyan }}>
                        {item.teamSize} membres
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold tabular-nums" style={{ color: C.green, fontFamily: "Sora" }}>{item.terminesEnTemps}</span>
                      <span className="text-xs ml-1" style={{ color: C.muted }}>/ {item.total}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${item.taux}%`, background: tauxColor, transition: "width 0.8s" }} />
                        </div>
                        <span className="text-sm font-bold w-10" style={{ color: tauxColor, fontFamily: "Sora" }}>{item.taux}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${item.progMoy}%`, background: `linear-gradient(to right,${C.cyan},${C.navy})` }} />
                        </div>
                        <span className="text-xs font-semibold w-8" style={{ color: C.cyan }}>{item.progMoy}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg,${scoreColor},${scoreColor}cc)`, boxShadow: `0 2px 8px ${scoreColor}40` }}>
                          {score}
                        </div>
                        <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── ProgressionGlobaleCard ──────────────────────────────────────────────────

type ProgItem = {
  userId: string; prenom: string; nom: string; poste: string;
  progression: number; phase: string; joursRestants: number;
  statut: "ok" | "risque" | "bloque";
};

const PROG_FILTERS = [
  { key: "all",   label: "Tous",    min: 0,   max: 100, color: C.navy   },
  { key: "p0",    label: "0%",      min: 0,   max: 0,   color: "#94a3b8" },
  { key: "p25",   label: "1–25%",   min: 1,   max: 25,  color: C.amber  },
  { key: "p50",   label: "26–50%",  min: 26,  max: 50,  color: C.violet },
  { key: "p75",   label: "51–75%",  min: 51,  max: 75,  color: C.cyan   },
  { key: "p99",   label: "76–99%",  min: 76,  max: 99,  color: C.green  },
  { key: "p100",  label: "100%",    min: 100, max: 100, color: C.green  },
] as const;

type FilterKey = typeof PROG_FILTERS[number]["key"];

const ProgressionGlobaleCard = ({
  progressionGlobale,
  parcoursActifsLength,
}: {
  progressionGlobale: ProgItem[];
  parcoursActifsLength: number;
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const filtered = activeFilter === "all"
    ? progressionGlobale
    : progressionGlobale.filter((item) => {
        const f = PROG_FILTERS.find(f => f.key === activeFilter)!;
        return item.progression >= f.min && item.progression <= f.max;
      });

  const activeFilterDef = PROG_FILTERS.find(f => f.key === activeFilter)!;

  // Compte par tranche pour les badges
  const counts = PROG_FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === "all"
      ? progressionGlobale.length
      : progressionGlobale.filter(i => i.progression >= f.min && i.progression <= f.max).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <SectionHeader
        title="Progression globale des salariés"
        sub={`${parcoursActifsLength} salariés suivis`}
      />

      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PROG_FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const count = counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: isActive ? f.color : "var(--bg)",
                color: isActive ? "white" : C.muted,
                border: `1.5px solid ${isActive ? f.color : "var(--border)"}`,
                transform: isActive ? "scale(1.05)" : "scale(1)",
                boxShadow: isActive ? `0 2px 8px ${f.color}40` : "none",
              }}
            >
              {f.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-xs font-bold leading-none"
                style={{
                  background: isActive ? "rgba(255,255,255,0.25)" : `${f.color}18`,
                  color: isActive ? "white" : f.color,
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Résultat filtre ── */}
      {activeFilter !== "all" && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
          style={{ background: `${activeFilterDef.color}10`, border: `1px solid ${activeFilterDef.color}25` }}>
          <span className="text-xs font-semibold" style={{ color: activeFilterDef.color }}>
            Tranche {activeFilterDef.label}
          </span>
          <span className="text-xs font-bold" style={{ color: activeFilterDef.color }}>
            {filtered.length} salarié{filtered.length !== 1 ? "s" : ""}
            {progressionGlobale.length > 0 && (
              <span className="font-normal ml-1" style={{ color: C.muted }}>
                ({Math.round((filtered.length / progressionGlobale.length) * 100)}% du total)
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Liste ── */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-medium" style={{ color: C.muted }}>
              Aucun salarié dans cette tranche
            </p>
          </div>
        )}
        {filtered.map((item) => {
          const statusIcon  = item.statut === "bloque" ? "🔴" : item.statut === "risque" ? "🟡" : "🟢";
          const statusColor = item.statut === "bloque" ? C.rose  : item.statut === "risque" ? C.amber : C.green;
          const statusLabel = item.statut === "bloque" ? "Bloqué" : item.statut === "risque" ? "À risque" : "En bonne voie";
          const phaseColor  = item.phase === "Terminé" ? C.green
            : item.phase === "Validation"             ? C.cyan
            : item.phase === "Montée en compétence"   ? C.violet
            : item.phase === "Intégration"             ? C.amber
            : C.muted;
          return (
            <div key={item.userId} className="p-3.5 rounded-2xl transition-all"
              style={{
                background: item.statut === "bloque" ? "#fff1f280" : item.statut === "risque" ? "#fffbeb80" : C.surface,
                border: `1.5px solid ${item.statut === "bloque" ? C.rose + "40" : item.statut === "risque" ? C.amber + "40" : C.border}`,
              }}>
              {/* Row 1 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.navy})` }}>
                    {item.prenom?.[0]}{item.nom?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: C.text }}>
                      {item.prenom} {item.nom}
                    </p>
                    <p className="text-xs" style={{ color: C.muted }}>{item.poste || "—"}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: statusColor + "18", color: statusColor }}>
                  {statusIcon} {statusLabel}
                </span>
              </div>
              {/* Row 2 */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${item.progression}%`,
                      background: item.statut === "bloque"
                        ? `linear-gradient(to right, ${C.rose}, #c01)`
                        : item.statut === "risque"
                        ? `linear-gradient(to right, ${C.amber}, #d97706)`
                        : `linear-gradient(to right, ${C.cyan}, ${C.green})`,
                    }} />
                </div>
                <span className="text-xs font-bold tabular-nums w-9 text-right"
                  style={{ color: item.statut === "bloque" ? C.rose : item.statut === "risque" ? C.amber : C.cyan }}>
                  {item.progression}%
                </span>
              </div>
              {/* Row 3 */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: phaseColor + "18", color: phaseColor }}>
                  📍 {item.phase}
                </span>
                <span className="text-xs" style={{ color: item.joursRestants < 0 ? C.rose : C.muted }}>
                  {item.joursRestants < 0
                    ? `⏰ ${Math.abs(item.joursRestants)}j de retard`
                    : item.joursRestants === 0
                    ? "📅 Dernier jour"
                    : `📅 ${item.joursRestants}j restants`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Légende ── */}
      <div className="flex gap-4 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
        {[
          { icon: "🟢", label: "En bonne voie", count: progressionGlobale.filter(p => p.statut === "ok").length,     color: C.green },
          { icon: "🟡", label: "À risque",       count: progressionGlobale.filter(p => p.statut === "risque").length, color: C.amber },
          { icon: "🔴", label: "Bloqué",          count: progressionGlobale.filter(p => p.statut === "bloque").length, color: C.rose  },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="text-xs">{s.icon}</span>
            <span className="text-xs" style={{ color: C.muted }}>{s.label}</span>
            <span className="text-xs font-bold" style={{ color: s.color }}>({s.count})</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

// ─── TachesParPosteCard ──────────────────────────────────────────────────────
type PosteStats = {
  positionId: string;
  titrePose: string;
  tauxMoyen: number;
  salaries: { userId: string; prenom: string; nom: string; totalTaches: number; tachesRealisees: number; tachesEnRetard: number; taux: number }[];
  realisees: { userId: string; prenom: string; nom: string; totalTaches: number; tachesRealisees: number; tachesEnRetard: number; taux: number }[];
  nonRealisees: { userId: string; prenom: string; nom: string; totalTaches: number; tachesRealisees: number; tachesEnRetard: number; taux: number }[];
};

const SalarieRow = ({
  s, accent, showTasks,
}: {
  s: PosteStats["salaries"][0];
  accent: string;
  showTasks: boolean;
}) => (
  <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
    style={{ background: "var(--bg)", border: `1px solid ${accent}18` }}>
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: `linear-gradient(135deg, ${accent}, ${C.navy})` }}>
      {s.prenom[0]}{s.nom[0]}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: C.text }}>
        {s.prenom} {s.nom}
      </p>
      {showTasks && s.totalTaches > 0 && (
        <p className="text-xs" style={{ color: C.muted }}>
          {s.tachesRealisees} dans les delais
          {s.tachesEnRetard > 0 && <span className="ml-1" style={{ color: C.rose }}>· {s.tachesEnRetard} en retard</span>}
        </p>
      )}
    </div>
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <span className="text-xs font-bold tabular-nums" style={{ color: accent }}>{s.taux}%</span>
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${s.taux}%`, background: accent }} />
      </div>
    </div>
  </div>
);

const PosteAccordion = ({ groupe }: { groupe: PosteStats }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"realisees" | "nonRealisees">("realisees");
  const tauxColor = groupe.tauxMoyen >= 80 ? C.green : groupe.tauxMoyen >= 50 ? C.amber : C.rose;
  const circumference = 2 * Math.PI * 20;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 transition"
        style={{ background: open ? `${tauxColor}06` : undefined }}>
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={tauxColor} strokeWidth="4"
              strokeDasharray={`${(groupe.tauxMoyen / 100) * circumference} ${circumference}`}
              strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span style={{ fontSize: 10, fontWeight: 900, color: tauxColor, fontFamily: "Sora" }}>{groupe.tauxMoyen}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: C.text, fontFamily: "Sora" }}>{groupe.titrePose}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${C.green}15`, color: C.green }}>
              ✓ {groupe.realisees.length} ont realise
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${C.rose}15`, color: C.rose }}>
              ✗ {groupe.nonRealisees.length} n'ont pas realise
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0" style={{ minWidth: 80 }}>
          <span className="text-xs" style={{ color: C.muted }}>{groupe.salaries.length} salarie{groupe.salaries.length > 1 ? "s" : ""}</span>
          <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full" style={{ width: `${groupe.tauxMoyen}%`, background: tauxColor }} />
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" className="flex-shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex gap-1 p-3" style={{ background: "var(--bg)" }}>
            {([
              { key: "realisees" as const,    label: `Ont realise (${groupe.realisees.length})`,     color: C.green },
              { key: "nonRealisees" as const, label: `N ont pas realise (${groupe.nonRealisees.length})`, color: C.rose },
            ]).map(t => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition"
                style={{
                  background: tab === t.key ? t.color : "transparent",
                  color: tab === t.key ? "white" : C.muted,
                  border: `1.5px solid ${tab === t.key ? t.color : "var(--border)"}`,
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="px-3 pb-3 space-y-2">
            {tab === "realisees"
              ? groupe.realisees.length > 0
                ? groupe.realisees.sort((a, b) => b.taux - a.taux).map(s => <SalarieRow key={s.userId} s={s} accent={C.green} showTasks={true} />)
                : <p className="text-xs text-center py-4" style={{ color: C.muted }}>Aucun salarie dans cette categorie</p>
              : groupe.nonRealisees.length > 0
                ? groupe.nonRealisees.sort((a, b) => b.taux - a.taux).map(s => <SalarieRow key={s.userId} s={s} accent={C.rose} showTasks={true} />)
                : <p className="text-xs text-center py-4" style={{ color: C.muted }}>Tous les salaries ont realise leurs taches</p>
            }
          </div>
        </div>
      )}
    </div>
  );
};

const TachesParPosteCard = ({ tachesParPoste }: { tachesParPoste: PosteStats[] }) => {
  const totalSalaries   = tachesParPoste.reduce((a, g) => a + g.salaries.length, 0);
  const totalRealisees  = tachesParPoste.reduce((a, g) => a + g.realisees.length, 0);
  const tauxGlobal      = totalSalaries > 0 ? Math.round((totalRealisees / totalSalaries) * 100) : 0;
  const tauxGlobalColor = tauxGlobal >= 80 ? C.green : tauxGlobal >= 50 ? C.amber : C.rose;

  return (
    <Card>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-bold" style={{ color: C.text, fontFamily: "Sora" }}>
            Taches realisees par poste
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            Salaries ayant realise 80% ou plus de leurs taches dans les delais
          </p>
        </div>
        <div className="flex flex-col items-center px-4 py-2.5 rounded-2xl flex-shrink-0"
          style={{ background: `${tauxGlobalColor}12`, border: `1.5px solid ${tauxGlobalColor}30` }}>
          <span className="text-2xl font-black leading-none" style={{ color: tauxGlobalColor, fontFamily: "Sora" }}>{tauxGlobal}%</span>
          <span className="text-xs mt-0.5 font-medium" style={{ color: tauxGlobalColor }}>global</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: `${C.green}10`, border: `1px solid ${C.green}25` }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${C.green}20`, fontSize: 16 }}>✓</div>
          <div>
            <p className="text-xl font-black leading-none" style={{ color: C.green, fontFamily: "Sora" }}>{totalRealisees}</p>
            <p className="text-xs mt-0.5" style={{ color: C.green }}>ont realise leurs taches</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: `${C.rose}10`, border: `1px solid ${C.rose}25` }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${C.rose}20`, fontSize: 16 }}>✗</div>
          <div>
            <p className="text-xl font-black leading-none" style={{ color: C.rose, fontFamily: "Sora" }}>{totalSalaries - totalRealisees}</p>
            <p className="text-xs mt-0.5" style={{ color: C.rose }}>n ont pas realise</p>
          </div>
        </div>
      </div>

      {tachesParPoste.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm font-medium" style={{ color: C.muted }}>Aucune donnee disponible</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
          {tachesParPoste.map(g => <PosteAccordion key={g.positionId} groupe={g} />)}
        </div>
      )}
    </Card>
  );
};

// ─── StatutParcoursCard ───────────────────────────────────────────────────────
const StatutParcoursCard = ({
  enCours,
  termines,
  collaborateursActifs,
  posMap,
}: {
  enCours: Parcours[];
  termines: Parcours[];
  collaborateursActifs: User[];
  posMap: Map<string, string>;
}) => {
  const [hovered, setHovered] = useState<"encours" | "termines" | null>(null);
  const total2 = enCours.length + termines.length;

  // Résoudre les salariés d'une liste de parcours
  const getSalaries = (parcours: Parcours[]) =>
    parcours.map((p) => {
      const u = collaborateursActifs.find((u) => u.id === p.userId);
      return {
        id: p.id,
        prenom: u?.prenom ?? "—",
        nom: u?.nom ?? "—",
        poste: posMap.get(p.positionId) ?? "—",
        progression: p.progression ?? 0,
        statut: p.statut,
      };
    });

  const salariesEnCours  = getSalaries(enCours);
  const salariesTermines = getSalaries(termines);

  const badges = [
    {
      key: "encours" as const,
      label: "En cours",
      value: enCours.length,
      color: C.cyan,
      bg: "#e0f7ff",
      salaries: salariesEnCours,
      progColor: (p: number) => p >= 75 ? C.green : p >= 40 ? C.cyan : C.amber,
    },
    {
      key: "termines" as const,
      label: "Terminés",
      value: termines.length,
      color: C.green,
      bg: "#f0fdf4",
      salaries: salariesTermines,
      progColor: (_: number) => C.green,
    },
  ];

  return (
    <Card style={{ position: "relative" }}>
      <SectionHeader title="Statut des parcours" sub="Survolez En cours ou Terminés pour voir les salariés" />

      {/* Donut 2 segments */}
      <div className="flex justify-center">
        <DonutChart
          segments={[
            { value: enCours.length,  color: C.cyan,  label: "En cours" },
            { value: termines.length, color: C.green, label: "Terminés" },
          ]}
          size={180} stroke={24}
          centerLabel={total2}
          centerSub="parcours"
        />
      </div>

      {/* Badges avec hover */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        {badges.map((b) => (
          <div key={b.key} className="relative">
            <div
              className="text-center p-3 rounded-xl cursor-pointer select-none transition-all"
              style={{
                background: hovered === b.key ? b.color + "22" : b.bg,
                border: `1.5px solid ${hovered === b.key ? b.color : "transparent"}`,
                transform: hovered === b.key ? "scale(1.04)" : "scale(1)",
                transition: "all .18s ease",
              }}
              onMouseEnter={() => setHovered(b.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <p className="text-2xl font-bold leading-none" style={{ color: b.color, fontFamily: "Sora" }}>
                {b.value}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: b.color }}>{b.label}</p>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                {total2 > 0 ? Math.round((b.value / total2) * 100) : 0}%
              </p>
            </div>

            {/* Popover liste salariés */}
            {hovered === b.key && b.salaries.length > 0 && (
              <div
                className="absolute z-50 rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  top: "calc(100% + 10px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 300,
                  background: "var(--surface)",
                  border: `1.5px solid ${b.color}40`,
                  boxShadow: `0 16px 48px rgba(0,0,0,0.18), 0 0 0 1px ${b.color}20`,
                }}
              >
                {/* Header popover */}
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ background: b.color + "12", borderBottom: `1px solid ${b.color}20` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: b.color }}>
                      {b.label} — {b.value} salarié{b.value > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Liste salariés */}
                <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                  {b.salaries.map((s) => (
                    <div key={s.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                      style={{ borderBottom: `1px solid var(--border)` }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${b.color}, ${C.navy})` }}
                      >
                        {s.prenom[0]}{s.nom[0]}
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: C.text }}>
                          {s.prenom} {s.nom}
                        </p>
                        <p className="text-xs truncate" style={{ color: C.muted }}>{s.poste}</p>
                      </div>

                      {/* Progression */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs font-bold" style={{ color: b.progColor(s.progression) }}>
                          {s.progression}%
                        </span>
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${s.progression}%`,
                              background: b.progColor(s.progression),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { data: users = [], isLoading: loadingUsers } = useQuery({ queryKey: ["allUsers"], queryFn: getAllUsersApi });
  const { data: allParcours = [], isLoading: loadingParcours } = useQuery({ queryKey: ["allParcours"], queryFn: getAllParcoursApi });
  const { data: positions = [] } = useQuery({ queryKey: ["positions"], queryFn: getPositionsApi });
  const { data: terminesRaw = [], isLoading: loadingTermines } = useQuery({ queryKey: ["parcoursTermines"], queryFn: getParcoursTerminesApi });
  const { data: feedbackStats } = useQuery({ queryKey: ["feedbackStatistics"], queryFn: getFeedbackStatisticsApi });
  const { data: allFeedbacks = [] } = useQuery({ queryKey: ["allFeedbacks"], queryFn: getAllFeedbacksApi });
  const { data: allAffectations = [] } = useQuery({
  queryKey: ["allAffectations"],
  queryFn: getAllAffectationsApi,
});
  const loading = loadingUsers || loadingParcours || loadingTermines;

  // ── Collaborateurs actifs (pas ADMIN, DESACTIVE, EXPIRE) ─────────────────
  const collaborateursActifs = useMemo(() => (users as User[]).filter(isActif), [users]);
  const actifIds = useMemo(() => new Set(collaborateursActifs.map((u) => u.id)), [collaborateursActifs]);

  // ── Parcours filtrés sur actifs ───────────────────────────────────────────
  const parcoursActifs = useMemo(
    () => (allParcours as Parcours[]).filter((p) => actifIds.has(p.userId)),
    [allParcours, actifIds]
  );
  const enCours = useMemo(() => parcoursActifs.filter((p) => p.statut === "EN_COURS"), [parcoursActifs]);
  const termines = useMemo(() => parcoursActifs.filter((p) => p.statut === "TERMINE"), [parcoursActifs]);
  const expires = useMemo(() => parcoursActifs.filter((p) => p.statut === "EXPIRE"), [parcoursActifs]);

  // ── Parcours terminés enrichis (actifs seulement) ─────────────────────────
  const terminesEnrichis = useMemo(
    () => (terminesRaw as { parcours: Parcours; salarie: User | null; tasks: Task[] }[])
      .filter((t) => t.salarie && actifIds.has(t.salarie.id)),
    [terminesRaw, actifIds]
  );

  // ── Postes map ────────────────────────────────────────────────────────────
  const posMap = useMemo(() => {
    const m = new Map<string, string>();
    (positions as Position[]).forEach((p) => m.set(p.id, p.titre));
    return m;
  }, [positions]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const total = parcoursActifs.length;
  const progressionMoy = enCours.length
    ? Math.round(enCours.reduce((a, p) => a + (p.progression ?? 0), 0) / enCours.length)
    : 0;

  const avecDuree = terminesEnrichis.filter((t) => t.parcours.dateFin);
  const tempsMoyJours = avecDuree.length
    ? Math.round(avecDuree.reduce((a, t) => a + daysBetween(t.parcours.dateDebut, t.parcours.dateFin), 0) / avecDuree.length)
    : 0;

  // ── Tâches ────────────────────────────────────────────────────────────────
  const allTasks = useMemo(() => terminesEnrichis.flatMap((t) => t.tasks), [terminesEnrichis]);
  const tasksDone = useMemo(() => allTasks.filter((t) => t.statut === "TERMINE" && t.dateCompletion), [allTasks]);
  const tasksDansDelai = useMemo(() => tasksDone.filter((t) => {
    if (!t.echeance || !t.dateCompletion) return true;
    return new Date(t.dateCompletion) <= new Date(t.echeance);
  }), [tasksDone]);
  const tauxDelai = tasksDone.length ? Math.round((tasksDansDelai.length / tasksDone.length) * 100) : 0;

  // Tasks par type (toutes tâches actifs — en cours + terminées)
  const allTasksActifs = useMemo(() => {
    const fromTermines = allTasks;
    return fromTermines;
  }, [allTasks]);

  const tasksParType = useMemo(() => (["FORMATION", "QUIZ", "ENTRETIEN", "SIMPLE"] as const).map((type) => ({
    label: type === "FORMATION" ? "Formation" : type === "QUIZ" ? "Quiz" : type === "ENTRETIEN" ? "Entretien" : "Simple",
    value: allTasksActifs.filter((t) => t.taskType === type).length,
    color: type === "FORMATION" ? C.cyan : type === "QUIZ" ? C.violet : type === "ENTRETIEN" ? C.green : C.amber,
  })), [allTasksActifs]);

  // ── Répartition par poste ─────────────────────────────────────────────────
  const POSTE_COLORS = [C.cyan, C.navy, C.green, C.violet, C.amber, C.rose];
  const repartitionPoste = useMemo(() => {
    const counts = new Map<string, number>();
    enCours.forEach((p) => {
      const titre = posMap.get(p.positionId) ?? "Autre";
      counts.set(titre, (counts.get(titre) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([titre, count], i) => ({ label: titre, value: count, color: POSTE_COLORS[i % POSTE_COLORS.length] }));
  }, [enCours, posMap]);

  // ── Évolution mensuelle (basé sur dateDebut des parcours) ─────────────────
  const evolutionMensuelle = useMemo(() => {
    const mois = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { label: mois[d.getMonth()], month: d.getMonth(), year: d.getFullYear() };
    });
    return months.map((m) => ({
      x: m.label,
      y: parcoursActifs.filter((p) => {
        const d = new Date(p.dateDebut);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).length,
    }));
  }, [parcoursActifs]);

  // ── Durée histogramme ─────────────────────────────────────────────────────
  const dureeHistogram = useMemo(() => {
    const buckets = [
      { label: "<7j", min: 0, max: 6 },
      { label: "1-2s", min: 7, max: 14 },
      { label: "2-4s", min: 15, max: 28 },
      { label: "1-2m", min: 29, max: 60 },
      { label: ">2m", min: 61, max: Infinity },
    ];
    return buckets.map((b) => ({
      label: b.label,
      value: avecDuree.filter((t) => {
        const d = daysBetween(t.parcours.dateDebut, t.parcours.dateFin);
        return d >= b.min && d <= b.max;
      }).length,
      color: C.navy,
    }));
  }, [avecDuree]);

  // ── Distribution progression (tranches) ───────────────────────────────────
  const distProgression = useMemo(() => [
    { label: "0%", value: enCours.filter((p) => (p.progression ?? 0) === 0).length, color: "#DDE5F0" },
    { label: "1–25%", value: enCours.filter((p) => (p.progression ?? 0) >= 1 && (p.progression ?? 0) <= 25).length, color: C.amber },
    { label: "26–50%", value: enCours.filter((p) => (p.progression ?? 0) >= 26 && (p.progression ?? 0) <= 50).length, color: C.violet },
    { label: "51–75%", value: enCours.filter((p) => (p.progression ?? 0) >= 51 && (p.progression ?? 0) <= 75).length, color: C.cyan },
    { label: "76–99%", value: enCours.filter((p) => (p.progression ?? 0) >= 76 && (p.progression ?? 0) <= 99).length, color: C.green },
    { label: "100%", value: enCours.filter((p) => (p.progression ?? 0) === 100).length, color: C.green },
  ], [enCours]);

  const gaugeColor = tauxDelai >= 80 ? C.green : tauxDelai >= 60 ? C.amber : C.rose;

  // ── Tâches réalisées par poste ────────────────────────────────────────────
  const tachesParPoste = useMemo(() => {
    // Group all enriched parcours by positionId
    const groups = new Map<string, {
      positionId: string;
      titrePose: string;
      salaries: {
        userId: string;
        prenom: string;
        nom: string;
        totalTaches: number;
        tachesRealisees: number;
        tachesEnRetard: number;
        taux: number;
      }[];
    }>();

    terminesEnrichis.forEach(({ parcours, salarie, tasks }) => {
      if (!salarie) return;
      const titrePose = posMap.get(parcours.positionId) ?? "Poste inconnu";
      if (!groups.has(parcours.positionId)) {
        groups.set(parcours.positionId, { positionId: parcours.positionId, titrePose, salaries: [] });
      }
      const doneTasks = tasks.filter(t => t.statut === "TERMINE" && t.dateCompletion);
      const dansDelais = doneTasks.filter(t => {
        if (!t.echeance || !t.dateCompletion) return true;
        return new Date(t.dateCompletion) <= new Date(t.echeance);
      });
      const enRetard = doneTasks.length - dansDelais.length;
      const taux = doneTasks.length > 0
        ? Math.round((dansDelais.length / doneTasks.length) * 100)
        : tasks.length === 0 ? 0 : 0;

      groups.get(parcours.positionId)!.salaries.push({
        userId: salarie.id,
        prenom: salarie.prenom ?? "",
        nom: salarie.nom ?? "",
        totalTaches: tasks.length,
        tachesRealisees: dansDelais.length,
        tachesEnRetard: enRetard,
        taux,
      });
    });

    // Add en-cours parcours too (tasks without dateCompletion → not done)
    enCours.forEach(p => {
      const u = collaborateursActifs.find(u => u.id === p.userId);
      if (!u) return;
      const titrePose = posMap.get(p.positionId) ?? "Poste inconnu";
      if (!groups.has(p.positionId)) {
        groups.set(p.positionId, { positionId: p.positionId, titrePose, salaries: [] });
      }
      // en-cours: taux basé sur progression seulement
      groups.get(p.positionId)!.salaries.push({
        userId: u.id,
        prenom: u.prenom ?? "",
        nom: u.nom ?? "",
        totalTaches: 0,
        tachesRealisees: 0,
        tachesEnRetard: 0,
        taux: p.progression ?? 0,
      });
    });

    return Array.from(groups.values())
      .map(g => {
        const tauxMoyen = g.salaries.length > 0
          ? Math.round(g.salaries.reduce((a, s) => a + s.taux, 0) / g.salaries.length)
          : 0;
        const realisees = g.salaries.filter(s => s.taux >= 80);
        const nonRealisees = g.salaries.filter(s => s.taux < 80);
        return { ...g, tauxMoyen, realisees, nonRealisees };
      })
      .sort((a, b) => b.tauxMoyen - a.tauxMoyen);
  }, [terminesEnrichis, enCours, collaborateursActifs, posMap]);

  // ── Progression globale des salariés (pour la nouvelle card) ─────────────
  const progressionGlobale = useMemo(() => {
    return parcoursActifs.map((p) => {
      const user = collaborateursActifs.find((u) => u.id === p.userId);
      const joursEcoules = daysBetween(p.dateDebut);
      const joursRestants = 30 - joursEcoules;
      const prog = p.progression ?? 0;

      // Phase basée sur progression
      const phase =
        p.statut === "TERMINE" ? "Terminé"
        : prog >= 80 ? "Validation"
        : prog >= 50 ? "Montée en compétence"
        : prog >= 20 ? "Intégration"
        : "Pré-onboarding";

      // Statut : bloqué si quiz verrouillé, à risque si retard, ok sinon
      const hasBlockedQuiz = false; // sans accès aux tasks depuis ici
      const statut: "ok" | "risque" | "bloque" =
        p.statut === "EXPIRE" ? "bloque"
        : joursRestants < 0 && prog < 100 ? "risque"
        : prog < 30 && joursEcoules > 10 ? "risque"
        : "ok";

      return {
        userId: p.userId,
        prenom: user?.prenom ?? "",
        nom: user?.nom ?? "",
        poste: posMap.get(p.positionId) ?? "",
        progression: prog,
        phase,
        joursRestants,
        statut,
      };
    }).sort((a, b) => {
      // Bloqués en premier, puis à risque, puis ok — et par progression décroissante
      const order: Record<"bloque" | "risque" | "ok", number> = { bloque: 0, risque: 1, ok: 2 };
      const aOrder = order[a.statut as keyof typeof order];
      const bOrder = order[b.statut as keyof typeof order];
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.progression - a.progression;
    });
  }, [parcoursActifs, collaborateursActifs, posMap]);

  // ── Meilleurs managers ────────────────────────────────────────────────────
  const meilleursManagers = useMemo(() => {
  const managers = (users as User[]).filter((u) => u.role === "MANAGER");
  const affectations = allAffectations as { userId: string; managerId: string }[];

  return managers.map((mgr) => {
    // Trouver les salariés via Affectation.managerId
    const teamUserIds = new Set(
      affectations
        .filter((a) => a.managerId === mgr.id)
        .map((a) => a.userId)
    );
    const teamMembers = (users as User[]).filter((u) => teamUserIds.has(u.id));
    const teamParcours = (allParcours as Parcours[]).filter((p) => teamUserIds.has(p.userId));
    const total = teamParcours.length;
    const terminesEnTemps = teamParcours.filter((p) => {
      if (p.statut !== "TERMINE" || !p.dateFin) return false;
      return daysBetween(p.dateDebut, p.dateFin) <= 30;
    }).length;
    const taux = total > 0 ? Math.round((terminesEnTemps / total) * 100) : 0;
    const progMoy = total > 0
      ? Math.round(teamParcours.reduce((a, p) => a + (p.progression ?? 0), 0) / total)
      : 0;
    return { mgr, total, terminesEnTemps, taux, progMoy, teamSize: teamMembers.length };
  })
  .filter((m) => m.teamSize > 0)
  .sort((a, b) => b.taux - a.taux || b.progMoy - a.progMoy);
}, [users, allParcours, allAffectations]);

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: C.bg }}>
        <Sidebar role="ADMIN" />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: C.cyan }} />
            <p className="text-sm font-medium" style={{ color: C.muted }}>Chargement des données…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>
      <Sidebar role="ADMIN" />
      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav showSearch={false} />

        <div className="px-8 py-8 page-enter" style={{ maxWidth: 1400 }}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(to bottom, ${C.cyan}, ${C.navy})` }} />
                <h1 className="text-2xl font-bold" style={{ color: C.text, fontFamily: "Sora" }}>
                  Analytics Onboarding
                </h1>
              </div>
              <p className="text-sm ml-3.5" style={{ color: C.muted }}>
                Collaborateurs actifs uniquement · admins &amp; désactivés exclus
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.green }} />
              Données en temps réel
            </div>
          </div>

          {/* ── KPI Row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-5 mb-8">
            <KpiCard icon="🚀" label="Onboardings actifs" value={enCours.length}
              sub={`sur ${total} parcours au total`} color={C.cyan} bg="#e0f7ff" delta={`+${enCours.length}`} />
            <KpiCard icon="✅" label="Parcours terminés" value={termines.length}
              sub={`${total > 0 ? Math.round((termines.length / total) * 100) : 0}% de complétion`}
              color={C.green} bg="#f0fdf4" />
            <KpiCard icon="⏱️" label="Temps moyen" value={tempsMoyJours}
              sub="jours pour finir un onboarding" color={C.violet} bg="#f5f3ff" suffix="j" />
            <KpiCard icon="🎯" label="Taux ponctualité" value={tauxDelai}
              sub="des tâches dans les délais" color={gaugeColor} bg={`${gaugeColor}15`} suffix="%" />
          </div>

          {/* ── Row 1 : Donut statuts + Area évolution ───────────────────── */}
          <div className="grid grid-cols-3 gap-6 mb-6">

            {/* Donut statuts */}
            <StatutParcoursCard
              enCours={enCours}
              termines={termines}
              collaborateursActifs={collaborateursActifs}
              posMap={posMap}
            />

            {/* Area chart évolution */}
            <Card className="col-span-2">
              <SectionHeader title="Évolution des onboardings" sub="Nouveaux parcours démarrés (6 derniers mois)" />
              <AreaChart data={evolutionMensuelle} color={C.cyan} height={160} width={500} />
              <div className="flex items-center justify-between mt-3 pt-3"
                style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: C.cyan }} />
                  <span className="text-xs" style={{ color: C.muted }}>Nouveaux parcours démarrés</span>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-lg"
                  style={{ background: "#e0f7ff", color: C.cyan }}>
                  Total : {total} parcours
                </span>
              </div>
            </Card>
          </div>

          {/* ── Row 2 : Gauge tâches + Bar répartition poste ────────────── */}
          <div className="grid grid-cols-2 gap-6 mb-6">

            {/* Tâches réalisées par poste */}
            <TachesParPosteCard tachesParPoste={tachesParPoste} />

            {/* Répartition par poste */}
            <Card>
              <SectionHeader title="Répartition par poste"
                sub={`${enCours.length} onboarding${enCours.length !== 1 ? "s" : ""} actifs`} />
              {repartitionPoste.length > 0 ? (
                <div className="flex gap-6 items-center">
                  <DonutChart
                    segments={repartitionPoste}
                    size={150} stroke={20}
                    centerLabel={enCours.length}
                    centerSub="actifs"
                  />
                  <div className="flex-1 space-y-2.5">
                    {repartitionPoste.map((r, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                          <span className="text-sm truncate max-w-[130px]" style={{ color: C.text }}>{r.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: r.color }}>{r.value}</span>
                          <span className="text-xs" style={{ color: C.muted }}>
                            ({enCours.length > 0 ? Math.round((r.value / enCours.length) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm" style={{ color: C.muted }}>Aucun onboarding actif</p>
                </div>
              )}
            </Card>
          </div>

          {/* ── Row 3 : Progression actifs + Progression globale salariés ── */}
          <div className="grid grid-cols-2 gap-6 mb-6">

            <Card>
              <SectionHeader title="Progression des onboardings actifs"
                sub={`${enCours.length} parcours en cours · moy. ${progressionMoy}%`} />
              <div className="mb-4">
                <BarChart data={distProgression} height={160} />
              </div>
              {/* Progression moyenne barre */}
              <div className="pt-4 border-t" style={{ borderColor: C.border }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: C.text }}>Progression moyenne</span>
                  <span className="font-bold text-lg" style={{ color: C.cyan, fontFamily: "Sora" }}>
                    {progressionMoy}%
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: `${progressionMoy}%`,
                      background: `linear-gradient(to right, ${C.cyan}, ${C.navy})`,
                      transition: "width 1s cubic-bezier(.4,0,.2,1)",
                      boxShadow: `0 0 8px ${C.cyan}60`,
                    }} />
                </div>
              </div>
            </Card>

            {/* Progression globale des salariés */}
            <ProgressionGlobaleCard progressionGlobale={progressionGlobale} parcoursActifsLength={parcoursActifs.length} />
          </div>

          {/* ── Meilleurs managers ──────────────────────────────────────── */}
          {meilleursManagers.length > 0 && (
            <>
              <Divider label="Championnat des managers — efficacité d'accompagnement" />
              <ManagerChampionship managers={meilleursManagers} />
            </>
          )}

          {/* ── Tableau détaillé ─────────────────────────────────────────── */}
          <Divider label="Détail par collaborateur" />
          <div className="mt-6 card overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <h2 className="text-base font-bold" style={{ color: C.text, fontFamily: "Sora" }}>
                Collaborateurs actifs en onboarding
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ background: "#e0f7ff", color: C.cyan }}>
                  {enCours.length} en cours
                </span>
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ background: "#f0fdf4", color: C.green }}>
                  {termines.length} terminés
                </span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                    {["Collaborateur", "Rôle", "Poste", "Statut parcours", "Progression", "Démarré le"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide"
                        style={{ color: C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...enCours, ...termines, ...expires].slice(0, 20).map((p) => {
                    const user = collaborateursActifs.find((u) => u.id === p.userId);
                    if (!user) return null;
                    const prog = p.progression ?? 0;
                    const progColor = prog === 100 ? C.green : prog >= 50 ? C.cyan : prog > 0 ? C.amber : C.muted;
                    const statutMeta = {
                      EN_COURS: { label: "En cours", color: C.cyan, bg: "#e0f7ff" },
                      TERMINE: { label: "Terminé", color: C.green, bg: "#f0fdf4" },
                      EXPIRE: { label: "Expiré", color: C.rose, bg: "#fff1f2" },
                    }[p.statut];
                    return (
                      <tr key={p.id} className="transition-colors"
                        style={{ borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.navy})` }}>
                              {user.prenom[0]}{user.nom[0]}
                            </div>
                            <div>
                              <p className="font-semibold" style={{ color: C.text }}>{user.prenom} {user.nom}</p>
                              <p className="text-xs" style={{ color: C.muted }}>{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-semibold px-2 py-1 rounded-lg"
                            style={{
                              background: user.role === "MANAGER" ? "#f5f3ff" : "#e0f7ff",
                              color: user.role === "MANAGER" ? C.violet : C.cyan,
                            }}>
                            {user.role === "MANAGER" ? "Manager" : "Salarié"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-medium" style={{ color: C.text }}>
                            {posMap.get(p.positionId) ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: statutMeta.bg, color: statutMeta.color }}>
                            {statutMeta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <ProgressRing value={prog} color={progColor} size={32} stroke={4} />
                            <span className="text-sm font-bold tabular-nums" style={{ color: progColor }}>
                              {prog}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs" style={{ color: C.muted }}>
                            {new Date(p.dateDebut).toLocaleDateString("fr-FR", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {enCours.length === 0 && termines.length === 0 && expires.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: C.muted }}>
                        Aucun parcours trouvé pour les collaborateurs actifs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {(enCours.length + termines.length + expires.length) > 20 && (
              <div className="px-6 py-3 text-center text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
                Affichage des 20 premiers résultats
              </div>
            )}
          </div>

          <div className="h-8" />

          {/* ── Section Feedback ──────────────────────────────────────────── */}
          {feedbackStats && (
            <>
              <Divider label="Évaluation & Feedback d'intégration" />

              {feedbackStats.total === 0 ? (
                <div className="mt-6 card p-12 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-base font-semibold" style={{ color: C.text, fontFamily: "Sora" }}>
                    Aucune évaluation soumise pour l'instant
                  </p>
                  <p className="text-sm mt-1" style={{ color: C.muted }}>
                    Les statistiques apparaîtront une fois que des salariés auront soumis leur évaluation d'intégration.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* KPI feedback row */}
                  <div className="grid grid-cols-4 gap-5">
                    <KpiCard icon="📊" label="Évaluations reçues" value={feedbackStats.total}
                      sub="questionnaires soumis" color={C.cyan} bg="#e0f7ff" />
                    <KpiCard icon="😊" label="Taux de satisfaction" value={feedbackStats.tauxSatisfactionGlobale}
                      sub="salariés satisfaits ou très satisfaits" color={C.green} bg="#f0fdf4" suffix="%" />
                    <KpiCard icon="👍" label="Taux de recommandation" value={feedbackStats.tauxRecommandation}
                      sub="recommandent le processus" color={C.violet} bg="#f5f3ff" suffix="%" />
                    <KpiCard icon="⚠️" label="Taux de difficultés" value={feedbackStats.tauxDifficultes}
                      sub="ont rencontré des difficultés" color={C.amber} bg="#fffbeb" suffix="%" />
                  </div>

                  {/* Scores moyens + Distribution */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Scores moyens par section */}
                    <Card>
                      <SectionHeader title="Scores moyens par dimension" sub="Évaluation sur 4 points" />
                      <div className="space-y-4">
                        {[
                          { label: "Qualité de l'accueil", value: feedbackStats.moyenneAccueil, max: 4, color: C.cyan },
                          { label: "Accompagnement manager", value: feedbackStats.moyenneManager, max: 4, color: C.violet },
                          { label: "Adaptation des tâches", value: feedbackStats.moyenneTaches, max: 4, color: C.green },
                          { label: "Facilité de la plateforme", value: feedbackStats.moyennePlateforme, max: 4, color: C.amber },
                        ].map((item) => {
                          const pct = (item.value / item.max) * 100;
                          const scoreColor = pct >= 75 ? C.green : pct >= 50 ? C.amber : C.rose;
                          return (
                            <div key={item.label}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm" style={{ color: C.text }}>{item.label}</span>
                                <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor, fontFamily: "Sora" }}>
                                  {item.value}/4
                                </span>
                              </div>
                              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                                <div className="h-full rounded-full transition-all duration-1000"
                                  style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
                                  }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Distribution satisfaction globale */}
                    <Card>
                      <SectionHeader title="Distribution satisfaction globale" sub={`${feedbackStats.total} réponses`} />
                      {feedbackStats.distributionSatisfaction && (
                        <div className="space-y-3">
                          {[
                            { label: "Très satisfait", key: "Très satisfait", color: C.green, emoji: "🌟" },
                            { label: "Satisfait", key: "Satisfait", color: C.cyan, emoji: "😊" },
                            { label: "Peu satisfait", key: "Peu satisfait", color: C.amber, emoji: "😐" },
                            { label: "Insatisfait", key: "Insatisfait", color: C.rose, emoji: "😔" },
                          ].map((item) => {
                            const val = feedbackStats.distributionSatisfaction[item.key] || 0;
                            const pct = feedbackStats.total > 0 ? Math.round((val / feedbackStats.total) * 100) : 0;
                            return (
                              <div key={item.key} className="flex items-center gap-3">
                                <span className="text-sm w-36 flex-shrink-0" style={{ color: C.text }}>
                                  {item.emoji} {item.label}
                                </span>
                                <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: C.border }}>
                                  <div className="h-full rounded-lg flex items-center transition-all duration-900"
                                    style={{
                                      width: `${pct}%`,
                                      background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
                                    }}>
                                    {pct > 15 && (
                                      <span className="ml-2 text-xs font-bold text-white">{val}</span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs font-bold w-10 text-right flex-shrink-0"
                                  style={{ color: item.color }}>
                                  {pct}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Gauge recommandation */}
                      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold" style={{ color: C.text }}>
                            👍 NPS — Recommandation
                          </span>
                          <span className="text-xl font-bold" style={{ color: feedbackStats.tauxRecommandation >= 70 ? C.green : C.amber, fontFamily: "Sora" }}>
                            {feedbackStats.tauxRecommandation}%
                          </span>
                        </div>
                        <div className="h-3 rounded-full overflow-hidden" style={{ background: C.border }}>
                          <div className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${feedbackStats.tauxRecommandation}%`,
                              background: feedbackStats.tauxRecommandation >= 70
                                ? `linear-gradient(90deg, ${C.green}cc, ${C.green})`
                                : `linear-gradient(90deg, ${C.amber}cc, ${C.amber})`,
                            }} />
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Suggestions + Difficultés */}
                  {((feedbackStats.suggestions?.length > 0) || (feedbackStats.difficultesList?.length > 0)) && (
                    <div className="grid grid-cols-2 gap-6">
                      {feedbackStats.suggestions?.length > 0 && (
                        <Card>
                          <SectionHeader title="💡 Suggestions d'amélioration"
                            sub={`${feedbackStats.suggestions.length} suggestion${feedbackStats.suggestions.length > 1 ? "s" : ""}`} />
                          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {feedbackStats.suggestions.map((sug: string, i: number) => (
                              <div key={i} className="px-4 py-3 rounded-xl text-sm"
                                style={{ background: `${C.cyan}08`, border: `1px solid ${C.cyan}20`, color: C.text }}>
                                <span className="mr-2 text-xs" style={{ color: C.cyan }}>💬</span>
                                {sug}
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                      {feedbackStats.difficultesList?.length > 0 && (
                        <Card>
                          <SectionHeader title="⚠️ Difficultés fréquentes"
                            sub={`${feedbackStats.difficultesList.length} signalement${feedbackStats.difficultesList.length > 1 ? "s" : ""}`} />
                          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {feedbackStats.difficultesList.map((diff: string, i: number) => (
                              <div key={i} className="px-4 py-3 rounded-xl text-sm"
                                style={{ background: `${C.amber}08`, border: `1px solid ${C.amber}20`, color: C.text }}>
                                <span className="mr-2 text-xs" style={{ color: C.amber }}>⚠️</span>
                                {diff}
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Feedback table */}
                  {allFeedbacks.length > 0 && (
                    <>
                      <Divider label="Détail des évaluations" />
                      <div className="mt-4 card overflow-hidden">
                        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                          <h2 className="text-base font-bold" style={{ color: C.text, fontFamily: "Sora" }}>
                            Évaluations individuelles
                          </h2>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                                {["Collaborateur", "Poste", "Accueil", "Manager", "Tâches", "Plateforme", "Satisfaction", "Recommande", "Date"].map((h) => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide"
                                    style={{ color: C.muted }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {allFeedbacks.map((fb: any) => {
                                const satMeta = [
                                  { min: 4, label: "Très satisfait", color: C.green, bg: "#f0fdf4" },
                                  { min: 3, label: "Satisfait", color: C.cyan, bg: "#e0f7ff" },
                                  { min: 2, label: "Peu satisfait", color: C.amber, bg: "#fffbeb" },
                                  { min: 1, label: "Insatisfait", color: C.rose, bg: "#fff1f2" },
                                ].find((m) => fb.satisfactionGlobale >= m.min) || { label: "—", color: C.muted, bg: C.border };
                                const scoreColor = (v: number, max = 4) =>
                                  v / max >= 0.75 ? C.green : v / max >= 0.5 ? C.amber : C.rose;
                                return (
                                  <tr key={fb.id} className="transition-colors"
                                    style={{ borderBottom: `1px solid ${C.border}` }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                          style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.navy})` }}>
                                          {fb.salariePrenom?.[0]}{fb.salarieNom?.[0]}
                                        </div>
                                        <span className="font-semibold" style={{ color: C.text }}>
                                          {fb.salariePrenom} {fb.salarieNom}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs" style={{ color: C.muted }}>{fb.poste || "—"}</span>
                                    </td>
                                    {[fb.qualiteAccueil, fb.accompagnementManager, fb.adaptationTaches, fb.faciliteUtilisation].map((v, i) => (
                                      <td key={i} className="px-4 py-3">
                                        <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(v), fontFamily: "Sora" }}>
                                          {v}/4
                                        </span>
                                      </td>
                                    ))}
                                    <td className="px-4 py-3">
                                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                                        style={{ background: satMeta.bg, color: satMeta.color }}>
                                        {satMeta.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span style={{ color: fb.recommandeProcessus ? C.green : C.rose }}>
                                        {fb.recommandeProcessus ? "✅ Oui" : "❌ Non"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs" style={{ color: C.muted }}>
                                        {fb.dateSubmission ? new Date(fb.dateSubmission).toLocaleDateString("fr-FR", {
                                          day: "2-digit", month: "short", year: "numeric",
                                        }) : "—"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="h-8" />
        </div>
      </main>
    </div>
  );
};

export default AnalyticsPage;