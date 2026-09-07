import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ClinicApiService } from '../../../core/services/clinic-api.service';
import { ClinicSessionService } from '../../../core/services/clinic-session.service';

@Component({
  selector: 'app-edit-clinic-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './edit-clinic-dialog.component.html',
  styleUrl: './edit-clinic-dialog.component.scss'
})
export class EditClinicDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<EditClinicDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ClinicApiService);
  readonly clinicSession = inject(ClinicSessionService);
  readonly data: any = inject(MAT_DIALOG_DATA, { optional: true });

  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  availableSpecialties: string[] = [
    'General Physician',
    'Cardiology',
    'Pediatrics',
    'Dermatology',
    'Orthopedics',
    'Gynecology',
    'ENT',
    'Dental',
    'Neurology',
    'Ophthalmology'
  ];

  clinicForm: FormGroup = this.fb.group({
    clinicName: ['', [Validators.required, Validators.maxLength(150)]],
    ownerName: ['', [Validators.required]],
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
    const clinic = this.data?.clinic || this.clinicSession.clinic();
    if (clinic) {
      const phone = clinic.ownerPhoneNumber?.startsWith('+91')
        ? clinic.ownerPhoneNumber.substring(3)
        : clinic.ownerPhoneNumber || '';

      this.clinicForm.patchValue({
        clinicName: clinic.clinicName || '',
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
    }
  }

  toggleSpecialty(spec: string): void {
    const current: string[] = this.clinicForm.get('specializations')?.value || [];
    if (current.includes(spec)) {
      if (current.length > 1) {
        this.clinicForm.patchValue({ specializations: current.filter(s => s !== spec) });
      }
    } else {
      this.clinicForm.patchValue({ specializations: [...current, spec] });
    }
    this.clinicForm.get('specializations')?.markAsTouched();
  }

  isSpecialtySelected(spec: string): boolean {
    const current: string[] = this.clinicForm.get('specializations')?.value || [];
    return current.includes(spec);
  }

  submit(): void {
    if (this.clinicForm.invalid) {
      this.clinicForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formVal = this.clinicForm.value;
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

    this.api.updateClinic(clinicId, payload).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.clinicSession.refreshClinic();
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to update clinic. Please try again.';
        this.errorMessage.set(msg);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
