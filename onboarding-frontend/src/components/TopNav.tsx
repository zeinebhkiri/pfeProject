import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

interface TopNavProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  showSearch?: boolean;
  onMenuOpen?: () => void; // ouvre le drawer Sidebar sur mobile
}

const TopNav = ({
  searchValue = "",
  onSearchChange,
  showSearch = true,
  onMenuOpen,
}: TopNavProps) => {
  const { email, role } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const profilePath = role === "ADMIN" ? "/admin/profil" : "/profile";

  // Focus auto quand la barre de recherche mobile s'ouvre
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 60);
  }, [searchOpen]);

  // Ferme la recherche mobile si on passe en >= md
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const h = (e: MediaQueryListEvent) => { if (e.matches) setSearchOpen(false); };
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  return (
    <div
      className="sticky top-0 z-30 transition-colors duration-300"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      {/* ── Barre principale ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4">

        {/* Hamburger — mobile uniquement */}
        <button
          onClick={onMenuOpen}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors md:hidden"
          style={{ background: "var(--border)", color: "var(--text)" }}
          aria-label="Ouvrir le menu"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Recherche desktop */}
        {showSearch && (
          <div className="relative hidden md:block w-80">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}>
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
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions droite */}
        <div className="flex items-center gap-1.5 md:gap-2">

          {/* Loupe mobile — toggle la barre dépliable */}
          {showSearch && (
            <button
              onClick={() => setSearchOpen(v => !v)}
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: searchOpen ? "var(--border)" : "transparent",
                color: "var(--text-muted)",
              }}
              aria-label="Rechercher"
            >
              {searchOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              )}
            </button>
          )}

          {/* Cloche notifications */}
          {role === "SALARIE" && <NotificationBell />}

          {/* Avatar */}
          <button
            onClick={() => navigate(profilePath)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center
                       text-white font-bold text-sm hover:scale-105 transition-transform shadow-md"
            style={{ background: "linear-gradient(135deg, #00AEEF, #1A2B6B)" }}
            title="Mon profil"
          >
            {email?.[0]?.toUpperCase() ?? "?"}
          </button>
        </div>
      </div>

      {/* ── Barre recherche mobile dépliable ──────────────────────────────── */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out md:hidden"
        style={{
          maxHeight: searchOpen && showSearch ? "64px" : "0px",
          opacity: searchOpen && showSearch ? 1 : 0,
        }}
      >
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Rechercher..."
              className="input-field pl-10 w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNav;