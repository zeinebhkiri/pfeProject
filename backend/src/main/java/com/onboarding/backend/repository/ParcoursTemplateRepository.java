// ParcoursTemplateRepository.java
package com.onboarding.backend.repository;
import com.onboarding.backend.model.ParcoursTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ParcoursTemplateRepository extends MongoRepository<ParcoursTemplate, String> {
    Optional<ParcoursTemplate> findByPositionIdAndActifTrue(String positionId);
    List<ParcoursTemplate> findByActifTrue();
}