import { Component, inject, signal, effect, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MapPinPickerComponent } from '../../../../shared/components/map-pin-picker.component';
import { ClinicSessionService } from '../../../../core/services/clinic-session.service';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { AuthTokenService } from '../../../../core/services/auth-token.service';

@Component({
  selector: 'app-clinic-profile-completion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MapPinPickerComponent
  ],
  templateUrl: './clinic-profile-completion.component.html',
  styleUrl: './clinic-profile-completion.component.scss'
})
export class ClinicProfileCompletionComponent {
  clinicSession = inject(ClinicSessionService);
  private readonly api = inject(ClinicApiService);
  private readonly db = inject(SessionStateService);
  private readonly fb = inject(FormBuilder);
  private readonly authToken = inject(AuthTokenService);

  profileCompleted = output<void>();

  profileFormGroup = this.fb.group({
    clinicName: ['', [Validators.required, Validators.minLength(3)]],
    ownerName: ['', [Validators.required, Validators.minLength(3)]],
    ownerEmail: ['', [Validators.required, Validators.email]],
    ownerPhoneNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    clinicRegistrationNumber: ['', [Validators.required]],
    addressLine: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  specializations = signal<string[]>([]);
  mapLat = 12.9719;
  mapLng = 77.6412;
  mapAddress = 'Indiranagar, Bengaluru';

  isProfileSubmitting = signal(false);
  profileError = signal<string | null>(null);

  specializationOptions = [
    'General Medicine', 'Pediatrics', 'Cardiology', 'Dermatology',
    'Orthopedics', 'Gynecology', 'Ophthalmology', 'Dental', 'ENT'
  ];

  constructor() {
    // Prefill initial values from login session immediately
    const loggedInUser = this.db.currentUser();
    const clinicNamePrefill = this.authToken.username() || '';
    if (loggedInUser) {
      this.profileFormGroup.patchValue({
        clinicName: clinicNamePrefill,
        ownerEmail: loggedInUser.email || '',
        ownerPhoneNumber: loggedInUser.phone ? loggedInUser.phone.replace(/^\+91/, '') : ''
      });
    }

    effect(() => {
      const clinic = this.clinicSession.clinic();
      if (clinic) {
        let rawPhone = clinic.ownerPhoneNumber || '';
        if (rawPhone.startsWith('+91')) {
          rawPhone = rawPhone.substring(3);
        }

        this.profileFormGroup.patchValue({
          clinicName: clinic.clinicName || this.profileFormGroup.get('clinicName')?.value || '',
          ownerName: clinic.ownerName || '',
          ownerEmail: clinic.ownerEmail || '',
          ownerPhoneNumber: rawPhone || this.profileFormGroup.get('ownerPhoneNumber')?.value || '',
          clinicRegistrationNumber: clinic.clinicRegistrationNumber || '',
          addressLine: clinic.addressLine || '',
          city: clinic.city || '',
          state: clinic.state || '',
          pincode: clinic.pincode || ''
        });

        if (clinic.specializations) {
          this.specializations.set(clinic.specializations);
        }
        if (clinic.latitude && clinic.longitude) {
          this.mapLat = clinic.latitude;
          this.mapLng = clinic.longitude;
          this.mapAddress = clinic.addressLine || '';
        }
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
    if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} characters required.`;
    if (control.errors['pattern']) {
      if (controlName === 'pincode') return 'PIN Code must be a 6-digit number.';
      if (controlName === 'ownerPhoneNumber') return 'Must be a valid 10-digit number starting with 6-9.';
    }
    return 'Invalid value.';
  }

  onMapLocationPicked(res: any) {
    this.mapLat = res.lat;
    this.mapLng = res.lng;
    this.profileFormGroup.patchValue({
      addressLine: res.formattedAddress,
      city: res.city,
      state: res.state,
      pincode: res.pincode
    });
  }

  onlyDigits(event: KeyboardEvent): boolean {
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPasteDigits(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const clean = pasted.replace(/\D/g, '').slice(0, 10);
    this.profileFormGroup.patchValue({ ownerPhoneNumber: clean });
  }

  toggleSpecialization(spec: string) {
    const current = this.specializations();
    if (current.includes(spec)) {
      this.specializations.set(current.filter(s => s !== spec));
    } else {
      this.specializations.set([...current, spec]);
    }
  }

  isSpecializationSelected(spec: string): boolean {
    return this.specializations().includes(spec);
  }

  submitProfileCompletion() {
    if (this.profileFormGroup.invalid) {
      this.profileFormGroup.markAllAsTouched();
      this.profileError.set('Please fix the validation errors marked in red.');
      return;
    }
    if (this.specializations().length === 0) {
      this.profileError.set('Please select at least one specialization.');
      return;
    }

    const clinicId = this.clinicSession.clinicId || this.db.currentClinicId();
    this.isProfileSubmitting.set(true);
    this.profileError.set(null);

    const formVals = this.profileFormGroup.value;

    let rawPhone = formVals.ownerPhoneNumber || '';
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const mobile10Digits = cleanDigits.slice(-10);
    const formattedPhone = '+91' + mobile10Digits;

    const payload = {
      clinicId: clinicId,
      clinicName: (formVals.clinicName || '').trim(),
      ownerName: (formVals.ownerName || '').trim(),
      ownerPhoneNumber: formattedPhone,
      ownerEmail: (formVals.ownerEmail || '').trim(),
      clinicRegistrationNumber: (formVals.clinicRegistrationNumber || '').trim(),
      addressLine: (formVals.addressLine || '').trim(),
      city: (formVals.city || '').trim(),
      state: (formVals.state || '').trim(),
      pincode: (formVals.pincode || '').trim(),
      specializations: this.specializations(),
      latitude: this.mapLat,
      longitude: this.mapLng
    };

    this.api.registerClinic(payload).subscribe({
      next: () => {
        this.isProfileSubmitting.set(false);
        this.clinicSession.refreshClinic();
        this.profileCompleted.emit();
      },
      error: (err: any) => {
        this.isProfileSubmitting.set(false);
        this.profileError.set(err?.error?.message || err?.message || 'Failed to register clinic profile.');
      }
    });
  }
}
