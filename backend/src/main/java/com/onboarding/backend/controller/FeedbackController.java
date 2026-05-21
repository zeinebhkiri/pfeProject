package com.onboarding.backend.controller;

import com.onboarding.backend.dto.FeedbackRequest;
import com.onboarding.backend.model.FeedbackOnboarding;
import com.onboarding.backend.repository.UserRepository;
import com.onboarding.backend.service.FeedbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final UserRepository userRepository;

    /**
     * Employee submits their onboarding feedback
     */
    @PostMapping
    public ResponseEntity<?> submitFeedback(@RequestBody FeedbackRequest req, Authentication auth) {
        try {
            String email = auth.getName();
            var userOpt = userRepository.findByEmail(email);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Utilisateur non trouvé"));
            }
            FeedbackOnboarding fb = feedbackService.submitFeedback(userOpt.get().getId(), req);
            return ResponseEntity.ok(fb);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Check if current user has already submitted feedback
     */
    @GetMapping("/my-status")
    public ResponseEntity<Map<String, Object>> getMyStatus(Authentication auth) {
        String email = auth.getName();
        var userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Utilisateur non trouvé"));
        }
        boolean submitted = feedbackService.hasSubmittedFeedback(userOpt.get().getId());
        Optional<FeedbackOnboarding> fb = feedbackService.getMyFeedback(userOpt.get().getId());
        return ResponseEntity.ok(Map.of(
            "submitted", submitted,
            "feedback", fb.isPresent() ? fb.get() : Map.of()
        ));
    }

    /**
     * Admin/Manager get all feedbacks
     */
    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<FeedbackOnboarding>> getAllFeedbacks() {
        return ResponseEntity.ok(feedbackService.getAllFeedbacks());
    }

    /**
     * Admin/Manager get aggregated statistics
     */
    @GetMapping("/statistics")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> getStatistics() {
        return ResponseEntity.ok(feedbackService.getStatistics());
    }
}
