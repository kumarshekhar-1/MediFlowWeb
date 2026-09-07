import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _counter = 0;
  private readonly _toasts = signal<Toast[]>([]);

  readonly toasts = computed(() => this._toasts());

  success(message: string, durationMs = 3500): void { this._push('success', message, durationMs); }
  error  (message: string, durationMs = 5000): void { this._push('error',   message, durationMs); }
  info   (message: string, durationMs = 3500): void { this._push('info',    message, durationMs); }
  warning(message: string, durationMs = 4000): void { this._push('warning', message, durationMs); }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  private _push(type: ToastType, message: string, durationMs: number): void {
    const id = ++this._counter;
    this._toasts.update(list => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
