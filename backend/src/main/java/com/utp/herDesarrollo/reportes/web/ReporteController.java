package com.utp.herDesarrollo.reportes.web;

import com.utp.herDesarrollo.reportes.application.dto.ActualizarReporteDTO;
import com.utp.herDesarrollo.reportes.application.dto.CrearReporteDTO;
import com.utp.herDesarrollo.reportes.application.dto.ReporteResponseDTO;
import com.utp.herDesarrollo.reportes.application.service.ReporteService;
import com.utp.herDesarrollo.reportes.domain.model.Prioridad;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controlador REST de tickets del Service Desk universitario.
 * Expone /api/tickets y mantiene /api/reportes como alias de compatibilidad.
 */
@RestController
@RequestMapping({"/api/tickets", "/api/reportes"})
public class ReporteController {

    private final ReporteService reporteService;

    public ReporteController(ReporteService reporteService) {
        this.reporteService = reporteService;
    }

    /**
     * Lista tickets con filtros opcionales por ubicación y prioridad.
     */
    @GetMapping
    public ResponseEntity<List<ReporteResponseDTO>> listarTodos(
            @RequestParam(required = false) String aulaId,
            @RequestParam(required = false) Prioridad prioridad) {
        if ((aulaId != null && !aulaId.isBlank()) || prioridad != null) {
            List<ReporteResponseDTO> reportes = reporteService.listarConFiltros(aulaId, prioridad);
            return ResponseEntity.ok(reportes);
        }
        List<ReporteResponseDTO> reportes = reporteService.listarTodos();
        return ResponseEntity.ok(reportes);
    }

    /**
     * Consulta un ticket por ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ReporteResponseDTO> buscarPorId(@PathVariable Long id) {
        ReporteResponseDTO reporte = reporteService.buscarPorId(id);
        return ResponseEntity.ok(reporte);
    }

    /**
     * Consulta tickets asociados a una ubicación.
     */
    @GetMapping({"/ubicacion/{aulaId}", "/aula/{aulaId}"})
    public ResponseEntity<List<ReporteResponseDTO>> listarPorAula(@PathVariable String aulaId) {
        List<ReporteResponseDTO> reportes = reporteService.listarPorAulaId(aulaId);
        return ResponseEntity.ok(reportes);
    }

    /**
     * Registra un ticket nuevo.
     */
    @PostMapping
    public ResponseEntity<ReporteResponseDTO> crearReporte(@RequestBody CrearReporteDTO dto) {
        ReporteResponseDTO creado = reporteService.crearReporte(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    /**
     * Actualiza estado o detalles del ticket.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ReporteResponseDTO> actualizarReporte(@PathVariable Long id, @RequestBody ActualizarReporteDTO dto) {
        ReporteResponseDTO actualizado = reporteService.actualizarReporte(id, dto);
        return ResponseEntity.ok(actualizado);
    }

    /**
     * Elimina un ticket (solo rol ADMIN).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarReporte(@PathVariable Long id) {
        reporteService.eliminarReporte(id);
        return ResponseEntity.noContent().build();
    }
}
