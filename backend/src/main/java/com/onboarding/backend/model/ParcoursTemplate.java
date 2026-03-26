package com.onboarding.backend.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@Document(collection = "parcours_templates")
public class ParcoursTemplate {

    @Id
    private String id;
    private String titre;
    private String description;
    private String positionId; // 1 position = 1 parcours template
    private boolean actif = true;
}