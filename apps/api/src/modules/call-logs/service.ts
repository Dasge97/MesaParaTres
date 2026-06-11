import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';

export interface RecordToolCallOptions {
  restaurant_id: string;
  provider_call_id?: string | null;
  caller_phone?: string | null;
  tool: string;
  input: unknown;
  output: unknown;
  reservation_id?: string | null;
  outcome?: string | null;
  extracted_intent?: string | null;
}

/**
 * Auditoría de lo que hace el agente de voz: cada tool call queda registrada.
 * Si llega provider_call_id (el call id de ElevenLabs), todas las tool calls
 * de la misma llamada se acumulan en un único CallLog. Nunca lanza: un fallo
 * de logging no puede romper la operación de negocio.
 */
export async function recordToolCall(opts: RecordToolCallOptions): Promise<void> {
  try {
    const entry = {
      tool: opts.tool,
      input: opts.input,
      output: opts.output,
      at: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    if (opts.provider_call_id) {
      const existing = await db.callLog.findUnique({
        where: { provider_call_id: opts.provider_call_id },
      });
      if (existing) {
        const calls = Array.isArray(existing.tool_calls)
          ? (existing.tool_calls as Prisma.JsonArray)
          : [];
        await db.callLog.update({
          where: { id: existing.id },
          data: {
            tool_calls: [...calls, entry] as Prisma.InputJsonValue,
            caller_phone: existing.caller_phone ?? opts.caller_phone ?? undefined,
            reservation_id: opts.reservation_id ?? existing.reservation_id ?? undefined,
            outcome: opts.outcome ?? existing.outcome ?? undefined,
            extracted_intent: opts.extracted_intent ?? existing.extracted_intent ?? undefined,
          },
        });
        return;
      }
    }

    await db.callLog.create({
      data: {
        restaurant_id: opts.restaurant_id,
        provider_call_id: opts.provider_call_id ?? null,
        caller_phone: opts.caller_phone ?? null,
        tool_calls: [entry] as Prisma.InputJsonValue,
        reservation_id: opts.reservation_id ?? null,
        outcome: opts.outcome ?? null,
        extracted_intent: opts.extracted_intent ?? null,
      },
    });
  } catch (e) {
    console.error('[call-log] error registrando tool call:', e);
  }
}
