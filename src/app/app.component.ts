import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar.component';
import { ToastComponent } from './shared/components/toast.component';
import { ProgressBarComponent } from './shared/components/progress-bar.component';
import { SessionStateService } from './core/services/session-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    RouterOutlet,
    ToastComponent,
    ProgressBarComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  db = inject(SessionStateService);
  private router = inject(Router);

  constructor() {
    // 1. Two-way binding: Sync Signal state changes to Router URLs
    effect(() => {
      const view = this.db.currentView();
      const user = this.db.currentUser();

      let targetPath = '/';
      let allowedPrefixes: string[] = [];

      if (view === 'AUTH') {
        targetPath = '/auth';
        allowedPrefixes = ['/auth'];
      } else if (view === 'REGISTER_CLINIC') {
        targetPath = '/register-clinic';
        allowedPrefixes = ['/register-clinic'];
      } else if (view === 'REGISTER_PATIENT') {
        targetPath = '/register-patient';
        allowedPrefixes = ['/register-patient'];
      } else if (view === 'APP') {
        if (user.role === 'OWNER') {
          targetPath = '/dashboard/owner';
          allowedPrefixes = ['/dashboard/owner', '/dashboard/clinic-admin'];
        } else if (user.role === 'DOCTOR') {
          targetPath = '/dashboard/doctor';
          allowedPrefixes = ['/dashboard/doctor'];
        } else if (user.role === 'RECEPTIONIST') {
          targetPath = '/dashboard/receptionist';
          allowedPrefixes = ['/dashboard/receptionist'];
        } else if (user.role === 'PATIENT') {
          targetPath = '/portal/patient';
          allowedPrefixes = ['/portal/patient'];
        }
      }

      const currentUrl = this.router.url;
      const isOnAllowedPath = allowedPrefixes.some(pref => currentUrl.startsWith(pref));

      if (!isOnAllowedPath && currentUrl !== targetPath && currentUrl !== '/' + targetPath) {
        this.router.navigateByUrl(targetPath);
      }
    });

    // 2. Two-way binding: Sync manual URL changes/page reload back to signals
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects;
        if (url === '/' || url === '/landing') {
          this.db.currentView.set('LANDING');
        } else if (url === '/auth') {
          this.db.currentView.set('AUTH');
        } else if (url === '/register-clinic') {
          this.db.currentView.set('REGISTER_CLINIC');
        } else if (url === '/register-patient') {
          this.db.currentView.set('REGISTER_PATIENT');
        } else if (url.startsWith('/dashboard/owner')) {
          this.db.currentView.set('APP');
        } else if (url.startsWith('/dashboard/doctor')) {
          this.db.currentView.set('APP');
        } else if (url.startsWith('/dashboard/receptionist')) {
          this.db.currentView.set('APP');
        } else if (url.startsWith('/portal/patient')) {
          this.db.currentView.set('APP');
        }
      }
    });
  }

  getRoleTitle(role: string): string {
    switch (role) {
      case 'OWNER': return 'Clinic Owner / Executive Dashboard';
      case 'DOCTOR': return 'Doctor Consultation Desk & Fast Prescription System';
      case 'RECEPTIONIST': return 'Reception Desk & Live Token Queue';
      case 'PATIENT': return 'Patient Discovery & Medical Portal';
      default: return 'Portal';
    }
  }
}
