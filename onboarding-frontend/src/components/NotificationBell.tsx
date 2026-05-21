import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMyTasksApi } from "../api/authApi";
import type { Task } from "../types/auth";

// ── Types ──────────────────────────────────────────────────────────────────
type NotifType =
  | "TASK_VALIDATED"
  | "NEW_COMMENT"
  | "QUIZ_UNLOCKED"
  | "ENTRETIEN_REPLANIFIE"
  | "DOCUMENT_CORRECTION";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  taskId: string;
  timestamp: Date;
  read: boolean;
}

// ── Config visuelle par type ───────────────────────────────────────────────
const NOTIF_CONFIG: Record<NotifType, { icon: string; color: string; bg: string; border: string }> = {
  TASK_VALIDATED:      { icon: "✅", color: "#059669", bg: "rgba(5,150,105,0.08)",   border: "rgba(5,150,105,0.2)"   },
  NEW_COMMENT:         { icon: "💬", color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  border: "rgba(124,58,237,0.2)"  },
  QUIZ_UNLOCKED:       { icon: "🔓", color: "#00AEEF", bg: "rgba(0,174,239,0.08)",   border: "rgba(0,174,239,0.2)"   },
  ENTRETIEN_REPLANIFIE:{ icon: "📅", color: "#d97706", bg: "rgba(217,119,6,0.08)",   border: "rgba(217,119,6,0.2)"   },
  DOCUMENT_CORRECTION: { icon: "📝", color: "#dc2626", bg: "rgba(220,38,38,0.08)",   border: "rgba(220,38,38,0.2)"   },
};

// ── Clé localStorage pour les notifications lues et déjà vues ─────────────
const READ_KEY  = "notif_read_ids";
const SEEN_KEY  = "notif_seen_signatures";

const getReadIds    = (): Set<string> => new Set(JSON.parse(localStorage.getItem(READ_KEY)  || "[]"));
const getSeenSigs   = (): Set<string> => new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
const saveReadIds   = (ids: Set<string>) => localStorage.setItem(READ_KEY,  JSON.stringify([...ids]));
const saveSeenSigs  = (sigs: Set<string>) => localStorage.setItem(SEEN_KEY, JSON.stringify([...sigs]));

