import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { SessionStateService } from '../../core/services/session-state.service';
import { PdfGeneratorService } from '../../core/services/pdf-generator.service';
import { DoctorSessionService } from '../../core/services/doctor-session.service';
import { AppointmentApiService } from '../../core/services/appointment-api.service';
import { PrescriptionApiService } from '../../core/services/prescription-api.service';
import { Appointment, Medicine, PrescriptionItem, Prescription, Doctor, Patient } from '../../core/models/clinic.models';
import { DoctorProfileComponent } from './components/doctor-profile/doctor-profile.component';
import { PatientApiService } from '../../core/services/patient-api.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PrescriptionDetailsDialogComponent } from '../../shared/components/prescription-details-dialog.component';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, 
    MatSelectModule, 
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    DoctorProfileComponent
  ],
  templateUrl: './doctor-dashboard.component.html',
  styleUrl: './doctor-dashboard.component.scss'
})
export class DoctorDashboardComponent implements OnInit {
  db = inject(SessionStateService);
  doctorSession = inject(DoctorSessionService);
  appointmentApi = inject(AppointmentApiService);
  prescriptionApi = inject(PrescriptionApiService);
  patientApi = inject(PatientApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  selectedDate = signal<string>(new Date().toISOString().split('T')[0]);
  apiDoctorAppointments = signal<any[]>([]);
  isLoadingAppointments = signal<boolean>(false);
  isSavingPrescription = signal<boolean>(false);
  isViewingRx = signal<boolean>(false);
  viewRxLoading = signal<boolean>(false);
  viewRxPrescriptionId = signal<string | null>(null);
  completedRx = signal<any>(null);             // raw API Rx for the selected completed appointment
  isLoadingCompletedRx = signal<boolean>(false);

  selectedDateObj = computed<Date>(() => {
    const s = this.selectedDate();
    if (!s) return new Date();
    const parts = s.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  });

  selectedDateFormatted = computed<string>(() => {
    const s = this.selectedDate();
    if (!s) return 'Select Date';
    const parts = s.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  });

  isTodaySelected = computed<boolean>(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.selectedDate() === today;
  });

  constructor() {
    effect(() => {
      const isLoaded = this.doctorSession.isLoaded();
      const live = this.doctorSession.doctor();
      const date = this.selectedDate();

      if (isLoaded && live && live.doctorId) {
        this.loadDoctorAppointments(date);
      }
    });
  }

  ngOnInit(): void {
    const doctorId = this.route.snapshot.queryParamMap.get('doctorId');
    if (doctorId) {
      this.doctorSession.refreshDoctor(doctorId);
    } else {
      this.doctorSession.fetchDoctor();
    }
  }

  get isProfileIncomplete(): boolean {
    const live = this.doctorSession.doctor();
    if (!live) return true;
    return !live.name || live.name === '—' || !live.specialization || live.specialization === '—' || !live.qualification || live.qualification === '—';
  }

