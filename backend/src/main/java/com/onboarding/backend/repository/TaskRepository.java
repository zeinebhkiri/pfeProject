// TaskRepository.java
package com.onboarding.backend.repository;
import com.onboarding.backend.model.Task;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface TaskRepository extends MongoRepository<Task, String> {
    List<Task> findByParcoursIdOrderByOrdreAsc(String parcoursId);
    List<Task> findByActeurIdOrderByOrdreAsc(String acteurId);
    List<Task> findByParcoursIdAndActeurId(String parcoursId, String acteurId);
}