// ── Dérivation des notifications depuis les tâches ─────────────────────────
function deriveNotifications(tasks: Task[]): Notification[] {
  const notifs: Notification[] = [];
  const readIds = getReadIds();

  for (const task of tasks) {
    // ── 1. Tâche validée (TERMINE, acteur non salarié a complété) ──────────
    if (task.statut === "TERMINE" && task.acteurProgressions) {
      const valideur = task.acteurProgressions.find(
        ap => ap.complete && (ap.typeActeur === "MANAGER" || ap.typeActeur === "RH")
      );
      if (valideur) {
        const sig = `TASK_VALIDATED:${task.id}`;
        const id  = sig;
        notifs.push({
          id,
          type: "TASK_VALIDATED",
          title: "Tâche validée",
          message: `« ${task.titre} » a été validée par ${valideur.typeActeur === "MANAGER" ? "votre manager" : "les RH"}.`,
          taskId: task.id,
          timestamp: valideur.dateCompletion
            ? new Date(valideur.dateCompletion)
            : task.dateCompletion
            ? new Date(task.dateCompletion)
            : new Date(),
          read: readIds.has(id),
        });
      }
    }

    // ── 2. NOUVEAUX COMMENTAIRES (version simplifiée) ────────────────────────
if (task.commentaires && task.commentaires.length > 0) {
  // Filtrer les commentaires du manager/RH (par le nom ou par l'ID)
  const managerComments = task.commentaires.filter(comment => {
    const commentDate = new Date(comment.date);
    const ageMs = Date.now() - commentDate.getTime();
    
    // Seulement les commentaires de moins de 7 jours
    if (ageMs > 7 * 24 * 60 * 60 * 1000) return false;
    
    // Si le nom contient "Manager" ou "Admin RH" ou "RH"
    if (comment.auteurNom && (
      comment.auteurNom.includes("Manager") ||
      comment.auteurNom.includes("Admin RH") ||
      comment.auteurNom.includes("RH")
    )) {
      return true;
    }
    
    return false;
  });
  
  // Éviter les doublons
  const seenComments = new Set<string>();
  
  managerComments.forEach((comment, idx) => {
    const date = new Date(comment.date);
    const signature = `${task.id}:${comment.date}:${comment.texte.slice(0, 30)}`;
    if (seenComments.has(signature)) return;
    seenComments.add(signature);
    
    const id = `NEW_COMMENT:${task.id}:${idx}:${comment.date}`;
    notifs.push({
      id,
      type: "NEW_COMMENT",
      title: "Nouveau commentaire",
      message: `${comment.auteurNom} a commenté « ${task.titre} » : "${comment.texte.slice(0, 60)}${comment.texte.length > 60 ? "…" : ""}"`,
      taskId: task.id,
      timestamp: date,
      read: readIds.has(id),
    });
  });
}

    // ── 4. Quiz débloqué (dateOuverture passée récemment, tâche NON_COMMENCE) ──
    if (
      task.taskType === "QUIZ" &&
      task.dateOuverture &&
      task.statut === "NON_COMMENCE"
    ) {
      const ouverture = new Date(task.dateOuverture);
      const now = new Date();
      const ageMs = now.getTime() - ouverture.getTime();
      // Débloqué il y a moins de 7 jours et maintenant accessible
      if (ageMs > 0 && ageMs < 7 * 24 * 60 * 60 * 1000) {
        const id = `QUIZ_UNLOCKED:${task.id}:${task.dateOuverture}`;
        notifs.push({
          id,
          type: "QUIZ_UNLOCKED",
          title: "Quiz débloqué",
          message: `Le quiz « ${task.titre} » est maintenant disponible. À vous de jouer !`,
          taskId: task.id,
          timestamp: ouverture,
          read: readIds.has(id),
        });
      }
    }
    // ── 4bis. Quiz débloqué par le manager (après 3 tentatives) ──────────────
 if (
  task.taskType === "QUIZ" &&
  task.nbTentatives === 0 &&        
  task.verrouille === false &&    
  task.statut !== "TERMINE" && task.statut !== "NON_COMMENCE"
) {

  const id = `QUIZ_UNLOCKED_BY_MANAGER:${task.id}`;
  const alreadyExists = notifs.some(n => n.id === id);
  
  if (!alreadyExists) {
    notifs.push({
      id,
      type: "QUIZ_UNLOCKED",
      title: "Quiz débloqué par votre manager",
      message: `Votre manager a débloqué le quiz « ${task.titre} ». Vous pouvez le repasser.`,
      taskId: task.id,
      timestamp: new Date(),
      read: readIds.has(id),
    });
  }
}
    // ── 5. Entretien replanifié (dateEntretien modifiée récemment) ──────────
    if (task.taskType === "ENTRETIEN" && task.dateEntretien) {
      const dateEntretien = new Date(task.dateEntretien);
      const ageMs = Date.now() - dateEntretien.getTime();
      // Replanifié dans le futur ou récemment modifié (dans 30 jours)
      const futureMs = dateEntretien.getTime() - Date.now();
      if (futureMs > 0 && futureMs < 30 * 24 * 60 * 60 * 1000) {
        const id = `ENTRETIEN_REPLANIFIE:${task.id}:${task.dateEntretien}`;
        notifs.push({
          id,
          type: "ENTRETIEN_REPLANIFIE",
          title: "Entretien planifié",
          message: `Votre entretien « ${task.titre} » est fixé au ${dateEntretien.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`,
          taskId: task.id,
          timestamp: dateEntretien,
          read: readIds.has(id),
        });
      } else if (ageMs > 0 && ageMs < 7 * 24 * 60 * 60 * 1000 && task.statut !== "TERMINE") {
        const id = `ENTRETIEN_REPLANIFIE:${task.id}:past:${task.dateEntretien}`;
        notifs.push({
          id,
          type: "ENTRETIEN_REPLANIFIE",
          title: "Entretien replanifié",
          message: `La date de votre entretien « ${task.titre} » a été modifiée.`,
          taskId: task.id,
          timestamp: dateEntretien,
          read: readIds.has(id),
        });
      }
    }

    // ── 6. Correction de document demandée (SIMPLE avec commentaire manager) ──
    if (
      task.taskType === "SIMPLE" &&
      task.statut === "EN_COURS" &&
      task.config?.typeDocumentAttendu &&
      !task.documentNom &&
      task.commentaires?.some(c =>
        c.auteurNom?.includes("Manager") || c.auteurNom?.includes("Admin RH")
      )
    ) {
      const id = `DOCUMENT_CORRECTION:${task.id}`;
      notifs.push({
        id,
        type: "DOCUMENT_CORRECTION",
        title: "Correction demandée",
        message: `Votre ${task.config.typeDocumentAttendu} pour « ${task.titre} » doit être resoumis.`,
        taskId: task.id,
        timestamp: task.dateCompletion ? new Date(task.dateCompletion) : new Date(),
        read: readIds.has(id),
      });
    }
  }

  // Trier par date décroissante, dédupliquer par id
  const seen = new Set<string>();
  return notifs
    .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ── Helper : formatage relatif du temps ───────────────────────────────────
function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800)return `Il y a ${Math.floor(diff / 86400)}j`;
  return date.toLocaleDateString("fr-FR");
}

