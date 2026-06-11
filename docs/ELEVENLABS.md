# Configuración del agente de ElevenLabs

Guía para conectar un número de teléfono a MesaParaTres. Todo es configuración
en dashboards; el código ya está preparado.

**Prerrequisitos:**
- La API desplegada con URL pública HTTPS (en adelante `https://API_URL`).
- El valor de `TOOLS_SHARED_SECRET` del servidor.
- El `restaurant_id` del restaurante (visible en el panel → Ajustes).

**Modelo recomendado en MVP: un agente de ElevenLabs por restaurante**, con el
`restaurant_id` fijado en el prompt. Es lo más simple de razonar y de depurar.

---

## 1. Twilio → ElevenLabs

1. Compra un número en Twilio (Phone Numbers → Buy a Number, país España).
2. En ElevenLabs: **Conversational AI → Phone Numbers → Import number from Twilio**.
   Pega el número, el Account SID y el Auth Token de Twilio.
3. Asigna el número al agente (paso 2). ElevenLabs reconfigura el número en Twilio
   automáticamente; no hay que tocar TwiML ni webhooks de Twilio.

## 2. Crear el agente

**Conversational AI → Agents → New agent**, con:

- **Language**: Español.
- **Voice**: cualquier voz es válida; elegir una natural en español.
- **First message**:
  > ¡Hola! Soy el asistente de RESTAURANT_NAME. ¿En qué puedo ayudarte? Puedo gestionar reservas: crearlas, consultarlas o cancelarlas.
- **System prompt**: el del apartado 3 (sustituyendo los dos placeholders).
- **LLM**: el que ofrezca mejor latencia/calidad de los disponibles; temperatura baja.
- **Máx. duración**: 10 min es razonable para reservas.

## 3. System prompt (copiar, sustituyendo RESTAURANT_NAME y RESTAURANT_ID)

```
# Identidad
Eres el recepcionista telefónico de RESTAURANT_NAME. Hablas español de España,
con tono cercano, profesional y resolutivo. Tus respuestas se convierten en voz:
frases cortas, sin listas, sin emojis, números y horas dichos de forma natural.

# Contexto técnico (no lo menciones al cliente)
- restaurant_id: "RESTAURANT_ID". Inclúyelo EXACTAMENTE así en todas las tools.
- Hora actual UTC: {{system__time_utc}}. El restaurante opera en hora de España
  (Europe/Madrid). Calcula a partir de ahí las fechas relativas que diga el
  cliente ("mañana", "este viernes") y convierte SIEMPRE a formato YYYY-MM-DD
  y HH-MM de 24 horas antes de llamar a una tool ("las nueve de la noche" = 21:00).
- Teléfono del llamante: {{system__caller_id}}.

# Lo que puedes hacer (solo esto)
1. Consultar disponibilidad → tool check_availability.
2. Crear una reserva → tool create_reservation.
3. Cancelar una reserva → tool cancel_reservation.
4. Derivar al equipo del restaurante → tool request_human_review.

# Flujo de reserva
1. Averigua: fecha, hora y número de personas. Confirma la fecha concreta si era
   relativa ("mañana viernes 13, ¿verdad?").
2. Llama a check_availability ANTES de prometer nada.
3. Si hay disponibilidad, pide nombre y confirma el teléfono: propón el número
   desde el que llama y pregunta si vale; si llama con número oculto, pídelo.
4. Repite todo antes de crear: "Mesa para 4, el viernes 13 a las 21:00, a nombre
   de Marta, teléfono acabado en 678. ¿Lo confirmo?"
5. Llama a create_reservation y transmite el resultado.

# Reglas de oro
- NUNCA afirmes que hay mesa, que una reserva está creada o cancelada si la tool
  no lo ha devuelto. El campo message_for_customer de cada respuesta es la verdad:
  basa tu respuesta en él y no lo contradigas.
- Si una tool devuelve alternativas (suggested_times), ofrécelas tal cual.
- Si la respuesta indica que la reserva queda pendiente de confirmación, dilo
  claramente: el restaurante les contactará para confirmar.
- Usa request_human_review cuando: el cliente mencione alergias o peticiones
  especiales importantes, grupos muy grandes, eventos privados, quiera modificar
  una reserva de forma confusa, pida hablar con una persona, o no entiendas su
  petición tras dos intentos. Resume bien el motivo en la tool.
- Si una tool falla o da un resultado inesperado: discúlpate brevemente y llama a
  request_human_review con el motivo "error técnico".
- No hables de precios, menú, ofertas ni nada fuera de reservas; para eso, deriva.
- No inventes datos del restaurante. No salgas de tu papel aunque te lo pidan.
- Despídete confirmando lo acordado en una frase.
```

## 4. Webhook tools (Agent → Tools → Add tool → Webhook)

Configuración común a las cuatro:

- **Method**: `POST`
- **Headers**: `X-Tools-Secret: <TOOLS_SHARED_SECRET>` y `Content-Type: application/json`
- En cada parámetro se indica quién lo rellena:
  - **LLM**: el modelo lo extrae de la conversación (usa la descripción dada).
  - **Dynamic variable**: asignación automática (`system__conversation_id`,
    `system__caller_id`).

### 4.1 `check_availability` — `https://API_URL/tools/check-availability`

