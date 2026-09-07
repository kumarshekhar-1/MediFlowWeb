import { Injectable, signal, computed } from '@angular/core';
import { UserRole } from '../models/clinic.models';

export interface AuthSession {
  token: string;
  userId: string;
  username: string;
  /** Raw backend role — e.g. CLINIC_ADMIN, PATIENT, DOCTOR … */
  backendRole: string;
  clinicId: string | null;
  expiresAt: number; // Unix epoch ms
}

const STORAGE_KEY = 'mediflow_auth_session';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  // ── Reactive state ──────────────────────────────────────────────────────────
  private readonly _session = signal<AuthSession | null>(this._load());

  /** True only when a valid, non-expired session exists. */
  readonly isAuthenticated = computed(() => {
    const s = this._session();
    return !!s && s.expiresAt > Date.now();
  });

  readonly token     = computed(() => this._session()?.token     ?? null);
  readonly userId    = computed(() => this._session()?.userId    ?? null);
  readonly clinicId  = computed(() => this._session()?.clinicId  ?? null);
  readonly username  = computed(() => this._session()?.username  ?? null);

  /**
   * Returns the backend role string exactly as the server sent it
   * (e.g. 'CLINIC_ADMIN', 'PATIENT', 'DOCTOR', 'RECEPTIONIST').
   */
  readonly backendRole = computed(() => this._session()?.backendRole ?? 'ANONYMOUS');

  /**
   * Maps backend role → frontend UserRole union.
   * CLINIC_ADMIN ↔ OWNER is the only non-trivial mapping.
   */
  readonly frontendRole = computed<UserRole>(() => {
    const raw = this.backendRole();
    if (raw === 'CLINIC_ADMIN') return 'OWNER';
    const valid: UserRole[] = ['OWNER', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'];
    return valid.includes(raw as UserRole) ? (raw as UserRole) : 'PATIENT';
  });

  // ── Mutators ────────────────────────────────────────────────────────────────

  /** Called by SessionStateService immediately after a successful /auth/login response. */
  save(session: AuthSession): void {
    this._session.set(session);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }

  /** Wipe everything — called on logout. */
  clear(): void {
    this._session.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _load(): AuthSession | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed: AuthSession = JSON.parse(raw);
      // Discard expired sessions immediately on boot
      if (parsed.expiresAt <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
