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
        //parcours.setParcoursTemplateId(template.getId());
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
            //task.setTaskTemplateId(tt.getId());
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
                task.setEcheance(refDate.minusDays(Math.abs(tt.getDelaiJours())).atStartOfDay());
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
    // ── Synchroniser un parcours actif avec les modifications du template ───
    /**
     * Ajoute les nouvelles tâches du template qui ne sont pas encore présentes
     * dans le parcours actif du salarié. Les tâches déjà existantes (complétées
     * ou en cours) ne sont jamais supprimées ni modifiées.
     */
    public void syncParcoursWithTemplate(
            com.onboarding.backend.model.Parcours parcours,
            List<com.onboarding.backend.model.TaskTemplate> templateTasks) {

        // Tâches existantes dans le parcours
        List<com.onboarding.backend.model.Task> existingTasks =
                taskRepository.findByParcoursIdOrderByOrdreAsc(parcours.getId());

        // Index des titres déjà présents (pour détection des doublons)
        java.util.Set<String> existingTitles = existingTasks.stream()
                .map(com.onboarding.backend.model.Task::getTitre)
                .collect(java.util.stream.Collectors.toSet());

        // Calculer le prochain ordre disponible
        int nextOrdre = existingTasks.stream()
                .mapToInt(com.onboarding.backend.model.Task::getOrdre)
                .max()
                .orElse(0) + 1;

        int added = 0;

        // ── Mettre à jour les tâches existantes (phase, acteurs, description, etc.) ──
        for (com.onboarding.backend.model.Task existing : existingTasks) {
            com.onboarding.backend.model.TaskTemplate matching = templateTasks.stream()
                    .filter(tt -> tt.getTitre().equals(existing.getTitre()))
                    .findFirst().orElse(null);
            if (matching == null) continue;
            // Ne pas toucher aux tâches TERMINE
            if (existing.getStatut() == Task.StatutTask.TERMINE) continue;

            boolean changed = false;

            // Phase
            if (matching.getPhase() != null && !matching.getPhase().equals(existing.getPhase())) {
                existing.setPhase(matching.getPhase());
                changed = true;
            }
            // Description
            if (matching.getDescription() != null && !matching.getDescription().equals(existing.getDescription())) {
                existing.setDescription(matching.getDescription());
                changed = true;
            }
            // TypeActeurs
            if (matching.getTypeActeurs() != null && !matching.getTypeActeurs().equals(existing.getTypeActeurs())) {
                existing.setTypeActeurs(matching.getTypeActeurs());
                // Reconstruire acteurIds et acteurProgressions
                List<String> newActeurIds = new ArrayList<>();
                List<Task.ActeurProgression> newProgressions = new ArrayList<>();
                com.onboarding.backend.model.Affectation aff =
                        affectationRepository.findByUserId(parcours.getUserId()).orElse(null);
                String managerId = aff != null ? aff.getManagerId() : null;
                for (TypeActeur acteur : matching.getTypeActeurs()) {
                    if (acteur == TypeActeur.MANAGER && managerId != null) newActeurIds.add(managerId);
                    else if (acteur == TypeActeur.SALARIE) newActeurIds.add(parcours.getUserId());
                    // Conserver la progression existante si l'acteur était déjà là
                    Task.ActeurProgression existingAp = existing.getActeurProgressions() == null ? null
                            : existing.getActeurProgressions().stream()
                            .filter(ap -> ap.getTypeActeur() == acteur).findFirst().orElse(null);
                    Task.ActeurProgression ap = existingAp != null ? existingAp : new Task.ActeurProgression();
                    ap.setTypeActeur(acteur);
                    newProgressions.add(ap);
                }
                existing.setActeurIds(newActeurIds);
                existing.setActeurProgressions(newProgressions);
                changed = true;
            }
            // Obligatoire
            if (existing.isObligatoire() != matching.isObligatoire()) {
                existing.setObligatoire(matching.isObligatoire());
                changed = true;
            }

            if (changed) taskRepository.save(existing);
        }

        for (com.onboarding.backend.model.TaskTemplate tt : templateTasks) {
            if (existingTitles.contains(tt.getTitre())) continue; // déjà présente

            com.onboarding.backend.model.Task newTask = new com.onboarding.backend.model.Task();
            newTask.setParcoursId(parcours.getId());
            newTask.setTitre(tt.getTitre());
            newTask.setDescription(tt.getDescription());
            newTask.setTaskType(tt.getTaskType());
            newTask.setTypeActeurs(tt.getTypeActeurs() != null ? tt.getTypeActeurs() : new ArrayList<>());
            newTask.setObligatoire(tt.isObligatoire());
            newTask.setOrdre(nextOrdre++);
            newTask.setPhase(tt.getPhase());
            newTask.setConfig(tt.getConfig());
            newTask.setStatut(Task.StatutTask.NON_COMMENCE);
            newTask.setNbTentatives(0);
            newTask.setProgression(0);
            newTask.setVerrouille(false);

            // Initialiser acteurIds et acteurProgressions (évite NPE dans TaskController)
            List<String> acteurIds = new ArrayList<>();
            List<Task.ActeurProgression> progressions = new ArrayList<>();

            // Récupérer l'affectation pour trouver le managerId
            com.onboarding.backend.model.Affectation aff =
                    affectationRepository.findByUserId(parcours.getUserId()).orElse(null);
            String managerId = aff != null ? aff.getManagerId() : null;

            if (tt.getTypeActeurs() != null) {
                for (TypeActeur acteur : tt.getTypeActeurs()) {
                    if (acteur == TypeActeur.MANAGER && managerId != null) {
                        acteurIds.add(managerId);
                    } else if (acteur == TypeActeur.SALARIE) {
                        acteurIds.add(parcours.getUserId());
                    }
                    Task.ActeurProgression ap = new Task.ActeurProgression();
                    ap.setTypeActeur(acteur);
                    ap.setComplete(false);
                    progressions.add(ap);
                }
            }
            newTask.setActeurIds(acteurIds);
            newTask.setActeurProgressions(progressions);

            // Verrou ENTRETIEN
            if (tt.getTaskType() == TaskType.ENTRETIEN) {
                newTask.setVerrouille(true);
            }

            // Calculer l'échéance depuis la date de début du parcours
            if (tt.getDelaiJours() > 0 && parcours.getDateDebut() != null) {
                newTask.setEcheance(parcours.getDateDebut().plusDays(tt.getDelaiJours()));
            }

            taskRepository.save(newTask);
            added++;
        }

        // Recalculer la progression du parcours
        if (added > 0) {
            int total = existingTasks.size() + added;
            long done = existingTasks.stream()
                    .filter(t -> t.getStatut() == Task.StatutTask.TERMINE)
                    .count();
            int progression = total > 0 ? (int) ((done * 100) / total) : 0;
            parcours.setProgression(progression);
            parcoursRepository.save(parcours);
        }
    }


}