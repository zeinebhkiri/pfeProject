package com.onboarding.backend.repository;

import com.onboarding.backend.model.FeedbackOnboarding;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FeedbackRepository extends MongoRepository<FeedbackOnboarding, String> {
    List<FeedbackOnboarding> findAll();
    Optional<FeedbackOnboarding> findBySalarieId(String salarieId);
    boolean existsBySalarieId(String salarieId);
}
