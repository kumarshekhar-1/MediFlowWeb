import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';
import { environment } from '../../../environments/environment';

/**
 * API Auth Interceptor
 *
 * Attaches identity headers to every request directed at the mediFlow backend.
 * AuthTokenService is the single source of truth — no fallbacks, no path
 * detection, no hardcoded IDs. If the user is not authenticated the role is
 * sent as ANONYMOUS, which the backend accepts for public endpoints and rejects
 * (403) for protected ones.
 */
export const apiAuthInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  // Only intercept requests to the mediFlow backend
  const isBackend = req.url.startsWith(environment.apiUrl) || req.url.includes('localhost:8080');
  if (!isBackend) {
    return next(req);
  }

  const auth = inject(AuthTokenService);

  let headers = req.headers
    .set('Content-Type', 'application/json')
    .set('X-User-Role', auth.backendRole());

  const userId   = auth.userId();
  const clinicId = auth.clinicId();
  const token    = auth.token();

  if (userId)   headers = headers.set('X-User-Id',   userId);
  if (clinicId) headers = headers.set('X-Clinic-Id', clinicId);
  if (token)    headers = headers.set('Authorization', `Bearer ${token}`);

  return next(req.clone({ headers }));
};
