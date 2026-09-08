import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';
import { environment } from '../../../environments/environment';

/**
 * Increments the LoadingService counter when a backend request starts
 * and decrements it when the request completes (success or error).
 * Only watches requests to our own backend.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const isBackend = req.url.startsWith(environment.apiUrl) || req.url.includes('localhost:8080');
  if (!isBackend) {
    return next(req);
  }

  const loading = inject(LoadingService);
  loading.increment();

  return next(req).pipe(
    finalize(() => loading.decrement())
  );
};
