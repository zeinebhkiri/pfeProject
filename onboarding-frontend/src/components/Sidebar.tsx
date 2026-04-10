import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";

interface SidebarProps {
  role: "ADMIN" | "SALARIE" | "MANAGER";
}

const adminLinks = [
  {
    label: "Dashboard",
    to: "/admin",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    label: "Équipe IT",
    isGroup: true,
    children: [
      {
        label: "Salariés",
        to: "/admin/salaries",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        label: "Managers",
        to: "/admin/managers",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: "Analytics",
    to: "/admin/analytics",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    label: "Documents",
    to: "/admin/documents",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
   {
    label: "Postes",
    to: "/admin/postes",
    icon: ( <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> ),
  },
  {
  label: "Parcours",
  to: "/admin/parcours",
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
},
{
  label: "Suivi parcours",
  to: "/admin/suivi-parcours",
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
},
];

const salarieLinks = [
  {
    label: "Mon espace",
    to: "/dashboard",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
  label: "Mon parcours",
  to: "/parcours",
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
},
];

const managerLinks = [
  {
    label: "Dashboard",
    to: "/manager",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    label: "Équipe",
    isGroup: true,
    children: [
      {
        label: "Mon équipe",
        to: "/manager/equipe",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
    ],
  },
  {
  label: "Parcours équipe",
  to: "/manager/parcours",
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
},
// ← Mon parcours personnel
{
  label: "Mon parcours",
  to: "/parcours",
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
},
  {
    label: "Analytics",
    to: "/manager/analytics",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
];

/* ── Logo Square IT ── */
const SquareITLogo = ({ collapsed }: { collapsed: boolean }) => (
  <div className={`flex items-center gap-3 transition-all duration-300 ${collapsed ? "justify-center" : ""}`}>
    <div className="relative flex-shrink-0 w-9 h-9">
      {/* Simplified geometric logo mark inspired by Square IT */}
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
        <rect x="2" y="2" width="14" height="14" rx="2" fill="#00AEEF" opacity="0.9"/>
        <rect x="20" y="2" width="14" height="14" rx="2" fill="#8DC63F" opacity="0.9"/>
        <rect x="2" y="20" width="14" height="14" rx="2" fill="#A8D8EA" opacity="0.7"/>
        <rect x="20" y="20" width="14" height="14" rx="2" fill="#00AEEF" opacity="0.5"/>
      </svg>
    </div>
    {!collapsed && (
      <div>
        <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: "Sora" }}>
          SQUARE <span style={{ color: "#00AEEF" }}>IT</span>
        </p>
        <p className="text-xs font-medium" style={{ color: "rgba(168,216,234,0.6)", letterSpacing: "0.08em" }}>
          CONSULTING
        </p>
      </div>
    )}
  </div>
);

const Sidebar = ({ role }: SidebarProps) => {
  const { logout, email } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const links =
    role === "ADMIN" ? adminLinks :
    role === "MANAGER" ? managerLinks :
    salarieLinks;

  const w = collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-w)";

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col transition-all duration-300 z-40"
      style={{
        width: w,
        background: "linear-gradient(180deg, #0D1B3E 0%, #1A2B6B 60%, #111D4A 100%)",
        borderRight: "1px solid rgba(0,174,239,0.12)",
      }}
    >
      {/* Top decoration line */}
      <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #00AEEF, #8DC63F, transparent)" }} />

      {/* Logo + toggle */}
      <div className={`flex items-center border-b py-4 transition-all duration-300 ${
        collapsed ? "px-3 justify-center" : "px-5 justify-between"
      }`} style={{ borderColor: "rgba(0,174,239,0.12)" }}>
        <SquareITLogo collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 ${collapsed ? "mt-2" : ""}`}
          title={collapsed ? "Agrandir" : "Réduire"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {collapsed
              ? <polyline points="9 18 15 12 9 6"/>
              : <polyline points="15 18 9 12 15 6"/>}
          </svg>
        </button>
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="mx-4 mt-4 mb-1 px-3 py-2 rounded-lg" style={{ background: "rgba(0,174,239,0.08)", border: "1px solid rgba(0,174,239,0.15)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#00AEEF" }}>
            {role === "ADMIN" ? "RH / Admin" : role === "MANAGER" ? "Manager" : "Employé"}
          </p>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {links.map((item: any) => {
          if (item.isGroup) {
            return (
              <div key={item.label}>
                {!collapsed ? (
                  <p className="text-xs font-semibold uppercase tracking-widest px-3 pt-4 pb-2"
                    style={{ color: "rgba(168,216,234,0.35)" }}>
                    {item.label}
                  </p>
                ) : (
                  <div className="my-2 mx-3 h-px" style={{ background: "rgba(0,174,239,0.15)" }} />
                )}
                {item.children.map((child: any) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`
                    }
                    title={collapsed ? child.label : undefined}
                  >
                    <span className="flex-shrink-0">{child.icon}</span>
                    {!collapsed && <span>{child.label}</span>}
                  </NavLink>
                ))}
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin" || item.to === "/manager" || item.to === "/dashboard"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User info + Logout */}
      <div className="px-2 py-3 space-y-1" style={{ borderTop: "1px solid rgba(0,174,239,0.12)" }}>
        {!collapsed && (
          <div className="px-3 py-2.5 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #00AEEF, #1A2B6B)" }}>
                {email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{email}</p>
                <p className="text-xs" style={{ color: "rgba(168,216,234,0.5)" }}>{role}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className={`sidebar-link w-full ${collapsed ? "justify-center px-0" : ""}`}
          style={{ color: "rgba(239,68,68,0.7)" }}
          title={collapsed ? "Déconnexion" : undefined}
          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,68,68,0.7)")}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;