  loadDoctorAppointments(dateStr?: string): void {
    const live = this.doctorSession.doctor();
    const docId = live?.doctorId || this.doctorSession.currentDoctorId();
    const clinicId = live?.clinicId;
    const targetDate = dateStr || this.selectedDate();

    if (!docId || !clinicId) {
      return;
    }

    this.isLoadingAppointments.set(true);
    this.appointmentApi.listByDoctor(clinicId, docId, targetDate, 0, 50).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        this.apiDoctorAppointments.set(list);
        this.isLoadingAppointments.set(false);
      },
      error: () => {
        this.isLoadingAppointments.set(false);
      }
    });
  }

  calculateAge(dob: string): number {
    if (!dob) return 30;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return 30;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  onDateChange(newDate: string): void {
    if (newDate && newDate !== this.selectedDate()) {
      this.selectedDate.set(newDate);
    }
  }

  onMatDateSelected(d: Date | null): void {
    if (d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      this.onDateChange(`${y}-${m}-${day}`);
    }
  }

  setToday(): void {
    const today = new Date().toISOString().split('T')[0];
    this.onDateChange(today);
  }

  activeDoctor = computed<Doctor>(() => {
    const live = this.doctorSession.doctor();
    const mock = this.db.currentDoctor();
    if (live) {
      return {
        id: live.doctorId || this.doctorSession.currentDoctorId(),
        userId: mock?.userId || 'usr-live-doctor',
        hospitalId: live.clinicId || 'CLN00001',
        name: live.name || 'Doctor',
        phone: live.mobileNumber || '',
        email: live.email || '',
        specialization: live.specialization || 'General Physician',
        qualification: live.qualification || 'MBBS',
        registrationNo: live.registrationNumber || '',
        council: 'Medical Council',
        experienceYears: 8,
        consultationFee: Number(live.consultationFee ?? 500),
        languages: ['English', 'Hindi'],
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        workingHours: '09:00 AM - 05:00 PM',
        slotDurationMins: Number(live.avgConsultationTimeMinutes ?? 15),
        onlineConsultation: true,
        avatar: mock?.avatar
      };
    }
    return {
      ...mock,
      id: this.doctorSession.currentDoctorId() || 'DOC00001',
      hospitalId: 'CLN00001'
    };
  });

  myTodayAppointments = computed<Appointment[]>(() => {
    const apiList = this.apiDoctorAppointments();
    const doc = this.activeDoctor();

    if (apiList && apiList.length > 0) {
      return apiList.map((a: any) => {
        const formattedTime = a.slotStartTime
          ? this.format24HrToAmPm(a.slotStartTime)
          : '';

        return {
          id: a.appointmentId,
          clinicId: a.clinicId,
          doctorId: a.doctorId,
          doctorName: a.doctorName || doc?.name || '',
          doctorSpecialization: a.doctorSpecialization || doc?.specialization || '',
          patientId: a.patientId,
          patientName: a.patientName || `Patient (${a.patientId})`,
          patientPhone: a.patientPhone || '',
          patientAge: a.patientAge ?? undefined,
          patientGender: a.patientGender || undefined,
          appointmentDate: a.appointmentDate,
          timeSlot: formattedTime,
          status: (a.status || '') as any,
          tokenNumber: a.appointmentId ? a.appointmentId.replace('APT', 'T-') : '',
          queuePosition: 1,
          reason: a.reasonForVisit || '',
          consultationFee: Number(a.consultationFee || doc?.consultationFee || 0),
          createdAt: a.createdAt || new Date().toISOString()
        };
      });
    }

    return [];
  });

  waitingPatients = computed(() => 
    this.myTodayAppointments().filter(a => 
      ['WAITING', 'CHECKED_IN', 'CONFIRMED', 'PENDING_PAYMENT', 'BOOKED'].includes(a.status)
    )
  );

  isConsultationDisabled = computed<boolean>(() => {
    const apt = this.selectedAppointment();
    if (!apt) return false;
    return apt.status === 'RESCHEDULED' || apt.status === 'CANCELLED';
  });

  private readonly COMPLETED_STATUSES = ['CONSULTATION_COMPLETED', 'COMPLETED', 'PAID', 'BILL_GENERATED'];

  isCompletedAppointment = computed<boolean>(() => {
    const apt = this.selectedAppointment();
    if (!apt) return false;
    return this.COMPLETED_STATUSES.includes(apt.status);
  });

  inConsultationPatient = computed(() => 
    this.myTodayAppointments().find(a => a.status === 'IN_CONSULTATION')
  );

  completedToday = computed(() => 
    this.myTodayAppointments().filter(a => ['CONSULTATION_COMPLETED', 'BILL_GENERATED', 'PAID', 'COMPLETED'].includes(a.status))
  );

  selectedAppointment = signal<Appointment | null>(null);
  selectedPatient = computed<Patient | null>(() => {
    const apt = this.selectedAppointment();
    if (!apt) return null;
    return {
      id: apt.patientId,
      userId: 'usr-live-patient',
      name: apt.patientName || 'Guest Patient',
      phone: apt.patientPhone || '',
      email: '',
      dateOfBirth: '',
      age: apt.patientAge,
      gender: (apt.patientGender || undefined) as any,
      address: '',
      bloodGroup: '',
      existingConditions: [],
      createdAt: new Date().toISOString()
    };
  });

  apiPastPrescriptions = signal<any[]>([]);

  patientPastPrescriptions = computed(() => {
    const all = this.apiPastPrescriptions();
    const apt = this.selectedAppointment();
    // If the selected appointment is completed, its prescription is already shown
    // in the main read-only view — exclude it from the past history list.
    if (apt && this.COMPLETED_STATUSES?.includes(apt.status)) {
      return all.filter(rx => rx.appointmentId !== apt.id);
    }
    return all;
  });

  showHistoryDrawer = signal<boolean>(false);
  showPrintModal = signal<boolean>(false);
  activePreviewRx = signal<Prescription | null>(null);

  // Active Consultation Workbench State
  consultationForm = {
    symptomsText: '',
    diagnosis: '',
    clinicalNotes: ''
  };

  diagnosisSuggestions = signal<any[]>([]);
  showDiagnosisDropdown = signal<boolean>(false);

  onDiagnosisInput(val: string): void {
    this.consultationForm.diagnosis = val;
    const q = val.trim();
    if (q.length >= 2) {
      this.prescriptionApi.suggestDiagnosis(q, 8).subscribe({
        next: (res) => {
          this.diagnosisSuggestions.set(res || []);
          this.showDiagnosisDropdown.set(!!(res && res.length > 0));
        },
        error: () => {
          this.diagnosisSuggestions.set([]);
          this.showDiagnosisDropdown.set(false);
        }
      });
    } else {
      this.diagnosisSuggestions.set([]);
      this.showDiagnosisDropdown.set(false);
    }
  }

  selectDiagnosis(item: any): void {
    const diagName = item.diseaseName || item.name || item;
    this.consultationForm.diagnosis = diagName;
    this.diagnosisSuggestions.set([]);
    this.showDiagnosisDropdown.set(false);

    if (this.medSearchQuery.trim()) {
      this.filterMedicines();
    }
  }

  // Fast Rx Builder State
  medSearchQuery: string = '';
  searchResults: Medicine[] = [];
  rxItems: Omit<PrescriptionItem, 'id'>[] = [];

  // Advice & Followup
  standardAdviceList = [
    'Drink plenty of warm fluids & stay hydrated',
    'Adequate bed rest for 2-3 days',
    'Avoid spicy, fried and oily foods',
    'Steam inhalation twice daily for 5 minutes',
    'Gargle with warm salt water 3 times a day',
    'Monitor blood pressure daily in the morning',
    'Follow up if fever persists beyond 3 days'
  ];
  selectedAdvice: string[] = [];
  customAdviceText: string = '';

  followUpDays: number = 0;
  followUpDate: string = '';
  followUpDateObj: Date | null = null;

  selectAppointment(apt: Appointment) {
    this.selectedAppointment.set(apt);
    this.resetForm();
    this.completedRx.set(null);

    if (apt.reason) {
      this.consultationForm.symptomsText = apt.reason;
    }

    // Load past patient prescriptions from API
    this.loadPastPrescriptions(apt.clinicId, apt.patientId);

    // For COMPLETED appointments: load prescription as read-only view, not into builder
    if (this.COMPLETED_STATUSES.includes(apt.status)) {
      this.isLoadingCompletedRx.set(true);
      this.prescriptionApi.getPrescriptionByAppointment(apt.clinicId, apt.id).subscribe({
        next: (rx) => {
          this.isLoadingCompletedRx.set(false);
          this.completedRx.set(rx || null);
        },
        error: () => {
          this.isLoadingCompletedRx.set(false);
          this.completedRx.set(null);
        }
      });
      return; // Skip pre-filling the builder for completed appointments
    }

    // For active/in-progress appointments: pre-fill builder if prescription exists
    this.prescriptionApi.getPrescriptionByAppointment(apt.clinicId, apt.id).subscribe({
      next: (existing) => {
        if (existing) {
          this.consultationForm.diagnosis = existing.diagnosis;
          this.consultationForm.clinicalNotes = existing.notes || '';
          
          const medicinesList = existing.medicines || [];
          this.rxItems = medicinesList.map(it => {
            const freqStr = it.timing ? `${it.morningQty}-${it.afternoonQty}-${it.nightQty} (${it.timing})` : `${it.morningQty}-${it.afternoonQty}-${it.nightQty}`;
            return {
              medicineId: 'med-' + Date.now(),
              medicineName: it.medicineName,
              genericName: '',
              strength: '',
              form: (it.dosage ? it.dosage.split(' ')[1] : 'Tablet') as any,
              dosage: it.dosage || '1 Tablet',
              frequency: freqStr,
              duration: `${it.durationDays} Days`,
              route: it.route || 'Oral',
              instructions: it.instructions || ''
            };
          });
          
          this.selectedAdvice = existing.investigationsAdvised || [];
          this.followUpDate = existing.followUpDate || '';
          if (existing.followUpDate) {
            this.followUpDateObj = new Date(existing.followUpDate);
          }
        }
      },
      error: () => {
        // Safe to ignore if not found
      }
    });
  }

  loadPastPrescriptions(clinicId: string, patientId: string): void {
    this.prescriptionApi.listByPatient(clinicId, patientId, 0, 100).subscribe({
      next: (res) => {
        const content = res?.content ?? (Array.isArray(res) ? res : []);
        this.apiPastPrescriptions.set(content);
      },
      error: () => {
        this.apiPastPrescriptions.set([]);
      }
    });
  }

  startConsultation(apt: Appointment) {
    this.selectAppointment(apt);
    this.db.updateAppointmentStatus(apt.id, 'IN_CONSULTATION');
  }

  markNoShow(apt: Appointment) {
    if (!apt) return;
    this.appointmentApi.markNoShow(apt.clinicId, apt.id).subscribe({
      next: () => {
        this.db.updateAppointmentStatus(apt.id, 'NO_SHOW');
        this.loadDoctorAppointments();
      },
      error: () => {
        this.db.updateAppointmentStatus(apt.id, 'NO_SHOW');
      }
    });
  }

  markCompleteDirect(apt: Appointment) {
    if (!apt) return;
    this.appointmentApi.markComplete(apt.clinicId, apt.id).subscribe({
      next: () => {
        this.db.updateAppointmentStatus(apt.id, 'COMPLETED');
        this.loadDoctorAppointments();
      },
      error: () => {
        this.db.updateAppointmentStatus(apt.id, 'COMPLETED');
      }
    });
  }

  filterMedicines() {
    const q = this.medSearchQuery.trim();
    if (!q) {
      this.searchResults = [];
      return;
    }

    const diagnosis = this.consultationForm.diagnosis || undefined;

    this.prescriptionApi.suggestMedicines(q, diagnosis, 8).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          this.searchResults = res.map((m: any) => ({
            id: String(m.medicineId || m.id || Math.random()),
            name: m.medicineName || m.name,
            genericName: m.genericName || '',
            category: m.category || 'Prescription Drug',
            form: (m.form || m.dosageForm || 'Tablet') as any,
            strength: m.strength || '',
            defaultDosage: m.defaultDosage || '1 ' + (m.form || 'tablet'),
            defaultFrequency: m.defaultFrequency || '1-0-1 (After Food)',
            defaultDuration: m.defaultDurationDays ? `${m.defaultDurationDays} Days` : (m.defaultDuration || '5 Days'),
            defaultRoute: 'Oral',
            sideEffects: [],
            stock: 100,
            price: 50
          }));
        } else {
          this.filterMedicinesLocally(q);
        }
      },
      error: () => {
        this.filterMedicinesLocally(q);
      }
    });
  }

  private filterMedicinesLocally(q: string) {
    const lower = q.toLowerCase();
    this.searchResults = this.db.medicines().filter(m => 
      m.name.toLowerCase().includes(lower) || 
      m.genericName.toLowerCase().includes(lower)
    ).slice(0, 6);
  }

  addMedicineToRx(med: Medicine) {
    this.rxItems.push({
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      strength: med.strength,
      form: med.form,
      dosage: '1 ' + med.form,
      frequency: med.defaultFrequency || '1-0-1 (After Food)',
      duration: med.defaultDuration || '5 Days',
      route: med.defaultRoute || 'Oral',
      instructions: 'Take after meals'
    });
    this.medSearchQuery = '';
    this.searchResults = [];
  }

  addCustomMedicineToRx(): void {
    if (!this.medSearchQuery.trim()) return;
    const query = this.medSearchQuery.trim();
    const customMed: Medicine = {
      id: 'custom-' + Date.now(),
      name: query,
      genericName: '',
      strength: '',
      form: 'Tablet',
      category: 'General',
      defaultFrequency: '1-0-1',
      defaultDuration: '5 Days',
      defaultRoute: 'Oral'
    };
    this.addMedicineToRx(customMed);
  }

  removeRxItem(idx: number) {
    this.rxItems.splice(idx, 1);
  }

  toggleAdvice(adv: string) {
    if (this.selectedAdvice.includes(adv)) {
      this.selectedAdvice = this.selectedAdvice.filter(a => a !== adv);
    } else {
      this.selectedAdvice.push(adv);
    }
  }

  addCustomAdvice(): void {
    if (!this.customAdviceText.trim()) return;
    const val = this.customAdviceText.trim();
    if (!this.selectedAdvice.includes(val)) {
      this.selectedAdvice.push(val);
    }
    this.customAdviceText = '';
  }

  getCustomAdvices(): string[] {
    return this.selectedAdvice.filter(a => !this.standardAdviceList.includes(a));
  }



  setFollowUp(days: number) {
    this.followUpDays = days;
    const target = new Date();
    target.setDate(target.getDate() + days);
    this.followUpDate = target.toISOString().split('T')[0];
    this.followUpDateObj = target;
  }

  onCustomFollowUpDateChange(d: Date | null) {
    if (d) {
      this.followUpDateObj = d;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      this.followUpDate = `${y}-${m}-${day}`;
      this.followUpDays = 0;
    } else {
      this.followUpDate = '';
      this.followUpDays = 0;
      this.followUpDateObj = null;
    }
  }


  clonePreviousPrescription(pastRx: any) {
    this.consultationForm.diagnosis = pastRx.diagnosis || '';
    this.consultationForm.symptomsText = (pastRx.symptoms || []).join(', ');
    
    const medicinesList = pastRx.medicines || pastRx.items || [];
    this.rxItems = medicinesList.map((it: any) => {
      const freqStr = it.timing ? `${it.morningQty}-${it.afternoonQty}-${it.nightQty} (${it.timing})` : (it.frequency || `${it.morningQty}-${it.afternoonQty}-${it.nightQty}`);
      return {
        medicineId: it.medicineId || 'med-' + Date.now(),
        medicineName: it.medicineName,
        genericName: it.genericName || '',
        strength: it.strength || '',
        form: it.form || (it.dosage ? it.dosage.split(' ')[1] : 'Tablet') as any,
        dosage: it.dosage || '1 Tablet',
        frequency: freqStr,
        duration: it.durationDays ? `${it.durationDays} Days` : (it.duration || '5 Days'),
        route: it.route || 'Oral',
        instructions: it.instructions || ''
      };
    });
    
    this.selectedAdvice = [...(pastRx.investigationsAdvised || pastRx.advice || [])];
    this.showHistoryDrawer.set(false);
  }

  /** Download a past prescription via backend PDF API */
  downloadPastPrescription(pastRx: any): void {
    const apt = this.selectedAppointment();
    if (!apt) return;
    const prescriptionId = pastRx.prescriptionId || pastRx.id;
    const clinicId = pastRx.clinicId || apt.clinicId;
    if (!prescriptionId || !clinicId) return;
    this.prescriptionApi.downloadPdf(clinicId, prescriptionId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Prescription-${prescriptionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        console.warn('[PDF] Past prescription PDF not available from API.');
      }
    });
  }

  viewPastPrescription(pastRx: any): void {
    const apt = this.selectedAppointment();
    const doc = this.activeDoctor();

    const medicinesList = pastRx.medicines || pastRx.items || [];
    const items: PrescriptionItem[] = medicinesList.map((m: any, idx: number) => ({
      id: 'rx-item-' + idx,
      medicineId: m.medicineId || '',
      medicineName: m.medicineName || m.name || '',
      genericName: m.genericName || '',
      strength: m.strength || '',
      form: (m.form || (m.dosage ? m.dosage.split(' ')[1] : 'Tablet')) as any,
      dosage: m.dosage || '1 Tablet',
      frequency: m.timing ? `${m.morningQty}-${m.afternoonQty}-${m.nightQty} (${m.timing})` : (m.frequency || `${m.morningQty ?? 1}-${m.afternoonQty ?? 0}-${m.nightQty ?? 1}`),
      duration: m.durationDays ? `${m.durationDays} Days` : (m.duration || '5 Days'),
      route: m.route || 'Oral',
      instructions: m.instructions || ''
    }));

    const rxModel: Prescription = {
      id: pastRx.prescriptionId || pastRx.id,
      consultationId: pastRx.appointmentId || pastRx.prescriptionId || pastRx.id,
      appointmentId: pastRx.appointmentId || apt?.id || '',
      clinicId: pastRx.clinicId || apt?.clinicId || doc?.hospitalId || '',
      clinicName: pastRx.clinicName || pastRx.clinic || pastRx.clinicId || '',
      doctorId: pastRx.doctorId || doc?.id || '',
      doctorName: pastRx.doctorName || pastRx.doctorId || '',
      doctorSpecialization: pastRx.doctorSpecialization || doc?.specialization || '',
      doctorRegNo: pastRx.doctorRegNo || doc?.registrationNo || '',
      patientId: pastRx.patientId || apt?.patientId || '',
      patientName: pastRx.patientName || apt?.patientName || 'Patient',
      patientAge: pastRx.patientAge || apt?.patientAge,
      patientGender: pastRx.patientGender || apt?.patientGender,
      prescriptionNumber: pastRx.prescriptionId || pastRx.id || 'RX-DETAILS',
      symptoms: Array.isArray(pastRx.symptoms) ? pastRx.symptoms : (pastRx.symptoms ? pastRx.symptoms.split(',') : []),
      diagnosis: pastRx.diagnosis || 'General Checkup',
      clinicalNotes: pastRx.notes || pastRx.clinicalNotes || '',
      items: items,
      advice: pastRx.investigationsAdvised || pastRx.advice || [],
      customAdvice: '',
      followUpDate: pastRx.followUpDate || '',
      issuedAt: pastRx.createdAt || pastRx.issuedAt || new Date().toISOString()
    };

    this.dialog.open(PrescriptionDetailsDialogComponent, {
      width: '780px',
      maxWidth: '95vw',
      panelClass: 'custom-dialog-container',
      backdropClass: 'app-modal-backdrop',
      data: { prescription: rxModel, rawRx: pastRx }
    });
  }

  completeAndSavePrescription() {
    const apt = this.selectedAppointment();
    const doc = this.activeDoctor();
    if (!apt || !doc) return;

    if (!this.consultationForm.diagnosis) {
      alert('Please specify a Clinical Diagnosis before completing.');
      return;
    }

    if (this.rxItems.length === 0) {
      alert('Please prescribe at least one medicine before completing consultation.');
      return;
    }

    const clinicId = apt.clinicId || doc.hospitalId || 'CLN00001';

    const payload = {
      appointmentId: apt.id,
      diagnosis: this.consultationForm.diagnosis,
      notes: this.consultationForm.clinicalNotes || undefined,
      followUpDate: this.followUpDate || undefined,
      medicines: this.rxItems.map(it => {
        const daysMatch = (it.duration || '5').match(/\d+/);
        const days = daysMatch ? parseInt(daysMatch[0], 10) : 5;
        
        const freq = it.frequency || '1-0-1';
        let morning = 0;
        let afternoon = 0;
        let night = 0;
        let timingVal = '';

        if (freq.toUpperCase().startsWith('SOS')) {
          morning = 0;
          afternoon = 0;
          night = 0;
          timingVal = 'SOS (As required)';
        } else {
          const parts = freq.split(' ')[0].split('-');
          morning = parseInt(parts[0], 10);
          afternoon = parseInt(parts[1], 10);
          night = parseInt(parts[2], 10);
          
          if (isNaN(morning)) morning = 1;
          if (isNaN(afternoon)) afternoon = 0;
          if (isNaN(night)) night = 1;

          timingVal = freq.includes('(') ? freq.substring(freq.indexOf('(') + 1, freq.indexOf(')')) : 'After food';
        }

        return {
          medicineName: `${it.medicineName} ${it.strength || ''}`.trim(),
          dosage: (it.dosage || '1 Tablet').trim(),
          morningQty: morning,
          afternoonQty: afternoon,
          nightQty: night,
          timing: timingVal,
          route: it.route || 'Oral',
          durationDays: days,
          instructions: it.instructions || 'Take after meals'
        };
      }),
      investigationsAdvised: this.selectedAdvice.length > 0 ? this.selectedAdvice : undefined
    };

    this.isSavingPrescription.set(true);

    this.prescriptionApi.createPrescription(clinicId, payload, apt.doctorId || doc.id).subscribe({
      next: (res) => {
        this.isSavingPrescription.set(false);
        console.log('[PrescriptionAPI] Created prescription:', res.prescriptionId);

        // Refresh doctor's appointments queue
        this.loadDoctorAppointments(this.selectedDate());

        const rx: Prescription = {
          id: res.prescriptionId || 'rx-' + Date.now(),
          clinicId: res.clinicId || clinicId,
          clinicName: this.db.currentClinic().name,
          doctorId: doc.id,
          doctorName: doc.name,
          doctorSpecialization: doc.specialization,
          doctorRegNo: doc.registrationNo,
          patientId: apt.patientId,
          patientName: apt.patientName,
          patientAge: apt.patientAge ?? undefined,
          patientGender: apt.patientGender || undefined,
          appointmentId: apt.id,
          consultationId: apt.id,
          prescriptionNumber: res.prescriptionId || 'RX-' + Date.now(),
          diagnosis: this.consultationForm.diagnosis,
          symptoms: this.consultationForm.symptomsText.split(',').map(s => s.trim()).filter(Boolean),
          clinicalNotes: this.consultationForm.clinicalNotes,
          items: this.rxItems.map(it => ({ ...it, id: 'rx-it-' + Math.random().toString(36).substring(2, 6) })),
          advice: this.selectedAdvice,
          customAdvice: this.customAdviceText,
          followUpDate: this.followUpDate,
          followUpDays: this.followUpDays,
          issuedAt: new Date().toISOString()
        };

        // Mark appointment complete on backend
        this.appointmentApi.markComplete(apt.clinicId, apt.id).subscribe({
          next: () => {
            this.db.updateAppointmentStatus(apt.id, 'COMPLETED');
            this.loadDoctorAppointments();
          },
          error: () => {
            this.db.updateAppointmentStatus(apt.id, 'COMPLETED');
          }
        });

        this.activePreviewRx.set(rx);
        this.showPrintModal.set(true);
      },
      error: (err) => {
        this.isSavingPrescription.set(false);
        console.warn('[PrescriptionAPI] Error creating prescription, using local store:', err);

        this.appointmentApi.markComplete(apt.clinicId, apt.id).subscribe({
          next: () => this.db.updateAppointmentStatus(apt.id, 'COMPLETED'),
          error: () => this.db.updateAppointmentStatus(apt.id, 'COMPLETED')
        });

        const rx = this.db.createPrescription({
          clinicId: apt.clinicId,
          clinicName: this.db.currentClinic().name,
          doctorId: doc.id,
          doctorName: doc.name,
          doctorSpecialization: doc.specialization,
          doctorRegNo: doc.registrationNo,
          patientId: apt.patientId,
          patientName: apt.patientName,
          patientAge: apt.patientAge ?? undefined,
          patientGender: apt.patientGender || undefined,
          appointmentId: apt.id,
          consultationId: apt.id,
          diagnosis: this.consultationForm.diagnosis,
          symptoms: this.consultationForm.symptomsText.split(',').map(s => s.trim()).filter(Boolean),
          clinicalNotes: this.consultationForm.clinicalNotes,
          items: this.rxItems.map(it => ({ ...it, id: 'rx-it-' + Math.random().toString(36).substring(2, 6) })),
          advice: this.selectedAdvice,
          customAdvice: this.customAdviceText,
          followUpDate: this.followUpDate,
          followUpDays: this.followUpDays
        });

        this.activePreviewRx.set(rx);
        this.showPrintModal.set(true);
      }
    });
  }

  previewPrescription() {
    const apt = this.selectedAppointment();
    const doc = this.activeDoctor();
    if (!apt || !doc) return;

    const mockRx: Prescription = {
      id: 'preview',
      clinicId: apt.clinicId,
      clinicName: this.db.currentClinic().name,
      doctorId: doc.id,
      doctorName: doc.name,
      doctorSpecialization: doc.specialization,
      doctorRegNo: doc.registrationNo,
      patientId: apt.patientId,
      patientName: apt.patientName,
      patientAge: apt.patientAge ?? undefined,
      patientGender: apt.patientGender || undefined,
      appointmentId: apt.id,
      consultationId: apt.id,
      prescriptionNumber: 'RX-PREVIEW',
      diagnosis: this.consultationForm.diagnosis || 'Clinical Assessment',
      symptoms: this.consultationForm.symptomsText.split(',').map(s => s.trim()).filter(Boolean),
      clinicalNotes: this.consultationForm.clinicalNotes,
      items: this.rxItems.map(it => ({ ...it, id: 'tmp' })),
      advice: this.selectedAdvice,
      customAdvice: this.customAdviceText,
      followUpDate: this.followUpDate,
      followUpDays: this.followUpDays,
      issuedAt: new Date().toISOString()
    };

    this.activePreviewRx.set(mockRx);
    this.showPrintModal.set(true);
  }

  pdfService = inject(PdfGeneratorService);

  /**
   * For COMPLETED appointments — fetch prescription by appointment ID and open read-only view.
   */
  viewCompletedPrescription(apt: Appointment): void {
    this.viewRxLoading.set(true);
    this.viewRxPrescriptionId.set(null);
    const doc = this.activeDoctor();
    const clinicId = apt.clinicId || doc.hospitalId;

    this.prescriptionApi.getPrescriptionByAppointment(clinicId, apt.id).subscribe({
      next: (rx) => {
        this.viewRxLoading.set(false);
        if (!rx) return;
        this.viewRxPrescriptionId.set(rx.prescriptionId || null);

        // Map API response to internal Prescription model for the print modal
        const medicinesList = rx.medicines || [];
        const rxObj: Prescription = {
          id: rx.prescriptionId,
          clinicId: rx.clinicId || clinicId,
          clinicName: this.doctorSession.doctor()?.clinicName || '',
          doctorId: rx.doctorId || doc.id,
          doctorName: doc.name,
          doctorSpecialization: doc.specialization,
          doctorRegNo: doc.registrationNo,
          patientId: rx.patientId,
          patientName: apt.patientName,
          patientAge: apt.patientAge ?? undefined,
          patientGender: apt.patientGender || undefined,
          appointmentId: apt.id,
          consultationId: apt.id,
          prescriptionNumber: rx.prescriptionId,
          diagnosis: rx.diagnosis,
          symptoms: [],
          clinicalNotes: rx.notes || '',
          items: medicinesList.map((m: any) => ({
            id: 'rx-it-' + Math.random().toString(36).substring(2, 6),
            medicineId: '',
            medicineName: m.medicineName,
            genericName: '',
            strength: '',
            form: (m.dosage ? m.dosage.split(' ')[1] : 'Tablet') as any,
            dosage: m.dosage || '',
            frequency: m.timing ? `${m.morningQty}-${m.afternoonQty}-${m.nightQty} (${m.timing})` : `${m.morningQty}-${m.afternoonQty}-${m.nightQty}`,
            duration: `${m.durationDays || 5} Days`,
            route: m.route || 'Oral',
            instructions: m.instructions || ''
          })),
          advice: rx.investigationsAdvised || [],
          customAdvice: '',
          followUpDate: rx.followUpDate || '',
          followUpDays: 0,
          issuedAt: rx.createdAt || new Date().toISOString()
        };
        this.isViewingRx.set(true);
        this.activePreviewRx.set(rxObj);
        this.showPrintModal.set(true);
      },
      error: () => {
        this.viewRxLoading.set(false);
        alert('Could not fetch prescription for this appointment.');
      }
    });
  }

  downloadPrescriptionPdf() {
    const rx = this.activePreviewRx();
    if (!rx) return;

    // Try API PDF first if we have a prescriptionId and clinicId
    const prescriptionId = this.viewRxPrescriptionId() || rx.id;
    const clinicId = rx.clinicId;
    if (prescriptionId && clinicId && !prescriptionId.startsWith('preview') && !prescriptionId.startsWith('rx-')) {
      this.downloadPrescriptionPdfFromApi(clinicId, prescriptionId, rx);
    } else {
      // Fallback: generate PDF from HTML using jsPDF
      this.pdfService.generatePrescriptionPdf(rx, { action: 'download' });
    }
  }

  downloadPrescriptionPdfFromApi(clinicId: string, prescriptionId: string, rx: Prescription): void {
    this.prescriptionApi.downloadPdf(clinicId, prescriptionId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Prescription-${prescriptionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        // API PDF not available, fall back to jsPDF
        console.warn('[PDF] Backend PDF not available, falling back to jsPDF...');
        this.pdfService.generatePrescriptionPdf(rx, { action: 'download' });
      }
    });
  }

  printPrescriptionPdf() {
    const rx = this.activePreviewRx();
    if (rx) {
      this.pdfService.generatePrescriptionPdf(rx, { action: 'print' });
    }
  }

  /** Download completed appointment prescription via backend PDF API, falling back to jsPDF */
  downloadCompletedRxViaApi(): void {
    const raw = this.completedRx();
    const apt = this.selectedAppointment();
    if (!raw || !apt) return;
    const prescriptionId = raw.prescriptionId;
    const clinicId = raw.clinicId || apt.clinicId;
    if (prescriptionId && clinicId) {
      this.prescriptionApi.downloadPdf(clinicId, prescriptionId).subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Prescription-${prescriptionId}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          console.warn('[PDF] Backend PDF unavailable, falling back to jsPDF.');
          this.downloadCompletedRxViaJsPdf();
        }
      });
    } else {
      this.downloadCompletedRxViaJsPdf();
    }
  }

  /** Generate a PDF locally using jsPDF from the completed appointment's prescription data */
  downloadCompletedRxViaJsPdf(): void {
    const raw = this.completedRx();
    const apt = this.selectedAppointment();
    const doc = this.activeDoctor();
    if (!raw || !apt) return;
    const medicinesList = raw.medicines || [];
    const rxObj: Prescription = {
      id: raw.prescriptionId,
      clinicId: raw.clinicId || apt.clinicId,
      clinicName: this.doctorSession.doctor()?.clinicName || '',
      doctorId: raw.doctorId || doc.id,
      doctorName: doc.name,
      doctorSpecialization: doc.specialization,
      doctorRegNo: doc.registrationNo,
      patientId: raw.patientId,
      patientName: apt.patientName,
      patientAge: apt.patientAge ?? undefined,
      patientGender: apt.patientGender || undefined,
      appointmentId: apt.id,
      consultationId: apt.id,
      prescriptionNumber: raw.prescriptionId,
      diagnosis: raw.diagnosis,
      symptoms: [],
      clinicalNotes: raw.notes || '',
      items: medicinesList.map((m: any) => ({
        id: 'rx-it-' + Math.random().toString(36).substring(2, 6),
        medicineId: '',
        medicineName: m.medicineName,
        genericName: '',
        strength: '',
        form: (m.dosage ? m.dosage.split(' ')[1] : 'Tablet') as any,
        dosage: m.dosage || '',
        frequency: m.timing ? `${m.morningQty}-${m.afternoonQty}-${m.nightQty} (${m.timing})` : `${m.morningQty}-${m.afternoonQty}-${m.nightQty}`,
        duration: `${m.durationDays || 5} Days`,
        route: m.route || 'Oral',
        instructions: m.instructions || ''
      })),
      advice: raw.investigationsAdvised || [],
      customAdvice: '',
      followUpDate: raw.followUpDate || '',
      followUpDays: 0,
      issuedAt: raw.createdAt || new Date().toISOString()
    };
    this.pdfService.generatePrescriptionPdf(rxObj, { action: 'download' });
  }

  private resetForm() {
    this.consultationForm = {
      symptomsText: '',
      diagnosis: '',
      clinicalNotes: ''
    };
    this.rxItems = [];
    this.selectedAdvice = [];
    this.customAdviceText = '';
    this.followUpDays = 0;
    this.followUpDate = '';
    this.followUpDateObj = null;
    this.medSearchQuery = '';
    this.searchResults = [];
    this.completedRx.set(null);
  }

  format24HrToAmPm(timeStr: string): string {
    if (!timeStr) return '10:00 AM';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }
}
