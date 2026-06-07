import { useEffect, useState, useRef } from "react";
import type { Badge } from "../hooks/useGamification";

// ─── Particle engine ──────────────────────────────────────────────────────────
interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number; maxLife: number;
  shape: "circle" | "star" | "diamond" | "ring";
  rotation: number; rotSpeed: number;
}

const CONFETTI_COLORS = [
  "#F59E0B", "#00AEEF", "#8DC63F", "#7C3AED",
  "#F43F5E", "#fff", "#FF6B35", "#06D6A0",
];

function makeParticles(count: number, cx: number, cy: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.8;
    const speed = 4 + Math.random() * 8;
    const maxLife = 90 + Math.random() * 70;
    return {
      id: i, x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 5 + Math.random() * 9,
      life: maxLife, maxLife,
      shape: (["circle", "star", "diamond", "ring"] as const)[Math.floor(Math.random() * 4)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
    };
  });
}

const ParticleCanvas = ({ active, width, height }: { active: boolean; width: number; height: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const cx = (width / 2 / width) * 100;
    const cy = 40;
    particlesRef.current = makeParticles(70, cx, cy);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, x: p.x + p.vx * (100 / canvas.width), y: p.y + p.vy * (100 / canvas.height), vy: p.vy + 0.15, life: p.life - 1, rotation: p.rotation + p.rotSpeed }))
        .filter(p => p.life > 0);

      particlesRef.current.forEach(p => {
        const px = (p.x / 100) * canvas.width;
        const py = (p.y / 100) * canvas.height;
        const alpha = Math.min(1, p.life / p.maxLife * 1.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rotation);

        if (p.shape === "circle") {
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.shape === "ring") {
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.lineWidth = 2; ctx.stroke();
        } else if (p.shape === "diamond") {
          ctx.beginPath();
          ctx.moveTo(0, -p.size); ctx.lineTo(p.size, 0);
          ctx.lineTo(0, p.size); ctx.lineTo(-p.size, 0);
          ctx.closePath(); ctx.fill();
        } else { // star
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const a = (Math.PI * 2 * k) / 5 - Math.PI / 2;
            const r = k % 2 === 0 ? p.size : p.size * 0.4;
            k === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
                    : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      if (particlesRef.current.length > 0) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, width, height]);

  return (
    <canvas ref={canvasRef} width={width} height={height}
      className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }} />
  );
};

// ─── Rarity config ────────────────────────────────────────────────────────────
const RARITY = {
  common:    { label: "COMMUN",     glow: "#64748B", ring: "#94a3b8", gradient: "linear-gradient(135deg,#475569,#1e293b)", star: "⭐" },
  rare:      { label: "RARE",       glow: "#3B82F6", ring: "#93c5fd", gradient: "linear-gradient(135deg,#1d4ed8,#0f172a)", star: "💎" },
  epic:      { label: "ÉPIQUE",     glow: "#8B5CF6", ring: "#c4b5fd", gradient: "linear-gradient(135deg,#6d28d9,#0f172a)", star: "💜" },
  legendary: { label: "LÉGENDAIRE", glow: "#F59E0B", ring: "#fcd34d", gradient: "linear-gradient(135deg,#d97706,#0f172a)", star: "👑" },
};

