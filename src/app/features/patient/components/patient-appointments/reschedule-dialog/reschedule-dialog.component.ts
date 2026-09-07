import { Component, inject, signal, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AppointmentApiService } from '../../../../../core/services/appointment-api.service';
import { ClinicApiService } from '../../../../../core/services/clinic-api.service';
import { Appointment } from '../../../../../core/models/clinic.models';
import { CalendarPickerComponent } from '../../../../../shared/components/calendar-picker.component';

@Component({
  selector: 'app-reschedule-dialog',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    CalendarPickerComponent
  ],
  templateUrl: './reschedule-dialog.component.html',
  styleUrl: './reschedule-dialog.component.scss'
})
export class RescheduleDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<RescheduleDialogComponent>);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly clinicApi = inject(ClinicApiService);

  appointment: Appointment;

  rescheduleNewDate = signal<string>('');
  rescheduleDateValue: Date = new Date();
  rescheduleNewSlot = signal<string>('');
  rescheduleAvailableSlots = signal<string[]>([]);
  rescheduleReason = signal<string>('Patient requested schedule change.');
  isReschedulingSubmitting = signal<boolean>(false);
  isLoadingSlots = signal<boolean>(false);
  rescheduleErrorMsg = signal<string | null>(null);
  doctorDetails = signal<any>(null);
  doctorScheduleLabel = signal<string>('');
  allowedWeekdays = signal<number[]>([]);
  todayDateStr: string = new Date().toISOString().split('T')[0];
  todayDate: Date = new Date();

  constructor(@Inject(MAT_DIALOG_DATA) public data: { appointment: Appointment }) {
    this.appointment = data.appointment;
    const initialDateStr = this.appointment?.appointmentDate || this.todayDateStr;
    this.rescheduleNewDate.set(initialDateStr);
    
    const parts = initialDateStr.split('-');
    if (parts.length === 3) {
      this.rescheduleDateValue = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      this.rescheduleDateValue = new Date();
    }
  }

  ngOnInit(): void {
    if (this.appointment) {
      this.loadAvailableSlots();
    }
  }

  onDateChange(newDate: string): void {
    this.rescheduleNewDate.set(newDate);
    this.rescheduleNewSlot.set('');
    this.loadAvailableSlots();
  }

  onMatDateChange(date: Date | null): void {
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    this.rescheduleNewDate.set(dateStr);
    this.rescheduleNewSlot.set('');
    this.loadAvailableSlots();
  }

  loadAvailableSlots(): void {
    const apt = this.appointment;
    const date = this.rescheduleNewDate();
    if (!apt || !apt.clinicId || !apt.doctorId || !date) return;

    this.isLoadingSlots.set(true);
    this.rescheduleErrorMsg.set(null);

    this.clinicApi.getDoctor(apt.clinicId, apt.doctorId).subscribe({
      next: (doc) => {
        this.doctorDetails.set(doc);
        const scheduleList = Array.isArray(doc?.schedules) ? doc.schedules : (doc?.schedule ? [doc.schedule] : []);
        if (scheduleList.length > 0) {
          const formattedSchedule = scheduleList.map((s: any) => {
            const day = s.dayOfWeek ? (s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase().substring(0, 2)) : '';
            const start = s.startTime?.substring(0, 5) || '';
            const end = s.endTime?.substring(0, 5) || '';
            return `${day} (${start}-${end})`;
          });
          this.doctorScheduleLabel.set(formattedSchedule.join(', '));
        } else {
          this.doctorScheduleLabel.set('');
        }

        const dayMap: { [key: string]: number } = {
          'SUNDAY': 0, 'SUN': 0,
          'MONDAY': 1, 'MON': 1,
          'TUESDAY': 2, 'TUE': 2,
          'WEDNESDAY': 3, 'WED': 3,
          'THURSDAY': 4, 'THU': 4,
          'FRIDAY': 5, 'FRI': 5,
          'SATURDAY': 6, 'SAT': 6
        };
        const weekdays: number[] = [];
        if (scheduleList.length > 0) {
          scheduleList.forEach((s: any) => {
            const d = s.dayOfWeek ? dayMap[s.dayOfWeek.toUpperCase()] : undefined;
            if (d !== undefined && !weekdays.includes(d)) {
              weekdays.push(d);
            }
          });
        }
        this.allowedWeekdays.set(weekdays);

        const intervalMins = doc?.avgConsultationTimeMinutes || 30;

        this.appointmentApi.getAvailableSlots(apt.clinicId, apt.doctorId, date, intervalMins).subscribe({
          next: (res) => {
            const list = Array.isArray(res) ? res : (res?.slots || []);
            const formatted = list
              .filter((s: any) => s.startTime && s.endTime)
              .map((s: any) => `${this.format24HrToAmPm(s.startTime)} - ${this.format24HrToAmPm(s.endTime)}`);
            this.rescheduleAvailableSlots.set(formatted);
            
            if (formatted.length > 0) {
              this.rescheduleNewSlot.set(formatted[0]);
            } else {
              this.rescheduleNewSlot.set('');
            }
            this.isLoadingSlots.set(false);
          },
          error: () => {
            this.rescheduleAvailableSlots.set([]);
            this.rescheduleNewSlot.set('');
            this.isLoadingSlots.set(false);
          }
        });
      },
      error: () => {
        this.appointmentApi.getAvailableSlots(apt.clinicId, apt.doctorId, date, 30).subscribe({
          next: (res) => {
            const list = Array.isArray(res) ? res : (res?.slots || []);
            const formatted = list
              .filter((s: any) => s.startTime && s.endTime)
              .map((s: any) => `${this.format24HrToAmPm(s.startTime)} - ${this.format24HrToAmPm(s.endTime)}`);
            this.rescheduleAvailableSlots.set(formatted);
            if (formatted.length > 0) {
              this.rescheduleNewSlot.set(formatted[0]);
            }
            this.isLoadingSlots.set(false);
          },
          error: () => {
            this.rescheduleAvailableSlots.set([]);
            this.isLoadingSlots.set(false);
          }
        });
      }
    });
  }

  rescheduleDateFilter = (d: Date | null): boolean => {
    const date = d || new Date();
    const day = date.getDay();
    const allowed = this.allowedWeekdays();
    if (allowed.length === 0) return true;
    return allowed.includes(day);
  };

  submitReschedule(): void {
    const apt = this.appointment;
    const date = this.rescheduleNewDate();
    const slot = this.rescheduleNewSlot();

    if (!apt || !apt.id || !apt.clinicId || !date || !slot) return;

    this.isReschedulingSubmitting.set(true);
    this.rescheduleErrorMsg.set(null);

    const slot24 = this.formatTimeTo24Hr(slot);
    const payload = {
      newAppointmentDate: date,
      newSlotStartTime: slot24,
      reason: this.rescheduleReason().trim() || undefined
    };

    this.appointmentApi.rescheduleAppointment(apt.clinicId, apt.id, payload).subscribe({
      next: () => {
        this.isReschedulingSubmitting.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isReschedulingSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to reschedule appointment on server.';
        this.rescheduleErrorMsg.set(msg);
      }
    });
  }

  closeDialog(): void {
    this.dialogRef.close(false);
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
}
