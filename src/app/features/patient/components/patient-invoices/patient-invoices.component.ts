import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PatientSessionService } from '../../../../core/services/patient-session.service';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { PdfGeneratorService } from '../../../../core/services/pdf-generator.service';
import { Invoice, Patient } from '../../../../core/models/clinic.models';

@Component({
  selector: 'app-patient-invoices',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './patient-invoices.component.html'
})
export class PatientInvoicesComponent {
  private readonly patientSession = inject(PatientSessionService);
  private readonly db = inject(SessionStateService);
  private readonly pdfService = inject(PdfGeneratorService);

  downloadInvoicePdf(inv: Invoice): void {
    this.pdfService.generateInvoicePdf(inv, { action: 'download' });
  }

  printInvoicePdf(inv: Invoice): void {
    this.pdfService.generateInvoicePdf(inv, { action: 'print' });
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

  get myInvoices(): Invoice[] {
    const pat = this.currentPatient;
    if (!pat) return [];
    return this.db.invoices().filter(i => i.patientId === pat.id);
  }
}
