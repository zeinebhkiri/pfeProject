package com.onboarding.backend.controller;

import com.onboarding.backend.model.ParcoursTemplate;
import com.onboarding.backend.model.TaskTemplate;
import com.onboarding.backend.repository.ParcoursTemplateRepository;
import com.onboarding.backend.repository.TaskTemplateRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/parcours-templates")
@RequiredArgsConstructor
public class ParcoursTemplateController {

    private final ParcoursTemplateRepository parcoursTemplateRepository;
    private final TaskTemplateRepository taskTemplateRepository;

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

    // ── DTOs ─────────────────────────────────────────────────────────────────
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