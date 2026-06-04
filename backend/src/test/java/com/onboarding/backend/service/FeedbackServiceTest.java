package com.onboarding.backend.service;

import com.onboarding.backend.dto.FeedbackRequest;
import com.onboarding.backend.model.FeedbackOnboarding;
import com.onboarding.backend.model.User;
import com.onboarding.backend.repository.FeedbackRepository;
import com.onboarding.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("FeedbackService Tests")
class FeedbackServiceTest {

    @Mock
    private FeedbackRepository feedbackRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private FeedbackService feedbackService;

    private User testUser;
    private FeedbackRequest validRequest;
    private FeedbackOnboarding savedFeedback;

    // Helper method to convert Number to Double for assertions
    private double asDouble(Object value) {
        return ((Number) value).doubleValue();
    }

    @BeforeEach
    void setUp() {
        // Given - common test data
        testUser = new User();
        testUser.setId("user123");
        testUser.setNom("Dupont");
        testUser.setPrenom("Jean");
        testUser.setEmail("jean.dupont@example.com");

        validRequest = new FeedbackRequest();
        validRequest.setPoste("Développeur Full Stack");
        validRequest.setDateFinIntegration("2025-06-15");
        validRequest.setQualiteAccueil(4);
        validRequest.setClarteInformations(4);
        validRequest.setAccompagnementManager(4);
        validRequest.setAdaptationTaches(3);
        validRequest.setDelaiSuffisant(1);
        validRequest.setDifficultesRencontrees(false);
        validRequest.setPrecisionDifficulties(null);
        validRequest.setFaciliteUtilisation(4);
        validRequest.setFonctionnalitesAdaptees(1);
        validRequest.setProblemTechniques(false);
        validRequest.setSatisfactionGlobale(4);
        validRequest.setRecommandeProcessus(true);
        validRequest.setSuggestions("Très bonne expérience, équipe accueillante !");

        savedFeedback = new FeedbackOnboarding();
        savedFeedback.setId("fb123");
        savedFeedback.setSalarieId("user123");
        savedFeedback.setSalarieNom("Dupont");
        savedFeedback.setSalariePrenom("Jean");
        savedFeedback.setPoste("Développeur Full Stack");
        savedFeedback.setSatisfactionGlobale(4);
        savedFeedback.setRecommandeProcessus(true);
    }

    // ==================== SUBMIT FEEDBACK TESTS ====================

    @Nested
    @DisplayName("submitFeedback() tests")
    class SubmitFeedbackTests {

        @Test
        @DisplayName("Should submit feedback successfully when user exists and never submitted before")
        void shouldSubmitFeedbackSuccessfully() {
            // GIVEN
            when(userRepository.findById("user123")).thenReturn(Optional.of(testUser));
            when(feedbackRepository.existsBySalarieId("user123")).thenReturn(false);
            when(feedbackRepository.save(any(FeedbackOnboarding.class))).thenReturn(savedFeedback);

            // WHEN
            FeedbackOnboarding result = feedbackService.submitFeedback("user123", validRequest);

            // THEN
            assertThat(result).isNotNull();
            assertThat(result.getSalarieId()).isEqualTo("user123");
            assertThat(result.getSalarieNom()).isEqualTo("Dupont");
            assertThat(result.getPoste()).isEqualTo("Développeur Full Stack");
            assertThat(result.getSatisfactionGlobale()).isEqualTo(4);

            verify(userRepository, times(1)).findById("user123");
            verify(feedbackRepository, times(1)).existsBySalarieId("user123");
            verify(feedbackRepository, times(1)).save(any(FeedbackOnboarding.class));
        }

