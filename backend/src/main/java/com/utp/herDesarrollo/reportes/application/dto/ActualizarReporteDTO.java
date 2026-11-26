package com.utp.herDesarrollo.reportes.application.dto;

import com.utp.herDesarrollo.reportes.domain.model.EstadoReporte;
import com.utp.herDesarrollo.reportes.domain.model.Prioridad;
import com.utp.herDesarrollo.reportes.domain.model.TipoSolicitud;
import com.utp.herDesarrollo.reportes.domain.model.TipoProblema;

/**
 * DTO para la actualización de estado y detalles de una incidencia.
 */
public class ActualizarReporteDTO {

    private String descripcion;
    private String servicioAfectado;
    private TipoSolicitud tipoSolicitud;
    private TipoProblema tipoProblema;
    private Prioridad prioridad;
    private EstadoReporte estado;

    public ActualizarReporteDTO() {
    }

    public ActualizarReporteDTO(String descripcion, TipoProblema tipoProblema, Prioridad prioridad, EstadoReporte estado) {
        this.descripcion = descripcion;
        this.tipoProblema = tipoProblema;
        this.prioridad = prioridad;
        this.estado = estado;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getServicioAfectado() {
        return servicioAfectado;
    }

    public void setServicioAfectado(String servicioAfectado) {
        this.servicioAfectado = servicioAfectado;
    }

    public TipoSolicitud getTipoSolicitud() {
        return tipoSolicitud;
    }

    public void setTipoSolicitud(TipoSolicitud tipoSolicitud) {
        this.tipoSolicitud = tipoSolicitud;
    }

    public TipoProblema getTipoProblema() {
        return tipoProblema;
    }

    public void setTipoProblema(TipoProblema tipoProblema) {
        this.tipoProblema = tipoProblema;
    }

    public Prioridad getPrioridad() {
        return prioridad;
    }

    public void setPrioridad(Prioridad prioridad) {
        this.prioridad = prioridad;
    }

    public EstadoReporte getEstado() {
        return estado;
    }

    public void setEstado(EstadoReporte estado) {
        this.estado = estado;
    }
}
