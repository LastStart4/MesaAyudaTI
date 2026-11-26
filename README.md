# Mesa de Ayuda TI Universitaria

Demostración funcional de una Mesa de Ayuda TI Universitaria para recibir y centralizar incidentes, solicitudes de servicio y consultas de estudiantes, docentes y personal administrativo de una institución universitaria. Permite registrar solicitudes, consultar su avance y resultado, y documentar la atención técnica con acceso según roles.

La demostración mantiene un flujo sencillo de atención. No implementa niveles formales N0–N3, un motor avanzado de SLA ni automatización de escalamiento; esos procesos forman parte de la propuesta organizacional del informe.

## Arquitectura

- **Backend:** Java 25, Spring Boot, REST, Spring Data JPA, Spring Security y JWT.
- **Frontend:** Angular 22, Angular Material, formularios reactivos y señales.
- **Persistencia:** PostgreSQL. Las pruebas del backend usan H2.
- **Roles:** `ALUMNO` (solicitante), `TECNICO` (Service Desk/soporte) y `ADMIN`.

Las rutas principales son `/tickets`, `/tickets/nuevo` y `/tickets/:id`. Las rutas de pantalla heredadas `/aulas` y `/aulas/seguimiento` redirigen al tablero. Las APIs principales son `/api/tickets`, `/api/ubicaciones` y `/api/intervenciones`; los endpoints anteriores `/api/reportes`, `/api/aulas` y `/api/atenciones` se conservan temporalmente como alias de compatibilidad. La ubicación física es opcional y secundaria en el formulario. Los incidentes duplicados se comparan por servicio, categoría y descripción, no por aula.

El catálogo principal de solicitudes ofrece categorías de soporte TI como autenticación, plataformas, redes, cuentas, software, correo y equipos. Los valores antiguos se conservan en el modelo para poder leer tickets históricos.

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

## Cuentas de demostración

El registro público siempre crea una cuenta solicitante (`ALUMNO`); el rol enviado por el cliente se ignora. Las cuentas de demostración no se crean por defecto. Para habilitarlas solo en un entorno local, configura antes de iniciar el backend:

```powershell
$env:APP_SECURITY_DEMO_USERS_ENABLED = "true"
$env:APP_SECURITY_TECNICO_PASSWORD = "tecnico123"
$env:APP_SECURITY_ADMIN_PASSWORD = "admin123"
```

No habilites `APP_SECURITY_DEMO_USERS_ENABLED` en un despliegue público. Usa contraseñas propias y fuertes, y no reutilices una base de datos de desarrollo.
