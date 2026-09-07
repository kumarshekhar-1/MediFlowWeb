import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { ClinicSessionService } from '../../../../core/services/clinic-session.service';
import { SessionStateService } from '../../../../core/services/session-state.service';

@Component({
  selector: 'app-receptionist-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule
  ],
  templateUrl: './receptionist-profile.component.html',
  styleUrl: './receptionist-profile.component.scss'
})
export class ReceptionistProfileComponent implements OnInit {
  private readonly router = inject(Router);
  readonly clinicSession = inject(ClinicSessionService);
  readonly db = inject(SessionStateService);

  ngOnInit(): void {
    this.clinicSession.fetchClinic();
  }

  goBack(): void {
    this.router.navigate(['/dashboard/receptionist']);
  }
}
