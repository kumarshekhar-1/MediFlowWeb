import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { PrescriptionApiService } from '../../core/services/prescription-api.service';
import { PdfGeneratorService } from '../../core/services/pdf-generator.service';
import { SessionStateService } from '../../core/services/session-state.service';
import { Prescription } from '../../core/models/clinic.models';

@Component({
  selector: 'app-prescription-details-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule],
  templateUrl: './prescription-details-dialog.component.html',
  styleUrl: './prescription-details-dialog.component.scss'
})
export class PrescriptionDetailsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PrescriptionDetailsDialogComponent>);
  private readonly prescriptionApi = inject(PrescriptionApiService);
  private readonly pdfService = inject(PdfGeneratorService);
  readonly db = inject(SessionStateService);

  prescription: Prescription;
  rawRx: any;
  isDownloading = signal<boolean>(false);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { prescription: Prescription; rawRx?: any }) {
    this.prescription = data.prescription;
    this.rawRx = data.rawRx || null;
  }

  downloadPdf(): void {
    const rx = this.prescription;
    const clinicId = rx.clinicId || this.db.currentClinicId();
    if (!clinicId || !rx.id) {
      // Fallback to jsPDF
      this.pdfService.generatePrescriptionPdf(rx, { action: 'download' });
      return;
    }

    this.isDownloading.set(true);
    this.prescriptionApi.downloadPdf(clinicId, rx.id).subscribe({
      next: (blob) => {
        this.isDownloading.set(false);
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
        this.isDownloading.set(false);
        this.pdfService.generatePrescriptionPdf(rx, { action: 'download' });
      }
    });
  }

  printPdf(): void {
    const rx = this.prescription;
    const clinicId = rx.clinicId || this.db.currentClinicId();
    if (!clinicId || !rx.id) {
      // Fallback to jsPDF
      this.pdfService.generatePrescriptionPdf(rx, { action: 'print' });
      return;
    }

    this.prescriptionApi.downloadPdf(clinicId, rx.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () => {
        this.pdfService.generatePrescriptionPdf(rx, { action: 'print' });
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
