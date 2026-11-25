package com.utp.herDesarrollo.security.config;

import com.utp.herDesarrollo.security.jwt.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Configuración central de seguridad, políticas CORS y control de acceso basado en roles (RBAC).
 * Unifica las políticas de acceso para los tres módulos y delega la gestión de usuarios
 * al servicio persistente UsuarioAuthService (JPA).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Peticiones preflight CORS
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Vistas estáticas de los módulos y login
                        .requestMatchers(
                                "/", "/index.html", "/css/**",
                                "/js/**", "/images/**", "/error",
                                "/aulas/**", "/atenciones/**", "/login/**"
                        ).permitAll()

                        // Autenticación JWT, registro de usuarios y directorio de técnicos
                        .requestMatchers("/api/auth/**").permitAll()

                        // Ubicaciones físicas asociadas opcionalmente a tickets
                        .requestMatchers(HttpMethod.GET, "/api/ubicaciones/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/ubicaciones/**").hasAnyRole("TECNICO", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/ubicaciones/**").hasAnyRole("TECNICO", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/ubicaciones/**").hasAnyRole("TECNICO", "ADMIN")

                        // Intervenciones y asignaciones del equipo de soporte
                        .requestMatchers(HttpMethod.GET, "/api/intervenciones/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/intervenciones").hasAnyRole("TECNICO", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/intervenciones/**").hasAnyRole("TECNICO", "ADMIN")

                        // Módulo de Aulas: consultas públicas
                        .requestMatchers(HttpMethod.GET, "/api/aulas/**").permitAll()

                        // Módulo de Aulas: gestión técnica restringida
                        .requestMatchers(HttpMethod.POST, "/api/aulas/**").hasAnyRole("TECNICO", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/aulas/**").hasAnyRole("TECNICO", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/aulas/**").hasAnyRole("TECNICO", "ADMIN")

                        // Mesa de Ayuda: consulta y registro libre
                        .requestMatchers(HttpMethod.GET, "/api/tickets/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/tickets").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/tickets/**").hasAnyRole("TECNICO", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/tickets/**").hasRole("ADMIN")

                        // Alias temporal para clientes existentes
                        .requestMatchers(HttpMethod.GET, "/api/reportes/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/reportes").permitAll()

                        // Alias de compatibilidad para clientes existentes
                        .requestMatchers(HttpMethod.PUT, "/api/reportes/**").hasAnyRole("TECNICO", "ADMIN")

                        // El alias conserva el mismo permiso administrativo que los tickets
                        .requestMatchers(HttpMethod.DELETE, "/api/reportes/**").hasRole("ADMIN")

                        // Módulo de Atenciones: consulta y registro libre
                        .requestMatchers(HttpMethod.GET, "/api/atenciones/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/atenciones").hasAnyRole("TECNICO", "ADMIN")

                        // Módulo de Atenciones: actualización restringida a personal técnico o admin
                        .requestMatchers(HttpMethod.PUT, "/api/atenciones/**").hasAnyRole("TECNICO", "ADMIN")

                        // Cualquier otra petición requiere autenticación
                        .anyRequest().authenticated()
                )
                .httpBasic(Customizer.withDefaults())
                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:http://localhost:4200,http://localhost:80,http://localhost}") List<String> allowedOrigins
    ) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration authenticationConfiguration
    ) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}
