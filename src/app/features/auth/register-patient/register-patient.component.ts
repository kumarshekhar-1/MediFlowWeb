import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { SessionStateService } from '../../../core/services/session-state.service';

@Component({
  selector: 'app-register-patient',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule
  ],
  templateUrl: './register-patient.component.html',
  styleUrl: './register-patient.component.scss'
})
export class RegisterPatientComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly db = inject(SessionStateService);

  isSubmitting = signal(false);
  apiError = signal<string | null>(null);
  apiSuccess = signal<string | null>(null);

  // Reactive FormGroup with Validators matching API rules
  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
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
    const maxLength = controlName === 'pinCode' ? 6 : 10;
    const finalVal = cleanText.slice(0, maxLength);
    this.registerForm.patchValue({ [controlName]: finalVal });
    this.registerForm.get(controlName)?.markAsTouched();
  }

  submitPatientRegistration() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.apiError.set(null);
    this.apiSuccess.set(null);

    const formVal = this.registerForm.value;

    this.db.registerPatientPortal(formVal.phoneNumber.trim(), formVal.name.trim(), formVal.password).subscribe({
      next: (userRes: any) => {
        this.isSubmitting.set(false);
        this.apiSuccess.set(`Patient account created! Your User ID is: ${userRes.userId}. Please note this down.`);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('mediflow_prefilled_username', userRes.userId);
        }
        setTimeout(() => this.router.navigate(['/auth']), 5000);
      },
      error: (signupErr: any) => {
        this.isSubmitting.set(false);
        const errorMsg = signupErr?.error?.message || signupErr?.message || 'Registration failed. Please try again.';
        this.apiError.set(errorMsg);
        console.error('Patient signup API error:', signupErr);
      }
    });
  }

  cancel() {
    this.router.navigate(['/']);
  }
}
