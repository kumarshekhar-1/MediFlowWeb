import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { ClinicSessionService } from '../../../../core/services/clinic-session.service';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { SPECIALIZATION_OPTIONS } from '../../../../core/constants/global';

@Component({
  selector: 'app-clinic-admin-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule
  ],
  templateUrl: './clinic-admin-profile.component.html',
  styleUrl: './clinic-admin-profile.component.scss'
})
export class ClinicAdminProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly clinicSession = inject(ClinicSessionService);
  private readonly clinicApi = inject(ClinicApiService);

  isSubmitting = signal(false);
  apiSuccess = signal<string | null>(null);
  apiError = signal<string | null>(null);

  availableSpecialties = SPECIALIZATION_OPTIONS;

  clinicForm: FormGroup = this.fb.group({
    clinicName: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    clinicRegistrationNumber: [{ value: '', disabled: true }],
    ownerName: ['', [Validators.required, Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    ownerPhoneNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    ownerEmail: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    addressLine: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['Karnataka', [Validators.required]],
    pincode: ['', [Validators.required, Validators.pattern(/^[1-9]\d{5}$/)]],
    specializations: [['General Physician'], [Validators.required]],
    status: ['ACTIVE']
  });

  ngOnInit(): void {
    this.clinicSession.fetchClinic();
    this.populateClinicForm();
  }

  populateClinicForm(): void {
    const clinic = this.clinicSession.clinic();
    if (clinic) {
      const phone = clinic.ownerPhoneNumber?.startsWith('+91')
        ? clinic.ownerPhoneNumber.substring(3)
        : clinic.ownerPhoneNumber || '';

      this.clinicForm.patchValue({
        clinicName: clinic.clinicName || '',
        clinicRegistrationNumber: clinic.clinicRegistrationNumber || 'REG-' + clinic.clinicId,
        ownerName: clinic.ownerName || '',
        ownerPhoneNumber: phone,
        ownerEmail: clinic.ownerEmail || '',
        addressLine: clinic.addressLine || '',
        city: clinic.city || '',
        state: clinic.state || 'Karnataka',
        pincode: clinic.pincode || '',
        specializations: clinic.specializations && clinic.specializations.length > 0 ? clinic.specializations : ['General Physician'],
        status: clinic.status || 'ACTIVE'
      });
    } else {
      setTimeout(() => this.populateClinicForm(), 400);
    }
  }

  hasError(form: FormGroup, controlName: string, errorType?: string): boolean {
    const ctrl = form.get(controlName);
    if (!ctrl || !ctrl.touched) return false;
    return errorType ? ctrl.hasError(errorType) : ctrl.invalid;
  }

  onlyDigits(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPasteDigits(event: ClipboardEvent, form: FormGroup, controlName: string): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    const clean = pasted.replace(/\D/g, '').slice(0, 10);
    form.patchValue({ [controlName]: clean });
  }

  toggleSpecialty(spec: string): void {
    const control = this.clinicForm.get('specializations');
    if (!control) return;
    const current: string[] = control.value || [];
    if (current.includes(spec)) {
      if (current.length > 1) {
        control.setValue(current.filter(s => s !== spec));
        control.markAsTouched();
      }
    } else {
      control.setValue([...current, spec]);
      control.markAsTouched();
    }
  }

  isSpecialtySelected(spec: string): boolean {
    const val: string[] = this.clinicForm.get('specializations')?.value || [];
    return val.includes(spec);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/owner']);
  }

  submitClinic(): void {
    if (this.clinicForm.invalid) {
      this.clinicForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.apiError.set(null);
    this.apiSuccess.set(null);

    const formVal = this.clinicForm.getRawValue();
    const clinicId = this.clinicSession.clinic()?.clinicId || this.clinicSession.clinicId;

    const payload = {
      clinicName: formVal.clinicName.trim(),
      ownerName: formVal.ownerName.trim(),
      ownerPhoneNumber: '+91' + formVal.ownerPhoneNumber.trim(),
      ownerEmail: formVal.ownerEmail.trim(),
      addressLine: formVal.addressLine.trim(),
      city: formVal.city.trim(),
      state: formVal.state.trim(),
      pincode: formVal.pincode.trim(),
      specializations: formVal.specializations,
      status: formVal.status,
      isActive: formVal.status === 'ACTIVE'
    };

    this.clinicApi.updateClinic(clinicId, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.apiSuccess.set('Clinic profile updated successfully!');
        this.clinicSession.refreshClinic();
        setTimeout(() => this.apiSuccess.set(null), 4000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to update clinic profile.';
        this.apiError.set(msg);
      }
    });
  }
}
