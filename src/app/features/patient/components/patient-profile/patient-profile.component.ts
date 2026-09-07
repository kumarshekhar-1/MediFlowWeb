import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Router } from '@angular/router';
import { PatientSessionService } from '../../../../core/services/patient-session.service';
import { PatientApiService, PatientRegistrationPayload } from '../../../../core/services/patient-api.service';
import { CustomSelectComponent, SelectOption } from '../../../../shared/components/custom-select.component';

@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CustomSelectComponent
  ],
  templateUrl: './patient-profile.component.html',
  styleUrl: './patient-profile.component.scss'
})
export class PatientProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly patientSession = inject(PatientSessionService);
  private readonly patientApi = inject(PatientApiService);

  isSubmitting = signal(false);
  apiSuccess = signal<string | null>(null);
  apiError = signal<string | null>(null);

  maxDate = new Date();

  genderOptions: SelectOption[] = [
    { label: 'Male', value: 'MALE' },
    { label: 'Female', value: 'FEMALE' },
    { label: 'Other', value: 'OTHER' }
  ];

  bloodGroupOptions: SelectOption[] = [
    { label: 'A+ (Positive)', value: 'A+' },
    { label: 'A- (Negative)', value: 'A-' },
    { label: 'B+ (Positive)', value: 'B+' },
    { label: 'B- (Negative)', value: 'B-' },
    { label: 'AB+ (Positive)', value: 'AB+' },
    { label: 'AB- (Negative)', value: 'AB-' },
    { label: 'O+ (Positive)', value: 'O+' },
    { label: 'O- (Negative)', value: 'O-' }
  ];

  patientForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    email: ['', [Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    phoneNumber: [{ value: '', disabled: true }],
    emergencyContactNumber: ['', [Validators.pattern(/^(\+91)?\s?[6-9]\d{9}$/)]],
    address: ['', [Validators.required]],
    pinCode: ['', [Validators.required, Validators.pattern(/^[1-9]\d{5}$/)]],
    dob: ['', [Validators.required]],
    gender: ['MALE', [Validators.required]],
    bloodGroup: ['O+', [Validators.required]],
    medicalHistory: ['']
  });

  ngOnInit(): void {
    this.patientSession.fetchPatient();
    this.populatePatientForm();
  }

  populatePatientForm(): void {
    const pat = this.patientSession.patient();
    if (pat) {
      const phone = pat.phoneNumber?.startsWith('+91')
        ? pat.phoneNumber.substring(3)
        : pat.phoneNumber || '';
      const emerg = pat.emergencyContactNumber?.startsWith('+91')
        ? pat.emergencyContactNumber.substring(3)
        : pat.emergencyContactNumber || '';

      let parsedDob: any = pat.dob;
      if (pat.dob && typeof pat.dob === 'string') {
        const d = new Date(pat.dob);
        if (!isNaN(d.getTime())) {
          parsedDob = d;
        }
      }

      this.patientForm.patchValue({
        name: pat.name || '',
        email: pat.email || '',
        phoneNumber: phone,
        emergencyContactNumber: emerg,
        address: pat.address || '',
        pinCode: pat.pinCode || '',
        dob: parsedDob || '',
        gender: pat.gender || 'MALE',
        bloodGroup: pat.bloodGroup || 'O+',
        medicalHistory: pat.medicalHistory || ''
      });
    } else {
      setTimeout(() => this.populatePatientForm(), 400);
    }
  }

  hasError(form: FormGroup, field: string, errorType?: string): boolean {
    const control = form.get(field);
    if (!control) return false;
    if (errorType) {
      return control.hasError(errorType) && (control.dirty || control.touched);
    }
    return control.invalid && (control.dirty || control.touched);
  }

  onlyDigits(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPasteDigits(event: ClipboardEvent, form: FormGroup, fieldName: string): void {
    event.preventDefault();
    const clipboardData = event.clipboardData;
    const pastedText = clipboardData?.getData('text') || '';
    const digitsOnly = pastedText.replace(/\D/g, '');
    form.get(fieldName)?.setValue(digitsOnly);
  }

  goBack(): void {
    this.router.navigate(['/portal/patient']);
  }

  submitPatient(): void {
    if (this.patientForm.invalid) {
      this.patientForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.apiSuccess.set(null);
    this.apiError.set(null);

    const formVal = this.patientForm.value;
    const currentPat = this.patientSession.patient();
    const patientId = currentPat?.patientId || this.patientSession.currentPatientId();

    let formattedDob = '';
    if (formVal.dob) {
      const d = new Date(formVal.dob);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        formattedDob = `${y}-${m}-${day}`;
      } else {
        formattedDob = String(formVal.dob);
      }
    }

    const payload: PatientRegistrationPayload = {
      name: formVal.name.trim(),
      email: formVal.email ? formVal.email.trim() : (currentPat?.email || ''),
      phoneNumber: currentPat?.phoneNumber || '',
      emergencyContactNumber: formVal.emergencyContactNumber ? (formVal.emergencyContactNumber.startsWith('+91') ? formVal.emergencyContactNumber.trim() : '+91' + formVal.emergencyContactNumber.trim()) : '',
      address: formVal.address.trim(),
      pinCode: formVal.pinCode.trim(),
      dob: formattedDob,
      gender: formVal.gender,
      bloodGroup: formVal.bloodGroup,
      medicalHistory: formVal.medicalHistory ? formVal.medicalHistory.trim() : '',
      patientId
    };

    this.patientApi.updatePatientDetails(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.apiSuccess.set('Patient profile updated successfully!');
        this.patientSession.refreshPatient(patientId);
        setTimeout(() => this.apiSuccess.set(null), 4000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to update patient profile.';
        this.apiError.set(msg);
      }
    });
  }
}
