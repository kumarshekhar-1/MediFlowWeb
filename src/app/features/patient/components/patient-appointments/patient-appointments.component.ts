import { Component, EventEmitter, inject, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AppointmentApiService } from '../../../../core/services/appointment-api.service';
import { PrescriptionApiService } from '../../../../core/services/prescription-api.service';
import { PdfGeneratorService } from '../../../../core/services/pdf-generator.service';
import { PatientSessionService } from '../../../../core/services/patient-session.service';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { Appointment, Patient, Prescription, PrescriptionItem } from '../../../../core/models/clinic.models';
import { RescheduleDialogComponent } from './reschedule-dialog/reschedule-dialog.component';
import { CancelDialogComponent } from './cancel-dialog/cancel-dialog.component';
import { PrescriptionDetailsDialogComponent } from '../../../../shared/components/prescription-details-dialog.component';

const COMPLETED_STATUSES = ['CONSULTATION_COMPLETED', 'COMPLETED', 'PAID', 'BILL_GENERATED'];

@Component({
  selector: 'app-patient-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  templateUrl: './patient-appointments.component.html',
  styleUrl: './patient-appointments.component.scss'
})
export class PatientAppointmentsComponent implements OnInit {
  private readonly appointmentApi  = inject(AppointmentApiService);
  private readonly prescriptionApi = inject(PrescriptionApiService);
  private readonly pdfService      = inject(PdfGeneratorService);
  private readonly patientSession  = inject(PatientSessionService);
  readonly db              = inject(SessionStateService);
  private readonly cdr             = inject(ChangeDetectorRef);
  private readonly dialog          = inject(MatDialog);

  @Output() navigateToBooking = new EventEmitter<void>();

  apiAppointmentsLoading: boolean = false;
  isConfirmingPayment: string | null = null;

  patientAppointments: Appointment[] = [];
  activeAppointment: Appointment | null = null;

  // Prescription modal state
  rxLoading: string | null = null;       // appointmentId being fetched
  readonly completedStatuses = COMPLETED_STATUSES;

  private lastEstimationTime: number = Date.now();

  ngOnInit(): void {
    this.loadPatientAppointments();
  }

  isCompletedStatus(status: string): boolean {
    return COMPLETED_STATUSES.includes(status);
  }

