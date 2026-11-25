import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import {
  ActualizarEstadoPayload,
  Atencion,
  AtencionBackendDTO,
  CrearAtencionPayload,
  EstadoAtencion,
  ReportePendienteAsignacion
} from '../models/atencion.model';
import { AuthService } from './auth.service';
import { ReporteService } from './reporte.service';

const STORAGE_KEY = 'mesa-ayuda-intervenciones-cache';

const ATENCIONES_SEMILLA: Atencion[] = [
  {
    id: 1,
    reporteId: 2,
    tecnicoEncargado: 'tecnico02',
    estado: 'EN_ATENCION',
    observaciones: 'Diagnóstico de conectividad Wi-Fi en curso en el laboratorio.',
    fechaRegistro: '2026-11-10T09:00:00',
    fechaResolucion: null,
    aulaCodigo: 'LAB-302',
    tipoProblema: 'REDES',
    prioridad: 'ALTA',
    tipoMantenimiento: 'CORRECTIVO',
    impactoAcademico: 'Interrupciones de conectividad'
  },
  {
    id: 2,
    reporteId: 4,
    tecnicoEncargado: 'tecnico01',
    estado: 'EN_ATENCION',
    observaciones: 'Validación de instalación de software autorizado en curso.',
    fechaRegistro: '2026-11-11T14:30:00',
    fechaResolucion: null,
    aulaCodigo: 'A-305',
    tipoProblema: 'SOFTWARE',
    prioridad: 'MEDIA',
    tipoMantenimiento: 'CORRECTIVO',
    impactoAcademico: 'Software requerido para actividad académica'
  },
  {
    id: 3,
    reporteId: 5,
    tecnicoEncargado: 'tecnico01',
    estado: 'RESUELTO',
    observaciones: 'Se restableció y verificó el acceso a la cuenta institucional.',
    fechaRegistro: '2026-11-09T11:15:00',
    fechaResolucion: '2026-11-09T12:00:00',
    aulaCodigo: 'LAB-104',
    tipoProblema: 'AUTENTICACION',
    prioridad: 'BAJA',
    tipoMantenimiento: 'CORRECTIVO',
    impactoAcademico: 'Acceso recuperado'
  }
];

const METADATA_REPORTES: Record<number, Partial<Atencion>> = {
  1: { aulaCodigo: 'A-101', tipoProblema: 'PLATAFORMAS', prioridad: 'ALTA', tipoMantenimiento: 'CORRECTIVO', impactoAcademico: 'Acceso a plataforma académica' },
  2: { aulaCodigo: 'LAB-302', tipoProblema: 'REDES', prioridad: 'ALTA', tipoMantenimiento: 'CORRECTIVO', impactoAcademico: 'Interrupciones de conectividad' },
  3: { aulaCodigo: 'B-204', tipoProblema: 'CUENTAS', prioridad: 'MEDIA', tipoMantenimiento: 'CORRECTIVO', impactoAcademico: 'Acceso a cuenta institucional' },
  4: { aulaCodigo: 'A-305', tipoProblema: 'SOFTWARE', prioridad: 'MEDIA', tipoMantenimiento: 'CORRECTIVO', impactoAcademico: 'Software para actividad académica' },
  5: { aulaCodigo: 'LAB-104', tipoProblema: 'AUTENTICACION', prioridad: 'BAJA', tipoMantenimiento: 'CORRECTIVO', impactoAcademico: 'Acceso institucional restablecido' },
  6: { aulaCodigo: 'D-401', tipoProblema: 'CORREO', prioridad: 'BAJA', tipoMantenimiento: 'CORRECTIVO', impactoAcademico: 'Acceso al correo institucional' }
};

