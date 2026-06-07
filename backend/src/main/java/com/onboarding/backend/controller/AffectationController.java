package com.onboarding.backend.controller;

import com.onboarding.backend.model.*;
import com.onboarding.backend.model.enums.StatutCompte;
import com.onboarding.backend.repository.*;
import com.onboarding.backend.service.EmailService;
import com.onboarding.backend.service.ParcoursService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/affectations")
@RequiredArgsConstructor
public class AffectationController {

    private final AffectationRepository     affectationRepository;
    private final UserRepository            userRepository;
    private final PositionRepository        positionRepository;
    private final ParcoursRepository        parcoursRepository;
    private final TaskRepository            taskRepository;
    private final ArchiveParcoursRepository archiveParcoursRepository;
    private final EmailService              emailService;
    private final ParcoursService           parcoursService;

    // =========================================================================
    //  1. PREMIERE AFFECTATION
    // =========================================================================
    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createAffectation(@RequestBody AffectationRequest request) {

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Salarié introuvable."));

        if (user.getStatutCompte() != StatutCompte.VALIDE) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Le salarié doit avoir un compte VALIDE pour être affecté."));
        }

        Position position = positionRepository.findById(request.getPositionId())
                .orElseThrow(() -> new RuntimeException("Poste introuvable."));

        Optional<Affectation> existante = affectationRepository.findByUserId(request.getUserId());
        if (existante.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Ce salarié a déjà une affectation. Utilisez le changement de poste."));
        }

        Affectation affectation = new Affectation();
        affectation.setUserId(request.getUserId());
        affectation.setPositionId(request.getPositionId());
        affectation.setManagerId(request.getManagerId());

        appliquerDatePriseDePoste(user, request.getDatePriseDePoste());
        userRepository.save(user);

        Affectation saved = affectationRepository.save(affectation);

        try {
            parcoursService.genererParcours(
                    request.getUserId(), request.getPositionId(), request.getManagerId());
        } catch (Exception e) {
            System.out.println("Parcours non généré : " + e.getMessage());
        }

