import type { ReactNode } from 'react';
import { RESERVATION_STATUS_LABELS_ES, type ReservationStatus } from '@mesaparatres/shared';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const styles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700',
    secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none bg-white ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white focus:border-slate-500 focus:outline-none ${props.className ?? ''}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none bg-white ${props.className ?? ''}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export const STATUS_COLORS: Record<ReservationStatus | 'blocked', string> = {
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  needs_review: 'bg-orange-100 text-orange-900 border-orange-400',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
  blocked: 'bg-slate-200 text-slate-600 border-slate-400',
};

export function StatusBadge({ status }: { status: ReservationStatus | 'blocked' }) {
  const label = status === 'blocked' ? 'Bloqueado' : RESERVATION_STATUS_LABELS_ES[status];
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[status]}`}
    >
      {label}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-lg bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    (error as { body?: { message?: string } })?.body?.message ??
    (error as Error)?.message ??
    'Error inesperado';
  return <p className="mt-2 text-sm text-red-600">{message}</p>;
}
