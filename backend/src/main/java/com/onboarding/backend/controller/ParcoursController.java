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

import java.util.*;

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
        try {
            // Check if authentication is valid
            if (auth == null || auth.getName() == null) {
                return ResponseEntity.status(401).body("Authentication required");
            }

            String email = auth.getName();
            com.onboarding.backend.model.User manager = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Manager introuvable."));

            // Get affectations - this might be null or empty
            List<com.onboarding.backend.model.Affectation> affectations =
                    affectationRepository.findAllByManagerId(manager.getId());

            // Handle null affectations
            if (affectations == null) {
                affectations = new ArrayList<>();
            }

            // Build response with null safety
            List<Map<String, Object>> result = affectations.stream()
                    .map(a -> {
                        try {
                            // Get salarie with null check
                            com.onboarding.backend.model.User salarie = null;
                            if (a.getUserId() != null) {
                                salarie = userRepository.findById(a.getUserId()).orElse(null);
                            }

                            // Skip if salarie is null (no user found)
                            if (salarie == null) {
                                return null;
                            }

                            // Get parcours with null check
                            Parcours parcours = null;
                            if (salarie.getId() != null) {
                                parcours = parcoursRepository.findByUserId(salarie.getId()).orElse(null);
                            }

                            // Get tasks with null check
                            List<Task> tasks = new ArrayList<>();
                            if (parcours != null && parcours.getId() != null) {
                                tasks = taskRepository.findByParcoursIdOrderByOrdreAsc(parcours.getId());
                                if (tasks == null) {
                                    tasks = new ArrayList<>();
                                }
                            }

                            // Build the response map
                            Map<String, Object> memberData = new HashMap<>();
                            memberData.put("salarie", salarie);
                            memberData.put("parcours", parcours != null ? parcours : new HashMap<>());
                            memberData.put("tasks", tasks);

                            return memberData;

                        } catch (Exception e) {
                            // Log the error for a specific member
                            System.err.println("Error processing affectation: " + e.getMessage());
                            return null;
                        }
                    })
                    .filter(Objects::nonNull) // Remove null entries
                    .toList();

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            // Log the full error for debugging
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body("Erreur lors de la récupération de l'équipe: " + e.getMessage());
        }
    }
}