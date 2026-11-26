export type TipoProblema =
  | 'AUTENTICACION'
  | 'PLATAFORMAS'
  | 'REDES'
  | 'CUENTAS'
  | 'SOFTWARE'
  | 'CORREO'
  | 'EQUIPOS'
  | 'OTRO'
  | 'TECNOLOGICO'
  | 'ELECTRICO'
  | 'MOBILIARIO'
  | 'INFRAESTRUCTURA';
export type Prioridad = 'ALTA' | 'MEDIA' | 'BAJA';
export type EstadoReporte = 'PENDIENTE' | 'EN_ATENCION' | 'RESUELTO';
export type TipoSolicitud = 'INCIDENTE' | 'SOLICITUD_SERVICIO' | 'CONSULTA';

export interface AulaDisponible {
  id?: number;
  codigo: string;
  ubicacion: string;
  capacidad?: number;
  estado?: string;
}

export interface Reporte {
  id: number;
  aulaId: string;
  aulaInternoId?: number;
  aulaUbicacion?: string;
  tipoSolicitud?: TipoSolicitud;
  tipoProblema: TipoProblema;
  servicioAfectado?: string;
  prioridad: Prioridad;
  estado: EstadoReporte;
  descripcion: string;
  fechaRegistro: string;
  reportadoPor?: string;
}

export interface CrearReportePayload {
  aulaId: string;
  aulaUbicacion: string;
  tipoSolicitud?: TipoSolicitud;
  tipoProblema: TipoProblema;
  prioridad: Prioridad;
  descripcion: string;
  servicioAfectado?: string;
}

/**
 * Contrato de creación de un ticket en Spring Boot (POST /api/tickets).
 */
export interface CrearReporteRequestDTO {
  aulaId: string;
  tipoSolicitud: TipoSolicitud;
  tipoProblema: TipoProblema;
  descripcion: string;
  prioridad: Prioridad;
  servicioAfectado: string;
  reportadoPor?: string;
}

/**
 * Contrato de actualización de un ticket (PUT /api/tickets/{id}).
 */
export interface ActualizarReporteRequestDTO {
  descripcion: string;
  servicioAfectado?: string;
  tipoSolicitud?: TipoSolicitud;
  tipoProblema: TipoProblema;
  prioridad: Prioridad;
  estado: EstadoReporte;
}
