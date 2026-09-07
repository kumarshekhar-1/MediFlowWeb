import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthTokenService } from '../services/auth-token.service';
import { UserRole } from '../models/clinic.models';

/**
 * Ensures user is authenticated before allowing access.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthTokenService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  router.navigate(['/auth']);
  return false;
};

/**
 * Restricts access to specific frontend user roles.
 * Automatically redirects users to their appropriate dashboard if they try to access unauthorized paths.
 */
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route, state) => {
    const auth = inject(AuthTokenService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      router.navigate(['/auth']);
      return false;
    }

    const userRole = auth.frontendRole();
    if (allowedRoles.includes(userRole)) {
      return true;
    }

    // Unauthorized role: redirect to their matching portal dashboard
    switch (userRole) {
      case 'OWNER':
        router.navigate(['/dashboard/owner']);
        break;
      case 'DOCTOR':
        router.navigate(['/dashboard/doctor']);
        break;
      case 'RECEPTIONIST':
        router.navigate(['/dashboard/receptionist']);
        break;
      case 'PATIENT':
        router.navigate(['/portal/patient']);
        break;
      default:
        router.navigate(['/']);
    }
    return false;
  };
};

/**
 * Redirects authenticated users to their appropriate dashboard.
 * Used to protect login/registration pages from already logged-in users.
 */
export const unauthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthTokenService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  const userRole = auth.frontendRole();
  switch (userRole) {
    case 'OWNER':
      router.navigate(['/dashboard/owner']);
      break;
    case 'DOCTOR':
      router.navigate(['/dashboard/doctor']);
      break;
    case 'RECEPTIONIST':
      router.navigate(['/dashboard/receptionist']);
      break;
    case 'PATIENT':
      router.navigate(['/portal/patient']);
      break;
    default:
      router.navigate(['/']);
  }
  return false;
};

