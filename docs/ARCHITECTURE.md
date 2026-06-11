# Arquitectura — MesaParaTres

## Visión

Sistema de reservas telefónicas para restaurantes con IA de voz. El pipeline de voz
(telefonía, STT/TTS, turn-taking, runtime conversacional) se delega en Twilio +
ElevenLabs Conversational AI. Todo el negocio es propio y vive aquí:

```
Cliente ──llamada──► Twilio ──► ElevenLabs Conversational AI
                                        │ webhooks /tools/* (X-Tools-Secret)
                                        ▼
                    ┌──────────────────────────────────────┐
                    │ API MesaParaTres (fuente de verdad)  │
                    │  motor disponibilidad · reservas      │
                    │  estados · call logs · notificaciones │
                    │            PostgreSQL                 │
                    └───────────────┬──────────────────────┘
                                    ▼
                       Panel admin (calendario interno)
```

## Capas del backend (`apps/api`)

- `modules/availability/engine.ts` — **motor puro** (sin I/O): capacidad por franja,
  bloqueos, horarios, redondeo a franja (±15 min), sugerencias de alternativas,
  límites de grupo. Es la pieza con más tests.
- `modules/reservations` — máquina de estados (`pending → confirmed/cancelled/
  needs_review/failed`; ver `state.ts`), creación transaccional con
  `pg_advisory_xact_lock(restaurante|fecha)` que re-valida capacidad bajo lock
  (anti-overbooking), idempotencia por `idempotency_key`.
- `modules/tools` — adaptadores ElevenLabs: traducen contratos de tools a servicios
  de dominio, generan `message_for_customer` en español (`messages.ts`) y registran
  todo en CallLog. Un error inesperado nunca devuelve 500 al agente: responde un
  mensaje controlado de disculpa, registra `outcome=error` y avisa al restaurante.
- `modules/calendar-view` — `GET /calendar`: eventos (reservas de todos los estados
  + bloqueos) con `start`/`end` ISO en la zona horaria del restaurante para el
  calendario interno del panel.
- `modules/calendar` — integración Google Calendar **dormida** (fuera del MVP):
  worker de sync asíncrono con reintentos/backoff, activo solo si existen
  credenciales de service account. Sin UI. Diseñada como espejo, nunca fuente.
- `modules/call-logs` — auditoría: una fila por llamada (`provider_call_id`), con
  el array `tool_calls` (input/output/timestamp de cada tool).
- `modules/notifications` — `notifyRestaurant()`: log de servidor siempre, email
  Resend si está configurado. Nunca lanza.

## Decisiones y simplificaciones deliberadas

1. **Fechas/horas como strings** (`YYYY-MM-DD`, `HH:MM`) en la zona del restaurante;
   Luxon solo en los bordes (validar pasado, ISO para calendario). Evita bugs de TZ.
2. **Una reserva consume capacidad solo de su franja**, aunque dure 90 min.
   `reservation_duration_minutes` solo determina el `end` del evento de calendario.
3. **El agente resuelve lenguaje natural** (“mañana a las nueve” → fecha ISO);
   el backend solo acepta fechas absolutas y valida.
4. **`needs_review`**: grupos > límite, fuera de horario, día cerrado, sin franja →
   se crean en ese estado y los resuelve una persona desde el panel. Las reservas
   `needs_review` **no** consumen capacidad hasta confirmarse (decisión MVP).
5. **Cancelación telefónica**: match por teléfono normalizado (+fecha/hora/nombre
   como desambiguadores). 0 matches → mensaje de no encontrado; >1 → se piden más
   datos. Nunca se cancela “la más parecida”.
6. **Lock por restaurante+día** (no por franja): el redondeo de hora hace que dos
   peticiones distintas puedan caer en la misma franja; el lock grueso lo cubre y
   la contención es irrelevante a esta escala.
7. **Worker in-process** para el sync (sin Redis/colas). Limitación conocida:
   una sola instancia de API.

## Multi-restaurante

Todo cuelga de `restaurant_id`. Cada número de Twilio/agente ElevenLabs mapea a un
restaurante (campo `elevenlabs_agent_id`, variable dinámica `restaurant_id` en el
agente). El panel opera con un selector de restaurante global.

## Seguridad

- Panel/API admin: JWT (12 h) sobre `AdminUser` (bcrypt).
- Tools: header `X-Tools-Secret` comparado en tiempo constante + rate limit
  (120/min por IP). Login con rate limit 10/min.
- La IA no puede escribir nada sin pasar por la validación del backend.

## Pendiente / roadmap

- Google Calendar como integración opcional (reactivar worker + UI de conexión).
- WhatsApp/SMS de confirmación al cliente.
- Multi-usuario con roles por restaurante.
- Despliegue (Railway/Render) + URL pública para las tools de ElevenLabs.
- Ocupación multi-franja por duración real de la reserva.
