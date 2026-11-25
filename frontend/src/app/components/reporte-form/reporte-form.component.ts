import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AulaDisponible, Prioridad, Reporte, TipoProblema } from '../../models/reporte.model';
import { AuthService } from '../../services/auth.service';
import { ReporteService } from '../../services/reporte.service';

/**
 * Validador Nivel 1: Exige formato real de código de aula universitaria:
 * Prefijo de Pabellón (A, B, C, D, E) o LAB seguido de guion, piso (1-9) y número de 2 dígitos (ej. A-101, LAB-302).
 */
function codigoAulaCampusValidator(): ValidatorFn {
  const regex = /^(?:[A-Ea-e]|LAB|lab)-[1-9]\d{2}$/;
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = (control.value ?? '').trim();
    if (!raw) {
      return null;
    }
    return regex.test(raw) ? null : { formatoAulaCampus: true };
  };
}

/**
 * Validador Nivel 1: Evita bypass por espacios en blanco y exige al menos
 * 10 caracteres reales, mínimo 2 palabras con letras y sin caracteres repetidos sin sentido.
 */
function diagnosticoRealValidator(): ValidatorFn {
  const minDosPalabrasConLetras = /[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}/;
  const caracteresRepetidos = /(.)\1{5,}/;

  return (control: AbstractControl): ValidationErrors | null => {
    const raw = (control.value ?? '');
    const trimmed = raw.trim();

    if (!raw) {
      return null;
    }
    if (trimmed.length === 0) {
      return { soloEspacios: true };
    }
    if (trimmed.length < 10) {
      return { minlengthReal: { requiredLength: 10, actualLength: trimmed.length } };
    }
    if (!minDosPalabrasConLetras.test(trimmed) || caracteresRepetidos.test(trimmed)) {
      return { diagnosticoIncoherente: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-reporte-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './reporte-form.component.html',
  styleUrl: './reporte-form.component.scss'
})
export class ReporteFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly reporteService = inject(ReporteService);
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly reporteEditandoId = signal<number | null>(null);
  readonly modoEdicion = computed(() => this.reporteEditandoId() !== null);

  // Ubicaciones sugeridas sincronizadas desde ReporteService
  readonly aulasSugeridas = this.reporteService.aulasSugeridas;

  readonly categorias: { valor: TipoProblema; label: string; icono: string }[] = [
    { valor: 'AUTENTICACION', label: 'Autenticación', icono: 'lock_open' },
    { valor: 'PLATAFORMAS', label: 'Plataformas', icono: 'school' },
    { valor: 'REDES', label: 'Redes y Wi-Fi', icono: 'wifi' },
    { valor: 'CUENTAS', label: 'Cuentas', icono: 'manage_accounts' },
    { valor: 'SOFTWARE', label: 'Software', icono: 'install_desktop' },
    { valor: 'CORREO', label: 'Correo institucional', icono: 'mail' },
    { valor: 'EQUIPOS', label: 'Equipos', icono: 'devices' },
    { valor: 'OTRO', label: 'Otro', icono: 'build' }
  ];

  readonly servicios = [
    'Plataforma académica',
    'Autenticación institucional',
    'Cuenta institucional',
    'Red Wi-Fi',
    'Correo institucional',
    'Software autorizado',
    'Equipo de cómputo',
    'Otro servicio'
  ];

  readonly prioridades: { valor: Prioridad; label: string; impacto: string }[] = [
    { valor: 'ALTA', label: 'Prioridad Alta', impacto: 'Inhabilita uso en clase' },
    { valor: 'MEDIA', label: 'Prioridad Media', impacto: 'Aula operativa con obs.' },
    { valor: 'BAJA', label: 'Prioridad Baja', impacto: 'Atención según prioridad' }
  ];

  // Formulario Reactivo con Validaciones Nivel 1 y Nivel 2
  readonly reporteForm = this.fb.nonNullable.group(
    {
      aulaId: [
        '',
        [
          Validators.maxLength(12),
          codigoAulaCampusValidator()
        ]
      ],
      aulaUbicacion: [
        ''
      ],
      servicioAfectado: ['Plataforma académica', [Validators.required]],
      tipoProblema: ['PLATAFORMAS' as TipoProblema, [Validators.required]],
      prioridad: ['ALTA' as Prioridad, [Validators.required]],
      descripcion: [
        '',
        [
          Validators.required,
          Validators.maxLength(255),
          diagnosticoRealValidator()
        ]
      ]
    },
    {
      validators: [this.reporteDuplicadoValidator()]
    }
  );

  constructor() {
    this.reporteService.cargarAulasSugeridas();

    // Nivel 2: Autocompletado automático de Pabellón y Piso según el código del aula
    this.f.aulaId.valueChanges.subscribe(valor => {
      const ubicacionCalculada = this.deducirUbicacionDesdeCodigo(valor);
      this.f.aulaUbicacion.setValue(ubicacionCalculada, { emitEvent: false });
    });

    // Detectar si viene una ubicación preseleccionada desde el catálogo del campus
    this.route.queryParamMap.subscribe(queryParams => {
      const aulaPreseleccionada = queryParams.get('aula');
      if (aulaPreseleccionada && !this.modoEdicion()) {
        const codigoNormalizado = aulaPreseleccionada.trim().toUpperCase();
        this.f.aulaId.setValue(codigoNormalizado);
        this.f.aulaId.markAsDirty();
        this.f.aulaId.markAsTouched();
      }
    });

    // Detectar si estamos editando un ticket
    this.route.paramMap.subscribe(params => {
      const rawId = params.get('id');
      const numericId = rawId ? Number(rawId) : null;
      this.reporteEditandoId.set(numericId);

      if (numericId !== null && !Number.isNaN(numericId)) {
        const local = this.reporteService.obtenerPorId(numericId);
        if (local) {
          this.precargarFormulario(local);
        }
        this.reporteService.sincronizarPorId(numericId).subscribe(remoto => {
          if (remoto) {
            this.precargarFormulario(remoto);
          }
        });
      }
    });
  }

  get f() {
    return this.reporteForm.controls;
  }

  private precargarFormulario(reporte: Reporte): void {
    if (reporte.estado === 'RESUELTO') {
      this.snackBar.open(
        `El ticket #${this.formatCount(reporte.id)} ya está resuelto y cerrado; no admite ediciones.`,
        'Cerrar',
        { duration: 4500, horizontalPosition: 'end', verticalPosition: 'bottom' }
      );
      this.router.navigate(['/tickets', reporte.id]);
      return;
    }

    this.reporteForm.patchValue({
      aulaId: reporte.aulaId,
      aulaUbicacion: reporte.aulaUbicacion || '',
      tipoProblema: reporte.tipoProblema,
      servicioAfectado: reporte.servicioAfectado,
      prioridad: reporte.prioridad,
      descripcion: reporte.descripcion
    });
    this.reporteForm.updateValueAndValidity();
  }

  /**
   * Validador Nivel 2 (a nivel de FormGroup):
   * Impide registrar un reporte si ya existe uno PENDIENTE o EN_ATENCION
   * para la misma aula y la misma categoría técnica (excluyendo el ID propio en modo edición).
   */
  private reporteDuplicadoValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const aulaId = group.get('aulaId')?.value ?? '';
      const tipo = group.get('tipoProblema')?.value as TipoProblema;
      if (!aulaId || !tipo) {
        return null;
      }

      const duplicado = this.reporteService.buscarDuplicadoActivo(
        aulaId,
        tipo,
        this.reporteEditandoId()
      );
      if (duplicado) {
        return {
          reporteDuplicado: {
            id: duplicado.id,
            aulaId: duplicado.aulaId,
            estado: duplicado.estado
          }
        };
      }
      return null;
    };
  }

  deducirUbicacionDesdeCodigo(codigoRaw: string): string {
    const limpio = codigoRaw.trim().toUpperCase();
    const aulaRegistrada = this.aulasSugeridas().find(a => a.codigo.toUpperCase() === limpio);
    if (aulaRegistrada?.ubicacion) {
      return aulaRegistrada.ubicacion;
    }

    const match = limpio.match(/^([A-E]|LAB)-([1-9])\d{2}$/);
    if (!match) {
      return limpio ? 'Ingresa un código válido (ej. A-101, LAB-302)' : 'Ubicación no especificada';
    }
    const prefijo = match[1];
    const piso = match[2];
    const pabellon = prefijo === 'LAB' ? 'Pabellón C (Laboratorios)' : `Pabellón ${prefijo}`;
    return `${pabellon} • Piso ${piso}`;
  }

  seleccionarAulaRapida(aula: AulaDisponible): void {
    if (this.modoEdicion()) {
      return;
    }
    this.f.aulaId.setValue(aula.codigo);
    this.f.aulaId.markAsDirty();
    this.f.aulaId.markAsTouched();
  }

  seleccionarCategoria(tipo: TipoProblema): void {
    this.f.tipoProblema.setValue(tipo);
    this.f.tipoProblema.markAsDirty();
  }

  seleccionarPrioridad(prioridad: Prioridad): void {
    this.f.prioridad.setValue(prioridad);
    this.f.prioridad.markAsDirty();
  }

  limpiarFormulario(): void {
    const idEdicion = this.reporteEditandoId();
    if (idEdicion !== null) {
      const original = this.reporteService.obtenerPorId(idEdicion);
      if (original) {
        this.precargarFormulario(original);
        return;
      }
    }

    this.reporteForm.reset({
      aulaId: '',
      aulaUbicacion: '',
      tipoProblema: 'PLATAFORMAS',
      servicioAfectado: 'Plataforma académica',
      prioridad: 'ALTA',
      descripcion: ''
    });
  }

  onSubmit(): void {
    if (this.reporteForm.invalid) {
      this.reporteForm.markAllAsTouched();
      return;
    }

    const idEdicion = this.reporteEditandoId();

    // Modo edición: requiere JWT de soporte técnico o administrador.
    if (idEdicion !== null) {
      if (!this.authService.puedeActualizarReportes()) {
        this.snackBar
          .open(
            'Esta operación requiere una cuenta de Soporte Técnico o Administrador.',
            'Iniciar sesión',
            { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' }
          )
          .onAction()
          .subscribe(() => {
            this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
          });
        return;
      }

      const raw = this.reporteForm.getRawValue();
      this.reporteService
        .actualizarDetallesReporte(idEdicion, {
          tipoProblema: raw.tipoProblema,
          prioridad: raw.prioridad,
          descripcion: raw.descripcion,
          servicioAfectado: raw.servicioAfectado
        })
        .subscribe({
          next: actualizado => {
            this.snackBar.open(
              `Ticket #${this.formatCount(actualizado.id)} actualizado correctamente`,
              'Cerrar',
              { duration: 3500, horizontalPosition: 'end', verticalPosition: 'bottom' }
            );
            this.router.navigate(['/tickets', actualizado.id]);
          },
          error: (err: HttpErrorResponse) => {
            const msg =
              err?.error?.message ||
              `Error (${err.status}) al guardar los cambios del ticket.`;
            this.snackBar.open(msg, 'Cerrar', {
              duration: 4500,
              horizontalPosition: 'end',
              verticalPosition: 'bottom'
            });
          }
        });
      return;
    }

    // Modo creación: POST /api/tickets.
    this.reporteService.crearReporte(this.reporteForm.getRawValue()).subscribe({
      next: creado => {
        const numOrden = String(creado.id).padStart(2, '0');
        this.snackBar
          .open(
            `Ticket #${numOrden} registrado exitosamente`,
            'Ver detalle',
            { duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom' }
          )
          .onAction()
          .subscribe(() => {
            this.router.navigate(['/tickets', creado.id]);
          });

        this.router.navigate(['/tickets']);
      },
      error: (err: HttpErrorResponse) => {
        const mensajeBackend =
          err?.error?.message ||
          `No se pudo registrar el ticket (${err.status}): revisa los datos ingresados.`;
        this.snackBar.open(mensajeBackend, 'Cerrar', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom'
        });
      }
    });
  }

  getCaracteresReales(): number {
    return this.f.descripcion.value.trim().length;
  }

  formatCount(count: number): string {
    return String(count).padStart(2, '0');
  }

  getCategoriaActual() {
    const actual = this.f.tipoProblema.value;
    return this.categorias.find(c => c.valor === actual) ?? this.categorias[0];
  }

  getPrioridadActual() {
    const actual = this.f.prioridad.value;
    return this.prioridades.find(p => p.valor === actual) ?? this.prioridades[0];
  }
}
