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

        List<Task> rhTasks = taskRepository.findRHTasks();

        System.out.println("✅ Tâches RH trouvées: " + rhTasks.size());
        rhTasks.forEach(t -> System.out.println("  - " + t.getTitre() + " (" + t.getStatut() + ")"));

        return ResponseEntity.ok(rhTasks);
    }

    // ── Démarrer une tâche ───────────────────────────────────────────────────
    @PutMapping("/{taskId}/start")
    public ResponseEntity<?> startTask(@PathVariable String taskId, Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        // Vérifier si l'utilisateur a le droit de démarrer cette tâche
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth, taskId);
        if (!canActOnTask(task, acteurCourant)) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Vous n'êtes pas autorisé à démarrer cette tâche."));
        }

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

        // Vérifier si l'utilisateur a le droit de soumettre ce quiz
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth, taskId);
        if (!canActOnTask(task, acteurCourant)) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Vous n'êtes pas autorisé à soumettre ce quiz."));
        }

        // Vérifier le nombre maximal de tentatives (max 3)
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

            // Si plus de tentatives après cet échec
            if (task.getNbTentatives() >= maxTentatives) {
                task.setVerrouille(true);
                task.setStatut(StatutTask.EN_COURS);
            }
        }

        taskRepository.save(task);
        parcoursService.checkEtDeverrouillerEntretien(task.getParcoursId());
        parcoursService.recalculerProgression(task.getParcoursId());
        return ResponseEntity.ok(task);
    }

    // ── Débloquer un quiz ────────────────────────────────────────────────────
    @PutMapping("/{taskId}/unlock-quiz")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<?> unlockQuiz(@PathVariable String taskId,
                                        @RequestBody(required = false) UnlockQuizRequest request,
                                        Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        // Seuls les rôles MANAGER et ADMIN peuvent débloquer un quiz,
        // indépendamment du fait qu'ils soient acteurs de la tâche.
        // La vérification du rôle est déjà assurée par @PreAuthorize ci-dessus.

        // Ajouter le commentaire si fourni
        if (request != null && request.getCommentaire() != null && !request.getCommentaire().isBlank()) {
            Task.Commentaire c = new Task.Commentaire();
            c.setAuteurId(request.getAuteurId());
            c.setAuteurNom(request.getAuteurNom() != null ? request.getAuteurNom() : "Manager");
            c.setTexte("🔓 Quiz débloqué — " + request.getCommentaire());
            c.setDate(LocalDateTime.now());
            if (task.getCommentaires() == null) task.setCommentaires(new java.util.ArrayList<>());
            task.getCommentaires().add(c);
        }

        // Débloquer
        task.setVerrouille(false);
        task.setStatut(StatutTask.EN_COURS);
        task.setNbTentatives(0);

        taskRepository.save(task);
        return ResponseEntity.ok(task);
    }

    // ── Déposer un document (salarié) ────────────────────────────────────────
    @PutMapping("/{taskId}/submit-document")
    public ResponseEntity<?> submitDocument(@PathVariable String taskId,
                                            @RequestBody DocumentSubmitRequest request,
                                            Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        if (task.getTaskType() != TaskType.SIMPLE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Type de tâche invalide."));
        }

        // Vérifier si l'utilisateur a le droit de soumettre ce document
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth, taskId);
        if (!canActOnTask(task, acteurCourant)) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Vous n'êtes pas autorisé à soumettre ce document."));
        }

        task.setDocumentContenu(request.getContenu());
        task.setDocumentNom(request.getNom());
        task.setDocumentMimeType(request.getMimeType());

        // Marquer la part du SALARIE comme faite
        boolean tousComplete = marquerActeurComplete(task, acteurCourant);

        if (tousComplete) {
            // Cas SIMPLE + typeActeurs = [SALARIE] seulement → auto-complet
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
    @DeleteMapping("/{taskId}/document")
    @PreAuthorize("hasAnyRole('SALARIE', 'MANAGER', 'ADMIN')")
    public ResponseEntity<?> deleteDocument(@PathVariable String taskId, Authentication auth) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        // Vérifier que la tâche n'est pas déjà terminée
        if (task.getStatut() == StatutTask.TERMINE) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Impossible de modifier une tâche terminée."));
        }

        // Supprimer le document
        task.setDocumentContenu(null);
        task.setDocumentNom(null);
        task.setDocumentMimeType(null);

        // Remettre la progression à 0 pour le salarié (si c'est sa part)
        resetActeurProgressions(task);
        task.setProgression(0);
        task.setStatut(StatutTask.EN_COURS);

        taskRepository.save(task);
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

        // Vérifier si l'utilisateur a le droit de valider cette tâche
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth, taskId);
        if (acteurCourant != TypeActeur.MANAGER && acteurCourant != TypeActeur.RH) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Vous n'êtes pas autorisé à valider cette tâche."));
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

        if (request.isApprouve()) {
            // Marquer la part de cet acteur comme faite
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
            // Non approuvé : remettre la tâche en cours pour correction (pas de rejet définitif)
            resetActeurProgressions(task);
            task.setStatut(StatutTask.EN_COURS);
            task.setProgression(0);
            task.setDocumentContenu(null);
            task.setDocumentNom(null);
            task.setDocumentMimeType(null);
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

        // Vérifier si l'utilisateur a le droit de compléter cette tâche
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth, taskId);
        if (!canActOnTask(task, acteurCourant)) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Vous n'êtes pas autorisé à compléter cette tâche."));
        }

        // Marquer la part de l'acteur courant
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
                                        @RequestBody CommentRequest request,
                                        Authentication auth) {
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
            @RequestBody EntretienRequest request,
            Authentication auth) {

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tâche introuvable."));

        // Vérifier si l'utilisateur a le droit de planifier
        TypeActeur acteurCourant = getTypeActeurFromAuth(auth, taskId);
        if (acteurCourant != TypeActeur.MANAGER && acteurCourant != TypeActeur.RH) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Seul le manager ou RH peut planifier un entretien."));
        }

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
     * Vérifie si l'acteur peut agir sur la tâche.
     */
    private boolean canActOnTask(Task task, TypeActeur acteur) {
        if (task.getActeurProgressions() == null) return false;

        return task.getActeurProgressions().stream()
                .anyMatch(ap -> ap.getTypeActeur() == acteur && !ap.isComplete());
    }

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
     * Détermine le TypeActeur de l'utilisateur connecté.
     * Priorité:
     * 1. Si l'utilisateur est assigné à la tâche, utiliser son TypeActeur contextuel
     * 2. Sinon, utiliser son rôle système
     */
    private TypeActeur getTypeActeurFromAuth(Authentication auth, String taskId) {
        if (auth == null) return TypeActeur.SALARIE;

        String email = auth.getName();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return TypeActeur.SALARIE;

        // Récupérer la tâche pour connaître le contexte
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) return TypeActeur.SALARIE;

        // Vérifier si l'utilisateur est assigné à cette tâche
        for (int i = 0; i < task.getActeurIds().size(); i++) {
            if (task.getActeurIds().get(i).equals(user.getId())) {
                // L'utilisateur a un rôle spécifique dans cette tâche
                Task.ActeurProgression ap = task.getActeurProgressions().get(i);
                if (ap != null) {
                    return ap.getTypeActeur();
                }
            }
        }

        // Fallback: utiliser le rôle système
        return switch (user.getRole()) {
            case MANAGER -> TypeActeur.MANAGER;
            case ADMIN   -> TypeActeur.RH;
            default      -> TypeActeur.SALARIE;
        };
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────
    @Data
    public static class UnlockQuizRequest {
        private String commentaire;
        private String auteurId;
        private String auteurNom;
    }

    @Data
    public static class QuizSubmitRequest {
        private List<Integer> reponses;
    }

    @Data
    public static class DocumentSubmitRequest {
        private String contenu;
        private String nom;
        private String mimeType;
    }

    @Data
    public static class ValidateRequest {
        private boolean approuve;
        private String commentaire;
        private String auteurId;
        private String auteurNom;
    }

    @Data
    public static class CommentRequest {
        private String auteurId;
        private String auteurNom;
        private String texte;
    }

    @Data
    public static class EntretienRequest {
        private String dateEntretien;
        private String documentContenu;
        private String documentNom;
        private String documentMimeType;

    }
}