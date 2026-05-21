package com.onboarding.backend.model;

import com.onboarding.backend.model.enums.TaskType;
import com.onboarding.backend.model.enums.TypeActeur;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@Document(collection = "tasks")
public class Task {

    @Id
    private String id;
    private String parcoursId;
   // private String taskTemplateId;

    private String titre;
    private String description;
    private TaskType taskType;
    private List<TypeActeur> typeActeurs;
    private List<String> acteurIds;

    private int ordre;
    private boolean obligatoire;
    private boolean verrouille = false;
    private String phase;
    private StatutTask statut = StatutTask.NON_COMMENCE;
    private LocalDateTime echeance;
    private LocalDateTime dateCompletion;

    private int scoreObtenu;
    private int nbTentatives;
    private int progression;

    // Réponses du salarié au quiz
    private List<Integer> reponsesQuiz;

    // Document déposé par le salarié
    private String documentContenu;
    private String documentNom;
    private String documentMimeType;

    // Commentaires
    private List<Commentaire> commentaires = new ArrayList<>();

    //A task is only TERMINE when all actors have done their part
    private List<ActeurProgression> acteurProgressions;
    private LocalDateTime dateOuverture;
    // Config copiée du template
    private TaskTemplate.TaskConfig config;
    // Dans Task.java — nouveaux champs pour l'entretien
    private String dateEntretien;
    private String documentEntretienContenu;
    private String documentEntretienNom;
    private String documentEntretienMimeType;
    public enum StatutTask {
        NON_COMMENCE,
        EN_COURS,
        TERMINE
    }

    @Data
    @NoArgsConstructor
    public static class Commentaire {
        private String auteurId;
        private String auteurNom;
        private String texte;
        private LocalDateTime date;
    }

    @Data
    @NoArgsConstructor
    public static class ActeurProgression {
        private TypeActeur typeActeur;
        private String acteurId;
        private boolean complete;
        private LocalDateTime dateCompletion;
    }
}