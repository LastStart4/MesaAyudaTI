import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import {
  ActualizarReporteRequestDTO,
  AulaDisponible,
  CrearReportePayload,
  CrearReporteRequestDTO,
  EstadoReporte,
  Prioridad,
  Reporte,
  TipoSolicitud,
  TipoProblema
} from '../models/reporte.model';
import { AuthService } from './auth.service';

const AULAS_POR_DEFECTO: AulaDisponible[] = [
  { codigo: 'A-101', ubicacion: 'Pabellón A • Piso 1' },
  { codigo: 'LAB-302', ubicacion: 'Pabellón C • Piso 3' },
  { codigo: 'B-204', ubicacion: 'Pabellón B • Piso 2' },
  { codigo: 'A-305', ubicacion: 'Pabellón A • Piso 3' },
  { codigo: 'D-401', ubicacion: 'Pabellón D • Piso 4' },
  { codigo: 'C-201', ubicacion: 'Pabellón C • Piso 2' }
];

const REPORTES_INICIALES: Reporte[] = [
  {
    id: 1,
    aulaId: 'A-101',
    aulaInternoId: 1,
    aulaUbicacion: 'Pabellón A • Piso 1',
    tipoSolicitud: 'INCIDENTE',
    tipoProblema: 'PLATAFORMAS',
    servicioAfectado: 'Plataforma académica',
    prioridad: 'ALTA',
    estado: 'PENDIENTE',
    descripcion: 'La plataforma académica no permite iniciar sesión durante el periodo de evaluaciones.',
    fechaRegistro: '2026-10-29T08:30:00'
  },
  {
    id: 2,
    aulaId: 'LAB-302',
    aulaInternoId: 2,
    aulaUbicacion: 'Pabellón C • Piso 3',
    tipoSolicitud: 'INCIDENTE',
    tipoProblema: 'REDES',
    servicioAfectado: 'Red Wi-Fi',
    prioridad: 'ALTA',
    estado: 'EN_ATENCION',
    descripcion: 'La red Wi-Fi presenta interrupciones frecuentes en el laboratorio de cómputo.',
    fechaRegistro: '2026-10-29T09:15:00'
  },
  {
    id: 3,
    aulaId: 'B-204',
    aulaInternoId: 3,
    aulaUbicacion: 'Pabellón B • Piso 2',
    tipoSolicitud: 'INCIDENTE',
    tipoProblema: 'CUENTAS',
    servicioAfectado: 'Cuenta institucional',
    prioridad: 'MEDIA',
    estado: 'PENDIENTE',
    descripcion: 'El usuario docente no puede acceder a su cuenta institucional.',
    fechaRegistro: '2026-10-28T14:20:00'
  },
  {
    id: 4,
    aulaId: 'A-305',
    aulaInternoId: 4,
    aulaUbicacion: 'Pabellón A • Piso 3',
    tipoSolicitud: 'SOLICITUD_SERVICIO',
    tipoProblema: 'SOFTWARE',
    servicioAfectado: 'Software autorizado',
    prioridad: 'MEDIA',
    estado: 'EN_ATENCION',
    descripcion: 'Se requiere instalar software autorizado para una actividad académica.',
    fechaRegistro: '2026-10-28T16:40:00'
  },
  {
    id: 5,
    aulaId: 'LAB-104',
    aulaInternoId: 5,
    aulaUbicacion: 'Pabellón C • Piso 1',
    tipoSolicitud: 'INCIDENTE',
    tipoProblema: 'AUTENTICACION',
    servicioAfectado: 'Autenticación institucional',
    prioridad: 'BAJA',
    estado: 'RESUELTO',
    descripcion: 'Se restableció el acceso a la cuenta institucional tras validar la identidad del usuario.',
    fechaRegistro: '2026-10-27T11:15:00'
  },
  {
    id: 6,
    aulaId: 'D-401',
    aulaInternoId: 6,
    aulaUbicacion: 'Pabellón D • Piso 4',
    tipoSolicitud: 'INCIDENTE',
    tipoProblema: 'CORREO',
    servicioAfectado: 'Correo institucional',
    prioridad: 'BAJA',
    estado: 'RESUELTO',
    descripcion: 'Se recuperó el acceso al correo institucional y se confirmó su funcionamiento.',
    fechaRegistro: '2026-10-26T10:00:00'
  },
  {
    id: 7,
    aulaId: 'C-201',
    aulaInternoId: 7,
    aulaUbicacion: 'Pabellón C • Piso 2',
    tipoSolicitud: 'CONSULTA',
    tipoProblema: 'PLATAFORMAS',
    servicioAfectado: 'Plataforma académica',
    prioridad: 'BAJA',
    estado: 'PENDIENTE',
    descripcion: 'Se solicita orientación para acceder a los recursos de la plataforma académica.',
    fechaRegistro: '2026-10-25T09:00:00'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/tickets';
  private readonly aulasApiUrl = '/api/ubicaciones';

  // Estado reactivo centralizado sincronizado con HttpClient (Semana 14)
  // Inicia vacío para evitar cualquier parpadeo (flash) de datos de respaldo al recargar con el backend encendido
  private readonly reportesState = signal<Reporte[]>([]);
  private readonly aulasSugeridasState = signal<AulaDisponible[]>(AULAS_POR_DEFECTO);
  private readonly cargandoState = signal<boolean>(true);
  private readonly backendConectadoState = signal<boolean>(false);

  readonly reportes = this.reportesState.asReadonly();
  readonly aulasSugeridas = this.aulasSugeridasState.asReadonly();
  readonly cargando = this.cargandoState.asReadonly();
  readonly backendConectado = this.backendConectadoState.asReadonly();

  constructor() {
    this.cargarReportes();
    this.cargarAulasSugeridas();
  }

  /**
   * Sincroniza fielmente GET /api/tickets cuando el servidor responde 200 OK.
   * Solo usa el conjunto semilla local cuando el servidor backend está apagado.
   */
  cargarReportes(aulaId?: string, prioridad?: Prioridad): void {
    this.cargandoState.set(true);

    let params = new HttpParams();
    if (aulaId && aulaId.trim()) {
      params = params.set('aulaId', aulaId.trim());
    }
    if (prioridad) {
      params = params.set('prioridad', prioridad);
    }

    this.http
      .get<Reporte[]>(this.apiUrl, { params })
      .pipe(
        map(lista => lista.map(item => this.normalizarReporte(item))),
        catchError(() => {
          this.backendConectadoState.set(false);
          this.cargandoState.set(false);
          // Solo si el backend está apagado y la lista está vacía, activamos los 6 reportes de respaldo
          if (this.reportesState().length === 0) {
            this.reportesState.set(REPORTES_INICIALES);
          }
          return of(null);
        })
      )
      .subscribe(listaRemota => {
        this.cargandoState.set(false);
        if (listaRemota !== null) {
          this.backendConectadoState.set(true);
          this.reportesState.set(listaRemota);
        }
      });
  }

  /**
   * Carga ubicaciones registradas para ofrecerlas como contexto opcional del ticket.
   */
  cargarAulasSugeridas(): void {
    this.http
      .get<AulaDisponible[]>(this.aulasApiUrl)
      .pipe(catchError(() => of(null)))
      .subscribe(aulasRemotas => {
        if (aulasRemotas && aulasRemotas.length > 0) {
          this.aulasSugeridasState.set(
            aulasRemotas.map(a => ({
              id: a.id,
              codigo: (a.codigo ?? '').trim().toUpperCase(),
              ubicacion: a.ubicacion || this.deducirUbicacionDesdeCodigo(a.codigo ?? ''),
              capacidad: a.capacidad,
              estado: a.estado
            }))
          );
        }
      });
  }

  obtenerPorId(id: number): Reporte | undefined {
    return this.reportesState().find(r => r.id === id);
  }

  /**
   * GET /api/tickets/{id} : Refresca un ticket puntual desde el backend.
   */
  sincronizarPorId(id: number): Observable<Reporte | undefined> {
    return this.http.get<Reporte>(`${this.apiUrl}/${id}`).pipe(
      map(item => this.normalizarReporte(item)),
      tap(remoto => {
        this.backendConectadoState.set(true);
        this.reportesState.update(lista => {
          const existe = lista.some(r => r.id === remoto.id);
          return existe
            ? lista.map(r => (r.id === remoto.id ? remoto : r))
            : [remoto, ...lista];
        });
      }),
      catchError(() => of(this.obtenerPorId(id)))
    );
  }

  /**
   * Verifica si ya existe un incidente activo para el mismo servicio, categoría y descripción.
   */
  buscarDuplicadoActivo(
    servicioAfectado: string,
    tipoProblema: TipoProblema,
    descripcion: string,
    excluirId?: number | null
  ): Reporte | undefined {
    const servicioNormalizado = servicioAfectado.trim().toLowerCase();
    const descripcionNormalizada = descripcion.trim().toLowerCase();
    if (!servicioNormalizado || !descripcionNormalizada) {
      return undefined;
    }
    return this.reportesState().find(
      r =>
        r.id !== excluirId &&
        (r.tipoSolicitud || 'INCIDENTE') === 'INCIDENTE' &&
        (r.servicioAfectado || 'Servicio general').trim().toLowerCase() === servicioNormalizado &&
        r.tipoProblema === tipoProblema &&
        r.descripcion.trim().toLowerCase() === descripcionNormalizada &&
        r.estado !== 'RESUELTO'
    );
  }

  /**
   * POST /api/tickets crea un ticket y propaga errores de negocio sin guardar datos falsos.
   * - Si el backend está apagado (status 0 / 502 / 504), guarda en memoria local para modo demostrativo.
   */
  crearReporte(payload: CrearReportePayload): Observable<Reporte> {
    const codigoNormalizado = payload.aulaId.trim().toUpperCase();
    const ubicacionCalculada =
      payload.aulaUbicacion.trim() ||
      (codigoNormalizado ? this.deducirUbicacionDesdeCodigo(codigoNormalizado) : 'Ubicación no especificada');

    const autorSesion =
      this.authService.sesion()?.nombreCompleto ||
      this.authService.sesion()?.username ||
      'Comunidad Académica UTP';

    const requestDto: CrearReporteRequestDTO = {
      aulaId: codigoNormalizado,
      tipoSolicitud: payload.tipoSolicitud || 'INCIDENTE',
      tipoProblema: payload.tipoProblema,
      descripcion: payload.descripcion.trim(),
      prioridad: payload.prioridad,
      servicioAfectado: (payload.servicioAfectado || 'Servicio general').trim(),
      reportadoPor: autorSesion
    };

    return this.http.post<Reporte>(this.apiUrl, requestDto).pipe(
      map(creado => this.normalizarReporte(creado, ubicacionCalculada, autorSesion)),
      tap(creadoRemoto => {
        this.backendConectadoState.set(true);
        this.reportesState.update(lista => [creadoRemoto, ...lista]);
        this.cargarAulasSugeridas();
      }),
      catchError((error: HttpErrorResponse) => {
        // Si el backend respondió con error de negocio o recurso no encontrado (400 / 404), no mentir al usuario
        if (error.status === 400 || error.status === 404 || error.status === 409) {
          return throwError(() => error);
        }

        // Respaldo solo cuando el servidor Spring Boot está apagado
        const listaActual = this.reportesState();
        const nextId = listaActual.length > 0 ? Math.max(...listaActual.map(r => r.id)) + 1 : 1;
        const nuevoReporteLocal: Reporte = {
          id: nextId,
          aulaId: codigoNormalizado,
          aulaUbicacion: ubicacionCalculada,
          tipoSolicitud: payload.tipoSolicitud || 'INCIDENTE',
          tipoProblema: payload.tipoProblema,
          servicioAfectado: (payload.servicioAfectado || 'Servicio general').trim(),
          prioridad: payload.prioridad,
          estado: 'PENDIENTE',
          descripcion: payload.descripcion.trim(),
          fechaRegistro: new Date().toISOString(),
          reportadoPor: autorSesion
        };
        this.reportesState.update(lista => [nuevoReporteLocal, ...lista]);
        return of(nuevoReporteLocal);
      })
    );
  }

  /**
   * PUT /api/tickets/{id} : Actualiza el estado del ticket en el backend.
   * Incluye reintento automático si el cliente tenía un DEMO_JWT previo a encender el backend.
   */
  actualizarEstado(id: number, nuevoEstado: EstadoReporte): Observable<Reporte> {
    const actual = this.obtenerPorId(id);
    if (!actual) {
      return throwError(() => new Error(`No se encontró el reporte #${id}`));
    }

    const requestDto: ActualizarReporteRequestDTO = {
      descripcion: actual.descripcion,
      servicioAfectado: actual.servicioAfectado || 'Servicio general',
      tipoSolicitud: actual.tipoSolicitud || 'INCIDENTE',
      tipoProblema: actual.tipoProblema,
      prioridad: actual.prioridad,
      estado: nuevoEstado
    };

    const ejecutarPut = () =>
      this.http.put<Reporte>(`${this.apiUrl}/${id}`, requestDto).pipe(
        map(respuesta => this.normalizarReporte(respuesta, actual.aulaUbicacion)),
        tap(actualizado => {
          this.backendConectadoState.set(true);
          this.reportesState.update(lista =>
            lista.map(r => (r.id === id ? actualizado : r))
          );
          this.cargarAulasSugeridas();
        })
      );

    return ejecutarPut().pipe(
      catchError((error: HttpErrorResponse) => {
        // Corrección #1: Si dio 401 porque el navegador tenía un DEMO_JWT antes de encender Spring Boot,
        // solicita el token real a /api/auth/login y reintenta una vez.
        if (error.status === 401 && this.authService.sesion()?.origen === 'DEMO_JWT') {
          return this.authService.asegurarTokenReal().pipe(switchMap(() => ejecutarPut()));
        }

        // Propagar errores reales del servidor (401, 403, 404, 400)
        if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 400) {
          return throwError(() => error);
        }

        // Si el servidor backend está apagado (status 0 / 502 / 504), actualizamos el estado reactivo local
        const actualizadoLocal: Reporte = { ...actual, estado: nuevoEstado };
        this.reportesState.update(lista =>
          lista.map(r => (r.id === id ? actualizadoLocal : r))
        );
        return of(actualizadoLocal);
      })
    );
  }

  /**
   * PUT /api/tickets/{id} : Actualiza los detalles del ticket.
   * Protegido por JWT (requiere ROLE_TECNICO o ROLE_ADMIN).
   */
  actualizarDetallesReporte(
    id: number,
    cambios: {
      tipoSolicitud?: TipoSolicitud;
      tipoProblema: TipoProblema;
      prioridad: Prioridad;
      descripcion: string;
      servicioAfectado?: string;
    }
  ): Observable<Reporte> {
    const actual = this.obtenerPorId(id);
    if (!actual) {
      return throwError(() => new Error(`No se encontró el reporte #${id}`));
    }

    const requestDto: ActualizarReporteRequestDTO = {
      descripcion: cambios.descripcion.trim(),
      servicioAfectado: (cambios.servicioAfectado || actual.servicioAfectado || 'Servicio general').trim(),
      tipoSolicitud: cambios.tipoSolicitud || actual.tipoSolicitud || 'INCIDENTE',
      tipoProblema: cambios.tipoProblema,
      prioridad: cambios.prioridad,
      estado: actual.estado
    };

    const ejecutarPut = () =>
      this.http.put<Reporte>(`${this.apiUrl}/${id}`, requestDto).pipe(
        map(respuesta => this.normalizarReporte(respuesta, actual.aulaUbicacion)),
        tap(actualizado => {
          this.backendConectadoState.set(true);
          this.reportesState.update(lista =>
            lista.map(r => (r.id === id ? actualizado : r))
          );
          this.cargarAulasSugeridas();
        })
      );

    return ejecutarPut().pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && this.authService.sesion()?.origen === 'DEMO_JWT') {
          return this.authService.asegurarTokenReal().pipe(switchMap(() => ejecutarPut()));
        }
        if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 400) {
          return throwError(() => error);
        }
        const actualizadoLocal: Reporte = {
          ...actual,
          servicioAfectado: (cambios.servicioAfectado || actual.servicioAfectado || 'Servicio general').trim(),
          tipoSolicitud: cambios.tipoSolicitud || actual.tipoSolicitud || 'INCIDENTE',
          tipoProblema: cambios.tipoProblema,
          prioridad: cambios.prioridad,
          descripcion: cambios.descripcion.trim()
        };
        this.reportesState.update(lista =>
          lista.map(r => (r.id === id ? actualizadoLocal : r))
        );
        return of(actualizadoLocal);
      })
    );
  }

  /**
   * DELETE /api/tickets/{id} : Elimina un ticket y actualiza la señal reactiva.
   * Protegido en SecurityConfig exclusivamente para ROLE_ADMIN.
   */
  eliminarReporte(id: number): Observable<void> {
    const ejecutarDelete = () =>
      this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
        tap(() => {
          this.backendConectadoState.set(true);
          this.reportesState.update(lista => lista.filter(r => r.id !== id));
          this.cargarAulasSugeridas();
        })
      );

    return ejecutarDelete().pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && this.authService.sesion()?.origen === 'DEMO_JWT') {
          return this.authService.asegurarTokenReal().pipe(switchMap(() => ejecutarDelete()));
        }
        if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 400) {
          return throwError(() => error);
        }
        // Respaldo cuando el backend está apagado
        this.reportesState.update(lista => lista.filter(r => r.id !== id));
        return of(undefined);
      })
    );
  }

  private normalizarReporte(item: Reporte, ubicacionRespaldo?: string, autorRespaldo?: string): Reporte {
    return {
      ...item,
      servicioAfectado: item.servicioAfectado || 'Servicio general',
      tipoSolicitud: item.tipoSolicitud || 'INCIDENTE',
      aulaId: (item.aulaId ?? '').trim().toUpperCase(),
      aulaUbicacion:
        item.aulaUbicacion ||
        (!item.aulaId?.trim() ? 'Ubicación no especificada' : undefined) ||
        ubicacionRespaldo ||
        this.deducirUbicacionDesdeCodigo(item.aulaId ?? ''),
      reportadoPor: item.reportadoPor || autorRespaldo || 'Comunidad Académica UTP'
    };
  }

  private deducirUbicacionDesdeCodigo(codigoRaw: string): string {
    const limpio = codigoRaw.trim().toUpperCase();
    const match = limpio.match(/^([A-E]|LAB)-([1-9])\d{2}$/);
    if (!match) {
      return 'Pabellón Central • Campus UTP';
    }
    const prefijo = match[1];
    const piso = match[2];
    const pabellon = prefijo === 'LAB' ? 'Pabellón C • Laboratorios' : `Pabellón ${prefijo}`;
    return `${pabellon} • Piso ${piso}`;
  }
}