// ── Composant principal ────────────────────────────────────────────────────
const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen]               = useState(false);
  const [filter, setFilter]           = useState<"all" | "unread">("all");
  const [localRead, setLocalRead]     = useState<Set<string>>(getReadIds);
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["myTasks"],
    queryFn: getMyTasksApi,
    retry: false,
    refetchInterval: 60_000, // Rafraîchit toutes les minutes
  });

  const allNotifs = useMemo(
    () => deriveNotifications(tasks as Task[]),
    [tasks]
  );

  const notifs  = filter === "unread"
    ? allNotifs.filter(n => !localRead.has(n.id))
    : allNotifs;

  const unreadCount = allNotifs.filter(n => !localRead.has(n.id)).length;

  // Fermer en cliquant dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Marquer une notification comme lue
  const markRead = (id: string) => {
    const next = new Set(localRead).add(id);
    setLocalRead(next);
    saveReadIds(next);
  };

  // Marquer toutes comme lues
  const markAllRead = () => {
    const next = new Set(allNotifs.map(n => n.id));
    setLocalRead(next);
    saveReadIds(next);
  };

  // Ouvrir la tâche correspondante
  const handleNotifClick = (notif: Notification) => {
    markRead(notif.id);
    sessionStorage.setItem("parcours_selected_task", notif.taskId);
     window.location.href = "/parcours";
    setOpen(false);
  };

  return (
    <div ref={dropRef} style={{ position: "relative" }}>

      {/* ── Bouton cloche ──────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: 12,
          border: open
            ? "1.5px solid rgba(0,174,239,0.5)"
            : "1.5px solid var(--border)",
          background: open ? "rgba(0,174,239,0.08)" : "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.18s ease",
          flexShrink: 0,
        }}
        title="Notifications"
      >
        {/* Icône cloche SVG */}
        <svg
          width="18" height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={open ? "#00AEEF" : "var(--text-muted)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        {/* Badge compteur ─────────────────── */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: "linear-gradient(135deg, #00AEEF, #0090C5)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "Sora, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--surface)",
              animation: "notif-pop 0.35s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ───────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 380,
            maxHeight: 520,
            borderRadius: 20,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.14), 0 4px 20px rgba(0,174,239,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "notif-slide 0.22s cubic-bezier(.22,1,.36,1)",
            zIndex: 999,
          }}
        >

          {/* ── En-tête ─────────────────────────────────────────────── */}
          <div
            style={{
              padding: "16px 18px 12px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", fontFamily: "Sora, sans-serif" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#00AEEF",
                    background: "rgba(0,174,239,0.1)",
                    border: "1px solid rgba(0,174,239,0.25)",
                    borderRadius: 6,
                    padding: "1px 7px",
                    fontFamily: "Sora, sans-serif",
                  }}
                >
                  {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "3px 6px",
                    borderRadius: 6,
                    fontFamily: "Sora, sans-serif",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#00AEEF")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  Tout marquer lu
                </button>
              )}
            </div>
          </div>

          {/* ── Filtres ─────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "10px 18px 8px",
              flexShrink: 0,
              borderBottom: "1px solid var(--border)",
            }}
          >
            {(["all", "unread"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "Sora, sans-serif",
                  padding: "4px 12px",
                  borderRadius: 8,
                  border: filter === f ? "1.5px solid rgba(0,174,239,0.4)" : "1.5px solid var(--border)",
                  background: filter === f ? "rgba(0,174,239,0.08)" : "transparent",
                  color: filter === f ? "#00AEEF" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f === "all" ? "Toutes" : "Non lues"}
              </button>
            ))}
          </div>

          {/* ── Liste des notifications ──────────────────────────────── */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifs.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: "rgba(0,174,239,0.06)",
                    border: "1.5px dashed rgba(0,174,239,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  🔔
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "Sora, sans-serif", margin: 0 }}>
                  {filter === "unread" ? "Tout est lu !" : "Aucune notification"}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
                  {filter === "unread"
                    ? "Vous êtes à jour sur toutes vos activités."
                    : "Les nouveautés de votre parcours apparaîtront ici."}
                </p>
              </div>
            ) : (
              <div style={{ padding: "6px 0" }}>
                {notifs.map((notif, idx) => {
                  const cfg    = NOTIF_CONFIG[notif.type];
                  const isRead = localRead.has(notif.id);

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      style={{
                        width: "100%",
                        padding: "11px 18px",
                        background: isRead ? "transparent" : "rgba(0,174,239,0.03)",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 11,
                        textAlign: "left",
                        transition: "background 0.15s",
                        borderBottom: idx < notifs.length - 1 ? "1px solid var(--border)" : "none",
                        position: "relative",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,174,239,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = isRead ? "transparent" : "rgba(0,174,239,0.03)")}
                    >
                      {/* Pastille non-lu */}
                      {!isRead && (
                        <div
                          style={{
                            position: "absolute",
                            left: 6,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "#00AEEF",
                            flexShrink: 0,
                          }}
                        />
                      )}

                      {/* Icône type */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                          marginLeft: 4,
                        }}
                      >
                        {cfg.icon}
                      </div>

                      {/* Texte */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                            marginBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isRead ? 600 : 700,
                              color: isRead ? "var(--text-muted)" : cfg.color,
                              fontFamily: "Sora, sans-serif",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {notif.title}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--text-light)",
                              flexShrink: 0,
                              fontFamily: "Sora, sans-serif",
                            }}
                          >
                            {timeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 12,
                            color: isRead ? "var(--text-muted)" : "var(--text)",
                            margin: 0,
                            lineHeight: 1.45,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {notif.message}
                        </p>
                      </div>

                      {/* Flèche */}
                      <svg
                        width="13" height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-light)"
                        strokeWidth="2.5"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      >
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          {allNotifs.length > 0 && (
            <div
              style={{
                padding: "10px 18px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => { navigate("/parcours"); setOpen(false); }}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#00AEEF",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "Sora, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 8,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,174,239,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                Voir mon parcours
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Animations globales ─────────────────────────────────────── */}
      <style>{`
        @keyframes notif-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes notif-slide {
          0%   { opacity: 0; transform: translateY(-8px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0)   scale(1);     }
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;