package com.onboarding.backend.controller;

import com.onboarding.backend.model.ParcoursTemplate;
import com.onboarding.backend.model.TaskTemplate;
import com.onboarding.backend.repository.ParcoursTemplateRepository;
import com.onboarding.backend.repository.TaskTemplateRepository;
import com.onboarding.backend.repository.ParcoursRepository;
import com.onboarding.backend.repository.AffectationRepository;
import com.onboarding.backend.repository.UserRepository;
import com.onboarding.backend.service.ParcoursService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/parcours-templates")
@RequiredArgsConstructor
public class ParcoursTemplateController {

    private final ParcoursTemplateRepository parcoursTemplateRepository;
    private final TaskTemplateRepository taskTemplateRepository;
    private final ParcoursRepository parcoursRepository;
    private final AffectationRepository affectationRepository;
    private final UserRepository userRepository;
    private final ParcoursService parcoursService;

    // ── Liste tous les templates actifs ─────────────────────────────────────
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ParcoursTemplate>> getAll() {
        return ResponseEntity.ok(parcoursTemplateRepository.findByActifTrue());
    }

    // ── Template par position ────────────────────────────────────────────────
    @GetMapping("/position/{positionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getByPosition(@PathVariable String positionId) {
        return parcoursTemplateRepository.findByPositionIdAndActifTrue(positionId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Créer un template ────────────────────────────────────────────────────
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody ParcoursTemplateRequest request) {
        // Vérifier qu'il n'existe pas déjà un template pour ce poste
        if (parcoursTemplateRepository.findByPositionIdAndActifTrue(request.getPositionId()).isPresent()) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Un parcours template existe déjà pour ce poste.")
            );
        }
        ParcoursTemplate t = new ParcoursTemplate();
        t.setTitre(request.getTitre());
        t.setDescription(request.getDescription());
        t.setPositionId(request.getPositionId());
        t.setActif(true);
        return ResponseEntity.ok(parcoursTemplateRepository.save(t));
    }

    // ── Modifier un template ─────────────────────────────────────────────────
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable String id,
                                    @RequestBody ParcoursTemplateRequest request) {
        ParcoursTemplate t = parcoursTemplateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template introuvable."));
        t.setTitre(request.getTitre());
        t.setDescription(request.getDescription());
        return ResponseEntity.ok(parcoursTemplateRepository.save(t));
    }

    // ── Supprimer un template ────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable String id) {
        parcoursTemplateRepository.findById(id).ifPresent(t -> {
            t.setActif(false);
            parcoursTemplateRepository.save(t);
        });
        return ResponseEntity.ok(Map.of("message", "Template désactivé."));
    }

    // ── Récupérer les tâches d'un template ──────────────────────────────────
    @GetMapping("/{id}/tasks")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TaskTemplate>> getTasks(@PathVariable String id) {
        return ResponseEntity.ok(
                taskTemplateRepository.findByParcoursTemplateIdOrderByOrdreAsc(id)
        );
    }

    // ── Ajouter une tâche au template ────────────────────────────────────────
    @PostMapping("/{id}/tasks")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> addTask(@PathVariable String id,
                                     @RequestBody TaskTemplate task) {
        task.setId(null);
        task.setParcoursTemplateId(id);
        // Calculer l'ordre automatiquement
        List<TaskTemplate> existing = taskTemplateRepository
                .findByParcoursTemplateIdOrderByOrdreAsc(id);
        task.setOrdre(existing.size() + 1);
        return ResponseEntity.ok(taskTemplateRepository.save(task));
    }

    // ── Modifier une tâche ───────────────────────────────────────────────────
    @PutMapping("/{id}/tasks/{taskId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateTask(@PathVariable String id,
                                        @PathVariable String taskId,
                                        @RequestBody TaskTemplate task) {
        TaskTemplate existing = taskTemplateRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));
        task.setId(taskId);
        task.setParcoursTemplateId(id);
        task.setOrdre(existing.getOrdre());
        return ResponseEntity.ok(taskTemplateRepository.save(task));
    }

    // ── Supprimer une tâche ──────────────────────────────────────────────────
    @DeleteMapping("/{id}/tasks/{taskId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteTask(@PathVariable String id,
                                        @PathVariable String taskId) {
        taskTemplateRepository.deleteById(taskId);
        // Réordonner les tâches restantes
        List<TaskTemplate> tasks = taskTemplateRepository
                .findByParcoursTemplateIdOrderByOrdreAsc(id);
        for (int i = 0; i < tasks.size(); i++) {
            tasks.get(i).setOrdre(i + 1);
            taskTemplateRepository.save(tasks.get(i));
        }
        return ResponseEntity.ok(Map.of("message", "Tâche supprimée."));
    }

    // ── Réordonner les tâches (drag & drop) ─────────────────────────────────
    @PutMapping("/{id}/tasks/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> reorderTasks(@PathVariable String id,
                                          @RequestBody List<ReorderRequest> orders) {
        for (ReorderRequest r : orders) {
            taskTemplateRepository.findById(r.getTaskId()).ifPresent(t -> {
                t.setOrdre(r.getOrdre());
                taskTemplateRepository.save(t);
            });
        }
        return ResponseEntity.ok(Map.of("message", "Ordre mis à jour."));
    }


    // ── Salariés actifs ayant un parcours lié à ce template ─────────────────
    /**
     * Retourne la liste des salariés qui ont actuellement un parcours EN_COURS
     * généré depuis ce template.
     */
    @GetMapping("/{id}/salaries-actifs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getSalariesActifs(@PathVariable String id) {
        // Trouver le positionId du template
        com.onboarding.backend.model.ParcoursTemplate template =
                parcoursTemplateRepository.findById(id).orElse(null);
        if (template == null) return ResponseEntity.notFound().build();

        // Parcours actifs liés à ce poste
        List<com.onboarding.backend.model.Parcours> parcours =
                parcoursRepository.findByPositionId(template.getPositionId())
                        .stream()
                        .filter(p -> p.getStatut() == com.onboarding.backend.model.Parcours.StatutParcours.EN_COURS)
                        .toList();

        List<Map<String, Object>> result = new ArrayList<>();
        for (com.onboarding.backend.model.Parcours p : parcours) {
            com.onboarding.backend.model.User user = userRepository.findById(p.getUserId()).orElse(null);
            if (user == null) continue;
            result.add(Map.of(
                    "userId",      user.getId(),
                    "prenom",      user.getPrenom() != null ? user.getPrenom() : "",
                    "nom",         user.getNom()    != null ? user.getNom()    : "",
                    "email",       user.getEmail()  != null ? user.getEmail()  : "",
                    "parcoursId",  p.getId(),
                    "progression", p.getProgression()
            ));
        }
        return ResponseEntity.ok(result);
    }

    // ── Appliquer les modifications du template aux salariés sélectionnés ───
    /**
     * Pour chaque userId fourni, régénère les tâches manquantes dans leur
     * parcours actif sans supprimer les tâches déjà complétées.
     * Seules les nouvelles tâches du template (non présentes dans le parcours) sont ajoutées.
     */
    @PostMapping("/{id}/apply-to-users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> applyToUsers(
            @PathVariable String id,
            @RequestBody ApplyToUsersRequest request) {

        if (request.getUserIds() == null || request.getUserIds().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Aucun utilisateur sélectionné."));
        }

        parcoursTemplateRepository.findById(id).orElseThrow(
                () -> new RuntimeException("Template introuvable."));

        List<com.onboarding.backend.model.TaskTemplate> templateTasks =
                taskTemplateRepository.findByParcoursTemplateIdOrderByOrdreAsc(id);

        int totalApplied = 0;
        List<String> errors = new ArrayList<>();

        for (String userId : request.getUserIds()) {
            try {
                // Trouver le positionId du template (déjà récupéré plus haut, on refetch si besoin)
                com.onboarding.backend.model.ParcoursTemplate tpl =
                        parcoursTemplateRepository.findById(id).orElse(null);
                if (tpl == null) continue;

                com.onboarding.backend.model.Parcours parcours =
                        parcoursRepository.findByPositionId(tpl.getPositionId())
                                .stream()
                                .filter(p -> p.getUserId().equals(userId)
                                        && p.getStatut() == com.onboarding.backend.model.Parcours.StatutParcours.EN_COURS)
                                .findFirst()
                                .orElse(null);

                if (parcours == null) continue;

                parcoursService.syncParcoursWithTemplate(parcours, templateTasks);
                totalApplied++;
            } catch (Exception e) {
                errors.add(userId + ": " + e.getMessage());
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", totalApplied + " parcours mis à jour avec succès.",
                "applied", totalApplied,
                "errors",  errors
        ));
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────
    @Data
    public static class ApplyToUsersRequest {
        private List<String> userIds;
    }

    @Data
    public static class ParcoursTemplateRequest {
        private String titre;
        private String description;
        private String positionId;
    }

    @Data
    public static class ReorderRequest {
        private String taskId;
        private int ordre;
    }
}