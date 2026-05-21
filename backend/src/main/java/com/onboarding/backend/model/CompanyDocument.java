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
    private String type;
    private String description;
    private String contenu;
    private String mimeType;
    private long taille;
    private String uploadedBy;
    private LocalDateTime dateUpload;
    private boolean actif = true;
}