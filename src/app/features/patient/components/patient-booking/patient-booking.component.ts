import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CustomSelectComponent, SelectOption } from '../../../../shared/components/custom-select.component';
import { CalendarPickerComponent } from '../../../../shared/components/calendar-picker.component';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { AppointmentApiService, CreateAppointmentPayload } from '../../../../core/services/appointment-api.service';
import { PatientSessionService } from '../../../../core/services/patient-session.service';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { Patient, Doctor } from '../../../../core/models/clinic.models';
import { asapScheduler } from 'rxjs';
import { observeOn } from 'rxjs/operators';

@Component({
  selector: 'app-patient-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CustomSelectComponent, CalendarPickerComponent],
  templateUrl: './patient-booking.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientBookingComponent implements OnInit, OnChanges {
  private readonly clinicApi = inject(ClinicApiService);
  private readonly appointmentApi = inject(AppointmentApiService);
  readonly patientSession = inject(PatientSessionService);
  private readonly db = inject(SessionStateService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() initialClinicId: string = '';
  @Input() initialDoctorId: string = '';
  @Output() bookingCompleted = new EventEmitter<void>();

  bookingClinicId: string = '';
  bookingDoctorId: string = '';
  bookingDate: string = '';
  bookingSlot: string = '';
  bookingReason: string = '';

  apiDoctors: any[] = [];
  apiDoctorsLoading: boolean = false;
  apiClinics: any[] = [];
  apiClinicsLoading: boolean = false;
  allowedDoctorWeekdays: number[] = [];
  todayDate: string = new Date().toISOString().split('T')[0];
  isBookingSubmitting: boolean = false;
  bookingSuccessMsg: string | null = null;
  bookingErrorMsg: string | null = null;
  availableSlots: string[] = [];
  selectedDoctorFullDetails: any = null;

  ngOnInit(): void {
    this.loadClinics();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const clinicChange = changes['initialClinicId'];
    const doctorChange = changes['initialDoctorId'];

    // Skip the first-change cycle — ngOnInit handles the initial load.
    // Only re-load when the parent passes NEW values after creation
    // (e.g. user picks a different doctor from discovery tab).
    const isSubsequentChange =
      (clinicChange && !clinicChange.isFirstChange()) ||
      (doctorChange && !doctorChange.isFirstChange());

    if (isSubsequentChange && this.initialClinicId) {
      this.bookingClinicId = this.initialClinicId;
      this.bookingDoctorId = this.initialDoctorId;
      this.loadDoctors(this.initialClinicId, !this.initialDoctorId);
    }
  }

  loadClinics(): void {
    if (this.apiClinicsLoading) return;
    this.apiClinicsLoading = true;
    this.bookingErrorMsg = null;
    this.clinicApi.listClinics(0, 50).pipe(observeOn(asapScheduler)).subscribe({
      next: (res) => {
        this.apiClinicsLoading = false;
        this.apiClinics = res?.content ?? (Array.isArray(res) ? res : []);
        this.cdr.markForCheck();

        // Chain the pre-selected doctors load strictly after clinics are successfully retrieved
        if (this.initialClinicId) {
          this.bookingClinicId = this.initialClinicId;
          this.bookingDoctorId = this.initialDoctorId;
          this.loadDoctors(this.initialClinicId, !this.initialDoctorId);
        }
      },
      error: () => {
        this.apiClinicsLoading = false;
        this.apiClinics = [];
        this.bookingErrorMsg = 'Failed to load clinics. Please check connection.';
        this.cdr.markForCheck();
      }
    });
  }

  loadDoctors(clinicId: string, autoSelectFirst: boolean = false): void {
    if (!clinicId) {
      this.apiDoctors = [];
      this.bookingDoctorId = '';
      return;
    }
    this.apiDoctorsLoading = true;
    this.clinicApi.listDoctors(clinicId).pipe(observeOn(asapScheduler)).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        this.apiDoctors = list;
        if (list.length > 0) {
          if (autoSelectFirst) {
            this.bookingDoctorId = list[0].doctorId;
            this.fetchDoctorScheduleDetails(clinicId, this.bookingDoctorId);
          } else if (this.bookingDoctorId && list.some((d: any) => d.doctorId === this.bookingDoctorId)) {
            this.fetchDoctorScheduleDetails(clinicId, this.bookingDoctorId);
          }
        } else {
          this.bookingDoctorId = '';
        }
        this.apiDoctorsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.apiDoctorsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onClinicSelected(clinicId: string): void {
    this.bookingClinicId = clinicId;
    this.bookingDoctorId = '';
    this.allowedDoctorWeekdays = [];
    this.availableSlots = [];
    this.bookingSlot = '';
    this.loadDoctors(clinicId, false);
  }

  onDoctorSelected(docId: string): void {
    this.bookingDoctorId = docId;
    this.bookingDate = '';
    this.bookingSlot = '';
    this.availableSlots = [];
    this.fetchDoctorScheduleDetails(this.bookingClinicId, docId);
  }

  onDateChanged(newDate: string): void {
    this.bookingDate = newDate;
    this.recalculateSlotsForDate(newDate);
  }

  fetchDoctorScheduleDetails(clinicId: string, doctorId: string): void {
    if (!doctorId || !clinicId) return;

    this.clinicApi.getDoctor(clinicId, doctorId).pipe(observeOn(asapScheduler)).subscribe({
      next: (doc) => {
        if (!doc) return;

        const dayMap: Record<string, number> = {
          'SUNDAY': 0, 'SUN': 0,
          'MONDAY': 1, 'MON': 1,
          'TUESDAY': 2, 'TUE': 2,
          'WEDNESDAY': 3, 'WED': 3,
          'THURSDAY': 4, 'THU': 4,
          'FRIDAY': 5, 'FRI': 5,
          'SATURDAY': 6, 'SAT': 6
        };

        const weekdays: number[] = [];
        const scheduleList: any[] = (Array.isArray(doc.schedules) && doc.schedules.length > 0)
          ? doc.schedules
          : (Array.isArray(doc.schedule) && doc.schedule.length > 0)
            ? doc.schedule
            : (doc.schedule && doc.schedule.dayOfWeek)
              ? [doc.schedule]
              : [];

        if (scheduleList.length > 0) {
          scheduleList.forEach((s: any) => {
            const d = s.dayOfWeek ? dayMap[s.dayOfWeek.toUpperCase()] : undefined;
            if (d !== undefined && !weekdays.includes(d)) {
              weekdays.push(d);
            }
          });
        }

        this.selectedDoctorFullDetails = doc;
        this.allowedDoctorWeekdays = [...weekdays];
        // Do not auto-select a date or calculate slots. Wait for manual date choice.
        this.cdr.markForCheck();
      },
      error: () => {
        this.allowedDoctorWeekdays = [];
        this.availableSlots = [];
        this.bookingSlot = '';
        this.cdr.markForCheck();
      }
    });
  }

  private convert24To12(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let hour = parseInt(parts[0], 10);
    const minute = parts[1] || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    const hourStr = String(hour).padStart(2, '0');
    return `${hourStr}:${minute} ${ampm}`;
  }

  recalculateSlotsForDate(dateStr: string): void {
    if (this.bookingClinicId && this.bookingDoctorId) {
      const intervalMins = this.selectedDoctorFullDetails?.avgConsultationTimeMinutes || 60;
      this.appointmentApi.getAvailableSlots(this.bookingClinicId, this.bookingDoctorId, dateStr, intervalMins)
        .pipe(observeOn(asapScheduler))
        .subscribe({
          next: (res) => {
            const list = Array.isArray(res) ? res : (res && Array.isArray(res.slots) ? res.slots : []);
            if (list.length > 0) {
              this.availableSlots = list
                .filter((s: any) => s.startTime && s.endTime)
                .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
                .map((s: any) => `${this.convert24To12(s.startTime)} - ${this.convert24To12(s.endTime)}`);
            } else {
              this.availableSlots = [];
            }

            if (this.availableSlots.length > 0 && !this.availableSlots.includes(this.bookingSlot)) {
              this.bookingSlot = this.availableSlots[0];
            } else if (this.availableSlots.length === 0) {
              this.bookingSlot = '';
            }
            this.cdr.markForCheck();
          },
          error: () => {
            this.availableSlots = [];
            this.bookingSlot = '';
            this.cdr.markForCheck();
          }
        });
    } else {
      this.availableSlots = [];
      this.bookingSlot = '';
    }
  }

  private ensureValidBookingDate(allowedDays: number[]): void {
    if (!allowedDays || allowedDays.length === 0) return;
    const parts = this.bookingDate.split('-').map(Number);
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (d < today) {
      d = new Date(today);
    }
    for (let i = 0; i < 7; i++) {
      if (allowedDays.includes(d.getDay())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        this.bookingDate = `${year}-${month}-${day}`;
        return;
      }
      d.setDate(d.getDate() + 1);
    }
  }

  confirmPatientBooking(): void {
    const pat = this.currentPatient;
    if (!pat) {
      this.bookingErrorMsg = 'Patient profile not loaded.';
      return;
    }

    if (!this.bookingClinicId) {
      this.bookingErrorMsg = 'Please select a clinic branch.';
      return;
    }

    if (!this.bookingDoctorId) {
      this.bookingErrorMsg = 'Please select a doctor.';
      return;
    }

    if (!this.bookingDate) {
      this.bookingErrorMsg = 'Please select a consultation date.';
      return;
    }

    if (!this.bookingSlot) {
      this.bookingErrorMsg = 'Please select a preferred time slot.';
      return;
    }

    this.isBookingSubmitting = true;
    this.bookingErrorMsg = null;
    this.bookingSuccessMsg = null;

    const slot24Hr = this.formatTimeTo24Hr(this.bookingSlot);
    const patientId = pat.id || this.patientSession.currentPatientId();

    // Pull name & phone directly from the live patient session (set on login)
    const livePat = this.patientSession.patient();
    const patientName = livePat?.name || pat?.name || '';
    const rawPhone = livePat?.phoneNumber || pat?.phone || '';
    // Ensure +91 prefix for backend validation
    const mobileNum = rawPhone.startsWith('+91') ? rawPhone : '+91' + rawPhone.replace(/\D/g, '').slice(-10);

    const payload: CreateAppointmentPayload = {
      doctorId: this.bookingDoctorId,
      patientId: patientId,
      appointmentDate: this.bookingDate,
      slotStartTime: slot24Hr,
      bookingSource: 'WEB',
      reasonForVisit: this.bookingReason ? this.bookingReason.trim() : 'General Consultation',
      patientName: patientName,
      mobileNum: mobileNum
    };

    this.appointmentApi.bookAppointment(this.bookingClinicId, payload).subscribe({
      next: (res) => {
        this.isBookingSubmitting = false;
        this.bookingSuccessMsg = `Appointment booked & confirmed! ID: ${res.appointmentId}`;
        
        this.appointmentApi.confirmPayment(this.bookingClinicId, res.appointmentId, {
          razorpayOrderId: 'order_EKfLwpHQBrSynr',
          razorpayPaymentId: 'pay_29QQoUBi66xm2f'
        }).subscribe({
          next: () => {}
        });

        setTimeout(() => {
          this.bookingSuccessMsg = null;
          this.bookingCompleted.emit();
        }, 1800);
      },
      error: (err) => {
        this.isBookingSubmitting = false;
        const msg = err?.error?.message || err?.message || 'Failed to book appointment on server.';
        this.bookingErrorMsg = msg;
      }
    });
  }

  formatTimeTo24Hr(slotTime: string): string {
    if (!slotTime) return '09:00:00';
    let s = slotTime.trim();
    if (s.includes('-')) {
      s = s.split('-')[0].trim();
    }
    const match12 = s.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])?$/);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = match12[2];
      const modifier = match12[3] ? match12[3].toUpperCase() : null;

      if (modifier === 'PM' && hours < 12) {
        hours += 12;
      } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
      }
      return `${String(hours).padStart(2, '0')}:${minutes}:00`;
    }
    const match24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match24) {
      const hours = String(parseInt(match24[1], 10)).padStart(2, '0');
      const minutes = match24[2].padStart(2, '0');
      const seconds = match24[3] ? match24[3].padStart(2, '0') : '00';
      return `${hours}:${minutes}:${seconds}`;
    }
    return '09:00:00';
  }

  get currentPatient(): Patient {
    const live = this.patientSession.patient();
    const mock = this.db.currentPatient();
    if (live) {
      return {
        id: live.patientId || this.patientSession.currentPatientId(),
        userId: mock?.userId || 'usr-live-patient',
        name: live.name || mock?.name || 'Patient',
        phone: live.phoneNumber || mock?.phone || '',
        email: live.email || mock?.email || '',
        dateOfBirth: live.dob || mock?.dateOfBirth || '',
        age: mock?.age || 28,
        gender: (live.gender || mock?.gender || 'MALE') as any,
        bloodGroup: live.bloodGroup || mock?.bloodGroup || 'B+',
        existingConditions: live.medicalHistory ? [live.medicalHistory] : mock?.existingConditions || [],
        address: live.address || mock?.address || '',
        createdAt: mock?.createdAt || new Date().toISOString()
      };
    }
    return mock;
  }

  get doctorsList(): Doctor[] {
    const apiList = this.apiDoctors;
    const clinics = this.apiClinics;
    if (apiList.length > 0) {
      return apiList.map((d: any) => {
        const cln = clinics.find((c: any) => c.clinicId === d.clinicId);
        const clinicName = cln?.clinicName || 'MediFlow Clinic';
        return {
          id: d.doctorId,
          userId: `usr-${d.doctorId}`,
          hospitalId: d.clinicId || '',
          hospitalName: d.clinicName || clinicName,
          name: d.name,
          phone: d.mobileNumber || '',
          email: d.email || '',
          registrationNo: d.registrationNumber || '',
          council: '',
          qualification: d.qualification || '',
          specialization: d.specialization || '',
          experienceYears: d.experienceYears || 0,
          consultationFee: Number(d.consultationFee || 0),
          languages: d.languages || [],
          workingDays: d.schedules && d.schedules.length > 0 
            ? d.schedules.map((s: any) => s.dayOfWeek ? (s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase()) : '')
            : [],
          workingHours: d.schedules && d.schedules.length > 0
            ? `${d.schedules[0].startTime?.substring(0, 5) || ''} - ${d.schedules[0].endTime?.substring(0, 5) || ''}`
            : '',
          slotDurationMins: d.avgConsultationTimeMinutes || 15,
          onlineConsultation: true
        };
      });
    }
    return [];
  }

  get clinicSelectOptions(): SelectOption[] {
    const apiList = this.apiClinics;
    if (apiList.length > 0) {
      return apiList.map((c: any) => ({
        value: c.clinicId,
        label: c.clinicName,
        subLabel: `${c.addressLine || c.city || ''} • ${c.specializations?.join(', ') || 'General'}`
      }));
    }
    return [];
  }

  get doctorSelectOptions(): SelectOption[] {
    return this.doctorsList.map(d => ({
      value: d.id,
      label: d.name,
      subLabel: `${d.specialization} • Fee: ₹${d.consultationFee}`,
      badge: `₹${d.consultationFee}`
    }));
  }

  get selectedDocWorkingDaysStr(): string {
    const doc = this.selectedDoctorFullDetails;
    if (!doc) return 'scheduled days';
    const scheduleList = Array.isArray(doc.schedules) ? doc.schedules : (doc.schedule ? [doc.schedule] : []);
    const days = scheduleList.map((s: any) => s.dayOfWeek ? (s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase()) : '');
    return days.filter(Boolean).join(', ');
  }

  get selectedDocScheduleLabel(): string {
    const doc = this.selectedDoctorFullDetails;
    if (!doc) return '';
    const scheduleList = Array.isArray(doc.schedules) ? doc.schedules : (doc.schedule ? [doc.schedule] : []);
    if (scheduleList.length === 0) return '';
    const formatted = scheduleList.map((s: any) => {
      const day = s.dayOfWeek ? (s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase().substring(0, 2)) : '';
      const start = s.startTime?.substring(0, 5) || '';
      const end = s.endTime?.substring(0, 5) || '';
      return `${day} (${start}-${end})`;
    });
    return formatted.join(', ');
  }

  get selectedDocObj(): Doctor | undefined {
    return this.doctorsList.find(d => d.id === this.bookingDoctorId);
  }
}
