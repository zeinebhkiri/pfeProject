package com.onboarding.backend.controller;

import com.onboarding.backend.model.Task;
import com.onboarding.backend.model.Task.StatutTask;
import com.onboarding.backend.model.TaskTemplate;
import com.onboarding.backend.model.User;
import com.onboarding.backend.model.enums.Role;
import com.onboarding.backend.model.enums.TaskType;
import com.onboarding.backend.model.enums.TypeActeur;
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
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));
        return ResponseEntity.ok(
                taskRepository.findByActeurIdsContainingOrderByOrdreAsc(user.getId())
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
                                        @RequestBody QuizSubmitRequest request,
                                        Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        if (task.getTaskType() != TaskType.QUIZ) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cette tâche n'est pas un quiz."));
        }
        if (task.isVerrouille()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tâche verrouillée."));
        }

        // ⭐ NOUVEAU : Vérifier le nombre maximal de tentatives (max 3)
        int maxTentatives = 3;
        if (task.getNbTentatives() >= maxTentatives) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Vous avez dépassé le nombre maximum de tentatives (" + maxTentatives + "). Quiz bloqué."));
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
            // Le SALARIE a réussi le quiz — marquer sa progression
            TypeActeur acteurCourant = getTypeActeurFromAuth(auth);
            boolean tousComplete = marquerActeurComplete(task, acteurCourant);

            if (tousComplete) {
                task.setStatut(StatutTask.TERMINE);
                task.setDateCompletion(LocalDateTime.now());
                task.setProgression(100);
            } else {
                // D'autres acteurs doivent encore intervenir
                task.setStatut(StatutTask.EN_COURS);
                task.setProgression(50);
            }
        } else {
            task.setStatut(StatutTask.EN_COURS);

            // ⭐ NOUVEAU : Si plus de tentatives après cet échec, verrouiller définitivement
            if (task.getNbTentatives() >= maxTentatives) {
                task.setVerrouille(true);
                task.setStatut(StatutTask.REJETE);
            }
        }

        taskRepository.save(task);
        parcoursService.checkEtDeverrouillerEntretien(task.getParcoursId());
        parcoursService.recalculerProgression(task.getParcoursId());
        return ResponseEntity.ok(task);
    }

    // ── Déposer un document (salarié) ────────────────────────────────────────
    @PutMapping("/{taskId}/submit-document")
    public ResponseEntity<?> submitDocument(@PathVariable String taskId,
                                            @RequestBody DocumentSubmitRequest request,
                                            Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        if (task.getTaskType() != TaskType.DOCUMENT_SALARIE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Type de tâche invalide."));
        }

        task.setDocumentContenu(request.getContenu());
        task.setDocumentNom(request.getNom());
        task.setDocumentMimeType(request.getMimeType());

        // Marquer la part du SALARIE comme faite
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth);
        boolean tousComplete = marquerActeurComplete(task, acteurCourant);

        if (tousComplete) {
            // Cas DOCUMENT_SALARIE + typeActeurs = [SALARIE] seulement → auto-complet
            task.setStatut(StatutTask.TERMINE);
            task.setProgression(100);
            task.setDateCompletion(LocalDateTime.now());
        } else {
            // En attente de validation manager/RH
            task.setStatut(StatutTask.EN_COURS);
            task.setProgression(50);
        }

        taskRepository.save(task);

        if (tousComplete) {
            parcoursService.checkEtDeverrouillerEntretien(task.getParcoursId());
            parcoursService.recalculerProgression(task.getParcoursId());
        }

        return ResponseEntity.ok(task);
    }

    // ── Valider une tâche (manager/RH) ──────────────────────────────────────
    @PutMapping("/{taskId}/validate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> validateTask(@PathVariable String taskId,
                                          @RequestBody ValidateRequest request,
                                          Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        // Ajouter commentaire si présent
        if (request.getCommentaire() != null && !request.getCommentaire().isBlank()) {
            Task.Commentaire c = new Task.Commentaire();
            c.setAuteurId(request.getAuteurId());
            c.setAuteurNom(request.getAuteurNom());
            c.setTexte(request.getCommentaire());
            c.setDate(LocalDateTime.now());
            task.getCommentaires().add(c);
        }

        if (request.isApprouve()) {
            // Marquer la part de cet acteur comme faite
            TypeActeur acteurCourant = getTypeActeurFromAuth(auth);
            boolean tousComplete = marquerActeurComplete(task, acteurCourant);

            if (tousComplete) {
                task.setStatut(StatutTask.TERMINE);
                task.setProgression(100);
                task.setDateCompletion(LocalDateTime.now());
            } else {
                // D'autres acteurs doivent encore valider
                task.setStatut(StatutTask.EN_COURS);
                task.setProgression(50);
            }
        } else {
            // Rejet → reset les progressions pour que tout recommence
            task.setStatut(StatutTask.REJETE);
            task.setProgression(0);
            resetActeurProgressions(task);
        }

        taskRepository.save(task);
        parcoursService.checkEtDeverrouillerEntretien(task.getParcoursId());
        parcoursService.recalculerProgression(task.getParcoursId());
        return ResponseEntity.ok(task);
    }

    // ── Marquer une tâche SIMPLE/FORMATION/ENTRETIEN comme terminée ──────────
    @PutMapping("/{taskId}/complete")
    public ResponseEntity<?> completeTask(@PathVariable String taskId,
                                          Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));
        if (task.isVerrouille()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tâche verrouillée."));
        }

        // Marquer la part de l'acteur courant
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth);
        boolean tousComplete = marquerActeurComplete(task, acteurCourant);

        if (tousComplete) {
            task.setStatut(StatutTask.TERMINE);
            task.setProgression(100);
            task.setDateCompletion(LocalDateTime.now());
        } else {
            // En attente que les autres acteurs complètent
            task.setStatut(StatutTask.EN_COURS);
            task.setProgression(50);
        }

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

    // ── Planifier un entretien (manager) ────────────────────────────────────
    @PutMapping("/{taskId}/planifier-entretien")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
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

    // ── Helpers privés ───────────────────────────────────────────────────────

    /**
     * Marque la progression de l'acteur donné comme complète.
     * Retourne true si TOUS les acteurs ont complété leur part.
     */
    private boolean marquerActeurComplete(Task task, TypeActeur acteur) {
        if (task.getActeurProgressions() == null) return true;

        for (Task.ActeurProgression ap : task.getActeurProgressions()) {
            if (ap.getTypeActeur() == acteur && !ap.isComplete()) {
                ap.setComplete(true);
                ap.setDateCompletion(LocalDateTime.now());
                break; // un seul acteur de ce type à marquer
            }
        }

        return task.getActeurProgressions().stream()
                .allMatch(Task.ActeurProgression::isComplete);
    }

    /**
     * Remet à zéro toutes les progressions (cas de rejet).
     */
    private void resetActeurProgressions(Task task) {
        if (task.getActeurProgressions() == null) return;
        for (Task.ActeurProgression ap : task.getActeurProgressions()) {
            ap.setComplete(false);
            ap.setDateCompletion(null);
        }
    }

    /**
     * Détermine le TypeActeur de l'utilisateur connecté selon son rôle.
     */
    private TypeActeur getTypeActeurFromAuth(Authentication auth) {
        if (auth == null) return TypeActeur.SALARIE;
        String email = auth.getName();
        return userRepository.findByEmail(email)
                .map(u -> switch (u.getRole()) {
                    case MANAGER -> TypeActeur.MANAGER;
                    case ADMIN   -> TypeActeur.RH;
                    default      -> TypeActeur.SALARIE;
                })
                .orElse(TypeActeur.SALARIE);
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

    @Data public static class EntretienRequest {
        private String dateEntretien;
        private String documentContenu;
        private String documentNom;
        private String documentMimeType;
    }
}