package com.onboarding.backend.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class FeedbackRequest {
    private String poste;
    private String dateFinIntegration;

    // Section 1
    private int qualiteAccueil;
    private int clarteInformations;
    private int accompagnementManager;

    // Section 2
    private int adaptationTaches;
    private int delaiSuffisant;
    private boolean difficultesRencontrees;
    private String precisionDifficulties;

    // Section 3
    private int faciliteUtilisation;
    private int fonctionnalitesAdaptees;
    private boolean problemTechniques;

    // Section 4
    private int satisfactionGlobale;
    private boolean recommandeProcessus;
    private String suggestions;
}
