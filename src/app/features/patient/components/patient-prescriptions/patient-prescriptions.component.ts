import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PrescriptionApiService } from '../../../../core/services/prescription-api.service';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { PatientSessionService } from '../../../../core/services/patient-session.service';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { PdfGeneratorService } from '../../../../core/services/pdf-generator.service';
import { Prescription, Patient, PrescriptionItem } from '../../../../core/models/clinic.models';
import { forkJoin } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PrescriptionDetailsDialogComponent } from '../../../../shared/components/prescription-details-dialog.component';
import { CustomSelectComponent, SelectOption } from '../../../../shared/components/custom-select.component';

@Component({
  selector: 'app-patient-prescriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, CustomSelectComponent],
  templateUrl: './patient-prescriptions.component.html',
  styleUrl: './patient-prescriptions.component.scss'
})
export class PatientPrescriptionsComponent implements OnInit {
  private readonly prescriptionApi = inject(PrescriptionApiService);
  private readonly clinicApi = inject(ClinicApiService);
  private readonly patientSession = inject(PatientSessionService);
  readonly db = inject(SessionStateService);
  private readonly pdfService = inject(PdfGeneratorService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);

  apiPrescriptions: any[] = [];
  apiPrescriptionsLoading: boolean = false;
  apiDoctors: any[] = [];
  apiClinics: any[] = [];

