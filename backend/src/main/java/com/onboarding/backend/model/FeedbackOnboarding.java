package com.onboarding.backend.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Document(collection = "feedback_onboarding")
public class FeedbackOnboarding {

    @Id
    private String id;

    // Employee info
    private String salarieId;
    private String salarieNom;
    private String salariePrenom;
    private String poste;
    private LocalDateTime dateFinIntegration;
    private LocalDateTime dateSubmission;

    // Section 1: Accueil et intégration
    private int qualiteAccueil;           // 4=Très satisfaisant, 3=Satisfaisant, 2=Moyen, 1=Insatisfaisant
    private int clarteInformations;       // 3=Oui totalement, 2=Oui partiellement, 1=Non
    private int accompagnementManager;    // 4=Excellent, 3=Bon, 2=Moyen, 1=Insuffisant

    // Section 2: Parcours d'intégration
    private int adaptationTaches;         // 4=Très adaptées, 3=Adaptées, 2=Peu adaptées, 1=Pas adaptées
    private int delaiSuffisant;           // 3=Oui, 2=Partiellement, 1=Non
    private boolean difficultesRencontrees;
    private String precisionDifficulties;

    // Section 3: Plateforme
    private int faciliteUtilisation;      // 4=Très facile, 3=Facile, 2=Moyenne, 1=Difficile
    private int fonctionnalitesAdaptees;  // 3=Oui totalement, 2=Oui partiellement, 1=Non
    private boolean problemTechniques;

    // Section 4: Satisfaction globale
    private int satisfactionGlobale;      // 4=Très satisfait, 3=Satisfait, 2=Peu satisfait, 1=Insatisfait
    private boolean recommandeProcessus;
    private String suggestions;
}
