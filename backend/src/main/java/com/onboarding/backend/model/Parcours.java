package com.onboarding.backend.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Document(collection = "parcours")
public class Parcours {

    @Id
    private String id;
    private String userId;
    private String positionId;
    private String parcoursTemplateId;

    private StatutParcours statut = StatutParcours.EN_COURS;
    private LocalDateTime dateDebut;
    private LocalDateTime dateFin;
    private int progression; // 0-100

    public enum StatutParcours {
        EN_COURS,
        TERMINE,
        EXPIRE
    }
}