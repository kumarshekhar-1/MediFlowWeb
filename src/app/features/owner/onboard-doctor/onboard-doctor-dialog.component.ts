import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ClinicApiService } from '../../../core/services/clinic-api.service';
import { ClinicSessionService } from '../../../core/services/clinic-session.service';
import { SessionStateService } from '../../../core/services/session-state.service';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { DoctorCreationPayload } from '../../../core/models/doctor.model';
import { SelectOption } from '../../../shared/components/custom-select.component';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

/** Custom validator to check if endTime is after startTime */
export const timeRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const startTime = control.get('startTime')?.value;
  const endTime = control.get('endTime')?.value;

  if (!startTime || !endTime) {
    return null;
  }

  if (startTime >= endTime) {
    return { invalidTimeRange: true };
  }
  return null;
};

/** FormArray level validator to check if schedules for the same day overlap */
export const schedulesOverlapValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const formArray = control as FormArray;
  const schedules = formArray.controls;

  // Keep track of day -> list of ranges
  const dayRanges: { [day: string]: { start: string; end: string; index: number }[] } = {};
  let hasOverlap = false;

  schedules.forEach((group, index) => {
    const day = group.get('dayOfWeek')?.value;
    const start = group.get('startTime')?.value;
    const end = group.get('endTime')?.value;

    if (!day || !start || !end || start >= end) {
      return;
    }

    if (!dayRanges[day]) {
      dayRanges[day] = [];
    }

    // Check if this overlaps with any existing range on the same day
    for (const range of dayRanges[day]) {
      // Overlap condition: startA < endB && startB < endA
      if (start < range.end && range.start < end) {
        hasOverlap = true;
      }
    }

    dayRanges[day].push({ start, end, index });
  });

  if (hasOverlap) {
    return { overlapDetected: true };
  }

  return null;
};

/**
 * Stand‑alone dialog for onboarding a new doctor.
 * Employs standard form controls, customized MatSelect dropdowns, and robust overlap validation.
 */
