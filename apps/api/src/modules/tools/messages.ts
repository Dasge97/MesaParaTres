import { humanDateEs } from '../../lib/time';
import type { EngineResult } from '../availability/engine';

/**
 * Mensajes en español que el agente de voz lee tal cual al cliente.
 * El agente nunca redacta el resultado de una operación: lo recibe aquí.
 */

function listTimes(times: string[]): string {
  if (times.length === 1) return times[0];
  return `${times.slice(0, -1).join(', ')} o ${times[times.length - 1]}`;
}

export function availabilityMessage(
  r: EngineResult,
  opts: { date: string; time: string; party_size: number; timezone: string },
): string {
  const fecha = humanDateEs(opts.date, opts.timezone);
  const alt = r.suggested_times.length
    ? ` ¿Te iría bien a las ${listTimes(r.suggested_times)}?`
    : '';

  if (r.available && !r.requires_confirmation) {
    return `Sí, hay disponibilidad para ${opts.party_size} personas el ${fecha} a las ${r.slot_time}.`;
  }
  if (r.available && r.requires_confirmation) {
    return (
      `Para un grupo de ${opts.party_size} personas necesito que el restaurante confirme la reserva. ` +
      `Puedo tomar nota y te contactarán para confirmarla. ¿Quieres que lo haga?`
    );
  }
  switch (r.reason) {
    case 'closed':
      return `Lo siento, el ${fecha} el restaurante está cerrado. ¿Quieres mirar otro día?`;
    case 'blocked':
      return r.suggested_times.length
        ? `Lo siento, esa hora no está disponible el ${fecha}.${alt}`
        : `Lo siento, el ${fecha} no admite reservas. ¿Quieres mirar otro día?`;
    case 'outside_opening_hours':
      return `A las ${opts.time} el restaurante está cerrado.${alt || ' ¿Quieres que pase tu petición al restaurante para que te confirmen si es posible?'}`;
    case 'no_slot':
      return `No tengo franja de reserva justo a las ${opts.time}.${alt || ' ¿Quieres que el restaurante revise tu petición?'}`;
    case 'full':
      return r.suggested_times.length
        ? `Lo siento, a las ${opts.time} está completo.${alt}`
        : `Lo siento, a las ${opts.time} está completo y no veo huecos cercanos ese día. ¿Quieres mirar otro día?`;
    case 'past_date':
      return 'Esa fecha y hora ya han pasado. ¿Para qué día quieres la reserva?';
    default:
      return 'Ahora mismo no puedo comprobar la disponibilidad. ¿Quieres que el restaurante te llame para confirmar?';
  }
}

export function reservationCreatedMessage(opts: {
  status: string;
  customer_name: string;
  party_size: number;
  date: string;
  time: string;
  timezone: string;
}): string {
  const fecha = humanDateEs(opts.date, opts.timezone);
  if (opts.status === 'confirmed') {
    return `¡Reserva confirmada! Mesa para ${opts.party_size} el ${fecha} a las ${opts.time}, a nombre de ${opts.customer_name}. ¡Os esperamos!`;
  }
  return (
    `He tomado nota de tu reserva para ${opts.party_size} el ${fecha} a las ${opts.time}, a nombre de ${opts.customer_name}. ` +
    `El restaurante tiene que confirmarla y te contactarán lo antes posible en este teléfono.`
  );
}

export function reservationFullMessage(suggested: string[], time: string): string {
  return suggested.length
    ? `Vaya, justo se ha llenado la franja de las ${time}. ¿Te iría bien a las ${listTimes(suggested)}?`
    : `Lo siento, a las ${time} ya no queda sitio. ¿Quieres mirar otro día u otra hora?`;
}

export function cancellationMessage(opts: {
  customer_name: string;
  date: string;
  time: string;
  timezone: string;
}): string {
  return `Listo: la reserva del ${humanDateEs(opts.date, opts.timezone)} a las ${opts.time} a nombre de ${opts.customer_name} queda cancelada.`;
}

export function cancellationNotFoundMessage(): string {
  return 'No encuentro ninguna reserva activa con esos datos. ¿Puedes confirmarme el teléfono con el que se hizo la reserva, o la fecha y la hora?';
}

export function cancellationAmbiguousMessage(count: number): string {
  return `Veo ${count} reservas activas asociadas a ese teléfono. ¿Me dices la fecha y la hora de la que quieres cancelar?`;
}

export function handoffMessage(): string {
  return 'De acuerdo. Paso tu petición al equipo del restaurante para que la gestionen personalmente; te contactarán lo antes posible.';
}

export function aiDisabledMessage(): string {
  return 'Ahora mismo no puedo gestionar reservas de forma automática. He avisado al restaurante para que te atiendan en cuanto puedan.';
}

export function errorFallbackMessage(): string {
  return 'Disculpa, estoy teniendo un problema técnico. He avisado al restaurante para que te contacten y lo gestionen personalmente.';
}