@Injectable({
  providedIn: 'root'
})
export class AtencionService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly reporteService = inject(ReporteService);
  private readonly apiUrl = '/api/intervenciones';

  readonly atenciones = signal<Atencion[]>(this.cargarCacheInicial());
  readonly reportesPendientes = signal<ReportePendienteAsignacion[]>([]);
  readonly cargando = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly origenDatos = signal<'API' | 'LOCAL'>('LOCAL');

  constructor() {
    this.cargarAtenciones().subscribe();
    this.cargarReportesPendientes().subscribe();
  }

  /**
   * Carga las intervenciones desde GET /api/intervenciones.
   * Si el backend está apagado o no responde, utiliza la caché local o datos semilla.
   */
  cargarAtenciones(estado?: EstadoAtencion): Observable<Atencion[]> {
    this.cargando.set(true);
    this.error.set(null);

    const url = estado ? `${this.apiUrl}?estado=${estado}` : this.apiUrl;

    return this.http.get<AtencionBackendDTO[]>(url).pipe(
      map(dtos => this.enriquecerAtenciones(dtos)),
      tap(lista => {
        this.atenciones.set(lista);
        this.origenDatos.set('API');
        this.guardarEnCache(lista);
        this.cargando.set(false);
        this.cargarReportesPendientes().subscribe();
      }),
      catchError((err: HttpErrorResponse) => {
        // En caso de que el backend no esté disponible, conservamos la caché local
        const listaFallback = this.cargarCacheInicial();
        this.atenciones.set(listaFallback);
        this.origenDatos.set('LOCAL');
        this.cargando.set(false);
        this.cargarReportesPendientes().subscribe();
        this.error.set(
          err.status === 0
            ? 'Servidor Spring Boot fuera de línea. Operando en Modo Demo Local.'
            : `Error al consultar atenciones (${err.status}): ${err.statusText}`
        );
        return of(listaFallback);
      })
    );
  }

  /**
   * Consulta los tickets (GET /api/tickets) y detecta aquellos que aún
   * no cuentan con una orden de atención asignada en curso.
   */
  cargarReportesPendientes(): Observable<ReportePendienteAsignacion[]> {
    return this.http.get<any[]>('/api/tickets').pipe(
      map(reportes => {
        const idsConAtencion = new Set(this.atenciones().map(a => a.reporteId));
        return reportes
          .filter(r => !idsConAtencion.has(r.id) && r.estado !== 'RESUELTO')
          .map(r => ({
            id: r.id,
            aulaId: r.aulaId || '',
            tipoProblema: r.tipoProblema || 'General',
            prioridad: r.prioridad || 'MEDIA',
            descripcion: r.descripcion || 'Ticket registrado para atención de soporte TI.',
            fechaRegistro: r.fechaRegistro,
            aulaUbicacion: r.aulaUbicacion,
            estado: r.estado
          }));
      }),
      tap(pendientes => this.reportesPendientes.set(pendientes)),
      catchError(() => of([]))
    );
  }

  /**
   * Asigna rápidamente un reporte nuevo a un técnico en un solo clic, generando
   * automáticamente la orden técnica correspondiente en el backend.
   */
  autoAsignarReporte(reporte: ReportePendienteAsignacion, tecnico?: string): Observable<Atencion> {
    const usuarioTecnico = tecnico || this.authService.sesion()?.username || 'tecnico01';
    const prioridadValida = (['ALTA', 'MEDIA', 'BAJA'].includes(reporte.prioridad)
      ? reporte.prioridad
      : 'MEDIA') as 'ALTA' | 'MEDIA' | 'BAJA';

    const payload: CrearAtencionPayload = {
      reporteId: reporte.id,
      tecnicoEncargado: usuarioTecnico,
      aulaCodigo: reporte.aulaId,
      tipoProblema: reporte.tipoProblema,
      prioridad: prioridadValida,
      tipoMantenimiento: 'CORRECTIVO',
      observaciones: `Intervención generada desde la bandeja de tickets. Motivo: ${reporte.descripcion}`,
      impactoAcademico: 'Atención solicitada por el ticket'
    };

    return this.crearAtencion(payload).pipe(
      tap(() => {
        this.reportesPendientes.update(items => items.filter(r => r.id !== reporte.id));
      })
    );
  }

  /**
   * Consulta una intervención específica por su identificador.
   */
  buscarPorId(id: number): Observable<Atencion> {
    return this.http.get<AtencionBackendDTO>(`${this.apiUrl}/${id}`).pipe(
      map(dto => this.enriquecerUna(dto)),
      catchError(() => {
        const encontrada = this.atenciones().find(a => a.id === id);
        if (encontrada) {
          return of(encontrada);
        }
        return throwError(() => new Error(`No se encontró la atención con ID ${id}`));
      })
    );
  }

  /**
   * Inicia el proceso de atención cambiando su estado de PENDIENTE a EN_ATENCION.
   * Usa PUT /api/intervenciones/{id}/estado con el JWT del interceptor.
   */
  iniciarAtencion(id: number, solicitadoPor?: string): Observable<Atencion> {
    const usuarioActual = solicitadoPor || this.authService.sesion()?.username || 'tecnico01';
    const payload: ActualizarEstadoPayload = {
      nuevoEstado: 'EN_ATENCION',
      observaciones: 'Atención técnica en curso. Diagnóstico y labores en ejecución por el técnico asignado.',
      solicitadoPor: usuarioActual
    };

    return this.authService.asegurarTokenReal().pipe(
      switchMap(() => this.http.put<AtencionBackendDTO>(`${this.apiUrl}/${id}/estado`, payload)),
      map(dto => this.enriquecerUna(dto)),
      tap(actualizada => {
        this.actualizarEnMemoria(actualizada);
        this.reporteService.cargarReportes();
        this.reporteService.cargarAulasSugeridas();
      }),
      catchError(() => {
        const local = this.actualizarEstadoLocal(id, 'EN_ATENCION', payload.observaciones);
        return of(local);
      })
    );
  }

  /**
   * Resuelve y certifica una atención técnica (EN_ATENCION -> RESUELTO).
   */
  resolverAtencion(
    id: number,
    observaciones: string,
    solucionDetalle?: string,
    solicitadoPor?: string
  ): Observable<Atencion> {
    const usuarioActual = solicitadoPor || this.authService.sesion()?.username || 'tecnico01';
    const obsCompletas = solucionDetalle
      ? `${observaciones.trim()} [Solución: ${solucionDetalle.trim()}]`
      : observaciones.trim();

    const payload: ActualizarEstadoPayload = {
      nuevoEstado: 'RESUELTO',
      observaciones: obsCompletas,
      solicitadoPor: usuarioActual
    };

    return this.authService.asegurarTokenReal().pipe(
      switchMap(() => this.http.put<AtencionBackendDTO>(`${this.apiUrl}/${id}/estado`, payload)),
      map(dto => this.enriquecerUna(dto)),
      tap(actualizada => {
        this.actualizarEnMemoria(actualizada);
        this.reporteService.cargarReportes();
        this.reporteService.cargarAulasSugeridas();
      }),
      catchError(() => {
        const local = this.actualizarEstadoLocal(id, 'RESUELTO', obsCompletas);
        return of(local);
      })
    );
  }

  /**
   * Registra una nueva intervención de soporte (POST /api/intervenciones).
   */
  crearAtencion(payload: CrearAtencionPayload): Observable<Atencion> {
    const bodyBackend = {
      reporteId: payload.reporteId,
      tecnicoEncargado: payload.tecnicoEncargado,
      observaciones: payload.observaciones || 'Nueva atención técnica asignada.'
    };

    return this.http.post<AtencionBackendDTO>(this.apiUrl, bodyBackend).pipe(
      map(dto => {
        const enriquecida = this.enriquecerUna(dto);
        enriquecida.aulaCodigo = payload.aulaCodigo || enriquecida.aulaCodigo;
        enriquecida.tipoProblema = payload.tipoProblema || enriquecida.tipoProblema;
        enriquecida.prioridad = payload.prioridad || enriquecida.prioridad;
        enriquecida.tipoMantenimiento = payload.tipoMantenimiento || enriquecida.tipoMantenimiento;
        enriquecida.impactoAcademico = payload.impactoAcademico || enriquecida.impactoAcademico;
        return enriquecida;
      }),
      tap(creada => {
        this.atenciones.update(items => [creada, ...items]);
        this.reportesPendientes.update(items => items.filter(r => r.id !== payload.reporteId));
        this.guardarEnCache(this.atenciones());
      }),
      catchError(() => {
        const nuevoId = this.atenciones().length > 0
          ? Math.max(...this.atenciones().map(a => a.id)) + 1
          : 1;

        const nuevaLocal: Atencion = {
          id: nuevoId,
          reporteId: payload.reporteId,
          tecnicoEncargado: payload.tecnicoEncargado,
          estado: 'PENDIENTE',
          observaciones: payload.observaciones || 'Nueva orden generada localmente.',
          fechaRegistro: new Date().toISOString(),
          fechaResolucion: null,
          aulaCodigo: payload.aulaCodigo || '',
          tipoProblema: payload.tipoProblema || 'Tecnológico',
          prioridad: payload.prioridad || 'MEDIA',
          tipoMantenimiento: payload.tipoMantenimiento || 'CORRECTIVO',
          impactoAcademico: payload.impactoAcademico || 'En evaluación técnica'
        };

        this.atenciones.update(items => [nuevaLocal, ...items]);
        this.reportesPendientes.update(items => items.filter(r => r.id !== payload.reporteId));
        this.guardarEnCache(this.atenciones());
        return of(nuevaLocal);
      })
    );
  }

  // --- Métodos de Enriquecimiento y Manejo de Caché ---

  private enriquecerAtenciones(dtos: AtencionBackendDTO[]): Atencion[] {
    return dtos.map(dto => this.enriquecerUna(dto));
  }

  private enriquecerUna(dto: AtencionBackendDTO): Atencion {
    const reporteActivo = this.reporteService.obtenerPorId(dto.reporteId);
    const meta = METADATA_REPORTES[dto.reporteId] || {};
    return {
      ...dto,
      aulaCodigo: reporteActivo?.aulaId || meta.aulaCodigo || '',
      tipoProblema: reporteActivo?.tipoProblema || meta.tipoProblema || 'General',
      prioridad: (reporteActivo?.prioridad as 'ALTA' | 'MEDIA' | 'BAJA') || meta.prioridad || 'MEDIA',
      tipoMantenimiento: meta.tipoMantenimiento || 'CORRECTIVO',
      impactoAcademico: meta.impactoAcademico || 'Seguimiento por mesa técnica'
    };
  }

  private actualizarEnMemoria(actualizada: Atencion): void {
    this.atenciones.update(items =>
      items.map(item => (item.id === actualizada.id ? { ...item, ...actualizada } : item))
    );
    this.guardarEnCache(this.atenciones());
  }

  private actualizarEstadoLocal(id: number, nuevoEstado: EstadoAtencion, observaciones?: string): Atencion {
    let resultado!: Atencion;
    this.atenciones.update(items =>
      items.map(item => {
        if (item.id === id) {
          resultado = {
            ...item,
            estado: nuevoEstado,
            observaciones: observaciones || item.observaciones,
            fechaResolucion: nuevoEstado === 'RESUELTO' ? new Date().toISOString() : item.fechaResolucion
          };
          return resultado;
        }
        return item;
      })
    );
    this.guardarEnCache(this.atenciones());
    return resultado;
  }

  private guardarEnCache(lista: Atencion[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
      } catch {
        // Manejo silencioso en caso de almacenamiento restringido
      }
    }
  }

  private cargarCacheInicial(): Atencion[] {
    if (typeof localStorage !== 'undefined') {
      const cache = localStorage.getItem(STORAGE_KEY);
      if (cache) {
        try {
          return JSON.parse(cache) as Atencion[];
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    return [...ATENCIONES_SEMILLA];
  }
}
