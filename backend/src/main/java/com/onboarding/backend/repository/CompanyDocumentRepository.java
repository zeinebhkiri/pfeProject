package com.onboarding.backend.repository;

import com.onboarding.backend.model.CompanyDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface CompanyDocumentRepository extends MongoRepository<CompanyDocument, String> {
    List<CompanyDocument> findByActifTrueOrderByDateUploadDesc();
}