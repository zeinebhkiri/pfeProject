package com.onboarding.backend.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Document(collection = "affectations")
public class Affectation {

    @Id
    private String id;
    private String userId;       // ID du salarié affecté
    private String positionId;       // Ex: "Développeur Backend"
    private String managerId;    // ID du manager superviseur
    private LocalDateTime dateAffectation;
}