# MesaParaTres

Recepcionista IA telefónico para restaurantes. La voz se delega (Twilio + ElevenLabs
Conversational AI); el negocio es propio: disponibilidad, reservas, estados,
configuración multi-restaurante, calendario interno, logs y notificaciones viven en
este backend, que es la **fuente de verdad**.

> Principio: **“Voz delegada, negocio propio.”**

## Estructura

```
apps/
  api/      Fastify + Prisma + PostgreSQL (puerto 3001)
  admin/    Panel React + Vite + Tailwind (puerto 5173)
packages/
  shared/   Contratos Zod + tipos compartidos (API ⇄ panel ⇄ tools)
scripts/
  smoke.ps1 Smoke test end-to-end (22 checks)
docs/
  ARCHITECTURE.md
```

## Puesta en marcha (dev)

Requisitos: Node 20+, Docker.

```powershell
# 1. Postgres
docker run -d --name mesaparatres-pg -p 5433:5432 `
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=mesaparatres `
  postgres:16-alpine

# 2. Dependencias + DB + seed
npm install
npm run db:migrate     # migraciones Prisma
npm run db:seed        # admin@demo.com / admin123 + restaurante demo

# 3. Arrancar
npm run dev:api        # http://localhost:3001
npm run dev:admin      # http://localhost:5173 (proxy /api → 3001)
```

Tests y verificación:

```powershell
npm test                          # 19 tests unitarios (motor + estados)
pwsh scripts/smoke.ps1            # 22 checks e2e (requiere API corriendo)
```

## Panel admin

Login: `admin@demo.com` / `admin123` (seed). Secciones: **Calendario** (vista
día/semana con reservas y bloqueos, detalle/edición en drawer, alta manual con
check de disponibilidad, bloqueo de franjas), Reservas, Disponibilidad (horarios +
franjas/capacidad), Bloqueos, Por revisar (needs_review + llamadas derivadas),
Llamadas (auditoría de tool calls), Restaurantes y Ajustes.

## Tools para ElevenLabs

Webhook tools bajo `/tools/*`, autenticadas con header `X-Tools-Secret`
(env `TOOLS_SHARED_SECRET`). Todas devuelven `message_for_customer` ya redactado:
el agente lo lee tal cual, nunca inventa el resultado.

| Tool | Endpoint |
|---|---|
| check_availability | `POST /tools/check-availability` |
| create_reservation | `POST /tools/create-reservation` (acepta `idempotency_key`) |
| cancel_reservation | `POST /tools/cancel-reservation` |
| request_human_review | `POST /tools/request-human-review` |

Incluir siempre `restaurant_id` (variable dinámica del agente) y `call_id`
(system var de ElevenLabs) para agrupar la auditoría por llamada.

## Decisiones clave

- **Capacidad por franja**, no mesas: una reserva consume cupo solo en su franja.
- **Anti-overbooking**: la creación re-valida capacidad dentro de una transacción
  con advisory lock de Postgres por restaurante+día.
- **Casos dudosos → `needs_review`**: grupos grandes, fuera de horario, día
  cerrado, errores; se resuelven desde el panel (confirmar/rechazar).
- **Calendario interno** como vista operativa. Google Calendar queda fuera del MVP;
  el módulo de sync existe en backend pero está dormido sin credenciales
  (`GOOGLE_SA_EMAIL`/`GOOGLE_SA_PRIVATE_KEY`) y sin UI.
- **Notificaciones**: log de servidor siempre; email vía Resend si hay
  `RESEND_API_KEY` y el restaurante tiene `notification_email`.
