package com.onboarding.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    public void sendActivationEmail(String toEmail, String token, String fullName, LocalDateTime dateLimit) {
        String activationLink = frontendUrl + "/activate-account?token=" + token;

        // Formater la date limite en français : ex "28/02/2025 à 14:30"
        String dateLimitFormatee = dateLimit.format(
                DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm")
        );

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Activez votre compte - Onboarding");
        message.setText(
                "Bonjour " + fullName + ",\n\n" +
                        "Votre compte a été créé. Veuillez cliquer sur le lien ci-dessous pour activer votre compte " +
                        "et définir votre mot de passe :\n\n" +
                        activationLink + "\n\n" +
                        "⚠️ IMPORTANT : Vous devez compléter votre profil à 100% avant le : " + dateLimitFormatee + "\n" +
                        "Passé ce délai, votre compte sera automatiquement désactivé si votre profil est incomplet.\n\n" +
                        "Cordialement,\nL'équipe RH"
        );

        mailSender.send(message);
    }
    public void sendCorrectionEmail(String toEmail, String prenomNom, String commentaire, String dateLimite) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("⚠️ Correction requise — Votre profil OnboardPro");
        message.setText(
                "Bonjour " + prenomNom + ",\n\n" +
                        "Votre responsable RH a examiné votre profil et demande des corrections.\n\n" +
                        "📝 Commentaire RH :\n" + commentaire + "\n\n" +
                        "📅 Date limite pour effectuer les corrections : " + dateLimite + "\n\n" +
                        "Veuillez vous connecter à votre espace OnboardPro et mettre à jour vos informations.\n\n" +
                        "Cordialement,\n" +
                        "L'équipe RH — OnboardPro"
        );
        mailSender.send(message);
    }
    public void sendWelcomeEmail(String toEmail, String prenomNom, String role,
                                 String poste, String managerNom) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("🎉 Bienvenue chez OnboardPro !");

        String corps;
        if (role.equals("MANAGER")) {
            corps = "Bonjour " + prenomNom + ",\n\n" +
                    "Félicitations ! Votre compte OnboardPro a été validé.\n\n" +
                    "📋 Votre poste : " + poste + "\n\n" +
                    "Vous avez un rôle de Manager. Vous serez superviseur d'une équipe.\n\n" +
                    "Bienvenue dans l'équipe !\n\n" +
                    "Cordialement,\nL'équipe RH — OnboardPro";
        } else {
            corps = "Bonjour " + prenomNom + ",\n\n" +
                    "Félicitations ! Votre compte OnboardPro a été validé.\n\n" +
                    "📋 Votre poste : " + poste + "\n" +
                    "👔 Votre manager : " + (managerNom != null ? managerNom : "À définir") + "\n\n" +
                    "Vous faites maintenant partie de l'équipe. Bienvenue !\n\n" +
                    "Cordialement,\nL'équipe RH — OnboardPro";
        }
        message.setText(corps);
        mailSender.send(message);
    }
    public void sendPasswordResetEmail(String toEmail, String prenomNom, String resetLink) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Réinitialisation de votre mot de passe — OnboardPro");
        message.setText(
                "Bonjour " + prenomNom + ",\n\n" +
                        "Vous avez demandé la réinitialisation de votre mot de passe.\n\n" +
                        "Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :\n" +
                        resetLink + "\n\n" +
                        "Ce lien est valable 30 minutes.\n\n" +
                        "Si vous n'avez pas fait cette demande, ignorez cet email.\n\n" +
                        "L'équipe OnboardPro"
        );
        mailSender.send(message);
    }
}