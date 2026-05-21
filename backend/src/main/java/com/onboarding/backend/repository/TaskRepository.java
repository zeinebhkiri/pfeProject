// TaskRepository.java
package com.onboarding.backend.repository;
import com.onboarding.backend.model.Task;
import com.onboarding.backend.model.enums.TaskType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface TaskRepository extends MongoRepository<Task, String> {
    List<Task> findByParcoursIdOrderByOrdreAsc(String parcoursId);

    //List<Task> findByActeurIdsContainingOrderByOrdreAsc(String acteurId);

    //List<Task> findByParcoursIdAndActeurIdsContaining(String parcoursId, String acteurId);
    @Query("{ 'typeActeurs': { $in: ['RH'] }, 'statut': { $nin: ['TERMINE'] } }")
    List<Task> findRHTasks();

}