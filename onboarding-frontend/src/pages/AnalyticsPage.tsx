import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllUsersApi } from "../api/authApi";
import { type User } from "../types/auth";
import Sidebar from "../components/Sidebar";
import TopNav from "../components/TopNav";

const AnalyticsPage = () => {
  const { data: users } = useQuery({ queryKey: ["allUsers"], queryFn: getAllUsersApi });

  const employees = useMemo(() => (users ?? []).filter((u: User) => u.role !== "ADMIN"), [users]);

  const stats = useMemo(() => ({
    total: employees.length,
    salaries: employees.filter((u: User) => u.role === "SALARIE").length,
    managers: employees.filter((u: User) => u.role === "MANAGER").length,
    valides: employees.filter((u: User) => u.statutCompte === "VALIDE").length,
    enAttente: employees.filter((u: User) => u.statutCompte === "EN_ATTENTE").length,
    expires: employees.filter((u: User) => u.statutCompte === "EXPIRE").length,
    desactives: employees.filter((u: User) => u.statutCompte === "DESACTIVE").length,
    completionMoy: employees.length
      ? Math.round(employees.reduce((acc: number, u: User) => acc + u.profilCompletion, 0) / employees.length)
      : 0,
    profilsComplets: employees.filter((u: User) => u.profilCompletion === 100).length,
  }), [employees]);

  const cards = [
    { label: "Total employés", value: stats.total, icon: "👥", color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Salariés", value: stats.salaries, icon: "👤", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Managers", value: stats.managers, icon: "👔", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Comptes validés", value: stats.valides, icon: "✅", color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "En attente", value: stats.enAttente, icon: "⏳", color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Expirés", value: stats.expires, icon: "⚠️", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Désactivés", value: stats.desactives, icon: "🚫", color: "text-red-600", bg: "bg-red-50" },
    { label: "Profils complets", value: stats.profilsComplets, icon: "📋", color: "text-teal-600", bg: "bg-teal-50" },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role="ADMIN" />
      <main className="flex-1 overflow-auto" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopNav showSearch={false} />

        <div className="px-8 py-8 page-enter space-y-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>Analytics</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Vue d'ensemble de l'onboarding</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-5">
            {cards.map((c) => (
              <div key={c.label} className="stat-card flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                  {c.icon}
                </div>
                <div>
                  <p className={`text-3xl font-bold ${c.color}`} style={{ fontFamily: "Sora" }}>{c.value}</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Completion moyenne */}
          <div className="card p-6">
            <h2 className="text-base font-bold mb-5" style={{ color: "var(--text)", fontFamily: "Sora" }}>
              Complétion moyenne des profils
            </h2>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="2.5"/>
                  <circle cx="18" cy="18" r="16" fill="none"
                    stroke={stats.completionMoy === 100 ? "#10b981" : "#6366f1"}
                    strokeWidth="2.5"
                    strokeDasharray={`${stats.completionMoy} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-indigo-600" style={{ fontFamily: "Sora" }}>
                    {stats.completionMoy}%
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {[
                  { label: "Profils complets (100%)", value: stats.profilsComplets, total: stats.total, color: "bg-emerald-500" },
                  { label: "Comptes validés", value: stats.valides, total: stats.total, color: "bg-indigo-500" },
                  { label: "En attente d'activation", value: stats.enAttente, total: stats.total, color: "bg-amber-500" },
                ].map((b) => (
                  <div key={b.label}>
                    <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                      <span>{b.label}</span>
                      <span className="font-semibold">{b.value}/{b.total}</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: "var(--border)" }}>
                      <div
                        className={`h-2 rounded-full ${b.color}`}
                        style={{ width: `${b.total ? (b.value / b.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AnalyticsPage;