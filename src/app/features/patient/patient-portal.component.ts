import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SessionStateService } from '../../core/services/session-state.service';
import { Patient, Doctor, Clinic, Appointment } from '../../core/models/clinic.models';
import { MatIconModule } from '@angular/material/icon';
import { HospitalMapLocatorComponent } from '../../shared/components/hospital-map-locator.component';
import { PatientSessionService } from '../../core/services/patient-session.service';
import { PatientProfileCompletionComponent } from './components/patient-profile-completion/patient-profile-completion.component';
import { AppointmentApiService } from '../../core/services/appointment-api.service';

import { Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

// Standalone Tab Components
import { PatientDiscoveryComponent } from './components/patient-discovery/patient-discovery.component';
import { PatientBookingComponent } from './components/patient-booking/patient-booking.component';
import { PatientAppointmentsComponent } from './components/patient-appointments/patient-appointments.component';
import { PatientPrescriptionsComponent } from './components/patient-prescriptions/patient-prescriptions.component';
import { PatientInvoicesComponent } from './components/patient-invoices/patient-invoices.component';

@Component({
  selector: 'app-patient-portal',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    HospitalMapLocatorComponent,
    PatientProfileCompletionComponent,
    PatientDiscoveryComponent,
    PatientBookingComponent,
    PatientAppointmentsComponent,
    PatientPrescriptionsComponent,
    PatientInvoicesComponent
  ],
  templateUrl: './patient-portal.component.html',
  styleUrl: './patient-portal.component.scss'
})
export class PatientPortalComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly patientSession = inject(PatientSessionService);
  readonly db = inject(SessionStateService);

  activeTab: 'DISCOVERY' | 'LOCATOR' | 'BOOKING' | 'APPOINTMENTS' | 'PRESCRIPTIONS' | 'INVOICES' | 'PROFILE' = 'DISCOVERY';
  bookingClinicId: string = '';
  bookingDoctorId: string = '';

  activeAppointment: Appointment | null = null;
  private lastEstimationTime: number = Date.now();
  private patientSub?: Subscription;

  constructor() {
    this.patientSub = toObservable(this.patientSession.patient).subscribe(patient => {
      if (patient?.patientId) {
        this.loadActiveAppointment(patient.patientId);
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const patientId = params.get('patientId');
      if (patientId) {
        this.patientSession.refreshPatient(patientId);
      } else {
        this.patientSession.fetchPatient();
      }
    });
  }

  ngOnDestroy(): void {
    this.patientSub?.unsubscribe();
  }

  switchTab(tab: any): void {
    this.activeTab = tab;
  }

  onBookClinicFromMap(clinic: Clinic): void {
    this.bookingClinicId = clinic.id;
    this.bookingDoctorId = '';
    this.switchTab('BOOKING');
  }

  openBookingForDoctor(doc: Doctor): void {
    this.bookingClinicId = doc.hospitalId || '';
    this.bookingDoctorId = doc.id;
    this.switchTab('BOOKING');
  }

  onBookingCompleted(): void {
    this.bookingClinicId = '';
    this.bookingDoctorId = '';
    const patientId = this.patientSession.patient()?.patientId || this.patientSession.currentPatientId();
    if (patientId) {
      this.loadActiveAppointment(patientId);
    }
    this.switchTab('APPOINTMENTS');
  }

  loadActiveAppointment(patientId: string): void {
    this.appointmentApi.listByPatient('', patientId, 0, 50).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        const pat = this.currentPatient;

        const appointments = list.map((a: any) => {
          const docName = a.doctorName || (a.doctorId ? `Doctor (${a.doctorId})` : '');
          const docSpec = a.doctorSpecialization || '';
          const clinicName = a.clinicName || (a.clinicId ? `Clinic (${a.clinicId})` : '');
          const formattedTime = a.slotStartTime ? this.format24HrToAmPm(a.slotStartTime) : '10:00 AM';

          return {
            id: a.appointmentId,
            clinicId: a.clinicId,
            clinicName: clinicName,
            doctorId: a.doctorId,
            doctorName: docName,
            doctorSpecialization: docSpec,
            patientId: a.patientId,
            patientName: pat?.name || 'Patient',
            patientPhone: pat?.phone || '',
            appointmentDate: a.appointmentDate,
            timeSlot: formattedTime,
            status: (a.status || 'CONFIRMED') as any,
            tokenNumber: a.appointmentId || 'APT000001',
            queuePosition: 1,
            reason: a.reasonForVisit || 'Consultation',
            consultationFee: Number(a.consultationFee || 500),
            paymentStatus: a.paymentStatus,
            cancelReason: a.cancelReason || null,
            createdAt: a.createdAt || new Date().toISOString()
          };
        });

        const activeList = appointments.filter((a: any) => 
          ['CONFIRMED', 'PENDING_PAYMENT', 'BOOKED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION'].includes(a.status)
        );

        // Sort active appointments chronologically (earliest first)
        activeList.sort((a: any, b: any) => {
          const aDateTime = new Date(`${a.appointmentDate}T${this.formatTimeTo24Hr(a.timeSlot)}`).getTime();
          const bDateTime = new Date(`${b.appointmentDate}T${this.formatTimeTo24Hr(b.timeSlot)}`).getTime();
          return aDateTime - bDateTime;
        });

        const activeApt = activeList.length > 0 ? activeList[0] : (appointments.length > 0 ? appointments[0] : null);
        this.activeAppointment = activeApt;
        this.lastEstimationTime = Date.now();
        this.cdr.markForCheck();
      },
      error: () => {
        this.activeAppointment = null;
        this.cdr.markForCheck();
      }
    });
  }

  getEstimatedWaitTime(apt: Appointment): string {
    if (!apt || !apt.appointmentDate) return '15 mins';
    if (apt.status === 'IN_CONSULTATION') return 'In Consultation';
    if (apt.status === 'COMPLETED') return 'Completed';
    if (apt.status === 'CANCELLED') return 'Cancelled';

    try {
      const timeStr = apt.timeSlot || '09:00 AM';
      const time24 = this.formatTimeTo24Hr(timeStr);
      const [h, m] = time24.split(':').map(Number);

      const [year, month, day] = apt.appointmentDate.split('-').map(Number);
      const aptDateTime = new Date(year, month - 1, day, isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0);
      const now = new Date(this.lastEstimationTime);

      const diffMs = aptDateTime.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);

      if (diffMins > 0) {
        if (diffMins < 60) {
          return `${diffMins} mins`;
        } else if (diffMins < 1440) {
          const hours = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          return mins > 0 ? `${hours}h ${mins}m` : `${hours} hrs`;
        } else {
          const days = Math.floor(diffMins / 1440);
          return `${days} ${days === 1 ? 'day' : 'days'}`;
        }
      } else if (diffMins >= -60) {
        return 'Ready for Visit';
      } else {
        return 'Slot Passed';
      }
    } catch (e) {
      return '15 mins';
    }
  }

  private format24HrToAmPm(timeStr: string): string {
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

  private formatTimeTo24Hr(slotTime: string): string {
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

  get isProfileIncomplete(): boolean {
    const p = this.patientSession.patient();
    if (!p) return true;
    return !p.dob || !p.gender || !p.address || p.address === 'Online Guest Booking';
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
}
