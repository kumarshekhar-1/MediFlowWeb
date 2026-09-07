import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CalendarPickerComponent } from '../../shared/components/calendar-picker.component';
import { SessionStateService } from '../../core/services/session-state.service';
import { PdfGeneratorService } from '../../core/services/pdf-generator.service';
import { PatientApiService } from '../../core/services/patient-api.service';
import { AppointmentApiService, CreateAppointmentPayload } from '../../core/services/appointment-api.service';
import { ClinicApiService } from '../../core/services/clinic-api.service';
import { ClinicSessionService } from '../../core/services/clinic-session.service';
import { Appointment, Invoice, PaymentMethod } from '../../core/models/clinic.models';
import { QuickPatientRegistrationComponent } from './components/quick-patient-registration/quick-patient-registration.component';

@Component({
  selector: 'app-receptionist-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, 
    MatSelectModule, 
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CalendarPickerComponent,
    QuickPatientRegistrationComponent
  ],
  templateUrl: './receptionist-dashboard.component.html',
  styleUrl: './receptionist-dashboard.component.scss'
})
export class ReceptionistDashboardComponent implements OnInit {
  db = inject(SessionStateService);
  clinicSession = inject(ClinicSessionService);
  clinicApi = inject(ClinicApiService);
  pdfService = inject(PdfGeneratorService);
  patientApi = inject(PatientApiService);
  appointmentApi = inject(AppointmentApiService);

  // Live state signals from real APIs
  doctorsList = signal<any[]>([]);
  apiAppointments = signal<any[]>([]);
  isLoadingAppointments = signal<boolean>(false);
  foundPatients = signal<any[]>([]);
  dynamicTimeSlots = signal<string[]>([]);
  isLoadingSlots = signal<boolean>(false);

  filterDoctorId = 'ALL';
  searchQuery = '';

  ngOnInit(): void {
    this.clinicSession.fetchClinic();
    this.loadClinicDoctors();
  }

  get activeClinicId(): string {
    return this.clinicSession.clinicId || this.db.currentClinicId() || '';
  }

  get availableTimeSlots(): string[] {
    const dSlots = this.dynamicTimeSlots();
    if (dSlots.length > 0) return dSlots;
    return [
      '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', 
      '11:30 AM', '12:00 PM', '04:30 PM', '05:00 PM', '05:30 PM', '06:00 PM'
    ];
  }

