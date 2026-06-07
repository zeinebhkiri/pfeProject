package com.onboarding.backend.model;

import com.onboarding.backend.model.enums.TaskType;
import com.onboarding.backend.model.enums.TypeActeur;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Snapshot complet et immuable d'un parcours terminé.
 *
 * Créé automatiquement lors d'un changement de poste (poste source = terminé).
 * Contient tout ce qui est nécessaire pour reconstituer l'historique :
 *  - Identité du salarié et du manager (dénormalisés)
 *  - Poste occupé
 *  - Dates clés (embauche, prise de poste, début/fin parcours)
 *  - Snapshot de toutes les tâches avec leurs résultats
 *  - Statistiques de complétion
 *
 * Cet enregistrement n'est JAMAIS modifié après création.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "archives_parcours")
public class ArchiveParcours {

    @Id
    private String id;

    // ────────────────────────────────────────────────────────────────────────
    //  SECTION 1 — Identifiants (pour requêtes)
    // ────────────────────────────────────────────────────────────────────────

    /** ID du salarié */
    private String userId;

    /** ID de l'ancien parcours (référence conservée pour traçabilité) */
    private String parcoursOriginalId;

    /** ID du poste occupé pendant ce parcours */
    private String positionId;

    /** ID du manager superviseur */
    private String managerId;

    // ────────────────────────────────────────────────────────────────────────
    //  SECTION 2 — Identité (valeurs figées au moment de l'archivage)
    // ────────────────────────────────────────────────────────────────────────

    /** Nom complet du salarié */
    private String nomSalarie;

    /** Email du salarié */
    private String emailSalarie;

    /** Intitulé exact du poste */
    private String titrePoste;

    /** Nom complet du manager */
    private String nomManager;

    /** Email du manager */
    private String emailManager;

    // ────────────────────────────────────────────────────────────────────────
    //  SECTION 3 — Dates clés du poste
    // ────────────────────────────────────────────────────────────────────────

    /** Date d'embauche initiale dans l'entreprise */
    private LocalDate dateEmbauche;

    /** Date de prise effective de ce poste */
    private LocalDate datePriseDePoste;

    /** Date à laquelle ce poste a été quitté (= date du changement) */
    private LocalDate dateFinPoste;

    // ────────────────────────────────────────────────────────────────────────
    //  SECTION 4 — Données du parcours
    // ────────────────────────────────────────────────────────────────────────

    /** Date de début du parcours */
    private LocalDateTime dateDebutParcours;

    /** Date de fin / complétion du parcours */
    private LocalDateTime dateFinParcours;

    /** Progression finale (0-100) */
    private int progressionFinale;

    /** Statut final (toujours TERMINE pour déclencher un archivage) */
    private String statutFinal;

    // ────────────────────────────────────────────────────────────────────────
    //  SECTION 5 — Statistiques de complétion
    // ────────────────────────────────────────────────────────────────────────

    private int nombreTachesTotal;
    private int nombreTachesTerminees;
    private int nombreTachesObligatoires;
    private int nombreTachesObligatoiresTerminees;
    private int scoreTotalObtenu;

    // ────────────────────────────────────────────────────────────────────────
    //  SECTION 6 — Snapshot des tâches (figées définitivement)
    // ────────────────────────────────────────────────────────────────────────

    /** Toutes les tâches du parcours, figées avec leurs résultats */
    private List<TacheArchivee> taches;

    // ────────────────────────────────────────────────────────────────────────
    //  SECTION 7 — Méta-données
    // ────────────────────────────────────────────────────────────────────────

    /** Date et heure de création de cette archive */
    private LocalDateTime dateArchivage;

    /** Motif de l'archivage */
    private String motifArchivage;

    /** Nouveau poste vers lequel le salarié a été réaffecté */
    private String nouveauPosteId;

    /** Intitulé du nouveau poste */
    private String titreNouveauPoste;

    // ────────────────────────────────────────────────────────────────────────
    //  Classe interne : snapshot d'une tâche
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Représentation immuable d'une tâche au moment de l'archivage.
     * Contient tous les résultats : score, document, réponses quiz, etc.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TacheArchivee {

        private String taskOriginalId;
        private String titre;
        private String description;
        private TaskType taskType;
        private List<TypeActeur> typeActeurs;
        private int ordre;
        private boolean obligatoire;
        private String phase;
        private String statut;

        /** Date limite qui était fixée */
        private LocalDateTime echeance;

        /** Date effective de complétion */
        private LocalDateTime dateCompletion;

        /** Score obtenu au quiz */
        private int scoreObtenu;

        /** Nombre de tentatives pour les quiz */
        private int nbTentatives;

        /** Progression individuelle de la tâche */
        private int progression;

        /** Nom du document déposé (si applicable) */
        private String documentNom;

        /** Tâche complétée dans les délais ? */
        private boolean completeDansLesDelais;
    }
}