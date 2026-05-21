package com.onboarding.backend.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Document(collection = "activation_tokens")
public class ActivationToken {

    @Id
    private String id;
    private String token;
    private String userId;
    private LocalDateTime expirationDate;
    private boolean used;
}