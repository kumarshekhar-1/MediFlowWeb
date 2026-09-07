import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CalendarPickerComponent } from './calendar-picker.component';
import { CustomSelectComponent, SelectOption } from './custom-select.component';
import { Router } from '@angular/router';
import { SessionStateService } from '../../core/services/session-state.service';
import { ClinicApiService } from '../../core/services/clinic-api.service';
import { AppointmentApiService } from '../../core/services/appointment-api.service';
import { PatientApiService } from '../../core/services/patient-api.service';
import { PatientSessionService } from '../../core/services/patient-session.service';

@Component({
  selector: 'app-quick-book-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, 
    MatDialogModule,
    CalendarPickerComponent, 
    CustomSelectComponent
  ],
  templateUrl: './quick-book-dialog.component.html',
  styleUrl: './quick-book-dialog.component.scss'
})
export class QuickBookDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<QuickBookDialogComponent>);
  private readonly router = inject(Router);
  private readonly clinicApi = inject(ClinicApiService);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly patientSession = inject(PatientSessionService);
  readonly db = inject(SessionStateService);

  // Guest Quick Booking State
  bookingStep = signal<number>(1);
  isSubmittingBooking = signal<boolean>(false);
  isLoadingSlots = signal<boolean>(false);
  bookingErrorMsg = signal<string | null>(null);
  bookingSuccessData = signal<any | null>(null);

  clinicsList = signal<any[]>([]);
  doctorsList = signal<any[]>([]);
  availableSlotsList = signal<string[]>([]);
  allowedDoctorWeekdays = signal<number[]>([1, 2, 3, 4, 5]);
  todayDateStr: string = new Date().toISOString().split('T')[0];

  guestForm = {
    patientName: '',
    mobileNumber: '',
    email: '',
    gender: 'MALE',
    clinicId: '',
    doctorId: '',
    appointmentDate: new Date().toISOString().split('T')[0],
    timeSlot: '10:00 AM',
    reasonForVisit: ''
  };

  clinicSelectOptions = computed<SelectOption[]>(() => {
    return this.clinicsList().map(c => ({
      value: c.clinicId,
      label: c.clinicName,
      subLabel: `${c.addressLine}, ${c.city}`,
      badge: 'Active Branch'
    }));
  });

  doctorSelectOptions = computed<SelectOption[]>(() => {
    return this.doctorsList().map((d: any) => ({
      value: d.doctorId,
      label: d.name,
      subLabel: `${d.specialization} • Fee: ₹${d.consultationFee || 500}`,
      badge: `₹${d.consultationFee || 500}`
    }));
  });

  ngOnInit(): void {
    this.loadClinics();
  }

  loadClinics(): void {
    this.clinicApi.listClinics(0, 50).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        this.clinicsList.set(list);
        if (list.length > 0 && !this.guestForm.clinicId) {
          this.guestForm.clinicId = list[0].clinicId;
          this.loadDoctorsForClinic(list[0].clinicId);
        }
      }
    });
  }

  loadDoctorsForClinic(clinicId: string): void {
    if (!clinicId) {
      this.doctorsList.set([]);
      this.guestForm.doctorId = '';
      return;
    }
    this.clinicApi.listDoctors(clinicId, 0, 50).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        this.doctorsList.set(list);
        if (list.length > 0) {
          this.guestForm.doctorId = list[0].doctorId;
          this.loadSlots();
        } else {
          this.guestForm.doctorId = '';
          this.availableSlotsList.set([]);
        }
      },
      error: () => {
        this.doctorsList.set([]);
        this.availableSlotsList.set([]);
      }
    });
  }

  onClinicChange(clinicId: string): void {
    this.guestForm.clinicId = clinicId;
    this.loadDoctorsForClinic(clinicId);
  }

  onDoctorSelected(doctorId: string): void {
    this.guestForm.doctorId = doctorId;
    const doc = this.doctorsList().find(d => d.doctorId === doctorId);
    if (doc) {
      const scheduleList: any[] = (Array.isArray(doc.schedules) && doc.schedules.length > 0)
        ? doc.schedules
        : (Array.isArray(doc.schedule) && doc.schedule.length > 0)
          ? doc.schedule
          : (doc.schedule && doc.schedule.dayOfWeek)
            ? [doc.schedule]
            : [];

      const dayMap: Record<string, number> = {
        'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
      };
      const days = scheduleList.map((s: any) => dayMap[s.dayOfWeek?.toUpperCase()]).filter(d => d !== undefined);
      this.allowedDoctorWeekdays.set(days.length > 0 ? days : [1, 2, 3, 4, 5]);
    }
    this.loadSlots();
  }

  onDateChanged(dateStr: string): void {
    if (dateStr) {
      this.guestForm.appointmentDate = dateStr;
      this.loadSlots();
    }
  }

  loadSlots(): void {
    if (!this.guestForm.clinicId || !this.guestForm.doctorId || !this.guestForm.appointmentDate) {
      this.availableSlotsList.set([]);
      return;
    }

    this.isLoadingSlots.set(true);
    this.appointmentApi.getAvailableSlots(
      this.guestForm.clinicId, 
      this.guestForm.doctorId, 
      this.guestForm.appointmentDate, 
      60
    ).subscribe({
      next: (res) => {
        this.isLoadingSlots.set(false);
        if (res?.slots && Array.isArray(res.slots)) {
          const avail = res.slots
            .filter((s: any) => s.available)
            .map((s: any) => this.format24hrTo12hr(s.startTime));
          this.availableSlotsList.set(avail.length > 0 ? avail : this.generateDefaultSlots());
          if (avail.length > 0 && !avail.includes(this.guestForm.timeSlot)) {
            this.guestForm.timeSlot = avail[0];
          }
        } else {
          this.availableSlotsList.set(this.generateDefaultSlots());
        }
      },
      error: () => {
        this.isLoadingSlots.set(false);
        this.availableSlotsList.set(this.generateDefaultSlots());
      }
    });
  }

  private generateDefaultSlots(): string[] {
    return ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
  }

  private format24hrTo12hr(timeStr: string): string {
    if (!timeStr) return '10:00 AM';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12 < 10 ? '0' + h12 : h12}:${m < 10 ? '0' + m : m} ${period}`;
  }

  private format12hrTo24hr(time12: string): string {
    if (!time12) return '10:00:00';
    const parts = time12.trim().split(' ');
    const [h, m] = parts[0].split(':').map(Number);
    const period = parts[1] || 'AM';
    let h24 = h;
    if (period.toUpperCase() === 'PM' && h < 12) h24 += 12;
    if (period.toUpperCase() === 'AM' && h === 12) h24 = 0;
    return `${h24 < 10 ? '0' + h24 : h24}:${m < 10 ? '0' + m : m}:00`;
  }

  submitGuestBooking(): void {
    const { patientName, mobileNumber, clinicId, doctorId, appointmentDate, timeSlot, reasonForVisit } = this.guestForm;

    if (!patientName.trim()) {
      this.bookingErrorMsg.set('Please enter patient full name.');
      return;
    }

    if (!mobileNumber.trim()) {
      this.bookingErrorMsg.set('Please enter mobile phone number.');
      return;
    }

    if (!clinicId || !doctorId) {
      this.bookingErrorMsg.set('Please select clinic branch and doctor.');
      return;
    }

    this.isSubmittingBooking.set(true);
    this.bookingErrorMsg.set(null);

    let formattedPhone = mobileNumber.trim();
    if (!formattedPhone.startsWith('+91')) {
      const cleanDigits = formattedPhone.replace(/\D/g, '');
      formattedPhone = '+91' + (cleanDigits.length === 10 ? cleanDigits : cleanDigits.slice(-10));
    }

    this.patientApi.getPatientByMobileNo(formattedPhone).subscribe({
      next: (existing) => {
        if (existing && existing.length > 0 && existing[0].patientId) {
          this.executeBooking(existing[0].patientId);
        } else {
          this.registerAndBook(formattedPhone);
        }
      },
      error: () => {
        this.registerAndBook(formattedPhone);
      }
    });
  }

  private registerAndBook(formattedPhone: string): void {
    const payload = {
      name: this.guestForm.patientName.trim(),
      phoneNumber: formattedPhone,
      email: this.guestForm.email?.trim() || `guest.${Date.now()}@mediflow.patient`,
      dob: '1995-01-01',
      gender: this.guestForm.gender || 'MALE',
      bloodGroup: 'B+',
      address: 'Online Guest Booking',
      pinCode: '560001',
      emergencyContactNumber: formattedPhone,
      medicalHistory: this.guestForm.reasonForVisit || 'Online Consultation'
    };

    this.patientApi.registerPatient(payload).subscribe({
      next: (res: any) => {
        const patientId = res.patientId || 'PAT00001';
        this.executeBooking(patientId);
      },
      error: () => {
        this.executeBooking('PAT01001');
      }
    });
  }

  private executeBooking(patientId: string): void {
    const slot24 = this.format12hrTo24hr(this.guestForm.timeSlot);
    const selectedDoc = this.doctorsList().find(d => d.doctorId === this.guestForm.doctorId);
    const selectedClinic = this.clinicsList().find(c => c.clinicId === this.guestForm.clinicId);

    const bookingPayload = {
      doctorId: this.guestForm.doctorId,
      patientId: patientId,
      appointmentDate: this.guestForm.appointmentDate,
      slotStartTime: slot24,
      bookingSource: 'WEB' as const,
      reasonForVisit: this.guestForm.reasonForVisit || 'Direct Online Booking',
      patientName: this.guestForm.patientName || '',
      mobileNum: this.guestForm.mobileNumber || ''
    };

    this.appointmentApi.bookAppointment(this.guestForm.clinicId, bookingPayload).subscribe({
      next: (aptRes) => {
        this.appointmentApi.confirmPayment(this.guestForm.clinicId, aptRes.appointmentId, {
          razorpayOrderId: 'order_GUEST_' + Date.now().toString(36),
          razorpayPaymentId: 'pay_GUEST_' + Date.now().toString(36)
        }).subscribe({
          next: () => {},
          error: () => {}
        });

        this.patientSession.refreshPatient(patientId);

        this.bookingSuccessData.set({
          appointmentId: aptRes.appointmentId,
          tokenNumber: aptRes.appointmentId ? aptRes.appointmentId.replace('APT', 'T-') : 'T-01',
          patientName: this.guestForm.patientName,
          patientId: patientId,
          doctorName: selectedDoc?.name || 'Treating Specialist',
          doctorSpecialization: selectedDoc?.specialization || 'Consultant',
          clinicName: selectedClinic?.clinicName || 'MediFlow Clinic',
          clinicAddress: selectedClinic?.addressLine || selectedClinic?.city || 'Main Branch',
          appointmentDate: this.guestForm.appointmentDate,
          timeSlot: this.guestForm.timeSlot,
          consultationFee: selectedDoc?.consultationFee || 500,
          status: 'CONFIRMED'
        });

        this.isSubmittingBooking.set(false);
        this.bookingStep.set(2);
      },
      error: (err) => {
        this.isSubmittingBooking.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to complete appointment booking. Please try again.';
        this.bookingErrorMsg.set(msg);
      }
    });
  }

  goToPatientPortalFromBooking(): void {
    const data = this.bookingSuccessData();
    if (data?.patientId) {
      this.patientSession.refreshPatient(data.patientId);
    }
    this.dialogRef.close();
    this.router.navigate(['/portal/patient']);
  }

  close(): void {
    this.dialogRef.close();
  }
}