  loadClinicDoctors(): void {
    const clinicId = this.activeClinicId;
    if (!clinicId) return;
    this.clinicApi.listDoctors(clinicId).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        this.doctorsList.set(list);
        if (list.length > 0 && (!this.filterDoctorId || this.filterDoctorId === 'ALL')) {
          const firstDocId = list[0].doctorId || list[0].id;
          this.filterDoctorId = firstDocId;
          this.bookingForm.doctorId = firstDocId;
        }
        this.loadTodayQueue();
      },
      error: (err) => console.warn('Could not load clinic doctors:', err)
    });
  }

  loadTodayQueue(): void {
    const clinicId = this.activeClinicId;
    const docId = (this.filterDoctorId && this.filterDoctorId !== 'ALL') 
      ? this.filterDoctorId 
      : (this.doctorsList()[0]?.doctorId || this.doctorsList()[0]?.id);

    if (!clinicId || !docId) {
      this.apiAppointments.set([]);
      this.isLoadingAppointments.set(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    this.isLoadingAppointments.set(true);

    this.appointmentApi.listByDoctor(clinicId, docId, today, 0, 100).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        this.apiAppointments.set(list);
        this.isLoadingAppointments.set(false);
      },
      error: () => this.isLoadingAppointments.set(false)
    });
  }

  onDoctorFilterChange(docId: string): void {
    this.filterDoctorId = docId;
    this.loadTodayQueue();
  }

  // Map API appointments to component Appointment models cleanly
  todayAppointments = computed<Appointment[]>(() => {
    const rawList = this.apiAppointments();
    if (rawList.length > 0) {
      return rawList.map((a: any): Appointment => ({
        id: a.appointmentId || a.id || '',
        clinicId: a.clinicId || this.activeClinicId,
        doctorId: a.doctorId || '',
        doctorName: a.doctorName || 'Doctor',
        doctorSpecialization: a.doctorSpecialization || '',
        patientId: a.patientId || '',
        patientName: a.patientName || 'Patient',
        patientPhone: a.patientPhone || a.mobileNumber || '',
        appointmentDate: a.appointmentDate || a.date || '',
        timeSlot: a.timeSlot || a.slotStartTime || '',
        status: (a.appointmentStatus || a.status || 'BOOKED') as any,
        reason: a.reasonForVisit || a.reason || '',
        tokenNumber: a.tokenNumber || 0,
        consultationFee: a.consultationFee || 0,
        createdAt: a.createdAt || new Date().toISOString()
      }));
    }
    return this.db.clinicAppointments();
  });

  waitingList = computed(() => 
    this.todayAppointments().filter(a => a.status === 'WAITING' || a.status === 'CHECKED_IN' || a.status === 'BOOKED' || a.status === 'CONFIRMED' || a.status === 'PENDING_PAYMENT')
  );

  inConsultList = computed(() => 
    this.todayAppointments().filter(a => a.status === 'IN_CONSULTATION')
  );

  pendingBillingList = computed(() => 
    this.todayAppointments().filter(a => a.status === 'CONSULTATION_COMPLETED')
  );

  completedList = computed(() => 
    this.todayAppointments().filter(a => a.status === 'PAID' || a.status === 'COMPLETED')
  );

  filteredAppointments = computed(() => {
    let list = this.todayAppointments();
    if (this.filterDoctorId !== 'ALL') {
      list = list.filter(a => a.doctorId === this.filterDoctorId);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(a => a.patientName.toLowerCase().includes(q) || a.patientPhone.includes(q));
    }
    return list;
  });

  // Modal State Signals
  showRegisterModal = signal<boolean>(false);
  showBookModal = signal<boolean>(false);
  showBillingModal = signal<boolean>(false);
  showReceiptModal = signal<boolean>(false);

  activeBillingApt: Appointment | null = null;
  activeInvoice = signal<Invoice | null>(null);

  // Booking Form State
  bookingForm = {
    patientId: '',
    patientName: '',
    patientPhoneSearch: '',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '10:00:00',
    reason: ''
  };

  // API Call: GET /patient/getPatientByMobileNo?mobileNo=...
  searchPatientByMobile(phone: string): void {
    if (!phone || phone.length < 5) return;
    this.patientApi.getPatientByMobileNo(phone).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res ? [res] : []);
        this.foundPatients.set(list);
        if (list.length > 0) {
          const p: any = list[0];
          this.bookingForm.patientId = p.patientId || p.mobileNum || p.phone || '';
          this.bookingForm.patientName = p.name || '';
        }
      },
      error: (err) => console.warn('Could not search patient by phone:', err)
    });
  }

  // API Call: GET /patient/getPatientDetails?patientId=...
  loadPatientDetails(patientId: string): void {
    if (!patientId) return;
    this.patientApi.getPatientDetails(patientId).subscribe({
      next: (res) => {
        if (res?.patientId) {
          this.bookingForm.patientId = res.patientId;
          this.bookingForm.patientName = res.name || '';
        }
      }
    });
  }

  // API Call: GET /appointments/availableSlots
  fetchAvailableSlots(): void {
    const clinicId = this.activeClinicId;
    const docId = this.bookingForm.doctorId;
    const date = this.bookingForm.date;

    if (!clinicId || !docId || !date) return;

    this.isLoadingSlots.set(true);
    this.appointmentApi.getAvailableSlots(clinicId, docId, date).subscribe({
      next: (res) => {
        const slots = (res || []).map((s: any) => s.startTime || s.slotTime || s.time || s);
        this.dynamicTimeSlots.set(slots);
        this.isLoadingSlots.set(false);
      },
      error: () => {
        this.isLoadingSlots.set(false);
      }
    });
  }

  onBookingDoctorChange(docId: string): void {
    this.bookingForm.doctorId = docId;
    this.fetchAvailableSlots();
  }

  onBookingDateChange(dateStr: string): void {
    this.bookingForm.date = dateStr;
    this.fetchAvailableSlots();
  }

  // API Call: POST /appointments/bookAppointment
  submitBookAppointment(): void {
    const clinicId = this.activeClinicId;
    if (!clinicId || !this.bookingForm.patientId || !this.bookingForm.doctorId) return;

    const slotTimeStr = this.bookingForm.timeSlot.includes(':') 
      ? (this.bookingForm.timeSlot.length === 5 ? `${this.bookingForm.timeSlot}:00` : this.bookingForm.timeSlot)
      : '10:00:00';

    const payload: CreateAppointmentPayload = {
      doctorId: this.bookingForm.doctorId,
      patientId: this.bookingForm.patientId,
      appointmentDate: this.bookingForm.date,
      slotStartTime: slotTimeStr,
      bookingSource: 'WALK_IN',
      reasonForVisit: this.bookingForm.reason || 'General Consultation',
      patientName: this.bookingForm.patientName || 'Patient',
      mobileNum: this.bookingForm.patientPhoneSearch || '9999999999'
    };

    this.appointmentApi.bookAppointment(clinicId, payload).subscribe({
      next: () => {
        this.showBookModal.set(false);
        this.loadTodayQueue();
      },
      error: (err) => {
        this.db.bookAppointment({
          clinicId,
          doctorId: this.bookingForm.doctorId,
          patientId: this.bookingForm.patientId,
          appointmentDate: this.bookingForm.date,
          timeSlot: this.bookingForm.timeSlot,
          reason: this.bookingForm.reason
        });
        this.showBookModal.set(false);
        this.loadTodayQueue();
      }
    });
  }

  // API Call: POST /appointments/markNoShow
  markNoShow(apt: Appointment): void {
    const clinicId = apt.clinicId || this.activeClinicId;
    this.appointmentApi.markNoShow(clinicId, apt.id).subscribe({
      next: () => this.loadTodayQueue(),
      error: () => this.db.updateAppointmentStatus(apt.id, 'NO_SHOW')
    });
  }

  // API Call: POST /appointments/markComplete
  markComplete(apt: Appointment): void {
    const clinicId = apt.clinicId || this.activeClinicId;
    this.appointmentApi.markComplete(clinicId, apt.id).subscribe({
      next: () => this.loadTodayQueue(),
      error: () => this.db.updateAppointmentStatus(apt.id, 'COMPLETED')
    });
  }

  // API Call: POST /appointments/cancelAppointment
  cancelAppointment(apt: Appointment): void {
    if (!confirm(`Are you sure you want to cancel the appointment for ${apt.patientName}?`)) return;
    const clinicId = apt.clinicId || this.activeClinicId;

    this.appointmentApi.cancelAppointment(clinicId, apt.id, 'Desk cancellation').subscribe({
      next: () => this.loadTodayQueue(),
      error: () => this.db.updateAppointmentStatus(apt.id, 'CANCELLED')
    });
  }

  checkInPatient(apt: Appointment): void {
    this.db.updateAppointmentStatus(apt.id, 'CHECKED_IN');
  }

  moveToWaiting(apt: Appointment): void {
    this.db.updateAppointmentStatus(apt.id, 'WAITING');
  }

  openRegisterModal(): void {
    this.showRegisterModal.set(true);
  }

  onPatientRegistered(): void {
    this.showRegisterModal.set(false);
    this.loadTodayQueue();
  }

  // POS Billing Desk State
  billItems: { serviceId: string; description: string; quantity: number; unitPrice: number; amount: number }[] = [];
  selectedServiceId = '';
  billDiscount = 0;
  selectedPaymentMethod: PaymentMethod = 'UPI';

  get billSubtotal(): number {
    return this.billItems.reduce((s, it) => s + it.amount, 0);
  }

  get billFinalTotal(): number {
    return Math.max(0, this.billSubtotal - (this.billDiscount || 0));
  }

  openBillingModal(apt: Appointment): void {
    this.activeBillingApt = apt;
    const fee = apt.consultationFee || 500;

    this.billItems = [
      {
        serviceId: '',
        description: `Consultation Fee (${apt.doctorName})`,
        quantity: 1,
        unitPrice: fee,
        amount: fee
      }
    ];
    this.billDiscount = 0;
    this.selectedPaymentMethod = 'UPI';
    this.showBillingModal.set(true);
  }

  addServiceToBill(): void {
    if (!this.selectedServiceId) return;
    const srv = this.db.services().find(s => s.id === this.selectedServiceId);
    if (srv) {
      this.billItems.push({
        serviceId: srv.id,
        description: srv.name,
        quantity: 1,
        unitPrice: srv.price,
        amount: srv.price
      });
    }
    this.selectedServiceId = '';
  }

  removeBillItem(idx: number): void {
    this.billItems.splice(idx, 1);
  }

  // API Call: POST /appointments/confirmPayment
  submitCollectPayment(): void {
    if (!this.activeBillingApt) return;
    const clinicId = this.activeBillingApt.clinicId || this.activeClinicId;
    const aptId = this.activeBillingApt.id;

    const payload = {
      razorpayOrderId: 'OFFLINE_ORDER_' + Date.now(),
      razorpayPaymentId: 'OFFLINE_PAY_' + Date.now()
    };

    this.appointmentApi.confirmPayment(clinicId, aptId, payload).subscribe({
      next: () => {
        const invoice = this.db.createInvoice({
          clinicId,
          patientId: this.activeBillingApt!.patientId,
          patientName: this.activeBillingApt!.patientName,
          patientPhone: this.activeBillingApt!.patientPhone,
          appointmentId: aptId,
          items: this.billItems,
          discount: this.billDiscount
        });
        this.db.recordPayment(invoice.id, this.billFinalTotal, this.selectedPaymentMethod);

        this.showBillingModal.set(false);
        this.activeInvoice.set(invoice);
        this.showReceiptModal.set(true);
        this.loadTodayQueue();
      },
      error: () => {
        const invoice = this.db.createInvoice({
          clinicId,
          patientId: this.activeBillingApt!.patientId,
          patientName: this.activeBillingApt!.patientName,
          patientPhone: this.activeBillingApt!.patientPhone,
          appointmentId: aptId,
          items: this.billItems,
          discount: this.billDiscount
        });
        this.db.recordPayment(invoice.id, this.billFinalTotal, this.selectedPaymentMethod);

        this.showBillingModal.set(false);
        this.activeInvoice.set(invoice);
        this.showReceiptModal.set(true);
        this.loadTodayQueue();
      }
    });
  }

  openInvoiceView(apt: Appointment): void {
    const inv = this.db.invoices().find(i => i.appointmentId === apt.id);
    if (inv) {
      this.activeInvoice.set(inv);
      this.showReceiptModal.set(true);
    } else {
      alert('No invoice generated for this appointment yet.');
    }
  }

  downloadInvoicePdf(): void {
    const inv = this.activeInvoice();
    if (inv) {
      this.pdfService.generateInvoicePdf(inv, { action: 'download' });
    }
  }

  printInvoicePdf(): void {
    const inv = this.activeInvoice();
    if (inv) {
      this.pdfService.generateInvoicePdf(inv, { action: 'print' });
    }
  }

  triggerPrint(): void {
    this.printInvoicePdf();
  }
}
