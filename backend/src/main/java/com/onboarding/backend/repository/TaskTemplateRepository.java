// TaskTemplateRepository.java
package com.onboarding.backend.repository;
import com.onboarding.backend.model.TaskTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface TaskTemplateRepository extends MongoRepository<TaskTemplate, String> {
    List<TaskTemplate> findByParcoursTemplateIdOrderByOrdreAsc(String parcoursTemplateId);
    void deleteByParcoursTemplateId(String parcoursTemplateId);
}