@Component({
  selector: 'app-onboard-doctor-dialog',
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
  templateUrl: './onboard-doctor-dialog.component.html',
  styleUrl: './onboard-doctor-dialog.component.scss',
})
export class OnboardDoctorDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<OnboardDoctorDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ClinicApiService);
  private readonly clinicSession = inject(ClinicSessionService);
  private readonly authToken = inject(AuthTokenService);
  readonly db = inject(SessionStateService);
  readonly data: any = inject(MAT_DIALOG_DATA, { optional: true });

  isEditMode = false;
  editDoctorId = '';

  registerSubmitting = signal(false);
  registerError = signal<string | null>(null);
  receptionistList = signal<{ receptionistId: string; name: string; mobileNumber: string }[]>([]);

  readonly daysOfWeekList: SelectOption[] = [
    { value: 'MONDAY', label: 'Monday', badge: 'Mon' },
    { value: 'TUESDAY', label: 'Tuesday', badge: 'Tue' },
    { value: 'WEDNESDAY', label: 'Wednesday', badge: 'Wed' },
    { value: 'THURSDAY', label: 'Thursday', badge: 'Thu' },
    { value: 'FRIDAY', label: 'Friday', badge: 'Fri' },
    { value: 'SATURDAY', label: 'Saturday', badge: 'Sat' },
    { value: 'SUNDAY', label: 'Sunday', badge: 'Sun' }
  ];

  // Generate 24 hours of 30-minute slots:
  readonly timeSlotsList: { value: string; label: string }[] = this.generateTimeSlots();

  generateTimeSlots(): { value: string; label: string }[] {
    const slots: { value: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const value = `${hh}:${mm}`;

        const period = h >= 12 ? 'PM' : 'AM';
        let displayHour = h % 12;
        if (displayHour === 0) displayHour = 12;
        const displayH = String(displayHour).padStart(2, '0');
        const label = `${displayH}:${mm} ${period}`;

        slots.push({ value, label });
      }
    }
    return slots;
  }

  readonly doctorForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\S+(?:\s+\S+)*$/)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    registrationNumber: ['', Validators.required],
    specialization: ['', Validators.required],
    email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    qualification: [''],
    avgConsultationTimeMinutes: [15, [Validators.required, Validators.min(1)]],
    consultationFee: [500, [Validators.required, Validators.min(0)]],
    receptionistId: [''],
    schedules: this.fb.array([], { validators: schedulesOverlapValidator })
  });

  ngOnInit(): void {
    // Fetch receptionist list from API
    const clinicId = this.clinicSession.clinic()?.clinicId ?? '';
    if (clinicId) {
      this.api.listReceptionists(clinicId).subscribe({
        next: (list) => this.receptionistList.set(list),
        error: () => {}
      });
    }

    // Check if editing an existing doctor
    if (this.data?.doctor) {
      this.isEditMode = true;
      const doc = this.data.doctor;
      this.editDoctorId = doc.doctorId;

      // Strip +91 prefix for the mobile field
      const mobile = doc.mobileNumber?.startsWith('+91')
        ? doc.mobileNumber.substring(3)
        : doc.mobileNumber || '';

      this.doctorForm.patchValue({
        name: doc.name || '',
        mobileNumber: mobile,
        registrationNumber: doc.registrationNumber || '',
        specialization: doc.specialization || '',
        email: doc.email || '',
        qualification: doc.qualification || '',
        avgConsultationTimeMinutes: doc.avgConsultationTimeMinutes || 15,
        consultationFee: doc.consultationFee || 500,
        receptionistId: doc.receptionistId || ''
      });

      // Pre-fill schedules — API returns 'schedules' (plural)
      const existingSchedules = doc.schedules || doc.schedule || [];
      if (existingSchedules.length > 0) {
        existingSchedules.forEach((sch: any) => {
          const startTime = sch.startTime ? sch.startTime.substring(0, 5) : '09:00';
          const endTime = sch.endTime ? sch.endTime.substring(0, 5) : '17:00';
          const group = this.fb.group({
            dayOfWeek: [sch.dayOfWeek || 'MONDAY', Validators.required],
            startTime: [startTime, Validators.required],
            endTime: [endTime, Validators.required]
          }, { validators: timeRangeValidator });
          this.schedulesFormArray.push(group);
        });
      } else {
        this.addSchedule();
      }
    } else {
      // Create mode — add one default schedule
      this.addSchedule();
    }
  }

  get schedulesFormArray(): FormArray {
    return this.doctorForm.get('schedules') as FormArray;
  }

  addSchedule() {
    const group = this.fb.group({
      dayOfWeek: ['MONDAY', Validators.required],
      startTime: ['09:00', Validators.required],
      endTime: ['17:00', Validators.required]
    }, { validators: timeRangeValidator });
    this.schedulesFormArray.push(group);
  }

  removeSchedule(index: number) {
    if (this.schedulesFormArray.length > 1) {
      this.schedulesFormArray.removeAt(index);
    }
  }

  hasError(controlName: string, errorType: string = ''): boolean {
    const control = this.doctorForm.get(controlName);
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
      
      this.doctorForm.patchValue({ [controlName]: finalVal });
      this.doctorForm.get(controlName)?.markAsTouched();
    }
  }

  getSelectedDayLabel(value: string): string {
    const found = this.daysOfWeekList.find(d => d.value === value);
    return found ? found.label : '';
  }

  getSelectedDayBadge(value: string): string {
    const found = this.daysOfWeekList.find(d => d.value === value);
    return found ? found.badge || '' : '';
  }

  getSelectedTimeLabel(value: string): string {
    const found = this.timeSlotsList.find(t => t.value === value);
    return found ? found.label : '';
  }

  submit() {
    if (this.doctorForm.invalid) {
      this.doctorForm.markAllAsTouched();
      this.schedulesFormArray.controls.forEach(c => c.markAsTouched());
      return;
    }

    if (this.schedulesFormArray.length === 0) {
      this.registerError.set('At least one schedule is required');
      return;
    }

    this.registerSubmitting.set(true);
    this.registerError.set(null);

    const formVal = this.doctorForm.value;
    const clinicId = this.clinicSession.clinic()?.clinicId
      || this.authToken.clinicId()
      || this.db.currentClinicId()
      || this.clinicSession.clinicId;

    if (!clinicId) {
      this.registerSubmitting.set(false);
      this.registerError.set('Clinic ID not available. Please log out and log back in.');
      return;
    }

    if (this.isEditMode) {
      // Update mode — send only updatable fields
      const updatePayload: any = {
        name: formVal.name.trim(),
        mobileNumber: '+91' + formVal.mobileNumber.trim(),
        specialization: formVal.specialization.trim(),
        email: formVal.email.trim(),
        qualification: formVal.qualification?.trim() || 'MBBS',
        avgConsultationTimeMinutes: Number(formVal.avgConsultationTimeMinutes),
        consultationFee: Number(formVal.consultationFee),
        receptionistId: formVal.receptionistId || null,
        schedules: formVal.schedules.map((s: any) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime
        }))
      };

      this.api.updateDoctor(clinicId, this.editDoctorId, updatePayload).subscribe({
        next: () => {
          this.registerSubmitting.set(false);
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.registerSubmitting.set(false);
          const errorMsg = err?.error?.message || err?.message || 'Update failed. Please try again.';
          this.registerError.set(errorMsg);
        },
      });
    } else {
      // Create mode
      const payload: DoctorCreationPayload = {
        name: formVal.name.trim(),
        mobileNumber: '+91' + formVal.mobileNumber.trim(),
        registrationNumber: formVal.registrationNumber.trim(),
        specialization: formVal.specialization.trim(),
        email: formVal.email.trim(),
        qualification: formVal.qualification?.trim() || 'MBBS',
        avgConsultationTimeMinutes: Number(formVal.avgConsultationTimeMinutes),
        consultationFee: Number(formVal.consultationFee),
        receptionistId: formVal.receptionistId?.trim() || undefined,
        schedules: formVal.schedules.map((s: any) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime
        }))
      };

      this.api.addDoctor(clinicId, payload).subscribe({
        next: () => {
          this.registerSubmitting.set(false);
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.registerSubmitting.set(false);
          const errorMsg = err?.error?.message || err?.message || 'Onboarding failed. Please try again.';
          this.registerError.set(errorMsg);
          console.error('Onboard doctor API error:', err);
        },
      });
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
