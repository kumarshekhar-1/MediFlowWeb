import { Component, inject, signal, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { AppointmentApiService } from '../../../../../core/services/appointment-api.service';
import { Appointment } from '../../../../../core/models/clinic.models';

@Component({
  selector: 'app-cancel-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  templateUrl: './cancel-dialog.component.html',
  styleUrl: './cancel-dialog.component.scss'
})
export class CancelDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CancelDialogComponent>);
  private readonly appointmentApi = inject(AppointmentApiService);

  appointment: Appointment;
  cancelReasonText = signal<string>('Patient requested cancellation due to personal reasons.');
  isCancellingSubmitting = signal<boolean>(false);
  cancelErrorMsg = signal<string | null>(null);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { appointment: Appointment }) {
    this.appointment = data.appointment;
  }

  submitCancel(): void {
    const apt = this.appointment;
    if (!apt || !apt.id || !apt.clinicId) return;

    this.isCancellingSubmitting.set(true);
    this.cancelErrorMsg.set(null);

    const reason = this.cancelReasonText().trim() || 'Patient requested cancellation.';

    this.appointmentApi.cancelAppointment(apt.clinicId, apt.id, reason).subscribe({
      next: () => {
        this.isCancellingSubmitting.set(false);
        this.dialogRef.close(true); // Return true on success
      },
      error: (err) => {
        this.isCancellingSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to cancel appointment on server.';
        this.cancelErrorMsg.set(msg);
      }
    });
  }

  closeDialog(): void {
    this.dialogRef.close(false);
  }
}
