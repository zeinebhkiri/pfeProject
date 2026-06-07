package com.onboarding.backend.repository;

import com.onboarding.backend.model.ArchiveParcours;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ArchiveParcoursRepository extends MongoRepository<ArchiveParcours, String> {

    /** Tous les parcours archivés d'un salarié, du plus récent au plus ancien */
    List<ArchiveParcours> findByUserIdOrderByDateFinPosteDesc(String userId);

    /** Tous les parcours archivés supervisés par un manager */
    List<ArchiveParcours> findByManagerId(String managerId);

    /** Parcours archivé correspondant à un parcours original */
    java.util.Optional<ArchiveParcours> findByParcoursOriginalId(String parcoursOriginalId);
}