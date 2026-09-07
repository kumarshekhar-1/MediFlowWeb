import { Injectable, inject, signal, computed } from '@angular/core';
import { ClinicApiService } from '../services/clinic-api.service';
import { ClinicSessionService } from '../services/clinic-session.service';
import { AuthTokenService } from './auth-token.service';

/**
 * DoctorSessionService
 *
 * Fetches and caches the active doctor from the real API (/clinics/getDoctor?clinicId=&doctorId=).
 * Mirrors ClinicSessionService and PatientSessionService.
 */
@Injectable({
  providedIn: 'root'
})
export class DoctorSessionService {
  private readonly clinicApi = inject(ClinicApiService);
  private readonly clinicSession = inject(ClinicSessionService);
  private readonly authToken = inject(AuthTokenService);

  /** Current active doctor ID */
  readonly currentDoctorId = signal<string>('');

  // State signals
  readonly doctor = signal<any | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed helpers
  readonly doctorName          = computed(() => this.doctor()?.name                   ?? '—');
  readonly specialization      = computed(() => this.doctor()?.specialization         ?? '—');
  readonly qualification       = computed(() => this.doctor()?.qualification          ?? '—');
  readonly registrationNumber  = computed(() => this.doctor()?.registrationNumber     ?? '—');
  readonly mobileNumber        = computed(() => this.doctor()?.mobileNumber           ?? '—');
  readonly email               = computed(() => this.doctor()?.email                  ?? '—');
  readonly consultationFee     = computed(() => this.doctor()?.consultationFee        ?? 500);
  readonly avgConsultationTime = computed(() => this.doctor()?.avgConsultationTimeMinutes ?? 15);
  readonly receptionistId      = computed(() => this.doctor()?.receptionistId         ?? null);
  readonly status              = computed(() => this.doctor()?.status                 ?? 'ACTIVE');
  readonly schedules           = computed(() => this.doctor()?.schedule               ?? []);
  readonly isLoaded            = computed(() => this.doctor() !== null);

  /**
   * Fetch the doctor from the API. Optional `doctorId` and `clinicId` override defaults.
   */
  fetchDoctor(doctorId?: string, clinicId?: string): void {
    const docId = doctorId || this.authToken.userId() || '';
    const clnId = clinicId || this.clinicSession.clinicId || this.authToken.clinicId() || '';

    if (!docId || !clnId) {
      // No doctor ID or clinic ID available yet — nothing to fetch
      return;
    }

    this.currentDoctorId.set(docId);

    if (this.isLoading()) return;
    if (this.isLoaded() && this.doctor()?.doctorId === docId) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.clinicApi.getDoctor(clnId, docId).subscribe({
      next: (response) => {
        this.doctor.set(response);
        this.isLoading.set(false);
        console.log(`[DoctorSession] Loaded: ${response.name} (${response.doctorId})`);
      },
      error: (err: any) => {
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to load doctor data';
        this.error.set(msg);
        console.warn('[DoctorSession] Could not fetch doctor:', msg);
      }
    });
  }

  /** Force a refresh even if already loaded */
  refreshDoctor(doctorId?: string, clinicId?: string): void {
    this.doctor.set(null);
    this.fetchDoctor(doctorId, clinicId);
  }
}
