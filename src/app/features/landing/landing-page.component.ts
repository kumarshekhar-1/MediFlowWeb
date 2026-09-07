import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SessionStateService } from '../../core/services/session-state.service';
import { UserRole } from '../../core/models/clinic.models';
import { QuickBookDialogComponent } from '../../shared/components/quick-book-dialog.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    MatDialogModule
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {
  readonly db = inject(SessionStateService);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    // Landing page is now fully optimized. No upfront API calls are made here.
  }

  openQuickBookModal(): void {
    this.dialog.open(QuickBookDialogComponent, {
      width: '960px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      panelClass: 'custom-dialog-container',
      disableClose: false
    });
  }



  goToLogin() {
    this.db.currentView.set('AUTH');
  }

  goToRegisterClinic() {
    this.db.currentView.set('REGISTER_CLINIC');
  }

  goToRegisterPatient() {
    this.db.currentView.set('REGISTER_PATIENT');
  }
}
