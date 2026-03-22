package com.onboarding.backend.config;

import com.onboarding.backend.model.Position;
import com.onboarding.backend.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class PositionDataInitializer implements CommandLineRunner {

    private final PositionRepository positionRepository;

    @Override
    public void run(String... args) {
        List<String> postes = List.of(
                "Commercial",
                "Développeur logiciel",
                "Chargé des ressources humaines",
                "Customer Success Manager",
                "Technicien support IT",
                "Responsable marketing digital",
                "Comptable",
                "Chef de projet",
                "Opérateur de production"
        );

        for (String titre : postes) {
            if (!positionRepository.existsByTitre(titre)) {
                Position p = new Position();
                p.setTitre(titre);
                p.setActif(true);
                positionRepository.save(p);
                System.out.println("Position créée : " + titre);
            }
        }
    }
}