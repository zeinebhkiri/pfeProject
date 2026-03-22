package com.onboarding.backend.config;

import com.onboarding.backend.filter.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Disable CSRF (not needed for stateless REST APIs)
                .csrf(AbstractHttpConfigurer::disable)

                // Enable CORS with our config below
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // Define which routes are public and which require authentication
                .authorizeHttpRequests(auth -> auth

                        // ── Routes publiques ────────────────────────────────────────────
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/auth/activate").permitAll()
                        .requestMatchers("/api/auth/token-info").permitAll()
                        .requestMatchers("/api/auth/forgot-password").permitAll()
                        .requestMatchers("/api/auth/reset-password").permitAll()


                        // ── Routes ADMIN (RH) uniquement ───────────────────────────────
                        .requestMatchers("/api/auth/create-employee").hasRole("ADMIN")
                        .requestMatchers("/api/users").hasRole("ADMIN")

                        // ── Routes MANAGER + ADMIN ──────────────────────────────────────
                        .requestMatchers("/api/manager/**").hasAnyRole("MANAGER", "ADMIN")

                        // ── Routes accessibles à tous les utilisateurs connectés ────────
                        .requestMatchers("/api/users/me").authenticated()
                        .requestMatchers("/api/parcours/**").authenticated()
                        .requestMatchers("/api/tasks/**").authenticated()
                        .requestMatchers("/api/documents/**").authenticated()
                        .requestMatchers("/api/affectations/**").authenticated()

                        // ── Tout le reste nécessite une authentification ─────────────────
                        .anyRequest().authenticated()
                )

                // Use stateless sessions (JWT, no server-side sessions)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // Register our custom authentication provider
                .authenticationProvider(authenticationProvider)

                // Add our JWT filter BEFORE Spring's default username/password filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // Allow requests from React frontend
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}