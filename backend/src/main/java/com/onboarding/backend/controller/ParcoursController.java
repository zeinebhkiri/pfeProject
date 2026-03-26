package com.onboarding.backend.controller;

import com.onboarding.backend.model.Parcours;
import com.onboarding.backend.model.Task;
import com.onboarding.backend.repository.AffectationRepository;
import com.onboarding.backend.repository.ParcoursRepository;
import com.onboarding.backend.repository.TaskRepository;
import com.onboarding.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/parcours")
@RequiredArgsConstructor
public class ParcoursController {

    private final ParcoursRepository parcoursRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final AffectationRepository affectationRepository;

    // ── Mon parcours (salarié connecté) ─────────────────────────────────────
    @GetMapping("/me")
    public ResponseEntity<?> getMyParcours(Authentication auth) {
        String email = auth.getName();
        com.onboarding.backend.model.User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));
        return parcoursRepository.findByUserId(user.getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Mes tâches (salarié connecté) ────────────────────────────────────────
    @GetMapping("/me/tasks")
    public ResponseEntity<?> getMyTasks(Authentication auth) {
        String email = auth.getName();
        com.onboarding.backend.model.User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));
        return parcoursRepository.findByUserId(user.getId())
                .map(p -> ResponseEntity.ok(
                        taskRepository.findByParcoursIdOrderByOrdreAsc(p.getId())
                ))
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Parcours d'un salarié (admin/manager) ────────────────────────────────
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> getParcoursOfUser(@PathVariable String userId) {
        return parcoursRepository.findByUserId(userId)
                .map(p -> {
                    List<Task> tasks = taskRepository.findByParcoursIdOrderByOrdreAsc(p.getId());
                    return ResponseEntity.ok(Map.of("parcours", p, "tasks", tasks));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Tous les parcours (admin) ────────────────────────────────────────────
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Parcours>> getAll() {
        return ResponseEntity.ok(parcoursRepository.findAll());
    }

    // ── Parcours de l'équipe (manager) ───────────────────────────────────────
    @GetMapping("/my-team")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<?> getTeamParcours(Authentication auth) {
        String email = auth.getName();
        com.onboarding.backend.model.User manager = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Manager introuvable."));

        List<com.onboarding.backend.model.Affectation> affectations =
                affectationRepository.findAllByManagerId(manager.getId());

        List<Map<String, Object>> result = affectations.stream()
                .map(a -> {
                    com.onboarding.backend.model.User salarie =
                            userRepository.findById(a.getUserId()).orElse(null);
                    Parcours parcours = parcoursRepository.findByUserId(a.getUserId()).orElse(null);
                    List<Task> tasks = parcours != null
                            ? taskRepository.findByParcoursIdOrderByOrdreAsc(parcours.getId())
                            : List.of();
                    return Map.<String, Object>of(
                            "salarie", salarie,
                            "parcours", parcours != null ? parcours : Map.of(),
                            "tasks", tasks
                    );
                })
                .toList();

        return ResponseEntity.ok(result);
    }
}