# Mesa de Ayuda TI Universitaria

Aplicación web para registrar, priorizar y dar seguimiento a incidentes y solicitudes tecnológicas de estudiantes, docentes y personal administrativo de la UTP. La propuesta contempla categorías como autenticación, plataformas académicas, redes, cuentas institucionales, software, correo y equipos, con flujo de atención y control de acceso por roles.

## Arquitectura

- **Backend:** Java 25, Spring Boot, REST, Spring Data JPA, Spring Security y JWT.
- **Frontend:** Angular 22, Angular Material, formularios reactivos y señales.
- **Persistencia:** PostgreSQL. Las pruebas del backend usan H2.
- **Roles:** `ALUMNO` (solicitante), `TECNICO` (Service Desk/soporte) y `ADMIN`.

Las rutas principales son `/tickets`, `/tickets/nuevo` y `/tickets/:id`. Las APIs principales son `/api/tickets`, `/api/ubicaciones` y `/api/intervenciones`; los endpoints anteriores `/api/reportes`, `/api/aulas` y `/api/atenciones` se conservan temporalmente como alias de compatibilidad. La ubicación física del campus es opcional en cada ticket.

## Base de datos

El backend apunta por defecto a una base PostgreSQL independiente llamada `mesa_ayuda_ti_db`, no a `classcare_db`. Créala antes de iniciar la aplicación:

```sql
CREATE DATABASE mesa_ayuda_ti_db;
```

Hibernate administra las tablas propias de esta aplicación, entre ellas `mesa_ayuda_tickets`, `mesa_ayuda_intervenciones`, `mesa_ayuda_usuarios` y `campus_ubicaciones`. Para usar otra instancia o nombre de base, configura `DB_URL`, `DB_USERNAME` y `DB_PASSWORD`. La base anterior de ClassCare no se migra ni se modifica.

## Ejecución local

Requisitos: JDK 25, PostgreSQL, Node.js 22+ y npm.

Backend:

```powershell
cd backend
.\gradlew.bat test
.\gradlew.bat bootRun
```

Frontend, en otra terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd test -- --watch=false
npm.cmd start
```

Angular corre en `http://localhost:4200` y usa el proxy de desarrollo hacia Spring Boot en `http://localhost:8080`.

## Cuentas locales de demostración

| Usuario | Contraseña | Rol |
|---|---|---|
| `alumno` | `alumno123` | Solicitante |
| `tecnico` | `tecnico123` | Soporte técnico |
| `admin` | `admin123` | Administrador |

Estas credenciales son únicamente valores de desarrollo; deben cambiarse antes de cualquier despliegue.
