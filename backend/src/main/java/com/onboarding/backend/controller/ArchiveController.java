package com.onboarding.backend.controller;

import com.onboarding.backend.model.*;
import com.onboarding.backend.model.enums.StatutCompte;
import com.onboarding.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/archive")
@RequiredArgsConstructor
public class ArchiveController {

    private final ParcoursRepository      parcoursRepository;
    private final ParcoursTemplateRepository parcoursTemplateRepository;
    private final TaskRepository          taskRepository;
    private final UserRepository          userRepository;
    private final PositionRepository        positionRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Parcours terminés (statut = TERMINE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne tous les parcours dont le statut est TERMINE,
     * enrichis des informations du salarié et de ses tâches.
     */
    @GetMapping("/parcours-termines")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getParcoursTermines() {

        List<Parcours> termines = parcoursRepository
                .findByStatut(Parcours.StatutParcours.TERMINE);

        List<Map<String, Object>> result = termines.stream().map(parcours -> {
            Map<String, Object> entry = new HashMap<>();
            entry.put("parcours", parcours);

            // Salarié associé
            User salarie = userRepository.findById(parcours.getUserId()).orElse(null);
            entry.put("salarie", salarie);

            // Tâches associées
            List<Task> tasks = taskRepository
                    .findByParcoursIdOrderByOrdreAsc(parcours.getId());
            entry.put("tasks", tasks != null ? tasks : List.of());

            return entry;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Anciens collaborateurs (statutCompte = DESACTIVE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne tous les utilisateurs désactivés, avec leur dernier
     * parcours et leurs tâches (lecture seule).
     */
    @GetMapping("/anciens-collaborateurs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getAnciensCollaborateurs() {

        List<User> desactives = userRepository
                .findByStatutCompte(StatutCompte.DESACTIVE);

        List<Map<String, Object>> result = desactives.stream().map(user -> {
            Map<String, Object> entry = new HashMap<>();
            entry.put("salarie", user);

            // Dernier parcours (il peut ne plus en avoir)
            Parcours parcours = parcoursRepository
                    .findByUserId(user.getId()).orElse(null);
            entry.put("parcours", parcours);

            // Tâches si parcours existant
            List<Task> tasks = List.of();
            if (parcours != null) {
                List<Task> found = taskRepository
                        .findByParcoursIdOrderByOrdreAsc(parcours.getId());
                tasks = found != null ? found : List.of();
            }
            entry.put("tasks", tasks);

            return entry;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Modèles de parcours archivés (actif = false)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne tous les ParcoursTemplate dont le champ actif est false.
     */
    @GetMapping("/modeles-archives")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ParcoursTemplate>> getModelesArchives() {
        return ResponseEntity.ok(parcoursTemplateRepository.findByActifFalse());
    }

    /**
     * Restaure un modèle archivé : remet actif = true.
     * Vérifie qu'aucun autre modèle actif n'existe déjà pour le même poste.
     */
    @PutMapping("/modeles-archives/{id}/restaurer")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> restaurerModele(@PathVariable String id) {
        ParcoursTemplate template = parcoursTemplateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Modèle introuvable."));

        // Vérifier conflit : un modèle actif existe-t-il déjà pour ce poste ?
        boolean conflitExiste = parcoursTemplateRepository
                .findByPositionIdAndActifTrue(template.getPositionId())
                .isPresent();

        if (conflitExiste) {
            return ResponseEntity.badRequest().body(
                    Map.of("error",
                            "Un modèle actif existe déjà pour ce poste. " +
                                    "Archivez-le d'abord avant de restaurer celui-ci.")
            );
        }

        template.setActif(true);
        parcoursTemplateRepository.save(template);
        return ResponseEntity.ok(Map.of("message", "Modèle restauré avec succès."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Postes archivés (actif = false)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne tous les postes archivés (actif = false)
     */
    @GetMapping("/postes-archives")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Position>> getPostesArchives() {
        return ResponseEntity.ok(positionRepository.findByActifFalse());
    }

    /**
     * Restaure un poste archivé : remet actif = true
     */
    @PutMapping("/postes-archives/{id}/restaurer")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> restaurerPoste(@PathVariable String id) {
        Position position = positionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Poste introuvable."));

        if (position.isActif()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Ce poste est déjà actif."));
        }

        position.setActif(true);
        positionRepository.save(position);
        return ResponseEntity.ok(Map.of("message", "Poste restauré avec succès."));
    }
}

