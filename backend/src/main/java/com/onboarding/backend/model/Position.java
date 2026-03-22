package com.onboarding.backend.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@Document(collection = "positions")
public class Position {

    @Id
    private String id;
    private String titre;        // Ex: "Développeur logiciel"
    private String description;  // Optionnel
    private boolean actif = true;
}