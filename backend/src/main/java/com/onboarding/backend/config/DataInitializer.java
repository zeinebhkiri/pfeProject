package com.onboarding.backend.config;

import com.onboarding.backend.model.User;
import com.onboarding.backend.model.enums.Role;
import com.onboarding.backend.model.enums.StatutCompte;
import com.onboarding.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.boot.CommandLineRunner;

@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    CommandLineRunner init() {
        return args -> {
            if (userRepository.count() == 0) {
                User admin = new User();
                admin.setEmail("admin@test.com");
                admin.setPassword(passwordEncoder.encode("admin123")); // ✅ encodé automatiquement
                admin.setRole(Role.ADMIN);
                admin.setStatutCompte(StatutCompte.VALIDE);
                admin.setNom("Admin");
                admin.setPrenom("Super");
                admin.setDateCreation(java.time.LocalDateTime.now());
                userRepository.save(admin);
                System.out.println("Admin créé automatiquement !");
            }
        };
    }
}