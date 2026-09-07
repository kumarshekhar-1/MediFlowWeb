import { Injectable, signal, computed } from '@angular/core';

/**
 * Tracks the count of in-flight HTTP requests so the top progress bar
 * knows when to show/hide. The loading interceptor calls increment()
 * before forwarding a request and decrement() once it completes (or errors).
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _active = signal<number>(0);

  /** True whenever at least one HTTP request is in flight. */
  readonly isLoading = computed(() => this._active() > 0);

  /** 0–100 clamped progress value for the bar width. */
  readonly progress = computed(() => this._active() > 0 ? 75 : 100);

  increment(): void { this._active.update(n => n + 1); }
  decrement(): void { this._active.update(n => Math.max(0, n - 1)); }
}
