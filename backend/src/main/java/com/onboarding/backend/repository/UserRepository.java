package com.onboarding.backend.repository;

import com.onboarding.backend.model.User;
import com.onboarding.backend.model.enums.Role;
import com.onboarding.backend.model.enums.StatutCompte;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findByRole(Role role);                          // ← NOUVEAU
    List<User> findByRoleIn(List<Role> roles);                 // ← NOUVEAU (utile plus tard)
    List<User> findByStatutCompte(StatutCompte statutCompte);
}