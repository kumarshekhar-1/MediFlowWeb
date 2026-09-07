import { Component, inject, signal, effect, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CustomSelectComponent } from '../../../../shared/components/custom-select.component';
import { PatientSessionService } from '../../../../core/services/patient-session.service';
import { PatientApiService, PatientRegistrationPayload } from '../../../../core/services/patient-api.service';
import { GENDER_OPTIONS, BLOOD_GROUP_OPTIONS } from '../../../../core/constants/global';

@Component({
  selector: 'app-patient-profile-completion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    CustomSelectComponent,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './patient-profile-completion.component.html',
  styleUrl: './patient-profile-completion.component.scss'
})
export class PatientProfileCompletionComponent {
  patientSession = inject(PatientSessionService);
  private readonly patientApi = inject(PatientApiService);
  private readonly fb = inject(FormBuilder);

  profileCompleted = output<void>();

  profileFormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^(\+91)?\s?[6-9]\d{9}$/)]],
    email: ['', [Validators.email]],
    emergencyContactNumber: ['', [Validators.pattern(/^(\+91)?\s?[6-9]\d{9}$/)]],
    address: ['', [Validators.required, Validators.minLength(4)]],
    pinCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    dob: ['', [Validators.required]],
    gender: ['MALE', [Validators.required]],
    bloodGroup: ['B+'],
    medicalHistory: ['']
  });

  isProfileSubmitting = signal(false);
  profileError = signal<string | null>(null);
  profileSuccess = signal<string | null>(null);

  genderOptions = GENDER_OPTIONS;
  bloodGroupOptions = BLOOD_GROUP_OPTIONS;

  constructor() {
    effect(() => {
      const p = this.patientSession.patient();
      const rawPhone = p?.phoneNumber || this.patientSession.patientPhone() || '';
      let phoneVal = rawPhone === '—' ? '' : rawPhone;
      if (phoneVal && !phoneVal.startsWith('+91')) {
        phoneVal = '+91' + phoneVal;
      }
      
      const rawName = p?.name || this.patientSession.patientName() || '';
      const nameVal = rawName === '—' ? '' : rawName;

      if (p) {
        let emergencyContact = p.emergencyContactNumber || '';
        if (emergencyContact && !emergencyContact.startsWith('+91')) {
          emergencyContact = '+91' + emergencyContact;
        }

        this.profileFormGroup.patchValue({
          name: nameVal,
          phoneNumber: phoneVal,
          email: p.email || '',
          emergencyContactNumber: emergencyContact,
          address: p.address === 'Online Guest Booking' ? '' : (p.address || ''),
          pinCode: p.pinCode || '',
          dob: p.dob || '',
          gender: p.gender || 'MALE',
          bloodGroup: p.bloodGroup || 'B+',
          medicalHistory: p.medicalHistory || ''
        });
      } else {
        this.profileFormGroup.patchValue({
          name: nameVal,
          phoneNumber: phoneVal
        });
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.profileFormGroup.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getErrorMessage(controlName: string): string {
    const control = this.profileFormGroup.get(controlName);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'This field is required.';
    if (control.errors['email']) return 'Please enter a valid email address.';
    if (control.errors['pattern']) {
      if (controlName === 'pinCode') return 'PIN Code must be a 6-digit number.';
      if (controlName === 'emergencyContactNumber' || controlName === 'phoneNumber') return 'Must be a valid 10-digit mobile number (e.g. +91 9876543210).';
    }
    if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} characters required.`;
    return 'Invalid field value.';
  }

  submitProfileCompletion(): void {
    if (this.profileFormGroup.invalid) {
      this.profileFormGroup.markAllAsTouched();
      this.profileError.set('Please fix the validation errors marked in red.');
      return;
    }

    const formVals = this.profileFormGroup.value;
    const p = this.patientSession.patient();
    const patientId = p?.patientId || this.patientSession.currentPatientId();
    const patientName = (formVals.name || '').trim();
    const patientPhone = (formVals.phoneNumber || '').replace(/\s+/g, '').trim();

    this.isProfileSubmitting.set(true);
    this.profileError.set(null);

    let dobStr = '';
    if (formVals.dob) {
      const dobVal = formVals.dob as any;
      if (dobVal instanceof Date) {
        const year = dobVal.getFullYear();
        const month = String(dobVal.getMonth() + 1).padStart(2, '0');
        const day = String(dobVal.getDate()).padStart(2, '0');
        dobStr = `${year}-${month}-${day}`;
      } else {
        dobStr = String(dobVal);
      }
    }

    let emergencyContact = (formVals.emergencyContactNumber || '').replace(/\s+/g, '').trim();
    if (!emergencyContact && patientPhone) {
      emergencyContact = patientPhone;
    }

    const payload: PatientRegistrationPayload = {
      patientId: patientId,
      name: patientName,
      phoneNumber: patientPhone,
      email: (formVals.email || '').trim(),
      emergencyContactNumber: emergencyContact,
      address: (formVals.address || '').trim(),
      pinCode: (formVals.pinCode || '').trim(),
      dob: dobStr,
      gender: formVals.gender!,
      bloodGroup: formVals.bloodGroup!,
      medicalHistory: (formVals.medicalHistory || '').trim()
    };

    this.patientApi.registerPatient(payload).subscribe({
      next: () => {
        this.isProfileSubmitting.set(false);
        this.profileError.set(null);
        this.profileSuccess.set('Profile saved successfully!');
        this.patientSession.refreshPatient(patientId);
        this.profileCompleted.emit();
      },
      error: (err: any) => {
        this.isProfileSubmitting.set(false);
        this.profileSuccess.set(null);
        this.profileError.set(err?.error?.message || err?.message || 'Failed to complete profile registration. Please try again.');
      }
    });
  }
}
