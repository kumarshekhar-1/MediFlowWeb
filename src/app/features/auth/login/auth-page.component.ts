import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { SessionStateService } from '../../../core/services/session-state.service';
import { UserRole } from '../../../core/models/clinic.models';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss'
})
export class AuthPageComponent implements OnInit {
  db = inject(SessionStateService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const prefilled = localStorage.getItem('mediflow_prefilled_username');
      if (prefilled) {
        this.loginIdentifier = prefilled;
        localStorage.removeItem('mediflow_prefilled_username');
      }
    }
  }

  isSubmitting = signal(false);
  apiError = signal<string | null>(null);

  authMode: 'LOGIN' | 'REGISTER' = 'LOGIN';
  loginMethod: 'MOBILE_OTP' | 'EMAIL_PASSWORD' = 'EMAIL_PASSWORD';

  // Mobile OTP State
  loginPhone: string = '';
  otpSent: boolean = false;
  enteredOtp: string = '';

  // Email / Identifier State
  loginIdentifier: string = '';
  loginPassword: string = '';

  setAuthMode(mode: 'LOGIN' | 'REGISTER') {
    this.authMode = mode;
  }

  sendOtp() {
    if (!this.loginPhone || this.loginPhone.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    this.otpSent = true;
  }

  loginWithEmailPassword() {
    if (!this.loginIdentifier || !this.loginPassword) {
      alert('Please enter both your user ID and password.');
      return;
    }
    this.isSubmitting.set(true);
    this.apiError.set(null);
    this.db.login(this.loginIdentifier.trim(), this.loginPassword).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.navigateForRole(this.db.currentUser().role);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Invalid user ID or password. Please try again.';
        this.apiError.set(errorMsg);
      }
    });
  }

  private navigateForRole(role: UserRole) {
    switch (role) {
      case 'OWNER':
        this.router.navigate(['/dashboard/owner']);
        break;
      case 'DOCTOR':
        this.router.navigate(['/dashboard/doctor']);
        break;
      case 'RECEPTIONIST':
        this.router.navigate(['/dashboard/receptionist']);
        break;
      case 'PATIENT':
        this.router.navigate(['/portal/patient']);
        break;
      default:
        this.router.navigate(['/']);
    }
  }

  selectRegistrationType(type: 'CLINIC' | 'PATIENT') {
    if (type === 'CLINIC') {
      this.router.navigate(['/register-clinic']);
    } else {
      this.router.navigate(['/register-patient']);
    }
  }

  openLandingPage() {
    this.router.navigate(['/']);
  }
}
