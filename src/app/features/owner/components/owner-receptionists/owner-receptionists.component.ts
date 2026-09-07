import { Component, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { ClinicSessionService } from '../../../../core/services/clinic-session.service';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { OnboardReceptionistDialogComponent } from '../../onboard-receptionist/onboard-receptionist-dialog.component';

@Component({
  selector: 'app-owner-receptionists',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule],
  templateUrl: './owner-receptionists.component.html'
})
export class OwnerReceptionistsComponent implements OnDestroy {
  private readonly clinicSession = inject(ClinicSessionService);
  private readonly api = inject(ClinicApiService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  receptionistList: any[] = [];
  receptionistListLoading = false;

  private clinicSub?: Subscription;

  constructor() {
    this.clinicSub = toObservable(this.clinicSession.clinic).subscribe(clinic => {
      if (clinic?.clinicId) {
        this.loadReceptionists(clinic.clinicId);
      }
    });
  }

  ngOnDestroy(): void {
    this.clinicSub?.unsubscribe();
  }

  loadReceptionists(clinicId: string): void {
    this.receptionistListLoading = true;
    this.api.listReceptionists(clinicId).subscribe({
      next: (res) => {
        this.receptionistList = res ?? [];
        this.receptionistListLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.receptionistListLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openAddReceptionistDialog(): void {
    const dialogRef = this.dialog.open(OnboardReceptionistDialogComponent, {
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
          this.loadReceptionists(clinicId);
        }
      }
    });
  }

  getReceptionistInitial(name: string): string {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
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
}
