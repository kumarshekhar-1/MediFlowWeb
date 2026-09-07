import { Component, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { ClinicSessionService } from '../../../../core/services/clinic-session.service';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { OnboardDoctorDialogComponent } from '../../onboard-doctor/onboard-doctor-dialog.component';

@Component({
  selector: 'app-owner-doctors',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule
  ],
  templateUrl: './owner-doctors.component.html'
})
export class OwnerDoctorsComponent implements OnDestroy {
  private readonly db = inject(SessionStateService);
  private readonly clinicSession = inject(ClinicSessionService);
  private readonly api = inject(ClinicApiService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  doctorList: any[] = [];
  doctorListLoading = false;

  receptionistList: any[] = [];
  showAssignReceptionistModal = false;
  selectedDoctorForAssignment: any = null;
  assignedReceptionistId = '';
  isAssigningReceptionist = false;
  assignSuccessMsg: string | null = null;
  assignErrorMsg: string | null = null;

  private clinicSub?: Subscription;

  constructor() {
    // toObservable must be called inside injection context (constructor)
    this.clinicSub = toObservable(this.clinicSession.clinic).subscribe(clinic => {
      if (clinic?.clinicId) {
        this.loadDoctors(clinic.clinicId);
      }
    });
  }

  ngOnDestroy(): void {
    this.clinicSub?.unsubscribe();
  }

  loadDoctors(clinicId: string): void {
    this.doctorListLoading = true;
    this.api.listDoctors(clinicId).subscribe({
      next: (res) => {
        const list = res?.content ?? res ?? [];
        this.doctorList = list;
        this.doctorListLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.doctorListLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openAddDoctorDialog(): void {
    const dialogRef = this.dialog.open(OnboardDoctorDialogComponent, {
      width: '800px',
      maxHeight: '95vh',
      disableClose: true,
      panelClass: 'custom-dialog-panel',
      backdropClass: 'app-modal-backdrop'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const clinicId = this.clinicSession.clinic()?.clinicId;
        if (clinicId) {
          this.clinicSession.refreshClinic();
          this.loadDoctors(clinicId);
        }
      }
    });
  }

  openEditDoctorDialog(doctor: any): void {
    const dialogRef = this.dialog.open(OnboardDoctorDialogComponent, {
      width: '800px',
      maxHeight: '95vh',
      disableClose: true,
      panelClass: 'custom-dialog-panel',
      backdropClass: 'app-modal-backdrop',
      data: { doctor }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const clinicId = this.clinicSession.clinic()?.clinicId;
        if (clinicId) {
          this.loadDoctors(clinicId);
        }
      }
    });
  }

  openAssignReceptionistModal(doc: any): void {
    this.selectedDoctorForAssignment = doc;
    const clinicId = this.clinicSession.clinic()?.clinicId;
    if (!clinicId) return;

    this.assignSuccessMsg = null;
    this.assignErrorMsg = null;

    this.api.listReceptionists(clinicId).subscribe({
      next: (res) => {
        const list = res ?? [];
        this.receptionistList = list;
        this.assignedReceptionistId = doc.receptionistId || (list.length > 0 ? list[0].receptionistId : '');
        this.showAssignReceptionistModal = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load receptionists for assignment:', err);
      }
    });
  }

  submitAssignReceptionist(): void {
    const doc = this.selectedDoctorForAssignment;
    const clinicId = this.clinicSession.clinic()?.clinicId;
    const recId = this.assignedReceptionistId;
    if (!doc || !clinicId || !recId) return;

    this.isAssigningReceptionist = true;
    this.assignSuccessMsg = null;
    this.assignErrorMsg = null;

    this.api.assignReceptionist(clinicId, doc.doctorId || doc.id, recId).subscribe({
      next: () => {
        this.isAssigningReceptionist = false;
        this.assignSuccessMsg = `Receptionist ${recId} successfully assigned to Dr. ${doc.name}!`;
        this.loadDoctors(clinicId);
        setTimeout(() => {
          this.showAssignReceptionistModal = false;
          this.assignSuccessMsg = null;
          this.cdr.markForCheck();
        }, 1200);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isAssigningReceptionist = false;
        this.assignErrorMsg = err?.error?.message || err?.message || 'Failed to assign receptionist';
        this.cdr.markForCheck();
      }
    });
  }

  getDoctorConsultationsCount(docId: string): number {
    const doc = this.doctorList.find(d => d.doctorId === docId);
    return doc ? (doc.realAppointmentsCount || 0) : 0;
  }

  getDoctorRevenue(docId: string, feeOverride?: number): number {
    const doc = this.doctorList.find(d => d.doctorId === docId);
    return doc ? (doc.realRevenue || 0) : 0;
  }

  /** Format HH:mm:ss or HH:mm to 12-hour display */
  formatTime(t: string): string {
    if (!t) return '';
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${String(display).padStart(2, '0')}:${m} ${period}`;
  }

  /** Get first letter of doctor's actual name (strips Dr/Dr. prefix) */
  getDoctorInitial(name: string): string {
    if (!name) return '?';
    const stripped = name.replace(/^Dr\.?\s*/i, '').trim();
    return (stripped || name).charAt(0).toUpperCase();
  }

  /** Capitalise day enum e.g. MONDAY -> Monday */
  formatDay(day: string): string {
    if (!day) return '';
    return day.charAt(0) + day.slice(1).toLowerCase();
  }
}
