package com.onboarding.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Proxy controller — relaie les requêtes vers l'API Anthropic.
 * Évite les problèmes CORS et masque la clé API côté serveur.
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiProxyController {

    @Value("${anthropic.api.key:}")
    private String anthropicApiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/chat")
    public ResponseEntity<String> chat(@RequestBody Map<String, Object> body) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"Clé API Anthropic non configurée.\"}");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", anthropicApiKey);
        headers.set("anthropic-version", "2023-06-01");

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    "https://api.anthropic.com/v1/messages",
                    HttpMethod.POST,
                    request,
                    String.class
            );
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(502)
                    .body("{\"error\":\"Erreur communication Anthropic: " + e.getMessage() + "\"}");
        }
    }
}