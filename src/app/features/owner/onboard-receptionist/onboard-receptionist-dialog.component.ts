import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ClinicApiService } from '../../../core/services/clinic-api.service';
import { ClinicSessionService } from '../../../core/services/clinic-session.service';
import { SessionStateService } from '../../../core/services/session-state.service';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';


@Component({
  selector: 'app-onboard-receptionist-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './onboard-receptionist-dialog.component.html',
  styleUrl: './onboard-receptionist-dialog.component.scss'
})
export class OnboardReceptionistDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<OnboardReceptionistDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ClinicApiService);
  private readonly clinicSession = inject(ClinicSessionService);
  private readonly db = inject(SessionStateService);

  registerSubmitting = signal(false);
  registerError = signal<string | null>(null);

  readonly receptionistForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]]
  });

  ngOnInit(): void {}

  hasError(controlName: string, errorType: string = ''): boolean {
    const control = this.receptionistForm.get(controlName);
    if (!control || !control.touched) return false;
    if (errorType) {
      return control.hasError(errorType);
    }
    return control.invalid;
  }

  onlyDigits(event: KeyboardEvent): boolean {
    const charCode = event.key;
    if (!/^[0-9]$/.test(charCode)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPasteDigits(event: ClipboardEvent, controlName: string) {
    event.preventDefault();
    const clipboardData = event.clipboardData;
    if (clipboardData) {
      const pastedText = clipboardData.getData('text');
      const cleanText = pastedText.replace(/\D/g, '');
      const finalVal = cleanText.slice(0, 10);
      
      this.receptionistForm.patchValue({ [controlName]: finalVal });
      this.receptionistForm.get(controlName)?.markAsTouched();
    }
  }


  submit() {
    if (this.receptionistForm.invalid) {
      this.receptionistForm.markAllAsTouched();
      return;
    }

    this.registerSubmitting.set(true);
    this.registerError.set(null);

    const formVal = this.receptionistForm.value;
    const payload = {
      name: formVal.name.trim(),
      mobileNumber: '+91' + formVal.mobileNumber.trim(),
      email: formVal.email.trim()
    };

    const clinicId = this.clinicSession.clinic()?.clinicId
      || this.db.currentClinicId()
      || this.clinicSession.clinicId;

    if (!clinicId) {
      this.registerSubmitting.set(false);
      this.registerError.set('Clinic ID not available. Please log out and log back in.');
      return;
    }

    this.api.addReceptionist(clinicId, payload).subscribe({
      next: (res) => {
        this.registerSubmitting.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.registerSubmitting.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Onboarding failed. Please try again.';
        this.registerError.set(errorMsg);
        console.error('Onboard receptionist API error:', err);
      }
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
