package com.utp.herDesarrollo.reportes.e2e;

import com.jayway.jsonpath.JsonPath;
import com.utp.herDesarrollo.aulas.model.Aula;
import com.utp.herDesarrollo.aulas.repository.AulaRepository;
import com.utp.herDesarrollo.reportes.domain.model.EstadoReporte;
import com.utp.herDesarrollo.reportes.domain.model.Prioridad;
import com.utp.herDesarrollo.reportes.domain.model.Reporte;
import com.utp.herDesarrollo.reportes.domain.repository.ReporteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Pruebas de Verificación End-to-End (Semana 15):
 * Valida la integración completa entre los contratos consumidos por Angular (HttpClient + AuthInterceptor),
 * los controladores REST de Spring Boot (Reportes, Aulas y Auth/JWT) y la capa de persistencia relacional JPA.
 */
@SpringBootTest
@Transactional
@DisplayName("Semana 15 - Verificación End-to-End (Angular Contract -> Spring Boot -> JPA/BD)")
class ReporteEndToEndIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ReporteRepository reporteRepository;

    @Autowired
    private AulaRepository aulaRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();

        if (!aulaRepository.existsByCodigo("A-101")) {
            aulaRepository.save(new Aula(null, "A-101", "Pabellón A • Piso 1", 40, "Disponible"));
        }
        if (!aulaRepository.existsByCodigo("LAB-302")) {
            aulaRepository.save(new Aula(null, "LAB-302", "Pabellón C • Piso 3", 30, "Disponible"));
        }
    }

    private String obtenerTokenJwt(String username, String password) throws Exception {
        String loginJson = """
                {
                    "username": "%s",
                    "password": "%s"
                }
                """.formatted(username, password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andExpect(jsonPath("$.tipo", is("Bearer")))
                .andReturn();

        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    @Test
    @DisplayName("E2E 1: Flujo de ticket de tres etapas, seguimiento y bloqueo de ticket cerrado")
    void debeEjecutarCicloOperativoCompletoDeTresEtapasYSincronizarAula() throws Exception {
        // 1. Verificar catálogo de aulas disponible para los chips de Angular (GET /api/aulas)
        mockMvc.perform(get("/api/aulas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.codigo == 'A-101')].estado", contains("Disponible")));

        // 2. Crear ticket desde el formulario de Mesa de Ayuda con prioridad alta
        String crearReporteJson = """
                {
                    "aulaId": "A-101",
                    "tipoSolicitud": "INCIDENTE",
                    "tipoProblema": "PLATAFORMAS",
                    "servicioAfectado": "Plataforma académica",
                    "descripcion": "La plataforma académica no permite iniciar sesión durante las evaluaciones.",
                    "prioridad": "ALTA"
                }
                """;

        MvcResult postResult = mockMvc.perform(post("/api/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crearReporteJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.aulaId", is("A-101")))
                .andExpect(jsonPath("$.aulaUbicacion", is("Pabellón A • Piso 1")))
                .andExpect(jsonPath("$.tipoSolicitud", is("INCIDENTE")))
                .andExpect(jsonPath("$.estado", is("PENDIENTE")))
                .andExpect(jsonPath("$.prioridad", is("ALTA")))
                .andReturn();

        Long reporteId = ((Number) JsonPath.read(postResult.getResponse().getContentAsString(), "$.id")).longValue();

        // 3. El estado físico de una ubicación no se modifica por el estado de un ticket.
        Aula aulaTrasCreacion = aulaRepository.findByCodigoIgnoreCase("A-101").orElseThrow();
        assertEquals("Disponible", aulaTrasCreacion.getEstado());

        // 4. Verificar que la detección de duplicados no depende de la ubicación (HTTP 400)
        String incidenteVirtualDuplicadoJson = """
                {
                    "tipoSolicitud": "INCIDENTE",
                    "tipoProblema": "PLATAFORMAS",
                    "servicioAfectado": "Plataforma académica",
                    "descripcion": "La plataforma académica no permite iniciar sesión durante las evaluaciones.",
                    "prioridad": "ALTA"
                }
                """;
        mockMvc.perform(post("/api/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(incidenteVirtualDuplicadoJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("ticket de incidente activo")));

        String incidenteVirtualJson = """
                {
                    "tipoSolicitud": "INCIDENTE",
                    "tipoProblema": "CUENTAS",
                    "servicioAfectado": "Cuenta institucional",
                    "descripcion": "Necesito recuperar el acceso a mi cuenta institucional.",
                    "prioridad": "MEDIA"
                }
                """;
        mockMvc.perform(post("/api/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(incidenteVirtualJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.aulaId", is("")));

        String crearSolicitudServicioJson = """
                {
                    "aulaId": "A-101",
                    "tipoSolicitud": "SOLICITUD_SERVICIO",
                    "tipoProblema": "PLATAFORMAS",
                    "servicioAfectado": "Plataforma académica",
                    "descripcion": "Se solicita habilitar una función de la plataforma.",
                    "prioridad": "MEDIA"
                }
                """;
        mockMvc.perform(post("/api/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crearSolicitudServicioJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipoSolicitud", is("SOLICITUD_SERVICIO")));

        // 5. Autenticar como TECNICO y avanzar a Etapa 2: EN_ATENCION
        String tokenTecnico = obtenerTokenJwt("tecnico", "tecnico123");

        String pasarAEnAtencionJson = """
                {
                    "descripcion": "Técnico revisando cableado HDMI y matriz de video del proyector.",
                    "tipoProblema": "PLATAFORMAS",
                    "servicioAfectado": "Plataforma académica",
                    "prioridad": "ALTA",
                    "estado": "EN_ATENCION"
                }
                """;

        mockMvc.perform(put("/api/tickets/" + reporteId)
                        .header("Authorization", "Bearer " + tokenTecnico)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pasarAEnAtencionJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", is("EN_ATENCION")));

        // 6. Avanzar al cierre del ticket: RESUELTO
        String pasarAResueltoJson = """
                {
                    "descripcion": "Transceptor HDMI reemplazado y señal de video verificada al 100%.",
                    "tipoProblema": "PLATAFORMAS",
                    "servicioAfectado": "Plataforma académica",
                    "prioridad": "ALTA",
                    "estado": "RESUELTO"
                }
                """;

        mockMvc.perform(put("/api/tickets/" + reporteId)
                        .header("Authorization", "Bearer " + tokenTecnico)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pasarAResueltoJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", is("RESUELTO")));

        // 7. La resolución de un ticket tampoco cambia el estado de la ubicación.
        Aula aulaTrasResolucion = aulaRepository.findByCodigoIgnoreCase("A-101").orElseThrow();
        assertEquals("Disponible", aulaTrasResolucion.getEstado());

        // 8. Verificar que un reporte RESUELTO queda cerrado y rechaza ediciones posteriores (HTTP 400)
        String intentoEditarCerradoJson = """
                {
                    "descripcion": "Intento de alterar expediente histórico ya cerrado.",
                    "tipoProblema": "PLATAFORMAS",
                    "servicioAfectado": "Plataforma académica",
                    "prioridad": "BAJA",
                    "estado": "RESUELTO"
                }
                """;

        mockMvc.perform(put("/api/tickets/" + reporteId)
                        .header("Authorization", "Bearer " + tokenTecnico)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(intentoEditarCerradoJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("resuelto y cerrado")));
    }

    @Test
    @DisplayName("E2E 2: RBAC para eliminar tickets; las ubicaciones no cambian de estado")
    void debePermitirEliminacionSoloAAdminYLiberarAulaAsociada() throws Exception {
        // 1. Registrar reporte de prioridad ALTA en LAB-302
        String crearJson = """
                {
                    "aulaId": "LAB-302",
                    "tipoProblema": "REDES",
                    "servicioAfectado": "Red Wi-Fi",
                    "descripcion": "La red Wi-Fi presenta interrupciones frecuentes en el laboratorio.",
                    "prioridad": "ALTA"
                }
                """;

        MvcResult postResult = mockMvc.perform(post("/api/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crearJson))
                .andExpect(status().isCreated())
                .andReturn();

        Long reporteId = ((Number) JsonPath.read(postResult.getResponse().getContentAsString(), "$.id")).longValue();
        assertEquals("Disponible", aulaRepository.findByCodigoIgnoreCase("LAB-302").orElseThrow().getEstado());

        // 2. Sin token -> 401 Unauthorized
        mockMvc.perform(delete("/api/tickets/" + reporteId))
                .andExpect(status().isUnauthorized());

        // 3. Con token de TECNICO -> 403 Forbidden (solo ADMIN puede eliminar)
        String tokenTecnico = obtenerTokenJwt("tecnico", "tecnico123");
        mockMvc.perform(delete("/api/tickets/" + reporteId)
                        .header("Authorization", "Bearer " + tokenTecnico))
                .andExpect(status().isForbidden());

        // 4. Con token de ADMIN -> 204 No Content
        String tokenAdmin = obtenerTokenJwt("admin", "admin123");
        mockMvc.perform(delete("/api/tickets/" + reporteId)
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isNoContent());

        // 5. Verificar que el ticket fue eliminado y la ubicación sigue disponible.
        assertFalse(reporteRepository.existsById(reporteId));
        assertEquals("Disponible", aulaRepository.findByCodigoIgnoreCase("LAB-302").orElseThrow().getEstado());
    }

    @Test
    @DisplayName("E2E 3: Consulta con JOIN FETCH y enriquecimiento de DTO (aulaInternoId y aulaUbicacion) para tarjetas de Angular")
    void debeRetornarDtoEnriquecidoConDatosDelAulaEnConsultas() throws Exception {
        Aula aula = aulaRepository.findByCodigoIgnoreCase("A-101").orElseThrow();
        Reporte guardado = reporteRepository.save(new Reporte(
                aula,
                com.utp.herDesarrollo.reportes.domain.model.TipoProblema.MOBILIARIO,
                "Cuatro carpetas con respaldar suelto cerca de la puerta.",
                Prioridad.MEDIA,
                EstadoReporte.PENDIENTE,
                java.time.LocalDateTime.now()
        ));

        mockMvc.perform(get("/api/reportes/" + guardado.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(guardado.getId().intValue())))
                .andExpect(jsonPath("$.aulaId", is("A-101")))
                .andExpect(jsonPath("$.aulaInternoId", is(aula.getId().intValue())))
                .andExpect(jsonPath("$.aulaUbicacion", is("Pabellón A • Piso 1")))
                .andExpect(jsonPath("$.tipoProblema", is("MOBILIARIO")))
                .andExpect(jsonPath("$.prioridad", is("MEDIA")))
                .andExpect(jsonPath("$.estado", is("PENDIENTE")));
    }
}
