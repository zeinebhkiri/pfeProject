package com.onboarding.backend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "company_documents")
public class CompanyDocument {

    @Id
    private String id;
    private String nom;
    private String type;        // REGLEMENT, MUTUELLE, INFO_ENTREPRISE, SECTEUR, PARTENAIRES, AUTRE
    private String description;
    private String contenu;     // base64
    private String mimeType;
    private long taille;        // taille en bytes
    private String uploadedBy;  // email admin
    private LocalDateTime dateUpload;
    private boolean actif = true;
}