  selectedRxClinicId: string = '';
  selectedRxDoctorId: string = '';
  rxSearchKeyword: string = '';


  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.apiPrescriptionsLoading = true;
    this.cdr.detectChanges();
    forkJoin({
      clinics: this.clinicApi.listClinics(0, 100),
      doctors: this.clinicApi.listDoctors(undefined, 0, 200)
    }).subscribe({
      next: (res) => {
        this.apiClinics = res.clinics?.content ?? (Array.isArray(res.clinics) ? res.clinics : []);
        this.apiDoctors = res.doctors?.content ?? (Array.isArray(res.doctors) ? res.doctors : []);
        
        this.selectedRxClinicId = ''; // Default to All Clinics (optional clinicId)
        this.selectedRxDoctorId = '';
        this.loadPatientPrescriptions(this.selectedRxClinicId, this.selectedRxDoctorId);
        this.cdr.detectChanges();
      },
      error: () => {
        this.apiPrescriptionsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadPatientPrescriptions(clinicId: string, doctorId: string): void {
    const patientId = this.patientSession.patient()?.patientId || this.patientSession.currentPatientId();
    if (!patientId) return;

    this.apiPrescriptionsLoading = true;
    this.cdr.detectChanges();
    this.prescriptionApi.listByPatientGlobal(patientId, 0, 200, doctorId || undefined, clinicId || undefined).subscribe({
      next: (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        this.apiPrescriptions = list;
        this.apiPrescriptionsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.apiPrescriptions = [];
        this.apiPrescriptionsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onRxClinicSelect(clinicId: string): void {
    this.selectedRxClinicId = clinicId || '';
    // Reset doctor selection when clinic changes
    this.selectedRxDoctorId = '';
    this.loadPatientPrescriptions(this.selectedRxClinicId, this.selectedRxDoctorId);
  }

  onRxDoctorSelect(doctorId: string): void {
    this.selectedRxDoctorId = doctorId;
    this.loadPatientPrescriptions(this.selectedRxClinicId, this.selectedRxDoctorId);
  }

  viewPrescriptionDetails(rx: Prescription): void {
    this.dialog.open(PrescriptionDetailsDialogComponent, {
      width: '780px',
      maxWidth: '95vw',
      panelClass: 'custom-dialog-container',
      backdropClass: 'app-modal-backdrop',
      data: { prescription: rx }
    });
  }

  downloadPrescriptionPdf(rx: Prescription): void {
    const clinicId = rx.clinicId || this.selectedRxClinicId;
    if (!clinicId) return;
    if (rx.id) {
      this.prescriptionApi.downloadPdf(clinicId, rx.id).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Prescription-${rx.id}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.pdfService.generatePrescriptionPdf(rx, { action: 'download' });
        }
      });
    } else {
      this.pdfService.generatePrescriptionPdf(rx, { action: 'download' });
    }
  }

  printPrescriptionPdf(rx: Prescription): void {
    const clinicId = rx.clinicId || this.selectedRxClinicId;
    if (!clinicId) return;
    if (rx.id) {
      this.prescriptionApi.downloadPdf(clinicId, rx.id).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
        },
        error: () => {
          this.pdfService.generatePrescriptionPdf(rx, { action: 'print' });
        }
      });
    } else {
      this.pdfService.generatePrescriptionPdf(rx, { action: 'print' });
    }
  }

  get currentPatient(): Patient {
    const live = this.patientSession.patient();
    const mock = this.db.currentPatient();
    if (live) {
      return {
        id: live.patientId || this.patientSession.currentPatientId(),
        userId: mock?.userId || 'usr-live-patient',
        name: live.name || mock?.name || '',
        phone: live.phoneNumber || mock?.phone || '',
        email: live.email || mock?.email || '',
        dateOfBirth: live.dob || mock?.dateOfBirth || '',
        age: mock?.age,
        gender: (live.gender || mock?.gender) as any,
        bloodGroup: live.bloodGroup || mock?.bloodGroup,
        existingConditions: live.medicalHistory ? [live.medicalHistory] : mock?.existingConditions || [],
        address: live.address || mock?.address || '',
        createdAt: mock?.createdAt || new Date().toISOString()
      };
    }
    return mock;
  }

  get myPrescriptions(): Prescription[] {
    const list = this.apiPrescriptions;
    const docs = this.apiDoctors;
    const clinics = this.apiClinics;
    const pat = this.currentPatient;

    if (list && list.length > 0) {
      return list.map((p: any) => {
        let docName = p.doctorName || p.doctorId || '';
        if (docName && (docName.startsWith('Dr.') || docName.startsWith('Dr '))) {
          docName = 'Dr. ' + docName.replace(/^Dr\.?\s*/i, '');
        } else if (docName && !docName.startsWith('DOC')) {
          docName = 'Dr. ' + docName;
        }

        const docSpec = p.doctorSpecialization || '';
        const clinicName = p.clinicName || p.clinic || p.clinicId || '';

        const items: PrescriptionItem[] = (p.medicines || []).map((m: any, idx: number) => ({
          id: 'rx-item-' + idx,
          medicineId: String(m.medicineId || idx + 1),
          medicineName: m.medicineName || '',
          genericName: m.genericName || '',
          strength: m.strength || '',
          form: m.form || 'Tablet',
          dosage: m.dosage || '',
          frequency: m.dosage || '1-0-1',
          duration: m.durationDays ? `${m.durationDays} Days` : '',
          route: 'Oral',
          instructions: m.instructions || ''
        }));

        return {
          id: p.prescriptionId,
          consultationId: p.appointmentId || p.prescriptionId,
          appointmentId: p.appointmentId,
          clinicId: p.clinicId,
          clinicName: clinicName,
          doctorId: p.doctorId,
          doctorName: docName,
          doctorSpecialization: docSpec,
          doctorRegNo: p.doctorRegNo || '',
          patientId: p.patientId,
          patientName: pat?.name || '',
          patientAge: pat?.age,
          patientGender: pat?.gender,
          prescriptionNumber: p.prescriptionId,
          symptoms: [],
          diagnosis: p.diagnosis || '',
          clinicalNotes: p.notes,
          items: items,
          advice: p.investigationsAdvised || [],
          customAdvice: p.notes,
          followUpDate: p.followUpDate,
          issuedAt: p.createdAt || new Date().toISOString()
        };
      });
    }
    return [];
  }

  get filteredPrescriptions(): Prescription[] {
    const all = this.myPrescriptions;
    const query = this.rxSearchKeyword.trim().toLowerCase();
    if (!query) return all;

    return all.filter(rx => 
      (rx.diagnosis && rx.diagnosis.toLowerCase().includes(query)) ||
      (rx.doctorName && rx.doctorName.toLowerCase().includes(query)) ||
      (rx.doctorSpecialization && rx.doctorSpecialization.toLowerCase().includes(query)) ||
      (rx.prescriptionNumber && rx.prescriptionNumber.toLowerCase().includes(query)) ||
      rx.items.some(it => (it.medicineName && it.medicineName.toLowerCase().includes(query)) || (it.genericName && it.genericName.toLowerCase().includes(query)))
    );
  }

  get filteredDoctorsForSelectedClinic(): any[] {
    if (!this.selectedRxClinicId) return this.apiDoctors;
    return this.apiDoctors.filter(doc => doc.hospitalId === this.selectedRxClinicId);
  }

  get clinicSelectOptions(): SelectOption[] {
    const opts: SelectOption[] = [
      { value: '', label: 'All Clinics & Hospitals' }
    ];
    for (const c of this.apiClinics) {
      opts.push({
        value: c.clinicId,
        label: c.clinicName || 'Clinic',
        subLabel: c.address || ''
      });
    }
    return opts;
  }

  get doctorSelectOptions(): SelectOption[] {
    const opts: SelectOption[] = [
      { value: '', label: 'All Doctors' }
    ];
    for (const d of this.filteredDoctorsForSelectedClinic) {
      opts.push({
        value: d.doctorId,
        label: d.name.startsWith('Dr') ? d.name : `Dr. ${d.name}`,
        subLabel: d.specialization ? `${d.specialization}${d.qualification ? ' • ' + d.qualification : ''}` : ''
      });
    }
    return opts;
  }
}
