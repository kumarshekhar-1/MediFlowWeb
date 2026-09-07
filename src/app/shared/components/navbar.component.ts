import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { SessionStateService } from '../../core/services/session-state.service';
import { ClinicSessionService } from '../../core/services/clinic-session.service';
import { DoctorSessionService } from '../../core/services/doctor-session.service';
import { PatientSessionService } from '../../core/services/patient-session.service';
import { UserRole } from '../../core/models/clinic.models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, 
    MatSelectModule, 
    MatMenuModule, 
    MatDividerModule
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  db = inject(SessionStateService);
  clinicSession = inject(ClinicSessionService);
  doctorSession = inject(DoctorSessionService);
  patientSession = inject(PatientSessionService);
  private readonly router = inject(Router);

  displayedUserName = computed(() => {
    const role = this.db.currentUser().role;
    if (role === 'OWNER') {
      const owner = this.clinicSession.ownerName();
      if (owner && owner !== '—') return owner;
    } else if (role === 'DOCTOR') {
      const doc = this.doctorSession.doctorName();
      if (doc && doc !== '—') return doc;
    } else if (role === 'PATIENT') {
      const pat = this.patientSession.patientName();
      if (pat && pat !== '—') return pat;
    }
    return this.db.currentUser().name;
  });

  ngOnInit(): void {
    const role = this.db.currentUser().role;
    if (role === 'DOCTOR') {
      this.doctorSession.fetchDoctor();
    } else if (role === 'OWNER' || role === 'RECEPTIONIST') {
      this.clinicSession.fetchClinic();
    }
  }

  onClinicChange(clinicId: string) {
    this.db.switchClinic(clinicId);
  }

  goToProfile() {
    const role = this.db.currentUser().role;
    if (role === 'PATIENT') {
      this.router.navigate(['/portal/patient/profile']);
    } else if (role === 'OWNER') {
      this.router.navigate(['/dashboard/clinic-admin/profile']);
    } else if (role === 'DOCTOR') {
      this.router.navigate(['/dashboard/doctor/profile']);
    } else if (role === 'RECEPTIONIST') {
      this.router.navigate(['/dashboard/receptionist/profile']);
    } else {
      this.router.navigate(['/profile']);
    }
  }

  logout() {
    this.db.logout();
  }

  goToLanding() {
    if (this.db.isAuthenticated()) {
      const role = this.db.currentUser().role;
      if (role === 'PATIENT') {
        this.router.navigate(['/portal/patient']);
      } else if (role === 'OWNER') {
        this.router.navigate(['/dashboard/owner']);
      } else if (role === 'DOCTOR') {
        this.router.navigate(['/dashboard/doctor']);
      } else if (role === 'RECEPTIONIST') {
        this.router.navigate(['/dashboard/receptionist']);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      this.router.navigate(['/']);
    }
  }

  goToAuth() {
    this.router.navigate(['/auth']);
  }

  goToRegisterClinic() {
    this.router.navigate(['/register-clinic']);
  }

  goToRegisterPatient() {
    this.router.navigate(['/register-patient']);
  }
}

