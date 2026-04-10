package com.onboarding.backend.controller;

import com.onboarding.backend.model.Affectation;
import com.onboarding.backend.model.Position;
import com.onboarding.backend.model.User;
import com.onboarding.backend.model.enums.StatutCompte;
import com.onboarding.backend.repository.AffectationRepository;
import com.onboarding.backend.repository.PositionRepository;
import com.onboarding.backend.repository.UserRepository;
import com.onboarding.backend.service.EmailService;
import com.onboarding.backend.service.ParcoursService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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
    private final ParcoursService parcoursService;
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
        if (request.getDatePriseDePoste() != null && !request.getDatePriseDePoste().isBlank()) {
            if (user.getProfessionalInfo() == null)
                user.setProfessionalInfo(new User.ProfessionalInfo());
            user.getProfessionalInfo().setDatePriseDePoste(
                    LocalDate.parse(request.getDatePriseDePoste())
            );
            user.getProfessionalInfo().setDatePriseDePostePersonnalisee(true);
            userRepository.save(user);
        } else {
            // ⭐ Si aucune date n'est fournie, utiliser la date d'embauche
            if (user.getProfessionalInfo() != null && user.getProfessionalInfo().getDateEmbauche() != null) {
                if (user.getProfessionalInfo().getDatePriseDePoste() == null) {
                    user.getProfessionalInfo().setDatePriseDePoste(user.getProfessionalInfo().getDateEmbauche());
                    userRepository.save(user);
                }
            }
        }

        Affectation saved = affectationRepository.save(affectation);
        try {
            parcoursService.genererParcours(
                    request.getUserId(),
                    request.getPositionId(),
                    request.getManagerId()
            );
        } catch (Exception e) {
            System.out.println("Parcours non généré : " + e.getMessage());
        }
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
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<?> getAllAffectations() {
        return ResponseEntity.ok(affectationRepository.findAll());
    }

    // ── DTO ─────────────────────────────────────────────────────────────────
    @Data
    public static class AffectationRequest {
        private String userId;
        private String positionId;  // ← remplace poste
        private String managerId;
        private String datePriseDePoste;
    }
}