        @Test
        @DisplayName("Should throw exception when user not found")
        void shouldThrowExceptionWhenUserNotFound() {
            // GIVEN
            when(userRepository.findById("unknown")).thenReturn(Optional.empty());

            // WHEN & THEN
            assertThatThrownBy(() -> feedbackService.submitFeedback("unknown", validRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("Utilisateur non trouvé");

            verify(feedbackRepository, never()).existsBySalarieId(any());
            verify(feedbackRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should throw exception when feedback already submitted by this user")
        void shouldThrowExceptionWhenFeedbackAlreadyExists() {
            // GIVEN
            when(userRepository.findById("user123")).thenReturn(Optional.of(testUser));
            when(feedbackRepository.existsBySalarieId("user123")).thenReturn(true);

            // WHEN & THEN
            assertThatThrownBy(() -> feedbackService.submitFeedback("user123", validRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("Vous avez déjà soumis votre évaluation d'intégration.");

            verify(feedbackRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should handle null dateFinIntegration gracefully")
        void shouldHandleNullDateFinIntegration() {
            // GIVEN
            validRequest.setDateFinIntegration(null);

            when(userRepository.findById("user123")).thenReturn(Optional.of(testUser));
            when(feedbackRepository.existsBySalarieId("user123")).thenReturn(false);
            when(feedbackRepository.save(any(FeedbackOnboarding.class))).thenAnswer(inv -> inv.getArgument(0));

            // WHEN
            FeedbackOnboarding result = feedbackService.submitFeedback("user123", validRequest);

            // THEN
            assertThat(result.getDateFinIntegration()).isNull();
        }

        @Test
        @DisplayName("Should handle empty dateFinIntegration gracefully")
        void shouldHandleEmptyDateFinIntegration() {
            // GIVEN
            validRequest.setDateFinIntegration("");

            when(userRepository.findById("user123")).thenReturn(Optional.of(testUser));
            when(feedbackRepository.existsBySalarieId("user123")).thenReturn(false);
            when(feedbackRepository.save(any(FeedbackOnboarding.class))).thenAnswer(inv -> inv.getArgument(0));

            // WHEN
            FeedbackOnboarding result = feedbackService.submitFeedback("user123", validRequest);

            // THEN
            assertThat(result.getDateFinIntegration()).isNull();
        }

        @Test
        @DisplayName("Should handle all integer fields correctly")
        void shouldHandleIntegerFieldsCorrectly() {
            // GIVEN
            validRequest.setQualiteAccueil(5);
            validRequest.setClarteInformations(4);
            validRequest.setAccompagnementManager(3);
            validRequest.setAdaptationTaches(2);
            validRequest.setDelaiSuffisant(0);
            validRequest.setFaciliteUtilisation(5);
            validRequest.setFonctionnalitesAdaptees(0);
            validRequest.setSatisfactionGlobale(3);

            when(userRepository.findById("user123")).thenReturn(Optional.of(testUser));
            when(feedbackRepository.existsBySalarieId("user123")).thenReturn(false);
            when(feedbackRepository.save(any(FeedbackOnboarding.class))).thenAnswer(inv -> inv.getArgument(0));

            // WHEN
            FeedbackOnboarding result = feedbackService.submitFeedback("user123", validRequest);

            // THEN
            assertThat(result.getQualiteAccueil()).isEqualTo(5);
            assertThat(result.getClarteInformations()).isEqualTo(4);
            assertThat(result.getAccompagnementManager()).isEqualTo(3);
            assertThat(result.getAdaptationTaches()).isEqualTo(2);
            assertThat(result.getDelaiSuffisant()).isEqualTo(0);
            assertThat(result.getFaciliteUtilisation()).isEqualTo(5);
            assertThat(result.getFonctionnalitesAdaptees()).isEqualTo(0);
            assertThat(result.getSatisfactionGlobale()).isEqualTo(3);
        }
    }

    // ==================== HAS SUBMITTED FEEDBACK TESTS ====================

    @Nested
    @DisplayName("hasSubmittedFeedback() tests")
    class HasSubmittedFeedbackTests {

        @Test
        @DisplayName("Should return true when user has submitted feedback")
        void shouldReturnTrueWhenFeedbackExists() {
            // GIVEN
            when(feedbackRepository.existsBySalarieId("user123")).thenReturn(true);

            // WHEN
            boolean result = feedbackService.hasSubmittedFeedback("user123");

            // THEN
            assertThat(result).isTrue();
            verify(feedbackRepository, times(1)).existsBySalarieId("user123");
        }

        @Test
        @DisplayName("Should return false when user has not submitted feedback")
        void shouldReturnFalseWhenNoFeedback() {
            // GIVEN
            when(feedbackRepository.existsBySalarieId("user123")).thenReturn(false);

            // WHEN
            boolean result = feedbackService.hasSubmittedFeedback("user123");

            // THEN
            assertThat(result).isFalse();
        }
    }

    // ==================== GET MY FEEDBACK TESTS ====================

    @Nested
    @DisplayName("getMyFeedback() tests")
    class GetMyFeedbackTests {

        @Test
        @DisplayName("Should return feedback when user has submitted")
        void shouldReturnFeedbackWhenExists() {
            // GIVEN
            when(feedbackRepository.findBySalarieId("user123")).thenReturn(Optional.of(savedFeedback));

            // WHEN
            Optional<FeedbackOnboarding> result = feedbackService.getMyFeedback("user123");

            // THEN
            assertThat(result).isPresent();
            assertThat(result.get().getSalarieId()).isEqualTo("user123");
            assertThat(result.get().getSalarieNom()).isEqualTo("Dupont");
        }

        @Test
        @DisplayName("Should return empty optional when no feedback found")
        void shouldReturnEmptyWhenNoFeedback() {
            // GIVEN
            when(feedbackRepository.findBySalarieId("unknown")).thenReturn(Optional.empty());

            // WHEN
            Optional<FeedbackOnboarding> result = feedbackService.getMyFeedback("unknown");

            // THEN
            assertThat(result).isEmpty();
        }
    }

    // ==================== GET ALL FEEDBACKS TESTS ====================

    @Nested
    @DisplayName("getAllFeedbacks() tests")
    class GetAllFeedbacksTests {

        @Test
        @DisplayName("Should return list of all feedbacks")
        void shouldReturnAllFeedbacks() {
            // GIVEN
            FeedbackOnboarding feedback2 = new FeedbackOnboarding();
            feedback2.setId("fb456");
            feedback2.setSalarieId("user456");
            List<FeedbackOnboarding> feedbacks = Arrays.asList(savedFeedback, feedback2);

            when(feedbackRepository.findAll()).thenReturn(feedbacks);

            // WHEN
            List<FeedbackOnboarding> result = feedbackService.getAllFeedbacks();

            // THEN
            assertThat(result).hasSize(2);
            assertThat(result).containsExactly(savedFeedback, feedback2);
        }

        @Test
        @DisplayName("Should return empty list when no feedbacks exist")
        void shouldReturnEmptyListWhenNoFeedbacks() {
            // GIVEN
            when(feedbackRepository.findAll()).thenReturn(Collections.emptyList());

            // WHEN
            List<FeedbackOnboarding> result = feedbackService.getAllFeedbacks();

            // THEN
            assertThat(result).isEmpty();
        }
    }

    // ==================== STATISTICS TESTS ====================

    @Nested
    @DisplayName("getStatistics() tests")
    class GetStatisticsTests {

        @Test
        @DisplayName("Should return zero statistics when no feedbacks exist")
        void shouldReturnEmptyStatisticsWhenNoFeedbacks() {
            // GIVEN
            when(feedbackRepository.findAll()).thenReturn(Collections.emptyList());

            // WHEN
            Map<String, Object> stats = feedbackService.getStatistics();

            // THEN
            assertThat(stats.get("total")).isEqualTo(0);
            assertThat(asDouble(stats.get("tauxSatisfactionGlobale"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("tauxRecommandation"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("tauxDifficultes"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("tauxProblemsTechniques"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("moyenneAccueil"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("moyenneManager"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("moyenneTaches"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("moyennePlateforme"))).isEqualTo(0.0);
            assertThat(stats.get("suggestions")).isEqualTo(Collections.emptyList());
            assertThat(stats.get("difficultesList")).isEqualTo(Collections.emptyList());
        }

        @Test
        @DisplayName("Should calculate statistics correctly with mixed feedbacks")
        void shouldCalculateStatisticsCorrectly() {
            // GIVEN
            FeedbackOnboarding happyUser = createFeedback(4, true, false, false, 5, 5, 5, 5, "Great!", null);
            FeedbackOnboarding mediumUser = createFeedback(3, true, false, false, 4, 4, 4, 4, "Good", null);
            FeedbackOnboarding unhappyUser = createFeedback(2, false, true, true, 2, 2, 2, 2, "Needs improvement", "Poor documentation");
            FeedbackOnboarding veryUnhappyUser = createFeedback(1, false, true, true, 1, 1, 1, 1, "Bad experience", "Everything is confusing");

            when(feedbackRepository.findAll()).thenReturn(Arrays.asList(happyUser, mediumUser, unhappyUser, veryUnhappyUser));

            // WHEN
            Map<String, Object> stats = feedbackService.getStatistics();

            // THEN
            assertThat(stats.get("total")).isEqualTo(4);
            assertThat(asDouble(stats.get("tauxSatisfactionGlobale"))).isEqualTo(50.0);
            assertThat(asDouble(stats.get("tauxRecommandation"))).isEqualTo(50.0);
            assertThat(asDouble(stats.get("tauxDifficultes"))).isEqualTo(50.0);
            assertThat(asDouble(stats.get("tauxProblemsTechniques"))).isEqualTo(50.0);
            assertThat(asDouble(stats.get("moyenneAccueil"))).isEqualTo(3.0);
            assertThat(asDouble(stats.get("moyenneManager"))).isEqualTo(3.0);
            assertThat(asDouble(stats.get("moyenneTaches"))).isEqualTo(3.0);
            assertThat(asDouble(stats.get("moyennePlateforme"))).isEqualTo(3.0);

            // Check suggestions
            List<String> suggestions = (List<String>) stats.get("suggestions");
            assertThat(suggestions).hasSize(4);
            assertThat(suggestions).contains("Great!", "Good", "Needs improvement", "Bad experience");

            // Check difficulties list (only non-null difficulties)
            List<String> difficulties = (List<String>) stats.get("difficultesList");
            assertThat(difficulties).hasSize(2);
            assertThat(difficulties).contains("Poor documentation", "Everything is confusing");
        }

        @Test
        @DisplayName("Should handle statistics with all satisfied users")
        void shouldHandleAllSatisfiedUsers() {
            // GIVEN
            FeedbackOnboarding happy1 = createFeedback(4, true, false, false, 5, 5, 5, 5, "Great", null);
            FeedbackOnboarding happy2 = createFeedback(4, true, false, false, 5, 5, 5, 5, "Awesome", null);

            when(feedbackRepository.findAll()).thenReturn(Arrays.asList(happy1, happy2));

            // WHEN
            Map<String, Object> stats = feedbackService.getStatistics();

            // THEN
            assertThat(asDouble(stats.get("tauxSatisfactionGlobale"))).isEqualTo(100.0);
            assertThat(asDouble(stats.get("tauxRecommandation"))).isEqualTo(100.0);
            assertThat(asDouble(stats.get("tauxDifficultes"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("tauxProblemsTechniques"))).isEqualTo(0.0);
        }

        @Test
        @DisplayName("Should handle statistics with all unsatisfied users")
        void shouldHandleAllUnsatisfiedUsers() {
            // GIVEN
            FeedbackOnboarding unhappy1 = createFeedback(1, false, true, true, 1, 1, 1, 1, "Bad", "Issue 1");
            FeedbackOnboarding unhappy2 = createFeedback(2, false, true, false, 2, 2, 2, 2, "Poor", "Issue 2");

            when(feedbackRepository.findAll()).thenReturn(Arrays.asList(unhappy1, unhappy2));

            // WHEN
            Map<String, Object> stats = feedbackService.getStatistics();

            // THEN
            assertThat(asDouble(stats.get("tauxSatisfactionGlobale"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("tauxRecommandation"))).isEqualTo(0.0);
            assertThat(asDouble(stats.get("tauxDifficultes"))).isEqualTo(100.0);
            assertThat(asDouble(stats.get("tauxProblemsTechniques"))).isEqualTo(50.0);
        }

        @Test
        @DisplayName("Should ignore null or empty suggestions and difficulties")
        void shouldIgnoreNullOrEmptySuggestions() {
            // GIVEN
            FeedbackOnboarding fb1 = createFeedback(4, true, false, false, 5, 5, 5, 5, null, null);
            FeedbackOnboarding fb2 = createFeedback(4, true, false, false, 5, 5, 5, 5, "", "");
            FeedbackOnboarding fb3 = createFeedback(4, true, true, false, 5, 5, 5, 5, "Valid suggestion", "Valid difficulty");

            when(feedbackRepository.findAll()).thenReturn(Arrays.asList(fb1, fb2, fb3));

            // WHEN
            Map<String, Object> stats = feedbackService.getStatistics();

            // THEN
            List<String> suggestions = (List<String>) stats.get("suggestions");
            assertThat(suggestions).hasSize(1);
            assertThat(suggestions.get(0)).isEqualTo("Valid suggestion");

            List<String> difficulties = (List<String>) stats.get("difficultesList");
            assertThat(difficulties).hasSize(1);
            assertThat(difficulties.get(0)).isEqualTo("Valid difficulty");
        }
    }

    // ==================== HELPER METHODS ====================

    private FeedbackOnboarding createFeedback(int satisfaction, boolean recommande,
                                              boolean difficultes, boolean techProblems,
                                              int accueil, int manager, int taches, int plateforme,
                                              String suggestions, String precisionDifficulties) {
        FeedbackOnboarding fb = new FeedbackOnboarding();
        fb.setSatisfactionGlobale(satisfaction);
        fb.setRecommandeProcessus(recommande);
        fb.setDifficultesRencontrees(difficultes);
        fb.setProblemTechniques(techProblems);
        fb.setQualiteAccueil(accueil);
        fb.setAccompagnementManager(manager);
        fb.setAdaptationTaches(taches);
        fb.setFaciliteUtilisation(plateforme);
        fb.setSuggestions(suggestions);
        fb.setPrecisionDifficulties(precisionDifficulties);
        return fb;
    }
}