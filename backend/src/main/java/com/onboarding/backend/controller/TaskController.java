package com.onboarding.backend.controller;

import com.onboarding.backend.model.Task;
import com.onboarding.backend.model.Task.StatutTask;
import com.onboarding.backend.model.TaskTemplate;
import com.onboarding.backend.model.enums.TaskType;
import com.onboarding.backend.repository.TaskRepository;
import com.onboarding.backend.repository.ParcoursRepository;
import com.onboarding.backend.repository.UserRepository;
import com.onboarding.backend.service.ParcoursService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository taskRepository;
    private final ParcoursRepository parcoursRepository;
    private final UserRepository userRepository;
    private final ParcoursService parcoursService;

    // ── Tâches d'un parcours ─────────────────────────────────────────────────
    @GetMapping("/parcours/{parcoursId}")
    public ResponseEntity<List<Task>> getByParcours(@PathVariable String parcoursId) {
        return ResponseEntity.ok(
                taskRepository.findByParcoursIdOrderByOrdreAsc(parcoursId)
        );
    }

    // ── Tâches assignées à un acteur (manager/RH) ────────────────────────────
    @GetMapping("/assigned")
    public ResponseEntity<List<Task>> getAssigned(Authentication auth) {
        String email = auth.getName();
        com.onboarding.backend.model.User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));
        return ResponseEntity.ok(
                taskRepository.findByActeurIdOrderByOrdreAsc(user.getId())
        );
    }

    // ── Démarrer une tâche ───────────────────────────────────────────────────
    @PutMapping("/{taskId}/start")
    public ResponseEntity<?> startTask(@PathVariable String taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));
        if (task.isVerrouille()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Cette tâche est verrouillée."));
        }
        task.setStatut(StatutTask.EN_COURS);
        taskRepository.save(task);
        return ResponseEntity.ok(task);
    }

    // ── Soumettre un quiz ────────────────────────────────────────────────────
    @PutMapping("/{taskId}/submit-quiz")
    public ResponseEntity<?> submitQuiz(@PathVariable String taskId,
                                        @RequestBody QuizSubmitRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        if (task.getTaskType() != TaskType.QUIZ) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cette tâche n'est pas un quiz."));
        }
        if (task.isVerrouille()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tâche verrouillée."));
        }

        task.setReponsesQuiz(request.getReponses());
        task.setNbTentatives(task.getNbTentatives() + 1);

        // Calculer le score
        List<TaskTemplate.Question> questions = task.getConfig().getQuestions();
        int total = questions.stream().mapToInt(TaskTemplate.Question::getPoints).sum();
        int obtenu = 0;
        for (int i = 0; i < questions.size() && i < request.getReponses().size(); i++) {
            if (questions.get(i).getBonneReponse() == request.getReponses().get(i)) {
                obtenu += questions.get(i).getPoints();
            }
        }

        int scorePourcent = total > 0 ? (obtenu * 100) / total : 0;
        task.setScoreObtenu(scorePourcent);

        if (scorePourcent >= task.getConfig().getScoreMinimum()) {
            task.setStatut(StatutTask.TERMINE);
            task.setDateCompletion(LocalDateTime.now());
            task.setProgression(100);


        } else {
            task.setStatut(StatutTask.EN_COURS);
        }

        taskRepository.save(task);
        parcoursService.checkEtDeverrouillerEntretien(task.getParcoursId());
        parcoursService.recalculerProgression(task.getParcoursId());
        return ResponseEntity.ok(task);
    }

    // ── Déposer un document (salarié) ────────────────────────────────────────
    @PutMapping("/{taskId}/submit-document")
    public ResponseEntity<?> submitDocument(@PathVariable String taskId,
                                            @RequestBody DocumentSubmitRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        if (task.getTaskType() != TaskType.DOCUMENT_SALARIE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Type de tâche invalide."));
        }

        task.setDocumentContenu(request.getContenu());
        task.setDocumentNom(request.getNom());
        task.setDocumentMimeType(request.getMimeType());
        task.setStatut(StatutTask.EN_COURS); // en attente de validation manager
        task.setProgression(50);
        taskRepository.save(task);
        return ResponseEntity.ok(task);
    }

    // ── Valider une tâche (manager/RH) ──────────────────────────────────────
    @PutMapping("/{taskId}/validate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> validateTask(@PathVariable String taskId,
                                          @RequestBody ValidateRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        if (request.isApprouve()) {
            task.setStatut(StatutTask.TERMINE);
            task.setProgression(100);
            task.setDateCompletion(LocalDateTime.now());

        } else {
            task.setStatut(StatutTask.REJETE);
        }

        // Ajouter commentaire si présent
        if (request.getCommentaire() != null && !request.getCommentaire().isBlank()) {
            Task.Commentaire c = new Task.Commentaire();
            c.setAuteurId(request.getAuteurId());
            c.setAuteurNom(request.getAuteurNom());
            c.setTexte(request.getCommentaire());
            c.setDate(LocalDateTime.now());
            task.getCommentaires().add(c);
        }

        taskRepository.save(task);
        parcoursService.checkEtDeverrouillerEntretien(task.getParcoursId());
        parcoursService.recalculerProgression(task.getParcoursId());
        return ResponseEntity.ok(task);
    }

    // ── Marquer une tâche SIMPLE comme terminée ──────────────────────────────
    @PutMapping("/{taskId}/complete")
    public ResponseEntity<?> completeTask(@PathVariable String taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));
        if (task.isVerrouille()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tâche verrouillée."));
        }
        task.setStatut(StatutTask.TERMINE);
        task.setProgression(100);
        task.setDateCompletion(LocalDateTime.now());
        taskRepository.save(task);
        parcoursService.checkEtDeverrouillerEntretien(task.getParcoursId());
        parcoursService.recalculerProgression(task.getParcoursId());
        return ResponseEntity.ok(task);
    }

    // ── Ajouter un commentaire ───────────────────────────────────────────────
    @PostMapping("/{taskId}/comments")
    public ResponseEntity<?> addComment(@PathVariable String taskId,
                                        @RequestBody CommentRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));
        Task.Commentaire c = new Task.Commentaire();
        c.setAuteurId(request.getAuteurId());
        c.setAuteurNom(request.getAuteurNom());
        c.setTexte(request.getTexte());
        c.setDate(LocalDateTime.now());
        task.getCommentaires().add(c);
        taskRepository.save(task);
        return ResponseEntity.ok(task);
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────
    @Data public static class QuizSubmitRequest { private List<Integer> reponses; }

    @Data public static class DocumentSubmitRequest {
        private String contenu; private String nom; private String mimeType;
    }

    @Data public static class ValidateRequest {
        private boolean approuve;
        private String commentaire;
        private String auteurId;
        private String auteurNom;
    }

    @Data public static class CommentRequest {
        private String auteurId; private String auteurNom; private String texte;
    }
    // ── Planifier un entretien (manager) ────────────────────────────────
    @PutMapping("/{taskId}/planifier-entretien")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<?> planifierEntretien(
            @PathVariable String taskId,
            @RequestBody EntretienRequest request) {

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        task.setDateEntretien(request.getDateEntretien());

        if (request.getDocumentContenu() != null && !request.getDocumentContenu().isBlank()) {
            task.setDocumentEntretienContenu(request.getDocumentContenu());
            task.setDocumentEntretienNom(request.getDocumentNom());
            task.setDocumentEntretienMimeType(request.getDocumentMimeType());
        }

        taskRepository.save(task);
        return ResponseEntity.ok(task);
    }

    // ── DTO ──────────────────────────────────────────────────────────────
    @Data
    public static class EntretienRequest {
        private String dateEntretien;
        private String documentContenu;  // base64 optionnel
        private String documentNom;
        private String documentMimeType;
    }
}