import { useState, useEffect } from "react";
 
export function useResponsiveLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
 
  // Ferme le menu quand on passe en desktop (≥ 768px)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
 
  return {
    menuOpen,
    openMenu:  () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
  };
}