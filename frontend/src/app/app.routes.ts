import { Routes } from '@angular/router';
import { AtencionListComponent } from './components/atencion-list/atencion-list.component';
import { AulaComponent } from './aula/aula.component';
import { LoginComponent } from './components/login/login.component';
import { SeguimientoAulasComponent } from './aula/seguimiento-aulas.component';
import { ReporteDetailComponent } from './components/reporte-detail/reporte-detail.component';
import { ReporteFormComponent } from './components/reporte-form/reporte-form.component';
import { ReporteListComponent } from './components/reporte-list/reporte-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'tickets', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'tickets', component: ReporteListComponent },
  { path: 'tickets/nuevo', component: ReporteFormComponent },
  { path: 'tickets/:id/editar', component: ReporteFormComponent },
  { path: 'tickets/:id', component: ReporteDetailComponent },
  { path: 'reportes/nuevo', redirectTo: 'tickets/nuevo' },
  { path: 'reportes/:id/editar', redirectTo: 'tickets/:id/editar' },
  { path: 'reportes/:id', redirectTo: 'tickets/:id' },
  { path: 'reportes', redirectTo: 'tickets' },
  { path: 'atenciones', component: AtencionListComponent },
  { path: 'aulas/seguimiento', component: SeguimientoAulasComponent },
  { path: 'aulas', component: AulaComponent },
  { path: '**', redirectTo: 'tickets' }
];
