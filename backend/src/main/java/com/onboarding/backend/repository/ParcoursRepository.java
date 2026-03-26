// ParcoursRepository.java
package com.onboarding.backend.repository;
import com.onboarding.backend.model.Parcours;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ParcoursRepository extends MongoRepository<Parcours, String> {
    Optional<Parcours> findByUserId(String userId);
    List<Parcours> findByPositionId(String positionId);
}