// ─── Single Toast ─────────────────────────────────────────────────────────────
const SingleToast = ({ badge, onDone }: { badge: Badge; onDone: () => void }) => {
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const [scanline, setScanline] = useState(0);
  const rc = RARITY[badge.rarity] ?? RARITY.common;
  const W = 420, H = 220;

  useEffect(() => {
    const t0 = setTimeout(() => setPhase("show"), 80);
    const t1 = setTimeout(() => setPhase("exit"), 4200);
    const t2 = setTimeout(() => onDone(), 4700);
    // Scanline animation
    const interval = setInterval(() => setScanline(s => (s + 2) % 100), 16);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearInterval(interval); };
  }, []);

  const ty = phase === "enter" ? 120 : phase === "exit" ? 120 : 0;
  const op = phase === "show" ? 1 : 0;
  const sc = phase === "show" ? 1 : phase === "enter" ? 0.8 : 0.9;

  return (
    <div className="relative"
      style={{
        width: W, height: H,
        transform: `translateY(${ty}px) scale(${sc})`,
        opacity: op,
        transition: phase === "show"
          ? "transform 0.5s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease"
          : "transform 0.4s ease-in, opacity 0.4s ease-in",
      }}>

      {/* Particles */}
      <ParticleCanvas active={phase === "show"} width={W} height={H} />

      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{ boxShadow: `0 0 0 1px ${rc.ring}30, 0 0 60px ${rc.glow}40, 0 0 120px ${rc.glow}20`, borderRadius: 24 }} />

      {/* Main card */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl"
        style={{ background: rc.gradient, border: `1.5px solid ${rc.ring}50` }}>

        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-5"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.5) 2px,rgba(255,255,255,0.5) 3px)" }} />

        {/* Moving scanline */}
        <div className="absolute left-0 right-0 h-8 pointer-events-none"
          style={{
            top: `${scanline}%`,
            background: `linear-gradient(to bottom, transparent, ${rc.glow}15, transparent)`,
            transition: "none",
          }} />

        {/* Corner decorations */}
        {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
          <div key={i} className={`absolute w-6 h-6 ${pos}`}
            style={{
              borderTop:    i < 2 ? `2px solid ${rc.ring}` : "none",
              borderBottom: i >= 2 ? `2px solid ${rc.ring}` : "none",
              borderLeft:   i % 2 === 0 ? `2px solid ${rc.ring}` : "none",
              borderRight:  i % 2 === 1 ? `2px solid ${rc.ring}` : "none",
              borderRadius: i === 0 ? "24px 0 0 0" : i === 1 ? "0 24px 0 0" : i === 2 ? "0 0 0 24px" : "0 0 24px 0",
            }} />
        ))}

        {/* Content */}
        <div className="relative z-10 flex items-center gap-5 h-full px-7">

          {/* Badge icon */}
          <div className="relative flex-shrink-0"
            style={{ animation: phase === "show" ? "badgePop 0.6s cubic-bezier(.34,1.56,.64,1) forwards" : undefined }}>

            {/* Outer pulse rings */}
            {[1.8, 1.4].map((scale, i) => (
              <div key={i} className="absolute inset-0 rounded-2xl"
                style={{
                  transform: `scale(${scale})`,
                  border: `1px solid ${rc.ring}`,
                  opacity: 0,
                  animation: phase === "show" ? `ringPulse 1.5s ease-out ${i * 0.2}s infinite` : undefined,
                }} />
            ))}

            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl relative"
              style={{
                background: badge.bg,
                border: `2px solid ${rc.ring}80`,
                boxShadow: `0 0 30px ${rc.glow}60, inset 0 1px 0 rgba(255,255,255,0.1)`,
              }}>
              {badge.icon}
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">

            {/* Rarity badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{rc.star}</span>
              <span className="text-xs font-black tracking-[0.2em] px-2.5 py-1 rounded-full"
                style={{
                  background: `${rc.glow}25`,
                  color: rc.ring,
                  border: `1px solid ${rc.glow}50`,
                  fontFamily: "Sora",
                  textShadow: `0 0 8px ${rc.glow}`,
                }}>
                {rc.label} DÉBLOQUÉ
              </span>
            </div>

            <p className="text-xs font-semibold mb-1" style={{ color: "rgba(168,216,234,0.6)" }}>
              🏆 Nouveau badge
            </p>
            <p className="text-xl font-black text-white leading-tight mb-1.5"
              style={{ fontFamily: "Sora", textShadow: `0 0 20px ${rc.glow}80` }}>
              {badge.name}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
              {badge.description}
            </p>

            {/* XP gain */}
            <div className="flex items-center gap-1.5 mt-2.5">
              <div className="px-2.5 py-1 rounded-lg text-xs font-black"
                style={{ background: `${rc.glow}20`, color: rc.ring, border: `1px solid ${rc.glow}30` }}>
                +{badge.xpReward} XP
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${rc.glow}, ${rc.ring}, ${rc.glow})`,
            animation: phase === "show" ? "timerBar 4.1s linear forwards" : undefined,
            transformOrigin: "left",
          }} />
      </div>

      {/* CSS */}
      <style>{`
        @keyframes badgePop {
          0%   { transform: scale(0) rotate(-20deg); }
          60%  { transform: scale(1.2) rotate(8deg); }
          80%  { transform: scale(0.9) rotate(-3deg); }
          100% { transform: scale(1) rotate(0); }
        }
        @keyframes ringPulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes timerBar {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
};

// ─── Queue manager ────────────────────────────────────────────────────────────
interface BadgeUnlockToastProps {
  badges: Badge[];
  onAllDone: (ids: string[]) => void;
}

export const BadgeUnlockToast = ({ badges, onAllDone }: BadgeUnlockToastProps) => {
  const [queue, setQueue] = useState<Badge[]>([]);
  const [current, setCurrent] = useState<Badge | null>(null);
  const shownIds = useRef<string[]>([]);

  useEffect(() => {
    if (badges.length === 0) return;
    const t = setTimeout(() => setQueue(badges), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [queue, current]);

  const handleDone = () => {
    if (current) shownIds.current.push(current.id);
    setCurrent(null);
    if (queue.length === 0) onAllDone(shownIds.current);
  };

  if (!current) return null;

  return (
    <div className="fixed z-[9999]" style={{ bottom: 32, right: 32 }}>
      <SingleToast key={current.id} badge={current} onDone={handleDone} />
    </div>
  );
};

export default BadgeUnlockToast;