package com.onboarding.backend.controller;

import com.onboarding.backend.model.Affectation;
import com.onboarding.backend.model.Position;
import com.onboarding.backend.model.User;
import com.onboarding.backend.model.enums.StatutCompte;
import com.onboarding.backend.repository.AffectationRepository;
import com.onboarding.backend.repository.PositionRepository;
import com.onboarding.backend.repository.UserRepository;
import com.onboarding.backend.service.EmailService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/affectations")
@RequiredArgsConstructor
public class AffectationController {

    private final AffectationRepository affectationRepository;
    private final UserRepository userRepository;
    private final PositionRepository positionRepository;
    private final EmailService emailService;

    // ── Créer ou modifier une affectation ───────────────────────────────────
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createAffectation(@RequestBody AffectationRequest request) {

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Salarié introuvable."));

        if (user.getStatutCompte() != StatutCompte.VALIDE) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Le salarié doit avoir un compte VALIDE pour être affecté.")
            );
        }

        // Vérifier que le poste existe
        Position position = positionRepository.findById(request.getPositionId())
                .orElseThrow(() -> new RuntimeException("Poste introuvable."));

        // Supprimer ancienne affectation si elle existe
        affectationRepository.findByUserId(request.getUserId())
                .ifPresent(affectationRepository::delete);

        // Créer nouvelle affectation
        Affectation affectation = new Affectation();
        affectation.setUserId(request.getUserId());
        affectation.setPositionId(request.getPositionId());
        affectation.setManagerId(request.getManagerId());
        affectation.setDateAffectation(LocalDateTime.now());
        Affectation saved = affectationRepository.save(affectation);

        // Envoyer email de bienvenue
        try {
            String managerNom = null;
            if (request.getManagerId() != null && !request.getManagerId().isBlank()) {
                managerNom = userRepository.findById(request.getManagerId())
                        .map(m -> m.getPrenom() + " " + m.getNom())
                        .orElse(null);
            }
            emailService.sendWelcomeEmail(
                    user.getEmail(),
                    user.getPrenom() + " " + user.getNom(),
                    user.getRole().name(),
                    position.getTitre(),
                    managerNom
            );
        } catch (Exception e) {
            // Ne pas bloquer si l'email échoue
        }

        return ResponseEntity.ok(saved);
    }

    // ── Récupérer l'affectation d'un salarié ────────────────────────────────
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getAffectationByUser(@PathVariable String userId) {
        return affectationRepository.findByUserId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Récupérer toutes les affectations ───────────────────────────────────
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAllAffectations() {
        return ResponseEntity.ok(affectationRepository.findAll());
    }

    // ── DTO ─────────────────────────────────────────────────────────────────
    @Data
    public static class AffectationRequest {
        private String userId;
        private String positionId;  // ← remplace poste
        private String managerId;
    }
}