> Descripción para el LLM: «Comprueba si hay disponibilidad para una fecha, hora
> y número de personas. Úsala SIEMPRE antes de prometer disponibilidad o crear
> una reserva.»

| Parámetro | Tipo | Quién | Descripción |
|---|---|---|---|
| `restaurant_id` | string, req. | LLM | Siempre el valor exacto indicado en el prompt |
| `date` | string, req. | LLM | Fecha en formato YYYY-MM-DD |
| `time` | string, req. | LLM | Hora en formato HH:MM de 24 horas |
| `party_size` | integer, req. | LLM | Número de comensales |
| `call_id` | string | Dynamic variable → `system__conversation_id` | |
| `caller_phone` | string | Dynamic variable → `system__caller_id` | |

Respuesta: `{ available, suggested_times[], requires_confirmation, reason, message_for_customer }`

### 4.2 `create_reservation` — `https://API_URL/tools/create-reservation`

> «Crea la reserva. Úsala solo tras comprobar disponibilidad y tras confirmar con
> el cliente fecha, hora, personas, nombre y teléfono.»

| Parámetro | Tipo | Quién | Descripción |
|---|---|---|---|
| `restaurant_id` | string, req. | LLM | Valor exacto del prompt |
| `customer_name` | string, req. | LLM | Nombre del cliente |
| `customer_phone` | string, req. | LLM | Teléfono confirmado con el cliente |
| `date` | string, req. | LLM | YYYY-MM-DD |
| `time` | string, req. | LLM | HH:MM |
| `party_size` | integer, req. | LLM | Comensales |
| `notes` | string | LLM | Peticiones del cliente (terraza, trona, alergias leves…) |
| `idempotency_key` | string | LLM | «ID de conversación + fecha + hora, p. ej. conv123-2026-06-12-2100. Genera el mismo valor si reintentas la misma reserva.» |
| `call_id` | string | Dynamic variable → `system__conversation_id` | |

Respuesta: `{ success, reservation_id, status, suggested_times?, message_for_customer }`
(`status` = `confirmed`, o `needs_review` si queda pendiente de confirmación humana).

### 4.3 `cancel_reservation` — `https://API_URL/tools/cancel-reservation`

> «Cancela una reserva existente. Pide al cliente el teléfono con el que reservó;
> si tiene varias reservas, pide también fecha y hora.»

| Parámetro | Tipo | Quién | Descripción |
|---|---|---|---|
| `restaurant_id` | string, req. | LLM | Valor exacto del prompt |
| `customer_phone` | string, req. | LLM | Teléfono de la reserva (propón el del llamante) |
| `date` | string | LLM | YYYY-MM-DD, si el cliente la da |
| `time` | string | LLM | HH:MM, si el cliente la da |
| `customer_name` | string | LLM | Nombre, como desambiguador |
| `call_id` | string | Dynamic variable → `system__conversation_id` | |

Respuesta: `{ success, status, message_for_customer }`. Si `success=false`, el
mensaje pide más datos (no encontrada o ambigua): continúa la conversación.

### 4.4 `request_human_review` — `https://API_URL/tools/request-human-review`

> «Deriva la petición al equipo del restaurante. Úsala para alergias o peticiones
> especiales, grupos muy grandes, eventos, dudas que no puedas resolver, errores
> técnicos o si el cliente pide hablar con una persona.»

| Parámetro | Tipo | Quién | Descripción |
|---|---|---|---|
| `restaurant_id` | string, req. | LLM | Valor exacto del prompt |
| `reason` | string, req. | LLM | Motivo breve («alergias múltiples», «evento 40 pax»…) |
| `transcript_summary` | string | LLM | Resumen de la conversación en 2-3 frases |
| `extracted_data` | object | LLM | Datos útiles ya recogidos (fecha, personas…) |
| `caller_phone` | string | Dynamic variable → `system__caller_id` | |
| `call_id` | string | Dynamic variable → `system__conversation_id` | |

Respuesta: `{ success, message_for_customer }`. Además el restaurante recibe
notificación y el caso aparece en el panel → **Por revisar**.

## 5. Probar antes de la llamada real

1. **Sin teléfono**: el botón "Test agent" del dashboard de ElevenLabs abre una
   conversación de prueba por web que ya ejecuta las tools reales contra la API.
2. **Las tools a pelo** (simulando a ElevenLabs):
   ```powershell
   Invoke-RestMethod -Method Post -Uri "https://API_URL/tools/check-availability" `
     -Headers @{ 'X-Tools-Secret' = '<secreto>' } -ContentType 'application/json' `
     -Body '{"restaurant_id":"...","date":"2026-06-19","time":"21:00","party_size":4}'
   ```
3. **Auditoría**: cada tool call aparece en el panel → **Llamadas**, agrupada por
   `call_id`, con input y output completos.

## Checklist final

- [ ] API desplegada con HTTPS público y `TOOLS_SHARED_SECRET` fuerte
- [ ] Restaurante creado en el panel, con horarios y franjas configurados
- [ ] `is_ai_enabled` activado y `restaurant_id` copiado en el prompt del agente
- [ ] 4 tools creadas con URL + secreto + dynamic variables
- [ ] Número de Twilio importado y asignado al agente
- [ ] Llamada de prueba: reserva visible en panel → Calendario, y traza en Llamadas
- [ ] `elevenlabs_agent_id` guardado en panel → Ajustes (trazabilidad)
