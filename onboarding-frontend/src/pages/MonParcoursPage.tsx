import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getMyParcoursApi, getMyTasksApi } from "../api/authApi";
import Sidebar from "../components/Sidebar";
import ParcoursWidget from "../components/ParcoursWidget";

const MonParcoursPage = () => {
  const { role } = useAuth();

  const { isLoading: loadingParcours } = useQuery({
    queryKey: ["myParcours"],
    queryFn: getMyParcoursApi,
    retry: false,
  });

  const { isLoading: loadingTasks } = useQuery({
    queryKey: ["myTasks"],
    queryFn: getMyTasksApi,
    retry: false,
  });

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
        <div className="border-b px-8 py-5 sticky top-0 z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)", fontFamily: "Sora" }}>
            Mon parcours d'intégration
          </h1>
        </div>
        <ParcoursWidget mode="full" />
      </main>
    </div>
  );
};

export default MonParcoursPage;