package com.onboarding.backend.controller;

import com.onboarding.backend.model.CompanyDocument;
import com.onboarding.backend.repository.CompanyDocumentRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/company-documents")
@RequiredArgsConstructor
public class CompanyDocumentController {

    private final CompanyDocumentRepository companyDocumentRepository;

    // ── Liste tous les documents actifs — tous les rôles ────────────────────
    @GetMapping
    public ResponseEntity<List<CompanyDocument>> getAllDocuments() {
        List<CompanyDocument> docs = companyDocumentRepository
                .findByActifTrueOrderByDateUploadDesc();
        // Ne pas retourner le contenu dans la liste
        docs.forEach(d -> d.setContenu(null));
        return ResponseEntity.ok(docs);
    }

    // ── Récupérer un document avec contenu — tous les rôles ─────────────────
    @GetMapping("/{id}")
    public ResponseEntity<CompanyDocument> getDocument(@PathVariable String id) {
        return companyDocumentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Uploader un document — ADMIN uniquement ──────────────────────────────
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CompanyDocument> uploadDocument(
            Authentication authentication,
            @RequestBody DocumentUploadRequest request) {

        CompanyDocument doc = new CompanyDocument();
        doc.setNom(request.getNom());
        doc.setType(request.getType());
        doc.setDescription(request.getDescription());
        doc.setContenu(request.getContenu());
        doc.setMimeType(request.getMimeType());
        doc.setTaille(request.getTaille());
        doc.setUploadedBy(authentication.getName());
        doc.setDateUpload(LocalDateTime.now());
        doc.setActif(true);

        CompanyDocument saved = companyDocumentRepository.save(doc);
        saved.setContenu(null); // ne pas retourner le contenu
        return ResponseEntity.ok(saved);
    }

    // ── Supprimer (désactiver) un document — ADMIN uniquement ────────────────
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable String id) {
        companyDocumentRepository.findById(id).ifPresent(doc -> {
            doc.setActif(false);
            companyDocumentRepository.save(doc);
        });
        return ResponseEntity.ok(Map.of("message", "Document supprimé."));
    }

    // ── DTO ──────────────────────────────────────────────────────────────────
    @Data
    public static class DocumentUploadRequest {
        private String nom;
        private String type;
        private String description;
        private String contenu;
        private String mimeType;
        private long taille;
    }
}