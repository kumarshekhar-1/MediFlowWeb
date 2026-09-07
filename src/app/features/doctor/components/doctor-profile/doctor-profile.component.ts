import { Component, inject, OnInit, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { DoctorSessionService } from '../../../../core/services/doctor-session.service';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { ClinicSessionService } from '../../../../core/services/clinic-session.service';

@Component({
  selector: 'app-doctor-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule
  ],
  templateUrl: './doctor-profile.component.html',
  styleUrl: './doctor-profile.component.scss'
})
export class DoctorProfileComponent implements OnInit {
  @Input() hideBackButton = false;

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly doctorSession = inject(DoctorSessionService);
  private readonly clinicApi = inject(ClinicApiService);
  private readonly clinicSession = inject(ClinicSessionService);

  isSubmitting = signal(false);
  apiSuccess = signal<string | null>(null);
  apiError = signal<string | null>(null);

  doctorForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    qualification: ['', [Validators.required]],
    specialization: ['', [Validators.required]],
    registrationNumber: [{ value: '', disabled: true }],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    consultationFee: [500, [Validators.required, Validators.min(0)]],
    avgConsultationTimeMinutes: [15, [Validators.required, Validators.min(5)]],
    status: ['ACTIVE']
  });

  ngOnInit(): void {
    this.doctorSession.fetchDoctor();
    this.populateDoctorForm();
  }

  populateDoctorForm(): void {
    const doc = this.doctorSession.doctor();
    if (doc) {
      const phone = doc.mobileNumber?.startsWith('+91')
        ? doc.mobileNumber.substring(3)
        : doc.mobileNumber || '';

      this.doctorForm.patchValue({
        name: doc.name || '',
        qualification: doc.qualification || '',
        specialization: doc.specialization || '',
        registrationNumber: doc.registrationNumber || '',
        mobileNumber: phone,
        email: doc.email || '',
        consultationFee: doc.consultationFee || 0,
        avgConsultationTimeMinutes: doc.avgConsultationTimeMinutes || 15,
        status: doc.status || 'ACTIVE'
      });
    } else {
      setTimeout(() => this.populateDoctorForm(), 400);
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
    this.router.navigate(['/dashboard/doctor']);
  }

  submitDoctor(): void {
    if (this.doctorForm.invalid) {
      this.doctorForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.apiSuccess.set(null);
    this.apiError.set(null);

    const formVal = this.doctorForm.value;
    const doc = this.doctorSession.doctor();
    const doctorId = doc?.doctorId || this.doctorSession.currentDoctorId();

    const payload = {
      name: formVal.name.trim(),
      mobileNumber: '+91' + formVal.mobileNumber.trim(),
      email: formVal.email.trim(),
      consultationFee: formVal.consultationFee,
      avgConsultationTimeMinutes: formVal.avgConsultationTimeMinutes,
      status: formVal.status,
      qualification: formVal.qualification.trim(),
      specialization: formVal.specialization.trim(),
      isActive: formVal.status === 'ACTIVE'
    };

    const clinicId = this.clinicSession.clinic()?.clinicId || this.clinicSession.clinicId;

    this.clinicApi.updateDoctor(clinicId, doctorId, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.apiSuccess.set('Doctor profile saved successfully!');
        this.doctorSession.refreshDoctor();
        setTimeout(() => this.apiSuccess.set(null), 4000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to update doctor profile.';
        this.apiError.set(msg);
      }
    });
  }
}
