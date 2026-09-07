import { Component, inject, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SessionStateService } from '../../core/services/session-state.service';

@Component({
  selector: 'app-clinic-profile',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './clinic-profile.component.html',
  styleUrl: './clinic-profile.component.scss'
})
export class ClinicProfileComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly db = inject(SessionStateService);

  role = computed(() => this.db.currentUser().role);

  ngOnInit(): void {
    const currentRole = this.role();
    if (currentRole === 'OWNER') {
      this.router.navigate(['/dashboard/clinic-admin/profile']);
    } else if (currentRole === 'PATIENT') {
      this.router.navigate(['/portal/patient/profile']);
    } else if (currentRole === 'DOCTOR') {
      this.router.navigate(['/dashboard/doctor/profile']);
    } else if (currentRole === 'RECEPTIONIST') {
      this.router.navigate(['/dashboard/receptionist/profile']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
