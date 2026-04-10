package com.onboarding.backend.dto;

import com.onboarding.backend.model.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateEmployeeRequest {

    @NotBlank(message = "Le nom est obligatoire")
    private String nom;

    @NotBlank(message = "Le prénom est obligatoire")
    private String prenom;

    @Email(message = "Email invalide")
    @NotBlank(message = "L'email est obligatoire")
    private String email;

    @NotNull(message = "Le rôle est obligatoire")
    private Role role; // SALARIE ou MANAGER (ADMIN ne peut pas être créé via cette route)

    @NotNull(message = "Le nombre de jours limite est obligatoire")
    @Min(value = 1, message = "Minimum 1 jour")
    private Integer joursLimite;
    private String dateEmbauche;
}