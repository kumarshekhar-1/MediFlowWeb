import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { SessionStateService } from '../../../core/services/session-state.service';

@Component({
  selector: 'app-register-clinic',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule
  ],
  templateUrl: './register-clinic.component.html',
  styleUrl: './register-clinic.component.scss'
})
export class RegisterClinicComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly db = inject(SessionStateService);

  isSubmitting = signal(false);
  apiError = signal<string | null>(null);
  apiSuccess = signal<string | null>(null);

  registerForm: FormGroup = this.fb.group({
    clinicName: ['', [Validators.required, Validators.maxLength(150)]],
    ownerPhoneNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]]
  });

  hasError(controlName: string, errorType: string = ''): boolean {
    const control = this.registerForm.get(controlName);
    if (!control || !control.touched) return false;
    if (errorType) return control.hasError(errorType);
    return control.invalid;
  }

  onlyDigits(event: KeyboardEvent): boolean {
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPasteDigits(event: ClipboardEvent, controlName: string) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') ?? '';
    const cleanText = pastedText.replace(/\D/g, '');
    const maxLength = 10;
    const finalVal = cleanText.slice(0, maxLength);
    this.registerForm.patchValue({ [controlName]: finalVal });
    this.registerForm.get(controlName)?.markAsTouched();
  }

  submitRegistration() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.apiError.set(null);
    this.apiSuccess.set(null);

    const v = this.registerForm.value;
    const rawPhone = v.ownerPhoneNumber.trim();

    this.db.registerClinicPortal(rawPhone, v.clinicName.trim(), v.password).subscribe({
      next: (userRes: any) => {
        this.isSubmitting.set(false);
        this.apiSuccess.set(`Clinic account created! Your User ID is: ${userRes.userId}. Please note this down.`);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('mediflow_prefilled_username', userRes.userId);
        }
        setTimeout(() => this.router.navigate(['/auth']), 5000);
      },
      error: (authErr: any) => {
        this.isSubmitting.set(false);
        const errorMsg = authErr?.error?.message || authErr?.message || 'Clinic registration failed.';
        this.apiError.set(errorMsg);
        console.error('Clinic owner registration API error:', authErr);
      }
    });
  }

  cancel() {
    this.router.navigate(['/']);
  }
}
