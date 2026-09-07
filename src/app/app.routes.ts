import { Routes } from '@angular/router';
import { LandingPageComponent } from './features/landing/landing-page.component';
import { AuthPageComponent } from './features/auth/login/auth-page.component';
import { RegisterClinicComponent } from './features/auth/register-clinic/register-clinic.component';
import { RegisterPatientComponent } from './features/auth/register-patient/register-patient.component';
import { OwnerDashboardComponent } from './features/owner/owner-dashboard.component';
import { DoctorDashboardComponent } from './features/doctor/doctor-dashboard.component';
import { ReceptionistDashboardComponent } from './features/receptionist/receptionist-dashboard.component';
import { PatientPortalComponent } from './features/patient/patient-portal.component';
import { ClinicProfileComponent } from './features/clinic-profile/clinic-profile.component';
import { PatientProfileComponent } from './features/patient/components/patient-profile/patient-profile.component';
import { ClinicAdminProfileComponent } from './features/owner/components/clinic-admin-profile/clinic-admin-profile.component';
import { DoctorProfileComponent } from './features/doctor/components/doctor-profile/doctor-profile.component';
import { ReceptionistProfileComponent } from './features/receptionist/components/receptionist-profile/receptionist-profile.component';
import { authGuard, roleGuard, unauthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'auth', component: AuthPageComponent, canActivate: [unauthGuard] },
  { path: 'profile', component: ClinicProfileComponent, canActivate: [authGuard] },
  { path: 'portal/patient/profile', component: PatientProfileComponent, canActivate: [roleGuard(['PATIENT'])] },
  { path: 'dashboard/clinic-admin/profile', component: ClinicAdminProfileComponent, canActivate: [roleGuard(['OWNER'])] },
  { path: 'dashboard/doctor/profile', component: DoctorProfileComponent, canActivate: [roleGuard(['DOCTOR'])] },
  { path: 'dashboard/receptionist/profile', component: ReceptionistProfileComponent, canActivate: [roleGuard(['RECEPTIONIST'])] },
  { path: 'register-clinic', component: RegisterClinicComponent, canActivate: [unauthGuard] },
  { path: 'register-patient', component: RegisterPatientComponent, canActivate: [unauthGuard] },
  { path: 'dashboard/owner', component: OwnerDashboardComponent, canActivate: [roleGuard(['OWNER'])] },
  { path: 'dashboard/doctor', component: DoctorDashboardComponent, canActivate: [roleGuard(['DOCTOR'])] },
  { path: 'dashboard/receptionist', component: ReceptionistDashboardComponent, canActivate: [roleGuard(['RECEPTIONIST'])] },
  { path: 'portal/patient', component: PatientPortalComponent, canActivate: [roleGuard(['PATIENT'])] },
  { path: '**', redirectTo: '' }
];
// Routes trigger comment.
