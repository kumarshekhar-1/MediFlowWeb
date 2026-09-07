import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

/**
 * Increments the LoadingService counter when a backend request starts
 * and decrements it when the request completes (success or error).
 * Only watches requests to our own backend (localhost:8080).
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('localhost:8080')) {
    return next(req);
  }

  const loading = inject(LoadingService);
  loading.increment();

  return next(req).pipe(
    finalize(() => loading.decrement())
  );
};
