package com.onboarding.backend.service;

import com.onboarding.backend.model.*;
import com.onboarding.backend.model.enums.TaskType;
import com.onboarding.backend.model.enums.TypeActeur;
import com.onboarding.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
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
            task.setTypeActeur(tt.getTypeActeur());
            task.setOrdre(tt.getOrdre());
            task.setObligatoire(tt.isObligatoire());
            task.setConfig(tt.getConfig());
            task.setStatut(Task.StatutTask.NON_COMMENCE);
            task.setNbTentatives(0);
            task.setProgression(0);

            // Assigner l'acteur
            if (tt.getTypeActeur() == TypeActeur.MANAGER) {
                task.setActeurId(managerId);
            } else if (tt.getTypeActeur() == TypeActeur.RH) {
                task.setActeurId(null); // sera géré par l'admin
            } else {
                task.setActeurId(userId); // SALARIE
            }

            // Calculer l'échéance
            if (tt.getDelaiJours() > 0) {
                task.setEcheance(LocalDateTime.now().plusDays(tt.getDelaiJours()));
            }

            // Verrouiller l'entretien par défaut
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