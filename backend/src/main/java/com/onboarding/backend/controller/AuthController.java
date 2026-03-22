package com.onboarding.backend.controller;

import com.onboarding.backend.dto.*;
import com.onboarding.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import com.onboarding.backend.model.PasswordResetToken;
import com.onboarding.backend.model.User;
import com.onboarding.backend.repository.PasswordResetTokenRepository;
import com.onboarding.backend.repository.UserRepository;
import com.onboarding.backend.service.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

// Dans la classe — ajouter ces champs



@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    @Value("${app.frontend.url}")
    private String frontendUrl;
    // ── Créer un employé — ADMIN (RH) uniquement ───────────────────────────
    @PostMapping("/create-employee")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> createEmployee(@Valid @RequestBody CreateEmployeeRequest request) {
        return ResponseEntity.ok(authService.createEmployee(request));
    }

    // ── Info du token (page d'activation) — public ─────────────────────────
    @GetMapping("/token-info")
    public ResponseEntity<Map<String, String>> getTokenInfo(@RequestParam String token) {
        return ResponseEntity.ok(authService.getTokenInfo(token));
    }

    // ── Activer le compte — public ──────────────────────────────────────────
    @PostMapping("/activate")
    public ResponseEntity<String> activateAccount(@Valid @RequestBody ActivateAccountRequest request) {
        return ResponseEntity.ok(authService.activateAccount(request));
    }

    // ── Login — public ──────────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
    // ── Demander réinitialisation mot de passe — public ────────────────────
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @RequestBody Map<String, String> body) {

        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Email requis."));
        }

        // Vérifier que l'utilisateur existe
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            // Réponse générique pour ne pas divulguer les emails existants
            return ResponseEntity.ok(Map.of("message",
                    "Si cet email existe, un lien de réinitialisation a été envoyé."));
        }

        User user = userOpt.get();

        // Supprimer ancien token si existe
        passwordResetTokenRepository.deleteByEmail(email);

        // Créer nouveau token
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setToken(UUID.randomUUID().toString());
        resetToken.setEmail(email);
        resetToken.setExpirationDate(LocalDateTime.now().plusMinutes(30));
        resetToken.setUsed(false);
        passwordResetTokenRepository.save(resetToken);

        // Envoyer email
        String resetLink = frontendUrl + "/reset-password?token=" + resetToken.getToken();
        emailService.sendPasswordResetEmail(
                email,
                user.getPrenom() + " " + user.getNom(),
                resetLink
        );

        return ResponseEntity.ok(Map.of("message",
                "Si cet email existe, un lien de réinitialisation a été envoyé."));
    }

    // ── Réinitialiser le mot de passe — public ─────────────────────────────
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @RequestBody Map<String, String> body) {

        String token = body.get("token");
        String password = body.get("password");
        String confirmPassword = body.get("confirmPassword");

        if (token == null || password == null || confirmPassword == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Tous les champs sont requis."));
        }

        if (!password.equals(confirmPassword)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Les mots de passe ne correspondent pas."));
        }

        if (password.length() < 8) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Le mot de passe doit contenir au moins 8 caractères."));
        }

        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Token invalide."));

        if (resetToken.isUsed()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Ce lien a déjà été utilisé."));
        }

        if (resetToken.getExpirationDate().isBefore(LocalDateTime.now())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Ce lien a expiré. Veuillez faire une nouvelle demande."));
        }

        User user = userRepository.findByEmail(resetToken.getEmail())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));

        user.setPassword(passwordEncoder.encode(password));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        return ResponseEntity.ok(Map.of("message", "Mot de passe réinitialisé avec succès."));
    }
}