  loadPatientAppointments(): void {
    const patientId = this.patientSession.patient()?.patientId || this.patientSession.currentPatientId();
    if (!patientId) {
      this.apiAppointmentsLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.apiAppointmentsLoading = true;
    this.cdr.markForCheck();

    this.appointmentApi.listByPatient('', patientId, 0, 50).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        const pat = this.currentPatient;

        if (list && list.length > 0) {
          this.patientAppointments = list.map((a: any) => {
            const docName    = a.doctorName || (a.doctorId ? `Doctor (${a.doctorId})` : '');
            const docSpec    = a.doctorSpecialization || '';
            const clinicName = a.clinicName || (a.clinicId ? `Clinic (${a.clinicId})` : '');
            const formattedTime = a.slotStartTime ? this.format24HrToAmPm(a.slotStartTime) : '';

            return {
              id:               a.appointmentId,
              clinicId:         a.clinicId,
              clinicName:       clinicName,
              doctorId:         a.doctorId,
              doctorName:       docName,
              doctorSpecialization: docSpec,
              patientId:        a.patientId,
              patientName:      pat?.name || '',
              patientPhone:     pat?.phone || '',
              appointmentDate:  a.appointmentDate,
              timeSlot:         formattedTime,
              status:           (a.status || 'CONFIRMED') as any,
              tokenNumber:      a.appointmentId || '',
              queuePosition:    1,
              reason:           a.reasonForVisit || '',
              consultationFee:  Number(a.consultationFee || 0),
              paymentStatus:    a.paymentStatus,
              cancelReason:     a.cancelReason || null,
              createdAt:        a.createdAt || new Date().toISOString()
            };
          });
        } else {
          this.patientAppointments = [];
        }

        const all = this.patientAppointments;
        if (!all || all.length === 0) {
          this.activeAppointment = null;
        } else {
          const activeList = all.filter(a =>
            ['CONFIRMED', 'PENDING_PAYMENT', 'BOOKED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION'].includes(a.status)
          );
          this.activeAppointment = activeList.length > 0 ? activeList[0] : all[0];
        }

        this.lastEstimationTime = Date.now();
        this.apiAppointmentsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.patientAppointments = [];
        this.activeAppointment = null;
        this.apiAppointmentsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ─── Prescription: View ────────────────────────────────────────────────────

  viewPrescription(apt: Appointment): void {
    if (!apt.clinicId || !apt.id) return;
    this.rxLoading = apt.id;
    this.cdr.markForCheck();

    this.prescriptionApi.getPrescriptionByAppointment(apt.clinicId, apt.id).subscribe({
      next: (rx) => {
        this.rxLoading = null;
        if (!rx) { this.cdr.markForCheck(); return; }
        const rxObj = this.mapRxToModel(rx, apt);
        this.dialog.open(PrescriptionDetailsDialogComponent, {
          width: '780px',
          maxWidth: '95vw',
          panelClass: 'custom-dialog-container',
          backdropClass: 'app-modal-backdrop',
          data: { prescription: rxObj, rawRx: rx }
        });
        this.cdr.markForCheck();
      },
      error: () => {
        this.rxLoading = null;
        this.cdr.markForCheck();
        alert('Prescription not available for this appointment.');
      }
    });
  }

  // ─── Prescription: Download via API PDF ───────────────────────────────────

  downloadAptPrescriptionPdf(apt: Appointment): void {
    if (!apt.clinicId || !apt.id) return;
    this.rxLoading = apt.id;
    this.cdr.markForCheck();

    this.prescriptionApi.getPrescriptionByAppointment(apt.clinicId, apt.id).subscribe({
      next: (rx) => {
        if (!rx || !rx.prescriptionId) {
          this.rxLoading = null;
          this.cdr.markForCheck();
          return;
        }
        const prescriptionId = rx.prescriptionId;
        this.prescriptionApi.downloadPdf(apt.clinicId, prescriptionId).subscribe({
          next: (blob: Blob) => {
            this.rxLoading = null;
            const url = window.URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = `Prescription-${prescriptionId}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
            this.cdr.markForCheck();
          },
          error: () => {
            // Fall back to jsPDF
            this.rxLoading = null;
            const rxObj = this.mapRxToModel(rx, apt);
            this.pdfService.generatePrescriptionPdf(rxObj, { action: 'download' });
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.rxLoading = null;
        this.cdr.markForCheck();
        alert('Prescription not available for this appointment.');
      }
    });
  }

  // ─── Map raw API response to internal Prescription model ─────────────────

  private mapRxToModel(rx: any, apt: Appointment): Prescription {
    const pat = this.currentPatient;
    const items: PrescriptionItem[] = (rx.medicines || []).map((m: any, idx: number) => ({
      id: 'rx-item-' + idx,
      medicineId: '',
      medicineName: m.medicineName || '',
      genericName: '',
      strength: '',
      form: (m.dosage ? m.dosage.split(' ')[1] : 'Tablet') as any,
      dosage: m.dosage || '',
      frequency: m.timing
        ? `${m.morningQty}-${m.afternoonQty}-${m.nightQty} (${m.timing})`
        : `${m.morningQty ?? ''}-${m.afternoonQty ?? ''}-${m.nightQty ?? ''}`,
      duration: m.durationDays ? `${m.durationDays} Days` : '',
      route: m.route || 'Oral',
      instructions: m.instructions || ''
    }));

    return {
      id:                   rx.prescriptionId,
      consultationId:       apt.id,
      appointmentId:        apt.id,
      clinicId:             rx.clinicId || apt.clinicId,
      clinicName:           apt.clinicName || '',
      doctorId:             rx.doctorId || apt.doctorId,
      doctorName:           apt.doctorName || '',
      doctorSpecialization: apt.doctorSpecialization || '',
      doctorRegNo:          '',
      patientId:            rx.patientId || apt.patientId,
      patientName:          pat?.name || '',
      patientAge:           pat?.age,
      patientGender:        pat?.gender,
      prescriptionNumber:   rx.prescriptionId,
      symptoms:             [],
      diagnosis:            rx.diagnosis || '',
      clinicalNotes:        rx.notes || '',
      items,
      advice:               rx.investigationsAdvised || [],
      customAdvice:         '',
      followUpDate:         rx.followUpDate || '',
      followUpDays:         0,
      issuedAt:             rx.createdAt || new Date().toISOString()
    };
  }

  // ─── Other existing methods ───────────────────────────────────────────────

  markPaymentComplete(apt: Appointment): void {
    if (!apt.id || !apt.clinicId) return;

    this.isConfirmingPayment = apt.id;
    this.cdr.markForCheck();

    this.appointmentApi.confirmPayment(apt.clinicId, apt.id, {
      razorpayOrderId: 'order_EKfLwpHQBrSynr',
      razorpayPaymentId: 'pay_29QQoUBi66xm2f'
    }).subscribe({
      next: () => {
        this.isConfirmingPayment = null;
        this.loadPatientAppointments();
      },
      error: (err) => {
        this.isConfirmingPayment = null;
        console.warn('[Payment] Error confirming payment:', err);
        this.loadPatientAppointments();
      }
    });
  }

  openCancelModal(apt: Appointment): void {
    const dialogRef = this.dialog.open(CancelDialogComponent, {
      width: '520px',
      data: { appointment: apt },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) { this.loadPatientAppointments(); }
    });
  }

  openRescheduleModal(apt: Appointment): void {
    const dialogRef = this.dialog.open(RescheduleDialogComponent, {
      width: '520px',
      data: { appointment: apt },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) { this.loadPatientAppointments(); }
    });
  }

  getEstimatedWaitTime(apt: Appointment): string {
    if (!apt || !apt.appointmentDate) return '';
    if (apt.status === 'IN_CONSULTATION') return 'In Consultation';
    if (apt.status === 'COMPLETED')       return 'Completed';
    if (apt.status === 'CANCELLED')       return 'Cancelled';

    try {
      const timeStr = apt.timeSlot || '09:00 AM';
      const time24  = this.formatTimeTo24Hr(timeStr);
      const [h, m]  = time24.split(':').map(Number);

      const [year, month, day] = apt.appointmentDate.split('-').map(Number);
      const aptDateTime = new Date(year, month - 1, day, isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0);
      const now         = new Date(this.lastEstimationTime);
      const diffMins    = Math.round((aptDateTime.getTime() - now.getTime()) / 60000);

      if (diffMins > 0) {
        if (diffMins < 60)   return `${diffMins} mins`;
        if (diffMins < 1440) {
          const hours = Math.floor(diffMins / 60);
          const mins  = diffMins % 60;
          return mins > 0 ? `${hours}h ${mins}m` : `${hours} hrs`;
        }
        const days = Math.floor(diffMins / 1440);
        return `${days} ${days === 1 ? 'day' : 'days'}`;
      } else if (diffMins >= -60) {
        return 'Ready for Visit';
      } else {
        return 'Slot Passed';
      }
    } catch {
      return '';
    }
  }

  format24HrToAmPm(timeStr: string): string {
    if (!timeStr) return '';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }

  formatTimeTo24Hr(slotTime: string): string {
    if (!slotTime) return '09:00:00';
    let s = slotTime.trim();
    if (s.includes('-')) s = s.split('-')[0].trim();
    const match12 = s.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])?$/);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = match12[2];
      const modifier = match12[3] ? match12[3].toUpperCase() : null;
      if (modifier === 'PM' && hours < 12) hours += 12;
      else if (modifier === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}:00`;
    }
    const match24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match24) {
      const hours   = String(parseInt(match24[1], 10)).padStart(2, '0');
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
        id:                 live.patientId || this.patientSession.currentPatientId(),
        userId:             mock?.userId || 'usr-live-patient',
        name:               live.name || mock?.name || '',
        phone:              live.phoneNumber || mock?.phone || '',
        email:              live.email || mock?.email || '',
        dateOfBirth:        live.dob || mock?.dateOfBirth || '',
        age:                mock?.age,
        gender:             (live.gender || mock?.gender) as any,
        bloodGroup:         live.bloodGroup || mock?.bloodGroup,
        existingConditions: live.medicalHistory ? [live.medicalHistory] : mock?.existingConditions || [],
        address:            live.address || mock?.address || '',
        createdAt:          mock?.createdAt || new Date().toISOString()
      };
    }
    return mock;
  }
}
