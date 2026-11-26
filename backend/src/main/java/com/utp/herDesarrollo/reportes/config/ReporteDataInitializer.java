package com.utp.herDesarrollo.reportes.config;

import com.utp.herDesarrollo.aulas.model.Aula;
import com.utp.herDesarrollo.aulas.repository.AulaRepository;
import com.utp.herDesarrollo.reportes.domain.model.EstadoReporte;
import com.utp.herDesarrollo.reportes.domain.model.Prioridad;
import com.utp.herDesarrollo.reportes.domain.model.Reporte;
import com.utp.herDesarrollo.reportes.domain.model.TipoProblema;
import com.utp.herDesarrollo.reportes.domain.model.TipoSolicitud;
import com.utp.herDesarrollo.reportes.domain.repository.ReporteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Carga datos de demostración idempotentes para la Mesa de Ayuda y ubicaciones del campus.
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class ReporteDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ReporteDataInitializer.class);

    private final AulaRepository aulaRepository;
    private final ReporteRepository reporteRepository;
    public ReporteDataInitializer(AulaRepository aulaRepository, ReporteRepository reporteRepository) {
        this.aulaRepository = aulaRepository;
        this.reporteRepository = reporteRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        Aula a101 = asegurarAula("A-101", "Pabellón A • Piso 1", 40, "Disponible");
        Aula lab302 = asegurarAula("LAB-302", "Pabellón C • Piso 3", 30, "Disponible");
        Aula b204 = asegurarAula("B-204", "Pabellón B • Piso 2", 45, "Disponible");
        Aula a305 = asegurarAula("A-305", "Pabellón A • Piso 3", 40, "Disponible");
        Aula lab104 = asegurarAula("LAB-104", "Pabellón C • Piso 1", 30, "Disponible");
        Aula d401 = asegurarAula("D-401", "Pabellón D • Piso 4", 50, "Disponible");
        Aula c201 = asegurarAula("C-201", "Pabellón C • Piso 2", 35, "Disponible");

        asegurarReporte(
                a101,
                TipoSolicitud.INCIDENTE,
                TipoProblema.PLATAFORMAS,
                Prioridad.ALTA,
                EstadoReporte.PENDIENTE,
                "La plataforma académica no permite iniciar sesión durante el periodo de evaluaciones.",
                LocalDateTime.of(2026, 10, 29, 8, 30)
        );

        asegurarReporte(
                lab302,
                TipoSolicitud.INCIDENTE,
                TipoProblema.REDES,
                Prioridad.ALTA,
                EstadoReporte.EN_ATENCION,
                "La red Wi-Fi presenta interrupciones frecuentes en el laboratorio de cómputo.",
                LocalDateTime.of(2026, 10, 29, 9, 15)
        );

        asegurarReporte(
                b204,
                TipoSolicitud.INCIDENTE,
                TipoProblema.CUENTAS,
                Prioridad.MEDIA,
                EstadoReporte.PENDIENTE,
                "El usuario docente no puede acceder a su cuenta institucional.",
                LocalDateTime.of(2026, 10, 28, 14, 20)
        );

        asegurarReporte(
                a305,
                TipoSolicitud.SOLICITUD_SERVICIO,
                TipoProblema.SOFTWARE,
                Prioridad.MEDIA,
                EstadoReporte.EN_ATENCION,
                "Se requiere instalar software autorizado para una actividad académica.",
                LocalDateTime.of(2026, 10, 28, 16, 40)
        );

        asegurarReporte(
                lab104,
                TipoSolicitud.INCIDENTE,
                TipoProblema.AUTENTICACION,
                Prioridad.BAJA,
                EstadoReporte.RESUELTO,
                "Se restableció el acceso a la cuenta institucional tras validar la identidad del usuario.",
                LocalDateTime.of(2026, 10, 27, 11, 15)
        );

        asegurarReporte(
                d401,
                TipoSolicitud.INCIDENTE,
                TipoProblema.CORREO,
                Prioridad.BAJA,
                EstadoReporte.RESUELTO,
                "Se recuperó el acceso al correo institucional y se confirmó su funcionamiento.",
                LocalDateTime.of(2026, 10, 26, 10, 0)
        );

        asegurarReporte(
                c201,
                TipoSolicitud.CONSULTA,
                TipoProblema.PLATAFORMAS,
                Prioridad.BAJA,
                EstadoReporte.PENDIENTE,
                "Se solicita orientación para acceder a los recursos de la plataforma académica.",
                LocalDateTime.of(2026, 10, 25, 9, 0)
        );

        log.info("Mesa de Ayuda TI: ubicaciones y tickets de soporte iniciales verificados correctamente.");
    }

    private Aula asegurarAula(String codigo, String ubicacion, int capacidad, String estadoInicial) {
        return aulaRepository.findByCodigoIgnoreCase(codigo)
                .map(existente -> {
                    boolean modificado = false;
                    if (existente.getUbicacion() == null
                            || existente.getUbicacion().isBlank()
                            || !existente.getUbicacion().contains("•")) {
                        existente.setUbicacion(ubicacion);
                        modificado = true;
                    }
                    if (existente.getCapacidad() <= 0) {
                        existente.setCapacidad(capacidad);
                        modificado = true;
                    }
                    if (existente.getEstado() == null || existente.getEstado().isBlank()) {
                        existente.setEstado(estadoInicial);
                        modificado = true;
                    }
                    return modificado ? aulaRepository.save(existente) : existente;
                })
                .orElseGet(() -> aulaRepository.save(new Aula(null, codigo, ubicacion, capacidad, estadoInicial)));
    }

    private void asegurarReporte(
            Aula aula,
            TipoSolicitud tipoSolicitud,
            TipoProblema tipoProblema,
            Prioridad prioridad,
            EstadoReporte estado,
            String descripcion,
            LocalDateTime fechaRegistro) {
        List<Reporte> existentesEnAula = reporteRepository.findByAulaId(aula.getCodigo());
        boolean yaExiste = existentesEnAula.stream()
                .anyMatch(r -> r.getTipoSolicitud() == tipoSolicitud
                        && r.getTipoProblema() == tipoProblema
                        && r.getDescripcion().equalsIgnoreCase(descripcion));

        if (!yaExiste) {
            Reporte nuevo = new Reporte(aula, tipoProblema, descripcion, prioridad, estado, fechaRegistro);
            nuevo.setTipoSolicitud(tipoSolicitud);
            nuevo.setServicioAfectado(nombreServicio(tipoProblema));
            reporteRepository.save(nuevo);
        }
    }

    private String nombreServicio(TipoProblema tipoProblema) {
        return switch (tipoProblema) {
            case AUTENTICACION -> "Autenticación institucional";
            case PLATAFORMAS -> "Plataforma académica";
            case REDES -> "Red Wi-Fi";
            case CUENTAS -> "Cuenta institucional";
            case SOFTWARE -> "Software autorizado";
            case CORREO -> "Correo institucional";
            case EQUIPOS -> "Equipo de cómputo";
            default -> "Otro servicio";
        };
    }
}
