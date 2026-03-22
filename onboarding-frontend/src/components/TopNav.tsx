import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface TopNavProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  showSearch?: boolean;
}

const TopNav = ({
  searchValue = "",
  onSearchChange,
  showSearch = true,
}: TopNavProps) => {
  const { email, role } = useAuth(); // ⚡ on récupère aussi le role
  const navigate = useNavigate();

  // 🔥 Détermine automatiquement la route profil
  const profilePath =
    role === "ADMIN"
      ? "/admin/profil"
      : "/profile";

  return (
    <div
      className="border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {showSearch ? (
        <div className="relative w-80">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Rechercher..."
            className="input-field pl-10"
          />
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(profilePath)}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm hover:scale-105 transition-transform shadow-md"
          title="Mon profil"
        >
          {email?.[0]?.toUpperCase() ?? "A"}
        </button>
      </div>
    </div>
  );
};

export default TopNav;