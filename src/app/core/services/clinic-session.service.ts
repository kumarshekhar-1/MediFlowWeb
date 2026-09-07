import { Injectable, inject, signal, computed } from '@angular/core';
import { ClinicApiService, ClinicApiResponse } from '../services/clinic-api.service';
import { AuthTokenService } from './auth-token.service';

/**
 * ClinicSessionService
 *
 * Fetches and caches the active clinic from the real API.
 * The clinic ID is read from AuthTokenService (set on login) — no hardcoding.
 */
@Injectable({
  providedIn: 'root'
})
export class ClinicSessionService {
  private readonly clinicApi = inject(ClinicApiService);
  private readonly authToken = inject(AuthTokenService);

  /**
   * The active clinic ID — always sourced from the authenticated session.
   * Falls back to empty string (which will gracefully skip the fetch).
   */
  get clinicId(): string {
    return this.authToken.clinicId() ?? '';
  }

  // State signals
  readonly clinic = signal<ClinicApiResponse | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed helpers
  readonly clinicName      = computed(() => this.clinic()?.clinicName      ?? '—');
  readonly ownerName       = computed(() => this.clinic()?.ownerName       ?? '—');
  readonly city            = computed(() => this.clinic()?.city            ?? '—');
  readonly specializations = computed(() => this.clinic()?.specializations ?? []);
  readonly isLoaded        = computed(() => this.clinic() !== null);

  /**
   * Fetch the clinic from the API.
   * Pass an explicit clinicId only when overriding (e.g. super-admin switching context).
   */
  fetchClinic(clinicId?: string): void {
    const id = clinicId ?? this.clinicId;

    if (!id) {
      // No clinic ID available yet — nothing to fetch
      return;
    }

    if (this.isLoading()) return;
    if (this.isLoaded() && this.clinic()?.clinicId === id) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.clinicApi.getClinic(id).subscribe({
      next: (response) => {
        this.clinic.set(response);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to load clinic data';
        this.error.set(msg);
        console.warn('[ClinicSession] Could not fetch clinic:', msg);
      }
    });
  }

  /** Force a refresh even if already loaded */
  refreshClinic(): void {
    this.clinic.set(null);
    this.fetchClinic();
  }
}
