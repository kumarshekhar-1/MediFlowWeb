import { Component, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { PatientApiService, PatientRegistrationPayload } from '../../../../core/services/patient-api.service';

@Component({
  selector: 'app-quick-patient-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './quick-patient-registration.component.html',
  styleUrl: './quick-patient-registration.component.scss'
})
export class QuickPatientRegistrationComponent {
  isOpen = input<boolean>(false);
  close = output<void>();
  registered = output<void>();

  patientApi = inject(PatientApiService);
  private fb = inject(FormBuilder);

  newPatientDobObj: Date | null = new Date(1995, 0, 1);
  registerSubmitting = signal(false);
  registerError = signal<string | null>(null);

  quickRegisterForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    email: ['', [Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    dob: [new Date(1995, 0, 1), [Validators.required]],
    gender: ['MALE', [Validators.required]],
    bloodGroup: ['B+'],
    allergiesText: [''],
    address: [''],
    emergencyContactNumber: ['', [Validators.pattern(/^[6-9]\d{9}$/)]],
    pinCode: ['', [Validators.pattern(/^[1-9]\d{5}$/)]]
  });

  resetForm() {
    this.quickRegisterForm.reset({
      gender: 'MALE',
      bloodGroup: 'B+',
      dob: new Date(1995, 0, 1)
    });
    this.newPatientDobObj = new Date(1995, 0, 1);
    this.registerError.set(null);
  }

  onNewPatientDobChange(d: Date | null) {
    if (d) {
      this.newPatientDobObj = d;
      this.quickRegisterForm.patchValue({ dob: d });
    }
  }

  hasError(controlName: string, errorType: string = ''): boolean {
    const control = this.quickRegisterForm.get(controlName);
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
      const maxLength = controlName === 'pinCode' ? 6 : 10;
      const finalVal = cleanText.slice(0, maxLength);
      
      this.quickRegisterForm.patchValue({ [controlName]: finalVal });
      this.quickRegisterForm.get(controlName)?.markAsTouched();
    }
  }

  submitRegisterPatient() {
    if (this.quickRegisterForm.invalid) {
      this.quickRegisterForm.markAllAsTouched();
      return;
    }

    this.registerSubmitting.set(true);
    this.registerError.set(null);

    const formVal = this.quickRegisterForm.value;
    let dobStr = '';
    if (formVal.dob instanceof Date) {
      const y = formVal.dob.getFullYear();
      const m = String(formVal.dob.getMonth() + 1).padStart(2, '0');
      const day = String(formVal.dob.getDate()).padStart(2, '0');
      dobStr = `${y}-${m}-${day}`;
    }

    const payload: PatientRegistrationPayload = {
      name: formVal.name.trim(),
      email: formVal.email?.trim() || '',
      phoneNumber: formVal.phone.trim(),
      emergencyContactNumber: formVal.emergencyContactNumber?.trim() || '',
      address: formVal.address?.trim() || '',
      pinCode: formVal.pinCode?.trim() || '',
      dob: dobStr,
      gender: formVal.gender,
      bloodGroup: formVal.bloodGroup,
      medicalHistory: formVal.allergiesText?.trim() || ''
    };

    this.patientApi.registerPatient(payload).subscribe({
      next: () => {
        this.registerSubmitting.set(false);
        this.registered.emit();
        alert('Patient registered successfully via API!');
      },
      error: (err) => {
        this.registerSubmitting.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Registration failed. Please try again.';
        this.registerError.set(errorMsg);
        console.error('Receptionist patient register API error:', err);
      }
    });
  }
}
