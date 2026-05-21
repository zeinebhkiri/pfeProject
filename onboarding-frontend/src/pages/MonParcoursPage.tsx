import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getMyParcoursApi, getMyTasksApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import ParcoursWidget from "../components/ParcoursWidget";
import type { Task } from "../types/auth";
import NotificationBell from "../components/NotificationBell";

const MonParcoursPage = () => {
  const { role } = useAuth();
  
  // État pour stocker l'ID de la tâche à ouvrir automatiquement
  const [initialTaskId, setInitialTaskId] = useState<string | null>(null);

  const { data: parcours, isLoading: loadingParcours } = useQuery({
    queryKey: ["myParcours"],
    queryFn: getMyParcoursApi,
    retry: false,
  });
  
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["myTasks"],
    queryFn: getMyTasksApi,
    retry: false,
  });

  // Lire le sessionStorage au chargement
  useEffect(() => {
    const storedTaskId = sessionStorage.getItem("parcours_selected_task");
    if (storedTaskId) {
      setInitialTaskId(storedTaskId);
      // Nettoyer pour ne pas le réutiliser au prochain rafraîchissement
      sessionStorage.removeItem("parcours_selected_task");
    }
  }, []);

  const tasksList = tasks as Task[];
  const completed = tasksList.filter(t => t.statut === "TERMINE").length;
  const total = tasksList.length;
  const progression = parcours?.progression ?? 0;

  if (loadingParcours || loadingTasks) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar role={role as any} />
        <main className="flex-1 flex items-center justify-center" style={{ marginLeft: "var(--sidebar-w)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin"
              style={{ borderColor: "rgba(0,174,239,0.2)", borderTopColor: "#00AEEF" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement de votre parcours...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar role={role as any} />
      <main className="flex-1 overflow-auto page-enter" style={{ marginLeft: "var(--sidebar-w)" }}>
        <div className="border-b px-8 py-4 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
                Mon parcours d'intégration
              </h1>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {completed}/{total} tâches
              </p>
            </div>
             
            <div className="flex items-center gap-3">
              <div className="w-28 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progression}%`, background: progression === 100 ? "#8DC63F" : "#00AEEF" }} />
              </div>
              <span className="text-sm font-bold"
                style={{ color: progression === 100 ? "#8DC63F" : "#00AEEF", fontFamily: "Sora" }}>
                {progression}%
              </span>
              <div className="flex items-center gap-3">
                <NotificationBell />
            </div>
            </div>
          </div>
        </div>
        
        {/* Passer l'ID de la tâche à ouvrir */}
        <ParcoursWidget initialSelectedTaskId={initialTaskId} />
      </main>
    </div>
  );
};

export default MonParcoursPage;