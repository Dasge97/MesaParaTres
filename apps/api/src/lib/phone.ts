/**
 * Normaliza teléfonos para que el matching entre llamadas funcione:
 * quita espacios, guiones y paréntesis; conserva un único "+" inicial.
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\+/g, '');
  }
  return cleaned.replace(/\+/g, '');
}
