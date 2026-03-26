package com.onboarding.backend.model;

import com.onboarding.backend.model.enums.TaskType;
import com.onboarding.backend.model.enums.TypeActeur;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@NoArgsConstructor
@Document(collection = "task_templates")
public class TaskTemplate {

    @Id
    private String id;
    private String parcoursTemplateId;
    private String titre;
    private String description;
    private TaskType taskType;
    private TypeActeur typeActeur;
    private int ordre;
    private boolean obligatoire = true;
    private int delaiJours; // délai en jours depuis le début du parcours
    private TaskConfig config;

    @Data
    @NoArgsConstructor
    public static class TaskConfig {
        // ── FORMATION ──
        private String videoUrl;
        private String fichierContenu;  // base64
        private String fichierNom;
        private String fichierMimeType;

        // ── QUIZ ──
        private List<Question> questions;
        private int scoreMinimum; // ex: 70 = 70%

        // ── DOCUMENT_RH ──
        private String documentContenu; // base64
        private String documentNom;
        private String documentMimeType;

        // ── DOCUMENT_SALARIE ──
        private String typeDocumentAttendu; // ex: "Contrat signé"

        // ── ENTRETIEN ──
        private Integer dureeMinutes;
        private String lieu;
        private String notesEntretien;

        // ── SIMPLE ──
        private String datePlanifiee; // optionnel
    }

    @Data
    @NoArgsConstructor
    public static class Question {
        private String id;
        private String texte;
        private List<String> options; // 4 options
        private int bonneReponse;     // index 0-3
        private int points;
    }
}