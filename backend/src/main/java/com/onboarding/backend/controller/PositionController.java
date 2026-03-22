package com.onboarding.backend.controller;

import com.onboarding.backend.model.Position;
import com.onboarding.backend.repository.PositionRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/positions")
@RequiredArgsConstructor
public class PositionController {

    private final PositionRepository positionRepository;

    // ── Liste tous les postes actifs — tous les rôles ───────────────────────
    @GetMapping
    public ResponseEntity<List<Position>> getAllPositions() {
        return ResponseEntity.ok(positionRepository.findByActifTrue());
    }

    // ── Créer un poste — ADMIN uniquement ───────────────────────────────────
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createPosition(@RequestBody PositionRequest request) {
        if (positionRepository.existsByTitre(request.getTitre())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Ce poste existe déjà."));
        }
        Position p = new Position();
        p.setTitre(request.getTitre());
        p.setDescription(request.getDescription());
        p.setActif(true);
        return ResponseEntity.ok(positionRepository.save(p));
    }

    // ── Modifier un poste — ADMIN uniquement ────────────────────────────────
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updatePosition(
            @PathVariable String id,
            @RequestBody PositionRequest request) {
        Position p = positionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Poste introuvable."));
        p.setTitre(request.getTitre());
        p.setDescription(request.getDescription());
        return ResponseEntity.ok(positionRepository.save(p));
    }

    // ── Désactiver un poste — ADMIN uniquement ──────────────────────────────
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deletePosition(@PathVariable String id) {
        positionRepository.findById(id).ifPresent(p -> {
            p.setActif(false);
            positionRepository.save(p);
        });
        return ResponseEntity.ok(Map.of("message", "Poste désactivé."));
    }

    // ── DTO ─────────────────────────────────────────────────────────────────
    @Data
    public static class PositionRequest {
        private String titre;
        private String description;
    }
}