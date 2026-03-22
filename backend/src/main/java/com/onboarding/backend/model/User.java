package com.onboarding.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.onboarding.backend.model.enums.Role;
import com.onboarding.backend.model.enums.StatutCompte;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String nom;
    private String prenom;

    @Indexed(unique = true)
    private String email;

    private String password;

    private Role role;
    private StatutCompte statutCompte;
    private int profilCompletion;

    private Profile profile;

    private LocalDateTime dateCreation;
    private LocalDateTime dateValidation;
    private String poste; // ← AJOUTER après dateValidation
    private LocalDateTime dateLimit;
    private ProfessionalInfo professionalInfo;

    @Data
    @NoArgsConstructor
    public static class Profile {
        private String adresse;
        private String rib;
        private String telephone;
        private String image;
        // ───── NOUVELLES COORDONNEES PERSONNELLES ─────

        private String numeroCnss;
        private LocalDate dateNaissance;
        private String lieuNaissance;
        private String nomBanque;
        private String statutSocial; // MARIE / CELIBATAIRE
        private String nationalite;
        private String genre; // HOMME / FEMME
        private String photoPoste;
        private List<Document> documents = new ArrayList<>();

    }
    //classe Document imbriquée
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Document {
        private String id;           // UUID généré
        private String nom;          // nom du fichier
        private String type;         // "RIB", "DIPLOME", "CIN", "AUTRE"
        private String contenu;      // base64
        private String mimeType;     // "application/pdf", "image/jpeg"...
        private LocalDateTime dateUpload;
    }
    @Data
    @NoArgsConstructor
    public static class ProfessionalInfo {

        private String emailProfessionnel;
        private String telephoneProfessionnel;
        private LocalDate dateEmbauche;

    }
}