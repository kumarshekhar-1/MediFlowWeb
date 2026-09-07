import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { OnboardDoctorDialogComponent } from './onboard-doctor/onboard-doctor-dialog.component';
import { OnboardReceptionistDialogComponent } from './onboard-receptionist/onboard-receptionist-dialog.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SessionStateService } from '../../core/services/session-state.service';
import { ClinicSessionService } from '../../core/services/clinic-session.service';
import { ClinicApiService } from '../../core/services/clinic-api.service';
import { ClinicProfileCompletionComponent } from './components/clinic-profile-completion/clinic-profile-completion.component';
import { OwnerDoctorsComponent } from './components/owner-doctors/owner-doctors.component';
import { OwnerReceptionistsComponent } from './components/owner-receptionists/owner-receptionists.component';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDialogModule,
    ClinicProfileCompletionComponent,
    OwnerDoctorsComponent,
    OwnerReceptionistsComponent
  ],
  templateUrl: './owner-dashboard.component.html',
  styleUrl: './owner-dashboard.component.scss'
})
export class OwnerDashboardComponent implements OnInit {
  db = inject(SessionStateService);
  clinicSession = inject(ClinicSessionService);
  private readonly api = inject(ClinicApiService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  activeTab = signal<'DOCTORS' | 'RECEPTIONISTS'>('DOCTORS');
  doctorIds = signal<string[]>([]);
  totalConsultationsCount = signal<number>(0);
  totalRevenueValue = signal<number>(0);

  ngOnInit(): void {
    this.clinicSession.fetchClinic();
  }

  isProfileIncomplete = computed(() => {
    return this.clinicSession.clinic() === null || this.clinicSession.error() !== null;
  });

  goToProfile(): void {
    this.router.navigate(['/dashboard/clinic-admin/profile']);
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
        this.clinicSession.refreshClinic();
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
        this.clinicSession.refreshClinic();
      }
    });
  }
}
