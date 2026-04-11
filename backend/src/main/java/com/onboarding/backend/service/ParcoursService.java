package com.onboarding.backend.service;

import com.onboarding.backend.model.*;
import com.onboarding.backend.model.enums.TaskType;
import com.onboarding.backend.model.enums.TypeActeur;
import com.onboarding.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ParcoursService {

    private final ParcoursRepository parcoursRepository;
    private final TaskRepository taskRepository;
    private final ParcoursTemplateRepository parcoursTemplateRepository;
    private final TaskTemplateRepository taskTemplateRepository;
    private final AffectationRepository affectationRepository;
    private final UserRepository userRepository;

    // ── Générer un parcours lors d'une affectation ──────────────────────────
    public Parcours genererParcours(String userId, String positionId, String managerId) {

        // Supprimer ancien parcours si existe
        parcoursRepository.findByUserId(userId).ifPresent(old -> {
            taskRepository.findByParcoursIdOrderByOrdreAsc(old.getId())
                    .forEach(taskRepository::delete);
            parcoursRepository.delete(old);
        });

        // Trouver le template associé au poste
        ParcoursTemplate template = parcoursTemplateRepository
                .findByPositionIdAndActifTrue(positionId)
                .orElse(null);

        if (template == null) return null; // pas de template = pas de parcours

        // Créer le parcours
        Parcours parcours = new Parcours();
        parcours.setUserId(userId);
        parcours.setPositionId(positionId);
        parcours.setParcoursTemplateId(template.getId());
        parcours.setStatut(Parcours.StatutParcours.EN_COURS);
        parcours.setDateDebut(LocalDateTime.now());
        parcours.setProgression(0);
        Parcours saved = parcoursRepository.save(parcours);

        // Générer les tâches depuis les templates
        List<TaskTemplate> taskTemplates = taskTemplateRepository
                .findByParcoursTemplateIdOrderByOrdreAsc(template.getId());

        for (TaskTemplate tt : taskTemplates) {
            Task task = new Task();
            task.setParcoursId(saved.getId());
            task.setTaskTemplateId(tt.getId());
            task.setTitre(tt.getTitre());
            task.setDescription(tt.getDescription());
            task.setTaskType(tt.getTaskType());
            task.setTypeActeurs(tt.getTypeActeurs());
            task.setOrdre(tt.getOrdre());
            task.setObligatoire(tt.isObligatoire());
            task.setPhase(tt.getPhase());
            task.setConfig(tt.getConfig());
            task.setStatut(Task.StatutTask.NON_COMMENCE);
            task.setNbTentatives(0);
            task.setProgression(0);
            task.setVerrouille(false); // Par défaut, non verrouillé


            // Assigner l'acteur
            List<String> acteurIds = new ArrayList<>();
            for (TypeActeur acteur : tt.getTypeActeurs()) {
                if (acteur == TypeActeur.MANAGER) acteurIds.add(managerId);
                else if (acteur == TypeActeur.SALARIE) acteurIds.add(userId);
                // RH → null, any admin handles it
            }
            task.setActeurIds(acteurIds);

            // Init acteurProgressions
            List<Task.ActeurProgression> progressions = new ArrayList<>();
            for (TypeActeur acteur : tt.getTypeActeurs()) {
                Task.ActeurProgression ap = new Task.ActeurProgression();
                ap.setTypeActeur(acteur);
                ap.setComplete(false);
                progressions.add(ap);
            }
            task.setActeurProgressions(progressions);

            // Récupérer la date de référence
            LocalDate refDate = LocalDate.now(); // fallback
            User u = userRepository.findById(userId).orElse(null);
            if (u != null && u.getProfessionalInfo() != null) {
                // Priorité : datePriseDePoste → dateEmbauche → today
                if (u.getProfessionalInfo().getDatePriseDePoste() != null) {
                    refDate = u.getProfessionalInfo().getDatePriseDePoste();
                } else if (u.getProfessionalInfo().getDateEmbauche() != null) {
                    refDate = u.getProfessionalInfo().getDateEmbauche();
                }
            }

            // ⭐ NOUVEAU: Gérer l'ouverture à J+1 uniquement pour les QUIZ
            if (tt.getTaskType() == TaskType.QUIZ) {
                // Date d'ouverture = refDate + 1 jour
                LocalDateTime dateOuverture = refDate.plusDays(1).atStartOfDay();
                task.setDateOuverture(dateOuverture);

                // Verrouiller si la date d'ouverture n'est pas encore atteinte
                task.setVerrouille(dateOuverture.isAfter(LocalDateTime.now()));
            }

            // Calculer l'échéance (pour tous les types)
            if (tt.getDelaiJours() > 0) {
                task.setEcheance(refDate.plusDays(tt.getDelaiJours()).atStartOfDay());
            }
            if (tt.getDelaiJours() < 0) {
                task.setEcheance(refDate.minusDays(tt.getDelaiJours()).atStartOfDay());
            }

            // Verrouiller l'entretien par défaut (priorité sur la logique ci-dessus)
            if (tt.getTaskType() == TaskType.ENTRETIEN) {
                task.setVerrouille(true);
            }

            taskRepository.save(task);
        }

        return saved;
    }

    // ── Vérifier et déverrouiller l'entretien ───────────────────────────────
    public void checkEtDeverrouillerEntretien(String parcoursId) {
        List<Task> tasks = taskRepository.findByParcoursIdOrderByOrdreAsc(parcoursId);

        Task  entretien = tasks.stream()
                .filter(t -> t.getTaskType() == TaskType.ENTRETIEN)
                .findFirst().orElse(null);

        if (entretien == null || !entretien.isVerrouille()) return;

        // Vérifier que toutes les tâches AVANT l'entretien sont TERMINE
        boolean toutesTerminees = tasks.stream()
                .filter(t -> t.getOrdre() < entretien.getOrdre())
                .allMatch(t -> t.getStatut() == Task.StatutTask.TERMINE);

        if (toutesTerminees) {
            entretien.setVerrouille(false);
            taskRepository.save(entretien);
        }
    }

    // ── Recalculer la progression du parcours ───────────────────────────────
    public void recalculerProgression(String parcoursId) {
        List<Task> tasks = taskRepository.findByParcoursIdOrderByOrdreAsc(parcoursId);

        if (tasks.isEmpty()) return;

        System.out.println("=== DEBUG ===");
        System.out.println("Nombre total de tâches: " + tasks.size());

        long terminees = tasks.stream()
                .filter(t -> {
                    System.out.println("Statut tâche: " + t.getStatut());
                    return t.getStatut() == Task.StatutTask.TERMINE;
                })
                .count();

        System.out.println("Nombre de tâches terminées: " + terminees);

        int progression = (int) ((terminees * 100.0) / tasks.size());

        System.out.println("Progression calculée: " + progression);

        Parcours parcours = parcoursRepository.findById(parcoursId).orElse(null);
        if (parcours == null) return;

        parcours.setProgression(progression);

        if (progression == 100) {
            parcours.setStatut(Parcours.StatutParcours.TERMINE);
            parcours.setDateFin(LocalDateTime.now());
        }

        parcoursRepository.save(parcours);
    }
}