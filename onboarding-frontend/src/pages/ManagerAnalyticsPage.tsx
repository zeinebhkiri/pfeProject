import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getMyTeamApi,
  getTeamParcoursApi,
  getAssignedTasksApi,
  getFeedbackStatisticsApi,
  getAllFeedbacksApi,
} from "../api/authApi";
import { type User, type Parcours, type Task } from "../types/auth";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";

// ─── utils ────────────────────────────────────────────────────────────────────
const daysBetween = (a: string, b?: string) =>
  Math.max(0, Math.round((new Date(b ?? Date.now()).getTime() - new Date(a).getTime()) / 86_400_000));

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

// Brand palette
const C = {
  navy:    "#1A2B6B",
  cyan:    "#00AEEF",
  green:   "#8DC63F",
  violet:  "#7C3AED",
  amber:   "#F59E0B",
  rose:    "#F43F5E",
  muted:   "var(--text-muted)",
  border:  "var(--border)",
  surface: "var(--surface)",
  text:    "var(--text)",
  bg:      "var(--bg)",
};

// ─── useCountUp ───────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start: number | null = null;
    const raf = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration]);
  return val;
}
const AnimNum = ({ n, s = "" }: { n: number; s?: string }) => {
  const v = useCountUp(n); return <>{v}{s}</>;
};