        envoyerEmailBienvenue(user, position, request.getManagerId());
        return ResponseEntity.ok(saved);
    }

    // =========================================================================
    //  2. CHANGEMENT DE POSTE (parcours terminé requis + archivage)
    // =========================================================================
    @PostMapping("/change-poste")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> changePoste(@RequestBody ChangePosteRequest request) {

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Salarié introuvable."));

        Position nouveauPoste = positionRepository.findById(request.getNouveauPositionId())
                .orElseThrow(() -> new RuntimeException("Nouveau poste introuvable."));

        Affectation ancienneAffectation = affectationRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> new RuntimeException(
                        "Ce salarié n'a pas d'affectation existante."));

        Optional<Parcours> parcoursOpt = parcoursRepository.findByUserId(request.getUserId());
        if (parcoursOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Aucun parcours trouvé pour ce salarié."));
        }

        Parcours parcoursActuel = parcoursOpt.get();
        boolean parcoursTermine =
                parcoursActuel.getStatut() == Parcours.StatutParcours.TERMINE ||
                        parcoursActuel.getProgression() >= 100;

        if (!parcoursTermine) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Le parcours du salarié n'est pas encore terminé " +
                            "(progression : " + parcoursActuel.getProgression() + "%). " +
                            "Le changement de poste est uniquement possible une fois " +
                            "le parcours d'intégration complété à 100%.",
                    "progression", parcoursActuel.getProgression(),
                    "statut", parcoursActuel.getStatut().name()));
        }

        Position ancienPoste = positionRepository
                .findById(ancienneAffectation.getPositionId()).orElse(null);

        // Archiver
        archiverParcours(parcoursActuel, user, ancienPoste,
                ancienneAffectation, nouveauPoste, request.getMotif());

        // Nouvelle affectation
        affectationRepository.delete(ancienneAffectation);

        Affectation nouvelleAffectation = new Affectation();
        nouvelleAffectation.setUserId(request.getUserId());
        nouvelleAffectation.setPositionId(request.getNouveauPositionId());
        nouvelleAffectation.setManagerId(
                request.getNouveauManagerId() != null && !request.getNouveauManagerId().isBlank()
                        ? request.getNouveauManagerId()
                        : ancienneAffectation.getManagerId());

        appliquerDatePriseDePoste(user, request.getNouveauDatePriseDePoste());
        userRepository.save(user);

        Affectation savedAffectation = affectationRepository.save(nouvelleAffectation);

        try {
            parcoursService.genererParcours(
                    request.getUserId(),
                    request.getNouveauPositionId(),
                    nouvelleAffectation.getManagerId());
        } catch (Exception e) {
            System.out.println("Nouveau parcours non généré : " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "message", "Changement de poste effectué. Le parcours précédent a été archivé.",
                "affectation", savedAffectation));
    }

    // =========================================================================
    //  3. ELIGIBILITE AU CHANGEMENT DE POSTE
    // =========================================================================
    @GetMapping("/change-poste/eligibilite/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> verifierEligibilite(@PathVariable String userId) {

        Optional<Affectation> affectation = affectationRepository.findByUserId(userId);
        if (affectation.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "eligible", false,
                    "hasAffectation", false,
                    "raison", "Aucune affectation existante."));
        }

        Optional<Parcours> parcoursOpt = parcoursRepository.findByUserId(userId);
        if (parcoursOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "eligible", false,
                    "hasAffectation", true,
                    "raison", "Aucun parcours trouvé."));
        }

        Parcours parcours = parcoursOpt.get();
        boolean termine =
                parcours.getStatut() == Parcours.StatutParcours.TERMINE ||
                        parcours.getProgression() >= 100;

        return ResponseEntity.ok(Map.of(
                "eligible", termine,
                "hasAffectation", true,
                "progression", parcours.getProgression(),
                "statutParcours", parcours.getStatut().name(),
                "raison", termine
                        ? "Le parcours est terminé. Le changement de poste est autorisé."
                        : "Parcours en cours (" + parcours.getProgression() + "%). " +
                        "Complétez le parcours avant de changer de poste."));
    }

    // =========================================================================
    //  4. HISTORIQUE DES POSTES D'UN SALARIE
    // =========================================================================
    @GetMapping("/historique/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> getHistoriquePostesSalarie(@PathVariable String userId) {
        List<ArchiveParcours> archives =
                archiveParcoursRepository.findByUserIdOrderByDateFinPosteDesc(userId);
        return ResponseEntity.ok(archives);
    }

    // =========================================================================
    //  5. ENDPOINTS EXISTANTS
    // =========================================================================
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getAffectationByUser(@PathVariable String userId) {
        return affectationRepository.findByUserId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('SALARIE')")
    public ResponseEntity<?> getAllAffectations() {
        return ResponseEntity.ok(affectationRepository.findAll());
    }

    // =========================================================================
    //  METHODES PRIVEES
    // =========================================================================

    private void archiverParcours(Parcours parcours, User user, Position ancienPoste,
                                  Affectation ancienneAffectation, Position nouveauPoste, String motif) {

        List<Task> taches = taskRepository.findByParcoursIdOrderByOrdreAsc(parcours.getId());

        User manager = ancienneAffectation.getManagerId() != null
                ? userRepository.findById(ancienneAffectation.getManagerId()).orElse(null)
                : null;

        int totalTaches          = taches.size();
        int tachesTerminees      = (int) taches.stream()
                .filter(t -> t.getStatut() == Task.StatutTask.TERMINE).count();
        int tachesObligatoires   = (int) taches.stream().filter(Task::isObligatoire).count();
        int tachesObligTerminees = (int) taches.stream()
                .filter(t -> t.isObligatoire() && t.getStatut() == Task.StatutTask.TERMINE).count();
        int scoreTotalObtenu     = taches.stream().mapToInt(Task::getScoreObtenu).sum();

        List<ArchiveParcours.TacheArchivee> tachesArchivees = taches.stream().map(t -> {
            boolean dansLesDelais = t.getDateCompletion() == null
                    || t.getEcheance() == null
                    || !t.getDateCompletion().isAfter(t.getEcheance());
            return new ArchiveParcours.TacheArchivee(
                    t.getId(), t.getTitre(), t.getDescription(),
                    t.getTaskType(), t.getTypeActeurs(),
                    t.getOrdre(), t.isObligatoire(), t.getPhase(),
                    t.getStatut() != null ? t.getStatut().name() : "NON_COMMENCE",
                    t.getEcheance(), t.getDateCompletion(),
                    t.getScoreObtenu(), t.getNbTentatives(), t.getProgression(),
                    t.getDocumentNom(), dansLesDelais);
        }).collect(Collectors.toList());

        LocalDate dateEmbauche     = null;
        LocalDate datePriseDePoste = null;
        if (user.getProfessionalInfo() != null) {
            dateEmbauche     = user.getProfessionalInfo().getDateEmbauche();
            datePriseDePoste = user.getProfessionalInfo().getDatePriseDePoste();
        }

        ArchiveParcours archive = ArchiveParcours.builder()
                .userId(user.getId())
                .parcoursOriginalId(parcours.getId())
                .positionId(ancienneAffectation.getPositionId())
                .managerId(ancienneAffectation.getManagerId())
                .nomSalarie(user.getPrenom() + " " + user.getNom())
                .emailSalarie(user.getEmail())
                .titrePoste(ancienPoste != null ? ancienPoste.getTitre() : "Poste inconnu")
                .nomManager(manager != null
                        ? manager.getPrenom() + " " + manager.getNom() : "Manager inconnu")
                .emailManager(manager != null ? manager.getEmail() : null)
                .dateEmbauche(dateEmbauche)
                .datePriseDePoste(datePriseDePoste)
                .dateFinPoste(LocalDate.now())
                .dateDebutParcours(parcours.getDateDebut())
                .dateFinParcours(parcours.getDateFin() != null
                        ? parcours.getDateFin() : LocalDateTime.now())
                .progressionFinale(parcours.getProgression())
                .statutFinal(parcours.getStatut().name())
                .nombreTachesTotal(totalTaches)
                .nombreTachesTerminees(tachesTerminees)
                .nombreTachesObligatoires(tachesObligatoires)
                .nombreTachesObligatoiresTerminees(tachesObligTerminees)
                .scoreTotalObtenu(scoreTotalObtenu)
                .taches(tachesArchivees)
                .dateArchivage(LocalDateTime.now())
                .motifArchivage(motif != null && !motif.isBlank() ? motif : "Changement de poste")
                .nouveauPosteId(nouveauPoste.getId())
                .titreNouveauPoste(nouveauPoste.getTitre())
                .build();

        archiveParcoursRepository.save(archive);

        if (parcours.getStatut() != Parcours.StatutParcours.TERMINE) {
            parcours.setStatut(Parcours.StatutParcours.TERMINE);
            parcours.setDateFin(LocalDateTime.now());
            parcoursRepository.save(parcours);
        }
    }

    private void appliquerDatePriseDePoste(User user, String datePriseDePosteStr) {
        if (user.getProfessionalInfo() == null)
            user.setProfessionalInfo(new User.ProfessionalInfo());

        if (datePriseDePosteStr != null && !datePriseDePosteStr.isBlank()) {
            user.getProfessionalInfo().setDatePriseDePoste(LocalDate.parse(datePriseDePosteStr));
            user.getProfessionalInfo().setDatePriseDePostePersonnalisee(true);
        } else if (user.getProfessionalInfo().getDatePriseDePoste() == null
                && user.getProfessionalInfo().getDateEmbauche() != null) {
            user.getProfessionalInfo().setDatePriseDePoste(
                    user.getProfessionalInfo().getDateEmbauche());
        }
    }

    private void envoyerEmailBienvenue(User user, Position position, String managerId) {
        try {
            String managerNom = managerId != null && !managerId.isBlank()
                    ? userRepository.findById(managerId)
                    .map(m -> m.getPrenom() + " " + m.getNom()).orElse(null)
                    : null;
            emailService.sendWelcomeEmail(user.getEmail(),
                    user.getPrenom() + " " + user.getNom(),
                    user.getRole().name(), position.getTitre(), managerNom);
        } catch (Exception ignored) {}
    }

    // DTOs
    @Data
    public static class AffectationRequest {
        private String userId;
        private String positionId;
        private String managerId;
        private String datePriseDePoste;
    }

    @Data
    public static class ChangePosteRequest {
        private String userId;
        private String nouveauPositionId;
        private String nouveauManagerId;
        private String nouveauDatePriseDePoste;
        private String motif;
    }
}