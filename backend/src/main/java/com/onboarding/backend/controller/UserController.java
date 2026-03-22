package com.onboarding.backend.controller;

import com.onboarding.backend.model.Affectation;
import com.onboarding.backend.model.User;
import com.onboarding.backend.model.enums.Role;
import com.onboarding.backend.model.enums.StatutCompte;
import com.onboarding.backend.repository.AffectationRepository;
import com.onboarding.backend.repository.UserRepository;
import com.onboarding.backend.service.EmailService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;


@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final AffectationRepository affectationRepository;
    // ── Mon profil ──────────────────────────────────────────────────────────
    @GetMapping("/me")
    public ResponseEntity<User> getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        return ResponseEntity.ok(user);
    }

    // ── Mettre à jour mon profil (salarié remplit ses coordonnées) ──────────
    @PutMapping("/me/profile")
    public ResponseEntity<User> updateMyProfile(
            Authentication authentication,
            @RequestBody ProfileUpdateRequest request) {

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        // Mettre à jour le profil
        if (user.getProfile() == null) user.setProfile(new User.Profile());
        user.getProfile().setAdresse(request.getAdresse());
        user.getProfile().setRib(request.getRib());
        user.getProfile().setTelephone(request.getTelephone());
        user.getProfile().setImage(request.getImage());
        user.getProfile().setNumeroCnss(request.numeroCnss);
        user.getProfile().setLieuNaissance(request.getLieuNaissance());
        user.getProfile().setNomBanque(request.getNomBanque());
        user.getProfile().setStatutSocial(request.getStatutSocial());
        user.getProfile().setNationalite(request.getNationalite());
        user.getProfile().setGenre(request.getGenre());
        if (request.getDateNaissance() != null && !request.getDateNaissance().isBlank()) {
            user.getProfile().setDateNaissance(LocalDate.parse(request.getDateNaissance()));
            user.getProfile().setPhotoPoste(request.getPhotoPoste()); // ← AJOUTER
        }
        // Calculer le profilCompletion
        user.setProfilCompletion(calculerCompletion(user));

        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    // ── Liste tous les utilisateurs — ADMIN uniquement ──────────────────────
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    // ── Voir le profil d'un salarié — ADMIN uniquement ──────────────────────
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<User> getUserById(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        return ResponseEntity.ok(user);
    }

    // ── Valider le compte d'un salarié — ADMIN uniquement ───────────────────
    @PutMapping("/{id}/validate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> validateUser(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if (user.getProfilCompletion() < 100) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Le profil n'est pas complété à 100%. Completion actuelle : " + user.getProfilCompletion() + "%")
            );
        }

        user.setStatutCompte(StatutCompte.VALIDE);
        user.setDateValidation(LocalDateTime.now());
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Compte validé avec succès."));
    }

    // ── Désactiver le compte d'un salarié — ADMIN uniquement ────────────────
    @PutMapping("/{id}/disable")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> disableUser(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        user.setStatutCompte(StatutCompte.DESACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Compte désactivé."));
    }

    // ── Liste tous les SALARIES ──────────────────────────────────────────────
    @GetMapping("/salaries")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<List<User>> getAllSalaries() {
        return ResponseEntity.ok(userRepository.findByRole(Role.SALARIE));
    }

    // ── Liste tous les MANAGERS — ADMIN uniquement ───────────────────────────
    @GetMapping("/managers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> getAllManagers() {
        return ResponseEntity.ok(userRepository.findByRole(Role.MANAGER));
    }


    // ── Calcul du taux de complétion ─────────────────────────────────────────
    private int calculerCompletion(User user) {

        if (user.getProfile() == null) return 0;

        int total = 10;
        int remplis = 0;

        User.Profile p = user.getProfile();

        if (p.getAdresse() != null && !p.getAdresse().isBlank()) remplis++;
        if (p.getRib() != null && !p.getRib().isBlank()) remplis++;
        if (p.getTelephone() != null && !p.getTelephone().isBlank()) remplis++;

        if (p.getNumeroCnss() != null && !p.getNumeroCnss().isBlank()) remplis++;
        if (p.getDateNaissance() != null) remplis++;
        if (p.getLieuNaissance() != null && !p.getLieuNaissance().isBlank()) remplis++;
        if (p.getNomBanque() != null && !p.getNomBanque().isBlank()) remplis++;
        if (p.getStatutSocial() != null && !p.getStatutSocial().isBlank()) remplis++;
        if (p.getNationalite() != null && !p.getNationalite().isBlank()) remplis++;
        if (p.getGenre() != null && !p.getGenre().isBlank()) remplis++;

        return (remplis * 100) / total;
    }
    // ── DTO ─────────────────────────────────────────────────────────────────────
    @Data
    public static class CorrectionRequest {
        private String commentaire;
        private String dateLimite; // format "dd/MM/yyyy"
    }

    // ── Envoyer email de correction — ADMIN ─────────────────────────────────────
    @PostMapping("/{id}/send-correction-email")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> sendCorrectionEmail(
            @PathVariable String id,
            @RequestBody CorrectionRequest request) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        emailService.sendCorrectionEmail(
                user.getEmail(),
                user.getPrenom() + " " + user.getNom(),
                request.getCommentaire(),
                request.getDateLimite()
        );

        return ResponseEntity.ok(Map.of("message", "Email de correction envoyé avec succès."));
    }
    @GetMapping("/my-team")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<?> getMyTeam(@AuthenticationPrincipal UserDetails userDetails) {
        User manager = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Manager introuvable"));


        List<Affectation> affectations = affectationRepository.findAllByManagerId(manager.getId());
        List<String> userIds = affectations.stream()
                .map(Affectation::getUserId)
                .collect(Collectors.toList());

        List<User> team = userRepository.findAllById(userIds);
        return ResponseEntity.ok(team);
    }
    // ── DTO interne pour la mise à jour du profil ────────────────────────────
    @Data
    public static class ProfileUpdateRequest {
        private String adresse;
        private String rib;
        private String telephone;
        private String image;
        private String numeroCnss;
        private String dateNaissance;
        private String lieuNaissance;
        private String nomBanque;
        private String statutSocial;
        private String nationalite;
        private String genre;
        private String photoPoste;
    }
    // ── DTO Document ─────────────────────────────────────────────────────────
    @Data
    public static class DocumentUploadRequest {
        private String nom;
        private String type;
        private String contenu;   // base64
        private String mimeType;
    }

    // ── Upload document — salarié connecté ──────────────────────────────────
    @PostMapping("/me/documents")
    public ResponseEntity<?> uploadDocument(
            Authentication authentication,
            @RequestBody DocumentUploadRequest request) {

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if (user.getProfile() == null) user.setProfile(new User.Profile());
        if (user.getProfile().getDocuments() == null)
            user.getProfile().setDocuments(new ArrayList<>());

        User.Document doc = new User.Document();
        doc.setId(java.util.UUID.randomUUID().toString());
        doc.setNom(request.getNom());
        doc.setType(request.getType());
        doc.setContenu(request.getContenu());
        doc.setMimeType(request.getMimeType());
        doc.setDateUpload(LocalDateTime.now());

        user.getProfile().getDocuments().add(doc);
        userRepository.save(user);

        // Retourner sans le contenu base64 pour alléger la réponse
        doc.setContenu(null);
        return ResponseEntity.ok(doc);
    }

    // ── Supprimer document ───────────────────────────────────────────────────
    @DeleteMapping("/me/documents/{docId}")
    public ResponseEntity<?> deleteDocument(
            Authentication authentication,
            @PathVariable String docId) {

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if (user.getProfile() != null && user.getProfile().getDocuments() != null) {
            user.getProfile().getDocuments()
                    .removeIf(d -> d.getId().equals(docId));
            userRepository.save(user);
        }

        return ResponseEntity.ok(Map.of("message", "Document supprimé."));
    }

    // ── Télécharger un document (admin ou propriétaire) ──────────────────────
    @GetMapping("/{userId}/documents/{docId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<?> getDocument(
            @PathVariable String userId,
            @PathVariable String docId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if (user.getProfile() == null || user.getProfile().getDocuments() == null)
            return ResponseEntity.notFound().build();

        return user.getProfile().getDocuments().stream()
                .filter(d -> d.getId().equals(docId))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    // Mettre à jour le profil (les informations profissionnels)
    @PutMapping("/{id}/professional-info")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<User> updateProfessionalInfo(@PathVariable String id, @RequestBody ProfessionalInfoRequest request) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if(user.getProfessionalInfo() == null){
            user.setProfessionalInfo(new User.ProfessionalInfo());
        }

        user.getProfessionalInfo().setEmailProfessionnel(request.getEmailProfessionnel());
        user.getProfessionalInfo().setTelephoneProfessionnel(request.getTelephoneProfessionnel());

        if(request.getDateEmbauche()!=null && !request.getDateEmbauche().isBlank()){
            user.getProfessionalInfo().setDateEmbauche(
                    LocalDate.parse(request.getDateEmbauche())
            );
        }

        userRepository.save(user);

        return ResponseEntity.ok(user);
    }
    @Data
    public static class ProfessionalInfoRequest {

        private String emailProfessionnel;
        private String telephoneProfessionnel;
        private String dateEmbauche;

    }

}