// ─── DonutChart ───────────────────────────────────────────────────────────────
const DonutChart = ({
  segments, size = 160, stroke = 22, centerLabel, centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number; stroke?: number; centerLabel?: string | number; centerSub?: string;
}) => {
  const [hov, setHov] = useState<number | null>(null);
  const total = segments.reduce((s, d) => s + d.value, 0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let off = 0;
  const arcs = segments.map((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0;
    const arc = { ...seg, dash: pct * circ, gap: circ - pct * circ, offset: off * circ, i };
    off += pct; return arc;
  });
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {total === 0 && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />}
          {arcs.map((a) => (
            <circle key={a.i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={a.color} strokeWidth={hov === a.i ? stroke + 5 : stroke}
              strokeDasharray={`${a.dash - 2} ${a.gap + 2}`} strokeDashoffset={-a.offset}
              strokeLinecap="round"
              style={{ transition: "stroke-width .2s ease, stroke-dasharray .8s cubic-bezier(.4,0,.2,1)",
                       cursor: "pointer", opacity: hov !== null && hov !== a.i ? 0.35 : 1 }}
              onMouseEnter={() => setHov(a.i)} onMouseLeave={() => setHov(null)} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {hov !== null ? (
            <>
              <span className="font-bold text-2xl leading-none" style={{ color: segments[hov].color, fontFamily: "Sora" }}>
                {segments[hov].value}
              </span>
              <span className="text-xs mt-1" style={{ color: C.muted }}>{segments[hov].label}</span>
            </>
          ) : (
            <>
              <span className="font-bold leading-none" style={{ fontSize: size*.19, color: C.navy, fontFamily:"Sora" }}>
                {centerLabel ?? total}
              </span>
              {centerSub && <span className="text-xs mt-1" style={{ color: C.muted }}>{centerSub}</span>}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <button key={i} className="flex items-center gap-1.5 transition-opacity"
            style={{ opacity: hov !== null && hov !== i ? .35 : 1 }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
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
const AreaChart = ({ data, color, height = 130 }: {
  data: { x: string; y: number }[]; color: string; height?: number;
}) => {
  const [tooltip, setTooltip] = useState<{ idx: number } | null>(null);
  const W = 500; const pad = { t: 12, b: 28, l: 8, r: 8 };
  const H = height - pad.t - pad.b;
  const max = Math.max(...data.map(d => d.y), 1);
  const pts = data.map((d, i) => ({
    x: pad.l + (i / Math.max(data.length - 1, 1)) * (W - pad.l - pad.r),
    y: pad.t + (1 - d.y / max) * H, v: d.y, lbl: d.x,
  }));
  const line = pts.map((p, i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length-1].x},${pad.t+H} L${pts[0].x},${pad.t+H} Z`;
  const gId = `ag${color.replace(/[^a-z0-9]/gi,"")}`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ overflow:"visible" }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[.25,.5,.75,1].map(t => (
        <line key={t} x1={pad.l} x2={W-pad.r}
          y1={pad.t+(1-t)*H} y2={pad.t+(1-t)*H}
          stroke={C.border} strokeWidth="1" strokeDasharray="4,4" opacity=".5" />
      ))}
      <path d={area} fill={`url(#${gId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="12" fill="transparent"
            onMouseEnter={() => setTooltip({ idx: i })}
            onMouseLeave={() => setTooltip(null)} style={{ cursor:"pointer" }} />
          <circle cx={p.x} cy={p.y} r={tooltip?.idx===i ? 5 : 3}
            fill={color} stroke={C.surface} strokeWidth="2"
            style={{ transition:"r .15s", pointerEvents:"none" }} />
          <text x={p.x} y={pad.t+H+16} textAnchor="middle" fontSize="10" fill={C.muted}>{p.lbl}</text>
        </g>
      ))}
      {tooltip !== null && pts[tooltip.idx] && (
        <g>
          <rect x={pts[tooltip.idx].x-24} y={pts[tooltip.idx].y-34} width={48} height={24} rx="6"
            fill={C.navy} opacity=".92" />
          <text x={pts[tooltip.idx].x} y={pts[tooltip.idx].y-18} textAnchor="middle"
            fontSize="11" fontWeight="700" fill="#fff" fontFamily="Sora">
            {pts[tooltip.idx].v}
          </text>
        </g>
      )}
    </svg>
  );
};

// ─── HBarChart ────────────────────────────────────────────────────────────────
const HBarChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
  const [hov, setHov] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3"
          onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
          <span className="text-xs w-20 text-right truncate flex-shrink-0" style={{ color: C.text }}>{d.label}</span>
          <div className="flex-1 h-7 rounded-xl overflow-hidden relative" style={{ background: C.border }}>
            <div className="h-full rounded-xl flex items-center"
              style={{
                width: `${(d.value/max)*100}%`,
                background: `linear-gradient(90deg, ${d.color}bb, ${d.color})`,
                transition: "width .9s cubic-bezier(.4,0,.2,1)",
                boxShadow: hov===i ? `0 0 14px ${d.color}55` : "none",
              }}>
              {(d.value/max)*100 > 18 &&
                <span className="ml-2.5 text-xs font-bold text-white">{d.value}</span>}
            </div>
            {(d.value/max)*100 <= 18 && d.value > 0 &&
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: C.text }}>{d.value}</span>}
          </div>
          <span className="text-xs font-bold w-8 flex-shrink-0 text-right" style={{ color: d.color }}>
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── VertBarChart ─────────────────────────────────────────────────────────────
const VertBarChart = ({ data, height = 150 }: {
  data: { label: string; value: number; color: string }[]; height?: number;
}) => {
  const [hov, setHov] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-2 w-full" style={{ height }}>
      {data.map((d, i) => {
        const bH = Math.max((d.value/max)*(height-36), d.value > 0 ? 6 : 0);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1"
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <span className="text-xs font-bold" style={{ color: d.color, minHeight: 18, opacity: d.value>0?1:0 }}>
              {d.value}
            </span>
            <div className="w-full relative" style={{ height: height-36 }}>
              <div className="absolute bottom-0 w-full rounded-t-xl"
                style={{
                  height: bH,
                  background: hov===i
                    ? `linear-gradient(to top, ${d.color}, ${d.color}cc)`
                    : `linear-gradient(to top, ${d.color}bb, ${d.color}88)`,
                  transition: "height .9s cubic-bezier(.4,0,.2,1), background .2s",
                  boxShadow: hov===i ? `0 -4px 16px ${d.color}50` : "none",
                }} />
            </div>
            <span className="text-center leading-tight" style={{ color: C.muted, fontSize: 10 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── GaugeArc ─────────────────────────────────────────────────────────────────
const GaugeArc = ({ value, color, size = 148 }: { value: number; color: string; size?: number }) => {
  const r = (size - 20) / 2;
  const circ = Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="relative flex items-end justify-center" style={{ width: size, height: size/2 + 24 }}>
      <svg width={size} height={size/2+8} viewBox={`0 0 ${size} ${size/2+8}`}>
        <path d={`M 10 ${size/2} A ${r} ${r} 0 0 1 ${size-10} ${size/2}`}
          fill="none" stroke={C.border} strokeWidth="15" strokeLinecap="round" />
        <path d={`M 10 ${size/2} A ${r} ${r} 0 0 1 ${size-10} ${size/2}`}
          fill="none" stroke={color} strokeWidth="15" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ-dash}`}
          style={{ transition:"stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <span className="text-3xl font-bold leading-none" style={{ color, fontFamily:"Sora" }}>
          <AnimNum n={Math.round(value)} s="%" />
        </span>
      </div>
    </div>
  );
};

// ─── ProgressRing ─────────────────────────────────────────────────────────────
const ProgressRing = ({ value, color, size = 44, stroke = 4 }: {
  value: number; color: string; size?: number; stroke?: number;
}) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(value/100)*circ} ${circ-(value/100)*circ}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray .8s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
};

// ─── KpiCard ──────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color, bg, suffix="" }: {
  icon:string; label:string; value:number; sub?:string;
  color:string; bg:string; suffix?:string;
}) => (
  <div className="stat-card group cursor-default">
    <div className="flex items-start justify-between mb-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110"
        style={{ background: bg }}>{icon}</div>
    </div>
    <p className="text-4xl font-bold leading-none tabular-nums" style={{ color, fontFamily:"Sora" }}>
      <AnimNum n={value} s={suffix} />
    </p>
    <p className="text-sm font-semibold mt-2" style={{ color: C.text }}>{label}</p>
    {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
  </div>
);

// ─── Card / helpers ───────────────────────────────────────────────────────────
const Card = ({ children, className="" }: { children: React.ReactNode; className?: string }) => (
  <div className={`card p-6 ${className}`}>{children}</div>
);
const SH = ({ title, sub }: { title:string; sub?:string }) => (
  <div className="mb-5">
    <h2 className="text-base font-bold" style={{ color: C.text, fontFamily:"Sora" }}>{title}</h2>
    {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
  </div>
);
const Divider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3">
    <div className="h-px flex-1" style={{ background: C.border }} />
    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted, fontFamily:"Sora" }}>{label}</span>
    <div className="h-px flex-1" style={{ background: C.border }} />
  </div>
);

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const StatutBadge = ({ statut }: { statut: string }) => {
  const map: Record<string, { label:string; color:string; bg:string }> = {
    EN_COURS:   { label:"En cours",  color: C.cyan,   bg:"#e0f7ff" },
    TERMINE:    { label:"Terminé",   color: C.green,  bg:"#f0fdf4" },
    EXPIRE:     { label:"Expiré",    color: C.rose,   bg:"#fff1f2" },
    NON_COMMENCE:{ label:"Non démarré", color: C.amber, bg:"#fffbeb" },
  };
  const m = map[statut] ?? { label: statut, color: C.muted, bg: C.border };
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: m.bg, color: m.color }}>{m.label}</span>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const ManagerAnalyticsPage = () => {
  const navigate = useNavigate();

  const { data: team = [], isLoading: lTeam } = useQuery({ queryKey:["myTeam"], queryFn: getMyTeamApi });
  const { data: teamParcours = [], isLoading: lParcours } = useQuery({ queryKey:["teamParcours"], queryFn: getTeamParcoursApi });
  const { data: assignedTasks = [], isLoading: lTasks } = useQuery({ queryKey:["assignedTasks"], queryFn: getAssignedTasksApi });
  const { data: feedbackStats } = useQuery({ queryKey: ["feedbackStatistics"], queryFn: getFeedbackStatisticsApi });
  const { data: allFeedbacks = [] } = useQuery({ queryKey: ["allFeedbacks"], queryFn: getAllFeedbacksApi });

  const loading = lTeam || lParcours || lTasks;

  // ── Équipe active (exclut désactivés/expirés) ─────────────────────────────
  const equipe = useMemo(
    () => (team as User[]).filter(u => u.statutCompte !== "DESACTIVE" && u.statutCompte !== "EXPIRE"),
    [team]
  );
  const equipeIds = useMemo(() => new Set(equipe.map(u => u.id)), [equipe]);

  // ── Parcours de l'équipe ──────────────────────────────────────────────────
  // getTeamParcoursApi renvoie Parcours[] ou {parcours, salarie, tasks}[]
  // on normalise vers Parcours[]
  const parcoursEquipe = useMemo<Parcours[]>(() => {
    const raw = teamParcours as any[];
    return raw.map(item => item.parcours ?? item).filter((p: Parcours) => equipeIds.has(p.userId));
  }, [teamParcours, equipeIds]);

  const parcoursEnCours  = useMemo(() => parcoursEquipe.filter(p => p.statut === "EN_COURS"), [parcoursEquipe]);
  const parcoursTermines = useMemo(() => parcoursEquipe.filter(p => p.statut === "TERMINE"), [parcoursEquipe]);
  const parcoursExpires  = useMemo(() => parcoursEquipe.filter(p => p.statut === "EXPIRE"), [parcoursEquipe]);

  // ── Tâches assignées ──────────────────────────────────────────────────────
  const tasks = assignedTasks as Task[];
  const tasksDone   = useMemo(() => tasks.filter(t => t.statut === "TERMINE" && t.dateCompletion), [tasks]);
  const tasksDansDelai = useMemo(() => tasksDone.filter(t => {
    if (!t.echeance || !t.dateCompletion) return true;
    return new Date(t.dateCompletion) <= new Date(t.echeance);
  }), [tasksDone]);
  const tauxDelai = tasksDone.length ? Math.round((tasksDansDelai.length / tasksDone.length) * 100) : 0;
  const tasksEnAttente = useMemo(() => tasks.filter(t => t.statut === "NON_COMMENCE" || t.statut === "EN_COURS"), [tasks]);

  // ── KPIs équipe ───────────────────────────────────────────────────────────
  const total = parcoursEquipe.length;
  const progressionMoy = parcoursEnCours.length
    ? Math.round(parcoursEnCours.reduce((a, p) => a + (p.progression ?? 0), 0) / parcoursEnCours.length)
    : 0;

  const avecDuree = parcoursTermines.filter(p => p.dateFin);
  const tempsMoyJours = avecDuree.length
    ? Math.round(avecDuree.reduce((a, p) => a + daysBetween(p.dateDebut, p.dateFin), 0) / avecDuree.length)
    : 0;

  // ── Complétion profil équipe ───────────────────────────────────────────────
  const completionMoy = equipe.length
    ? Math.round(equipe.reduce((a, u) => a + u.profilCompletion, 0) / equipe.length)
    : 0;

  // ── Tâches par type ───────────────────────────────────────────────────────
  const tasksParType = useMemo(() =>
    (["FORMATION","QUIZ","ENTRETIEN","SIMPLE"] as const).map(type => ({
      label: type==="FORMATION"?"Formation":type==="QUIZ"?"Quiz":type==="ENTRETIEN"?"Entretien":"Simple",
      value: tasks.filter(t => t.taskType === type).length,
      color: type==="FORMATION"?C.cyan:type==="QUIZ"?C.violet:type==="ENTRETIEN"?C.green:C.amber,
    })), [tasks]);

  // ── Statuts tâches ────────────────────────────────────────────────────────
  const tasksParStatut = useMemo(() => [
    { label:"Non démarré", value: tasks.filter(t=>t.statut==="NON_COMMENCE").length, color:"#DDE5F0" },
    { label:"En cours",    value: tasks.filter(t=>t.statut==="EN_COURS").length,     color: C.cyan  },
    { label:"Terminé",     value: tasks.filter(t=>t.statut==="TERMINE").length,      color: C.green },
  ], [tasks]);

  // ── Évolution mensuelle ───────────────────────────────────────────────────
  const evolutionMensuelle = useMemo(() => {
    const mois = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5-i), 1);
      return {
        x: mois[d.getMonth()],
        y: parcoursEquipe.filter(p => {
          const s = new Date(p.dateDebut);
          return s.getMonth()===d.getMonth() && s.getFullYear()===d.getFullYear();
        }).length,
      };
    });
  }, [parcoursEquipe]);

  // ── Distribution progression ──────────────────────────────────────────────
  const distProg = useMemo(() => [
    { label:"0%",    value: parcoursEnCours.filter(p=>(p.progression??0)===0).length,                           color:"#DDE5F0" },
    { label:"1–25%", value: parcoursEnCours.filter(p=>(p.progression??0)>=1&&(p.progression??0)<=25).length,   color: C.amber  },
    { label:"26–50%",value: parcoursEnCours.filter(p=>(p.progression??0)>=26&&(p.progression??0)<=50).length,  color: C.violet },
    { label:"51–75%",value: parcoursEnCours.filter(p=>(p.progression??0)>=51&&(p.progression??0)<=75).length,  color: C.cyan   },
    { label:"76–99%",value: parcoursEnCours.filter(p=>(p.progression??0)>=76&&(p.progression??0)<=99).length,  color: C.green  },
  ], [parcoursEnCours]);

  // ── Tâches urgentes (deadline dans les 3 prochains jours) ─────────────────
  const tasksUrgentes = useMemo(() => {
    const now = Date.now();
    return tasksEnAttente.filter(t => {
      if (!t.echeance) return false;
      const diff = new Date(t.echeance).getTime() - now;
      return diff >= 0 && diff <= 3 * 86_400_000;
    }).sort((a, b) => new Date(a.echeance!).getTime() - new Date(b.echeance!).getTime());
  }, [tasksEnAttente]);

  // ── Membres avec leurs parcours ───────────────────────────────────────────
  const membresAvecParcours = useMemo(() =>
    equipe.map(u => {
      const p = parcoursEquipe.find(p => p.userId === u.id);
      return { user: u, parcours: p ?? null };
    }).sort((a, b) => {
      if (!a.parcours && b.parcours) return 1;
      if (a.parcours && !b.parcours) return -1;
      return 0;
    }),
    [equipe, parcoursEquipe]
  );

  const gaugeColor = tauxDelai>=80?C.green:tauxDelai>=60?C.amber:tauxDelai>0?C.rose:C.muted;

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: C.bg }}>
        <Sidebar role="MANAGER" />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft:"var(--sidebar-w)" }}>
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
      <Sidebar role="MANAGER" />
      <main className="flex-1 overflow-auto" style={{ marginLeft:"var(--sidebar-w)" }}>
        <TopNav showSearch={false} />

        <div className="px-8 py-8 page-enter" style={{ maxWidth: 1400 }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => navigate("/manager")}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: C.border, color: C.muted }}>
                  ← Retour
                </button>
                <div className="w-1.5 h-6 rounded-full ml-2"
                  style={{ background:`linear-gradient(to bottom, ${C.cyan}, ${C.navy})` }} />
                <h1 className="text-2xl font-bold" style={{ color: C.text, fontFamily:"Sora" }}>
                  Analytics — Mon équipe
                </h1>
              </div>
              <p className="text-sm ml-16" style={{ color: C.muted }}>
                {equipe.length} membre{equipe.length !== 1 ? "s" : ""} actif{equipe.length !== 1 ? "s" : ""} dans votre équipe
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: C.surface, border:`1px solid ${C.border}`, color: C.muted }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.green }} />
              Données en temps réel
            </div>
          </div>

          {/* ── KPI Row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-5 mb-8">
            <KpiCard icon="👥" label="Membres de l'équipe" value={equipe.length}
              sub={`${parcoursEnCours.length} en onboarding actif`} color={C.navy} bg="#eef2ff" />
            <KpiCard icon="🚀" label="Onboardings actifs" value={parcoursEnCours.length}
              sub={`sur ${total} parcours au total`} color={C.cyan} bg="#e0f7ff" />
            <KpiCard icon="⏱️" label="Temps moyen"
              value={tempsMoyJours} suffix="j"
              sub="pour finir un onboarding" color={C.violet} bg="#f5f3ff" />
            <KpiCard icon="🎯" label="Taux ponctualité"
              value={tauxDelai} suffix="%"
              sub="des tâches dans les délais" color={gaugeColor} bg={`${gaugeColor}18`} />
          </div>

          {/* ── Row 1 : Donut parcours + Area évolution ──────────────────── */}
          <div className="grid grid-cols-3 gap-6 mb-6">

            <Card>
              <SH title="Statut des parcours" sub="Répartition de l'équipe" />
              <div className="flex justify-center">
                <DonutChart
                  segments={[
                    { value: parcoursEnCours.length,  color: C.cyan,  label:"En cours" },
                    { value: parcoursTermines.length,  color: C.green, label:"Terminés" },
                    { value: parcoursExpires.length,   color: C.rose,  label:"Expirés"  },
                  ]}
                  size={170} stroke={22} centerLabel={total} centerSub="parcours"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { l:"En cours",  v:parcoursEnCours.length,  c:C.cyan,  bg:"#e0f7ff" },
                  { l:"Terminés",  v:parcoursTermines.length, c:C.green, bg:"#f0fdf4" },
                  { l:"Expirés",   v:parcoursExpires.length,  c:C.rose,  bg:"#fff1f2" },
                ].map(s => (
                  <div key={s.l} className="text-center p-2.5 rounded-xl" style={{ background:s.bg }}>
                    <p className="text-xl font-bold" style={{ color:s.c, fontFamily:"Sora" }}>{s.v}</p>
                    <p className="text-xs font-medium" style={{ color:s.c }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="col-span-2">
              <SH title="Évolution des onboardings" sub="Parcours démarrés (6 derniers mois)" />
              <AreaChart data={evolutionMensuelle} color={C.cyan} height={155} />
              <div className="flex items-center justify-between mt-3 pt-3"
                style={{ borderTop:`1px solid ${C.border}` }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background:C.cyan }} />
                  <span className="text-xs" style={{ color:C.muted }}>Nouveaux parcours démarrés</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background:"#e0f7ff", color:C.cyan }}>
                  {total} parcours au total
                </span>
              </div>
            </Card>
          </div>

          {/* ── Row 2 : Gauge tâches + Donut tâches par type ─────────────── */}
          <div className="grid grid-cols-2 gap-6 mb-6">

            <Card>
              <SH title="Tâches réalisées dans les délais"
                sub={`Basé sur ${tasksDone.length} tâches terminées`} />
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <GaugeArc value={tauxDelai} color={gaugeColor} size={150} />
                  <p className="text-sm font-medium text-center" style={{ color: C.muted }}>
                    {tauxDelai>=80?"✅ Excellente ponctualité"
                     :tauxDelai>=60?"⚠️ À surveiller"
                     :tasksDone.length>0?"🔴 Retards importants"
                     :"— Pas encore de données"}
                  </p>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="p-3.5 rounded-2xl" style={{ background:"#f0fdf4" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-emerald-700">Dans les délais</span>
                      <span className="text-2xl font-bold text-emerald-600" style={{ fontFamily:"Sora" }}>
                        <AnimNum n={tasksDansDelai.length} />
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background:"#d1fae5" }}>
                      <div className="h-full rounded-full" style={{
                        width:`${tauxDelai}%`, background: C.green,
                        transition:"width 1s cubic-bezier(.4,0,.2,1)",
                      }} />
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl" style={{ background:"#fff1f2" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-rose-700">En retard</span>
                      <span className="text-2xl font-bold text-rose-500" style={{ fontFamily:"Sora" }}>
                        <AnimNum n={tasksDone.length - tasksDansDelai.length} />
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background:"#fecdd3" }}>
                      <div className="h-full rounded-full" style={{
                        width:`${100-tauxDelai}%`, background: C.rose,
                        transition:"width 1s cubic-bezier(.4,0,.2,1)",
                      }} />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl flex items-center justify-between"
                    style={{ background:`${C.amber}15`, border:`1px dashed ${C.amber}60` }}>
                    <span className="text-xs font-medium" style={{ color: C.amber }}>
                      ⏳ Tâches en attente
                    </span>
                    <span className="text-lg font-bold" style={{ color: C.amber, fontFamily:"Sora" }}>
                      <AnimNum n={tasksEnAttente.length} />
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <SH title="Répartition des tâches" sub={`${tasks.length} tâches assignées au total`} />
              <div className="flex gap-6 items-center">
                <DonutChart
                  segments={tasksParStatut.filter(t => t.value > 0)}
                  size={150} stroke={20}
                  centerLabel={tasks.length} centerSub="tâches"
                />
                <div className="flex-1 space-y-3">
                  <p className="text-xs font-semibold mb-2" style={{ color:C.muted }}>Par type de tâche</p>
                  <HBarChart data={tasksParType.filter(t=>t.value>0)} />
                </div>
              </div>
            </Card>
          </div>

          {/* ── Row 3 : Progression + Complétion profil ───────────────────── */}
          <div className="grid grid-cols-2 gap-6 mb-6">

            <Card>
              <SH title="Progression des onboardings actifs"
                sub={`${parcoursEnCours.length} en cours · moy. ${progressionMoy}%`} />
              <VertBarChart data={distProg} height={150} />
              <div className="pt-4 mt-4 border-t" style={{ borderColor:C.border }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color:C.text }}>Progression moyenne</span>
                  <span className="font-bold text-lg" style={{ color:C.cyan, fontFamily:"Sora" }}>
                    {progressionMoy}%
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background:C.border }}>
                  <div className="h-full rounded-full"
                    style={{
                      width:`${progressionMoy}%`,
                      background:`linear-gradient(to right, ${C.cyan}, ${C.navy})`,
                      transition:"width 1s cubic-bezier(.4,0,.2,1)",
                      boxShadow:`0 0 8px ${C.cyan}55`,
                    }} />
                </div>
              </div>
            </Card>

            <Card>
              <SH title="Complétion des profils" sub="Membres de l'équipe actifs" />
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative" style={{ width:140, height:140 }}>
                    <svg width="140" height="140" style={{ transform:"rotate(-90deg)" }}>
                      <circle cx="70" cy="70" r="54" fill="none" stroke={C.border} strokeWidth="14" />
                      <circle cx="70" cy="70" r="54" fill="none"
                        stroke={completionMoy>=80?C.green:completionMoy>=50?C.cyan:C.amber}
                        strokeWidth="14" strokeLinecap="round"
                        strokeDasharray={`${(completionMoy/100)*2*Math.PI*54} ${(1-completionMoy/100)*2*Math.PI*54}`}
                        style={{ transition:"stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold" style={{ color:completionMoy>=80?C.green:completionMoy>=50?C.cyan:C.amber, fontFamily:"Sora" }}>
                        <AnimNum n={completionMoy} s="%" />
                      </span>
                      <span className="text-xs" style={{ color:C.muted }}>moyenne</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {[
                    { label:"0%",    value: equipe.filter(u=>u.profilCompletion===0).length,                          color:"#DDE5F0" },
                    { label:"1–33%", value: equipe.filter(u=>u.profilCompletion>0&&u.profilCompletion<=33).length,    color: C.amber  },
                    { label:"34–66%",value: equipe.filter(u=>u.profilCompletion>33&&u.profilCompletion<=66).length,   color: C.violet },
                    { label:"67–99%",value: equipe.filter(u=>u.profilCompletion>66&&u.profilCompletion<100).length,   color: C.cyan   },
                    { label:"100%",  value: equipe.filter(u=>u.profilCompletion===100).length,                        color: C.green  },
                  ].map(r => {
                    const pct = equipe.length>0?Math.round((r.value/equipe.length)*100):0;
                    return (
                      <div key={r.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color:C.text }}>{r.label}</span>
                          <span className="font-bold" style={{ color:r.color }}>{r.value} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background:C.border }}>
                          <div className="h-full rounded-full"
                            style={{ width:`${pct}%`, background:r.color, transition:"width .9s cubic-bezier(.4,0,.2,1)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>

          {/* ── Tâches urgentes ───────────────────────────────────────────── */}
          {tasksUrgentes.length > 0 && (
            <>
              <Divider label={`⚠️ Tâches urgentes — deadline dans 3 jours`} />
              <div className="mt-5 mb-6 grid grid-cols-3 gap-4">
                {tasksUrgentes.slice(0, 6).map(t => {
                  const daysLeft = Math.ceil((new Date(t.echeance!).getTime() - Date.now()) / 86_400_000);
                  return (
                    <div key={t.id} className="card p-4 border-l-4 hover:shadow-md transition-shadow"
                      style={{ borderLeftColor: daysLeft===0?C.rose:C.amber }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold leading-tight" style={{ color:C.text }}>{t.titre}</p>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background:daysLeft===0?"#fff1f2":"#fffbeb", color:daysLeft===0?C.rose:C.amber }}>
                          {daysLeft===0?"Aujourd'hui":`${daysLeft}j`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <StatutBadge statut={t.statut} />
                        <span className="text-xs" style={{ color:C.muted }}>{fmt(t.echeance!)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Tableau membres ───────────────────────────────────────────── */}
          <Divider label="Détail par membre de l'équipe" />
          <div className="mt-6 mb-8 card overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom:`1px solid ${C.border}` }}>
              <h2 className="text-base font-bold" style={{ color:C.text, fontFamily:"Sora" }}>
                Membres de l'équipe
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ background:"#e0f7ff", color:C.cyan }}>
                  {parcoursEnCours.length} actif{parcoursEnCours.length!==1?"s":""}
                </span>
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ background:"#f0fdf4", color:C.green }}>
                  {parcoursTermines.length} terminé{parcoursTermines.length!==1?"s":""}
                </span>
              </div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.bg }}>
                    {["Membre","Statut compte","Parcours","Progression","Profil","Démarré le"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide"
                        style={{ color:C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {membresAvecParcours.map(({ user, parcours }) => {
                    const prog = parcours?.progression ?? 0;
                    const progColor = prog===100?C.green:prog>=50?C.cyan:prog>0?C.amber:C.muted;
                    return (
                      <tr key={user.id} className="transition-colors"
                        style={{ borderBottom:`1px solid ${C.border}` }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.bg; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>

                        {/* Membre */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background:`linear-gradient(135deg, ${C.cyan}, ${C.navy})` }}>
                              {user.prenom[0]}{user.nom[0]}
                            </div>
                            <div>
                              <p className="font-semibold" style={{ color:C.text }}>{user.prenom} {user.nom}</p>
                              <p className="text-xs" style={{ color:C.muted }}>{user.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Statut compte */}
                        <td className="px-5 py-3.5">
                          {(() => {
                            const m: Record<string,{l:string;c:string;bg:string}> = {
                              VALIDE:     {l:"Validé",    c:C.green,  bg:"#f0fdf4"},
                              ACCEPTE:    {l:"Soumis",    c:C.cyan,   bg:"#e0f7ff"},
                              EN_ATTENTE: {l:"En attente",c:C.amber,  bg:"#fffbeb"},
                            };
                            const s = m[user.statutCompte] ?? {l:user.statutCompte,c:C.muted,bg:C.border};
                            return (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                style={{ background:s.bg, color:s.c }}>{s.l}</span>
                            );
                          })()}
                        </td>

                        {/* Statut parcours */}
                        <td className="px-5 py-3.5">
                          {parcours ? <StatutBadge statut={parcours.statut} />
                            : <span className="text-xs" style={{ color:C.muted }}>Aucun parcours</span>}
                        </td>

                        {/* Progression */}
                        <td className="px-5 py-3.5">
                          {parcours ? (
                            <div className="flex items-center gap-3">
                              <ProgressRing value={prog} color={progColor} size={36} stroke={4} />
                              <span className="text-sm font-bold tabular-nums" style={{ color:progColor }}>
                                {prog}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color:C.muted }}>—</span>
                          )}
                        </td>

                        {/* Profil */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background:C.border }}>
                              <div className="h-full rounded-full"
                                style={{
                                  width:`${user.profilCompletion}%`,
                                  background: user.profilCompletion===100?C.green:user.profilCompletion>=50?C.cyan:C.amber,
                                }} />
                            </div>
                            <span className="text-xs font-semibold" style={{
                              color: user.profilCompletion===100?C.green:user.profilCompletion>=50?C.cyan:C.amber
                            }}>
                              {user.profilCompletion}%
                            </span>
                          </div>
                        </td>

                        {/* Date début */}
                        <td className="px-5 py-3.5">
                          <span className="text-xs" style={{ color:C.muted }}>
                            {parcours ? fmt(parcours.dateDebut) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {equipe.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color:C.muted }}>
                        Aucun membre dans votre équipe
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* ── Section Feedback ──────────────────────────────────────────── */}
        {feedbackStats && (
          <div className="px-8 pb-8" style={{ maxWidth: 1400 }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: C.border }} />
              <span className="text-xs font-bold uppercase tracking-widest"
                style={{ color: C.muted, fontFamily: "Sora" }}>Évaluation & Feedback d'intégration</span>
              <div className="h-px flex-1" style={{ background: C.border }} />
            </div>

            {feedbackStats.total === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-base font-semibold" style={{ color: C.text, fontFamily: "Sora" }}>
                  Aucune évaluation soumise pour l'instant
                </p>
                <p className="text-sm mt-1" style={{ color: C.muted }}>
                  Les statistiques apparaîtront une fois que des salariés auront soumis leur évaluation.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPI Row */}
                <div className="grid grid-cols-4 gap-5">
                  {[
                    { icon: "📊", label: "Évaluations reçues", value: feedbackStats.total, sub: "questionnaires soumis", color: C.cyan, bg: "#e0f7ff", suffix: "" },
                    { icon: "😊", label: "Taux de satisfaction", value: feedbackStats.tauxSatisfactionGlobale, sub: "salariés satisfaits", color: C.green, bg: "#f0fdf4", suffix: "%" },
                    { icon: "👍", label: "Taux de recommandation", value: feedbackStats.tauxRecommandation, sub: "recommandent le processus", color: C.violet, bg: "#f5f3ff", suffix: "%" },
                    { icon: "⚠️", label: "Difficultés signalées", value: feedbackStats.tauxDifficultes, sub: "ont rencontré des difficultés", color: C.amber, bg: "#fffbeb", suffix: "%" },
                  ].map((k) => (
                    <div key={k.label} className="stat-card">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                        style={{ background: k.bg }}>{k.icon}</div>
                      <p className="text-4xl font-bold leading-none tabular-nums"
                        style={{ color: k.color, fontFamily: "Sora" }}>
                        {k.value}{k.suffix}
                      </p>
                      <p className="text-sm font-semibold mt-2" style={{ color: C.text }}>{k.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: C.muted }}>{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Scores moyens */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="card p-6">
                    <h2 className="text-lg font-bold mb-1" style={{ color: C.text, fontFamily: "Sora" }}>Scores moyens</h2>
                    <p className="text-sm mb-5" style={{ color: C.muted }}>Par dimension évaluée (sur 4)</p>
                    <div className="space-y-4">
                      {[
                        { label: "Qualité de l'accueil", val: feedbackStats.moyenneAccueil, color: C.cyan },
                        { label: "Accompagnement manager", val: feedbackStats.moyenneManager, color: C.violet },
                        { label: "Adaptation des tâches", val: feedbackStats.moyenneTaches, color: C.green },
                        { label: "Facilité plateforme", val: feedbackStats.moyennePlateforme, color: C.amber },
                      ].map((item) => {
                        const pct = (item.val / 4) * 100;
                        const sc = pct >= 75 ? C.green : pct >= 50 ? C.amber : C.rose;
                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm" style={{ color: C.text }}>{item.label}</span>
                              <span className="text-sm font-bold" style={{ color: sc, fontFamily: "Sora" }}>{item.val}/4</span>
                            </div>
                            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${item.color}cc, ${item.color})` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Satisfaction distribution */}
                  <div className="card p-6">
                    <h2 className="text-lg font-bold mb-1" style={{ color: C.text, fontFamily: "Sora" }}>Satisfaction globale</h2>
                    <p className="text-sm mb-5" style={{ color: C.muted }}>{feedbackStats.total} réponses collectées</p>
                    <div className="space-y-3">
                      {[
                        { k: "Très satisfait", c: C.green, emoji: "🌟" },
                        { k: "Satisfait", c: C.cyan, emoji: "😊" },
                        { k: "Peu satisfait", c: C.amber, emoji: "😐" },
                        { k: "Insatisfait", c: C.rose, emoji: "😔" },
                      ].map((item) => {
                        const val = feedbackStats.distributionSatisfaction?.[item.k] || 0;
                        const pct = feedbackStats.total > 0 ? Math.round((val / feedbackStats.total) * 100) : 0;
                        return (
                          <div key={item.k} className="flex items-center gap-3">
                            <span className="text-sm w-32 flex-shrink-0" style={{ color: C.text }}>{item.emoji} {item.k}</span>
                            <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: C.border }}>
                              <div className="h-full rounded-lg flex items-center transition-all"
                                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${item.c}cc, ${item.c})` }}>
                                {pct > 15 && <span className="ml-2 text-xs font-bold text-white">{val}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-bold w-9 text-right" style={{ color: item.c }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                {feedbackStats.suggestions?.length > 0 && (
                  <div className="card p-6">
                    <h2 className="text-lg font-bold mb-1" style={{ color: C.text, fontFamily: "Sora" }}>
                      💡 Suggestions d'amélioration
                    </h2>
                    <p className="text-sm mb-4" style={{ color: C.muted }}>
                      {feedbackStats.suggestions.length} suggestion{feedbackStats.suggestions.length > 1 ? "s" : ""} collectée{feedbackStats.suggestions.length > 1 ? "s" : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {feedbackStats.suggestions.map((s: string, i: number) => (
                        <div key={i} className="px-4 py-3 rounded-xl text-sm"
                          style={{ background: `${C.cyan}08`, border: `1px solid ${C.cyan}20`, color: C.text }}>
                          💬 {s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="h-8" />
          </div>
        )}
      </main>
    </div>
  );
};

export default ManagerAnalyticsPage;