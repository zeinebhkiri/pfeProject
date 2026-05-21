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
    private List<TypeActeur> typeActeurs;
    private int ordre;
    private boolean obligatoire = true;
    private int delaiJours;
    private String phase;
    private TaskConfig config;

    @Data
    @NoArgsConstructor
    public static class TaskConfig {
        // FORMATION
        private String videoUrl;
        private String fichierContenu;
        private String fichierNom;
        private String fichierMimeType;

        // QUIZ
        private List<Question> questions;
        private int scoreMinimum;

        //  ENTRETIEN
        private Integer dureeMinutes;
        private String lieu;
        private String notesEntretien;

        // SIMPLE
        private String datePlanifiee;
        private String documentContenu;
        private String documentNom;
        private String documentMimeType;
        private String typeDocumentAttendu;
    }

    @Data
    @NoArgsConstructor
    public static class Question {
        private String id;
        private String texte;
        private List<String> options;
        private int bonneReponse;
        private int points;
    }
}