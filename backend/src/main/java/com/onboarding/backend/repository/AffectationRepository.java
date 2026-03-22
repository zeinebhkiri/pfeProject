package com.onboarding.backend.repository;

import com.onboarding.backend.model.Affectation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AffectationRepository extends MongoRepository<Affectation, String> {
    Optional<Affectation> findByUserId(String userId);
    List<Affectation> findAllByManagerId(String managerId);
}