package com.onboarding.backend.service;

import com.onboarding.backend.dto.*;
import com.onboarding.backend.model.ActivationToken;
import com.onboarding.backend.model.User;
import com.onboarding.backend.model.enums.Role;
import com.onboarding.backend.model.enums.StatutCompte;
import com.onboarding.backend.repository.ActivationTokenRepository;
import com.onboarding.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ActivationTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;

    // ─── STEP 1: HR Creates Employee ──────────────────────────────────────────

    public String createEmployee(CreateEmployeeRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Un compte avec cet email existe déjà.");
        }

        // Sécurité : un ADMIN ne peut pas être créé via cette route publique
        if (request.getRole() == Role.ADMIN) {
            throw new RuntimeException("Impossible de créer un compte ADMIN via cette route.");
        }

        // Seuls SALARIE et MANAGER sont autorisés
        if (request.getRole() != Role.SALARIE && request.getRole() != Role.MANAGER) {
            throw new RuntimeException("Rôle invalide. Choisissez SALARIE ou MANAGER.");
        }

        User user = new User();
        user.setNom(request.getNom());
        user.setPrenom(request.getPrenom());
        user.setEmail(request.getEmail());
        user.setPassword(null);
        user.setRole(request.getRole()); // ← SALARIE ou MANAGER selon le choix RH
        user.setStatutCompte(StatutCompte.EN_ATTENTE);
        user.setProfilCompletion(0);
        user.setDateCreation(LocalDateTime.now());
        user.setDateLimit(LocalDateTime.now().plusDays(request.getJoursLimite()));

        // ⭐ Initialiser ProfessionalInfo avec la date d'embauche du formulaire ⭐
        User.ProfessionalInfo professionalInfo = new User.ProfessionalInfo();

        // Attacher la date d'embauche (obligatoire)
        if (request.getDateEmbauche() != null && !request.getDateEmbauche().isBlank()) {
            professionalInfo.setDateEmbauche(LocalDate.parse(request.getDateEmbauche()));
        } else {
            // Option: mettre la date du jour si non fournie
            professionalInfo.setDateEmbauche(LocalDate.now());
        }
        // Dans createEmployee — après avoir set dateEmbauche
        if (request.getDateEmbauche() != null && !request.getDateEmbauche().isBlank()) {
            if (user.getProfessionalInfo() == null) {
                user.setProfessionalInfo(new User.ProfessionalInfo());
            }
            LocalDate embauche = LocalDate.parse(request.getDateEmbauche());
            user.getProfessionalInfo().setDateEmbauche(embauche);
            user.getProfessionalInfo().setDatePriseDePoste(embauche); // ← sync auto
            user.getProfessionalInfo().setDatePriseDePostePersonnalisee(false);
        }

        // ⭐ Les autres champs professionnels restent vides ou null pour l'instant
        // (ils pourront être modifiés plus tard via l'endpoint PUT)
        professionalInfo.setEmailProfessionnel(null);
        professionalInfo.setTelephoneProfessionnel(null);

        user.setProfessionalInfo(professionalInfo);
        User savedUser = userRepository.save(user);

        String tokenValue = UUID.randomUUID().toString();
        ActivationToken activationToken = new ActivationToken();
        activationToken.setToken(tokenValue);
        activationToken.setUserId(savedUser.getId());
        activationToken.setExpirationDate(LocalDateTime.now().plusHours(5));
        activationToken.setUsed(false);
        tokenRepository.save(activationToken);
        System.out.println("=== DEBUG TIME CHECK ===");
        System.out.println("Token expiration: " + activationToken.getExpirationDate());
        System.out.println("Backend now: " + LocalDateTime.now());
        System.out.println("========================");

        emailService.sendActivationEmail(
                savedUser.getEmail(),
                tokenValue,
                savedUser.getPrenom() + " " + savedUser.getNom(),
                savedUser.getDateLimit(),// ← AJOUTER ce paramètre
                savedUser.getProfessionalInfo().getDateEmbauche()
        );

        return "Compte " + request.getRole().name() + " créé. Email d'activation envoyé à " + savedUser.getEmail();
    }

    // ─── STEP 2: Employee Activates Account ───────────────────────────────────

    public String activateAccount(ActivateAccountRequest request) {
        // Check passwords match
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new RuntimeException("Les mots de passe ne correspondent pas.");
        }

        // Find the token
        ActivationToken activationToken = tokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new RuntimeException("Token invalide."));

        // Check if already used
        if (activationToken.isUsed()) {
            throw new RuntimeException("Ce lien d'activation a déjà été utilisé.");
        }

        // Check expiration
        if (activationToken.getExpirationDate().isBefore(LocalDateTime.now())) {
            User user = userRepository.findById(activationToken.getUserId())
                    .orElseThrow(() -> new RuntimeException("User invalide."));
            user.setStatutCompte(StatutCompte.EXPIRE);
            userRepository.save(user);
            activationToken.setUsed(true);
            tokenRepository.save(activationToken);
            throw new RuntimeException("Ce lien d'activation a expiré.");


        }

        // Find the user linked to this token
        User user = userRepository.findById(activationToken.getUserId())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));

        // Set hashed password and activate account
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setStatutCompte(StatutCompte.ACCEPTE);
        //user.setDateValidation(LocalDateTime.now());
        userRepository.save(user);

        // Mark token as used
        activationToken.setUsed(true);
        tokenRepository.save(activationToken);
        System.out.println("Expiration token : " + activationToken.getExpirationDate());
        System.out.println("Now : " + LocalDateTime.now());

        return "Compte activé avec succès. Vous pouvez maintenant vous connecter.";
    }

    // ─── STEP 3: Login ────────────────────────────────────────────────────────

    public LoginResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable."));

        if (user.getStatutCompte() != StatutCompte.ACCEPTE && user.getStatutCompte() != StatutCompte.VALIDE) {
            throw new RuntimeException("Votre compte n'est pas encore accepté ou a été désactivé.");
        }

        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("userId", user.getId());
        extraClaims.put("role", user.getRole().name()); // SALARIE, MANAGER, ou ADMIN

        org.springframework.security.core.userdetails.User userDetails =
                new org.springframework.security.core.userdetails.User(
                        user.getEmail(),
                        user.getPassword(),
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
                        // Génère : ROLE_SALARIE, ROLE_MANAGER, ou ROLE_ADMIN
                );

        String jwt = jwtService.generateToken(extraClaims, userDetails);
        return new LoginResponse(jwt, user.getEmail(), user.getRole().name(), user.getId());
    }

    // ─── Helper: Get token info (for activation page) ─────────────────────────

    public Map<String, String> getTokenInfo(String token) {
        System.out.println("TOKEN RECU: [" + token + "]");
        ActivationToken activationToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Token invalide."));

        if (activationToken.isUsed()) {
            throw new RuntimeException("Ce lien a déjà été utilisé.");
        }

        if (activationToken.getExpirationDate().isBefore(LocalDateTime.now())) {
            User user = userRepository.findById(activationToken.getUserId())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));
            user.setStatutCompte(StatutCompte.EXPIRE);
            userRepository.save(user);
            activationToken.setUsed(true);
            tokenRepository.save(activationToken);
            throw new RuntimeException("Ce lien a expiré.");

        }

        User user = userRepository.findById(activationToken.getUserId())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable."));

        Map<String, String> info = new HashMap<>();
        info.put("email", user.getEmail());
        info.put("role", user.getRole().name());
        info.put("prenom", user.getPrenom());
        info.put("nom", user.getNom());
        System.out.println("Expiration token : " + activationToken.getExpirationDate());
        System.out.println("Now : " + LocalDateTime.now());
        return info;
    }

    //methode qui verifie le token chaque 5 min
    //ki ma yenzelch 3al mail ba3d 5 h
    @Scheduled(fixedRate = 300000) // toutes les 5 minutes
    public void expirePendingAccountsAutomatically() {

        // 1. Expirer les tokens d'activation non utilisés
        List<ActivationToken> expiredTokens =
                tokenRepository.findAllByExpirationDateBeforeAndUsedFalse(LocalDateTime.now());

        for (ActivationToken token : expiredTokens) {
            User user = userRepository.findById(token.getUserId()).orElse(null);
            if (user != null && user.getStatutCompte() == StatutCompte.EN_ATTENTE) {
                user.setStatutCompte(StatutCompte.EXPIRE);
                userRepository.save(user);
            }
            token.setUsed(true);
            tokenRepository.save(token);
        }

        // 2. Désactiver les comptes ACCEPTE dont la dateLimit est dépassée
        //    et dont le profilCompletion < 100
        List<User> usersToCheck = userRepository.findByStatutCompte(StatutCompte.ACCEPTE);
        for (User user : usersToCheck) {
            if (user.getDateLimit() != null
                    && user.getDateLimit().isBefore(LocalDateTime.now())
                    && user.getProfilCompletion() < 100) {
                user.setStatutCompte(StatutCompte.DESACTIVE);
                userRepository.save(user);
                System.out.println("Compte désactivé automatiquement : " + user.getEmail());
            }
        }
    }
}