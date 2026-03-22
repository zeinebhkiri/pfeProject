package com.onboarding.backend.repository;

import com.onboarding.backend.model.Position;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PositionRepository extends MongoRepository<Position, String> {
    List<Position> findByActifTrue();
    boolean existsByTitre(String titre);
}