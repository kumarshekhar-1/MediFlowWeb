import { Injectable, inject, signal, computed } from '@angular/core';
import { PatientApiService, PatientRegistrationPayload } from '../services/patient-api.service';
import { AuthTokenService } from './auth-token.service';

/**
 * PatientSessionService
 *
 * Fetches and caches the active patient from /patient/getPatientDetails?patientId=.
 * The patient ID is read from AuthTokenService (set on login) — no hardcoded defaults.
 */
@Injectable({
  providedIn: 'root'
})
export class PatientSessionService {
  private readonly patientApi = inject(PatientApiService);
  private readonly authToken = inject(AuthTokenService);

  /** Current active patient ID — always sourced from the authenticated session. */
  readonly currentPatientId = signal<string>('');

  // State signals
  readonly patient = signal<PatientRegistrationPayload | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed helpers
  readonly patientName     = computed(() => this.patient()?.name            ?? '—');
  readonly patientPhone    = computed(() => this.patient()?.phoneNumber     ?? '—');
  readonly patientEmail    = computed(() => this.patient()?.email           ?? '—');
  readonly patientDob      = computed(() => this.patient()?.dob             ?? '—');
  readonly patientGender   = computed(() => this.patient()?.gender          ?? '—');
  readonly patientBlood    = computed(() => this.patient()?.bloodGroup      ?? '—');
  readonly patientAddress  = computed(() => this.patient()?.address         ?? '—');
  readonly patientPinCode  = computed(() => this.patient()?.pinCode         ?? '—');
  readonly patientHistory  = computed(() => this.patient()?.medicalHistory  ?? '');
  readonly isLoaded        = computed(() => this.patient() !== null);

  /**
   * Fetch the patient from the API.
   * Pass an explicit patientId only when overriding (e.g. doctor viewing a patient).
   */
  fetchPatient(patientId?: string): void {
    const id = patientId || this.authToken.userId() || '';

    if (!id) {
      // No patient ID available yet — nothing to fetch
      return;
    }

    this.currentPatientId.set(id);

    if (this.isLoading()) return;
    if (this.isLoaded() && this.patient()?.patientId === id) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.patientApi.getPatientDetails(id).subscribe({
      next: (response) => {
        this.patient.set(response);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to load patient data';
        this.error.set(msg);
        console.warn('[PatientSession] Could not fetch patient:', msg);
      }
    });
  }

  /** Force a refresh even if already loaded */
  refreshPatient(patientId?: string): void {
    this.patient.set(null);
    this.fetchPatient(patientId);
  }
}
