package com.onboarding.backend.service;

import com.onboarding.backend.dto.FeedbackRequest;
import com.onboarding.backend.model.FeedbackOnboarding;
import com.onboarding.backend.model.User;
import com.onboarding.backend.repository.FeedbackRepository;
import com.onboarding.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    public FeedbackOnboarding submitFeedback(String userId, FeedbackRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

        // Check if already submitted
        if (feedbackRepository.existsBySalarieId(userId)) {
            throw new RuntimeException("Vous avez déjà soumis votre évaluation d'intégration.");
        }

        FeedbackOnboarding fb = new FeedbackOnboarding();
        fb.setSalarieId(userId);
        fb.setSalarieNom(user.getNom());
        fb.setSalariePrenom(user.getPrenom());
        fb.setPoste(req.getPoste());
        fb.setDateSubmission(LocalDateTime.now());

        if (req.getDateFinIntegration() != null && !req.getDateFinIntegration().isEmpty()) {
            LocalDate d = LocalDate.parse(req.getDateFinIntegration(), DateTimeFormatter.ISO_DATE);
            fb.setDateFinIntegration(d.atStartOfDay());
        }

        fb.setQualiteAccueil(req.getQualiteAccueil());
        fb.setClarteInformations(req.getClarteInformations());
        fb.setAccompagnementManager(req.getAccompagnementManager());
        fb.setAdaptationTaches(req.getAdaptationTaches());
        fb.setDelaiSuffisant(req.getDelaiSuffisant());
        fb.setDifficultesRencontrees(req.isDifficultesRencontrees());
        fb.setPrecisionDifficulties(req.getPrecisionDifficulties());
        fb.setFaciliteUtilisation(req.getFaciliteUtilisation());
        fb.setFonctionnalitesAdaptees(req.getFonctionnalitesAdaptees());
        fb.setProblemTechniques(req.isProblemTechniques());
        fb.setSatisfactionGlobale(req.getSatisfactionGlobale());
        fb.setRecommandeProcessus(req.isRecommandeProcessus());
        fb.setSuggestions(req.getSuggestions());

        return feedbackRepository.save(fb);
    }

    public boolean hasSubmittedFeedback(String userId) {
        return feedbackRepository.existsBySalarieId(userId);
    }

    public Optional<FeedbackOnboarding> getMyFeedback(String userId) {
        return feedbackRepository.findBySalarieId(userId);
    }

    public List<FeedbackOnboarding> getAllFeedbacks() {
        return feedbackRepository.findAll();
    }

    public Map<String, Object> getStatistics() {
        List<FeedbackOnboarding> feedbacks = feedbackRepository.findAll();
        Map<String, Object> stats = new HashMap<>();

        stats.put("total", feedbacks.size());

        if (feedbacks.isEmpty()) {
            stats.put("tauxSatisfactionGlobale", 0.0);
            stats.put("tauxRecommandation", 0.0);
            stats.put("tauxDifficultes", 0.0);
            stats.put("tauxProblemsTechniques", 0.0);
            stats.put("moyenneAccueil", 0.0);
            stats.put("moyenneManager", 0.0);
            stats.put("moyenneTaches", 0.0);
            stats.put("moyennePlateforme", 0.0);
            stats.put("distributionSatisfaction", new HashMap<>());
            stats.put("suggestions", new ArrayList<>());
            stats.put("difficultesList", new ArrayList<>());
            return stats;
        }

        int n = feedbacks.size();

        // Satisfaction globale (satisfied = score 3 or 4)
        long satisfied = feedbacks.stream().filter(f -> f.getSatisfactionGlobale() >= 3).count();
        stats.put("tauxSatisfactionGlobale", Math.round((double) satisfied / n * 100.0));

        // Recommendation rate
        long recommanded = feedbacks.stream().filter(FeedbackOnboarding::isRecommandeProcessus).count();
        stats.put("tauxRecommandation", Math.round((double) recommanded / n * 100.0));

        // Difficulties rate
        long difficultes = feedbacks.stream().filter(FeedbackOnboarding::isDifficultesRencontrees).count();
        stats.put("tauxDifficultes", Math.round((double) difficultes / n * 100.0));

        // Technical problems
        long techProblems = feedbacks.stream().filter(FeedbackOnboarding::isProblemTechniques).count();
        stats.put("tauxProblemsTechniques", Math.round((double) techProblems / n * 100.0));

        // Average scores
        stats.put("moyenneAccueil", round2(feedbacks.stream().mapToInt(FeedbackOnboarding::getQualiteAccueil).average().orElse(0)));
        stats.put("moyenneManager", round2(feedbacks.stream().mapToInt(FeedbackOnboarding::getAccompagnementManager).average().orElse(0)));
        stats.put("moyenneTaches", round2(feedbacks.stream().mapToInt(FeedbackOnboarding::getAdaptationTaches).average().orElse(0)));
        stats.put("moyennePlateforme", round2(feedbacks.stream().mapToInt(FeedbackOnboarding::getFaciliteUtilisation).average().orElse(0)));

        // Distribution satisfaction globale
        Map<String, Long> distrib = new LinkedHashMap<>();
        distrib.put("Très satisfait", feedbacks.stream().filter(f -> f.getSatisfactionGlobale() == 4).count());
        distrib.put("Satisfait", feedbacks.stream().filter(f -> f.getSatisfactionGlobale() == 3).count());
        distrib.put("Peu satisfait", feedbacks.stream().filter(f -> f.getSatisfactionGlobale() == 2).count());
        distrib.put("Insatisfait", feedbacks.stream().filter(f -> f.getSatisfactionGlobale() == 1).count());
        stats.put("distributionSatisfaction", distrib);

        // Suggestions list (non-empty)
        List<String> suggestions = feedbacks.stream()
                .map(FeedbackOnboarding::getSuggestions)
                .filter(s -> s != null && !s.trim().isEmpty())
                .collect(Collectors.toList());
        stats.put("suggestions", suggestions);

        // Difficulties list
        List<String> difficultiesList = feedbacks.stream()
                .filter(FeedbackOnboarding::isDifficultesRencontrees)
                .map(FeedbackOnboarding::getPrecisionDifficulties)
                .filter(s -> s != null && !s.trim().isEmpty())
                .collect(Collectors.toList());
        stats.put("difficultesList", difficultiesList);

        return stats;
    }

    private double round2(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
