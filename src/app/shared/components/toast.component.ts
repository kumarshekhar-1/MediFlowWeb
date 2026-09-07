import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast-{{ toast.type }}" (click)="toastService.dismiss(toast.id)">
          <span class="toast-icon">{{ icon(toast.type) }}</span>
          <span class="toast-msg">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.dismiss(toast.id); $event.stopPropagation()">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      pointer-events: none;
    }

    .toast {
      pointer-events: all;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 300px;
      max-width: 420px;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 550;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.08);
      cursor: pointer;
      animation: toast-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      backdrop-filter: blur(8px);
    }

    @keyframes toast-in {
      from { transform: translateX(110%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    .toast-success { background: #f0fdf4; border: 1px solid #86efac; color: #15803d; }
    .toast-error   { background: #fff1f2; border: 1px solid #fca5a5; color: #b91c1c; }
    .toast-info    { background: #eff6ff; border: 1px solid #93c5fd; color: #1d4ed8; }
    .toast-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }

    .toast-icon { font-size: 1.1rem; flex-shrink: 0; }

    .toast-msg { flex: 1; line-height: 1.4; }

    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      opacity: 0.5;
      font-size: 0.8rem;
      padding: 0 0.2rem;
      flex-shrink: 0;
      color: inherit;
      &:hover { opacity: 1; }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);

  icon(type: Toast['type']): string {
    switch (type) {
      case 'success': return '✓';
      case 'error':   return '✕';
      case 'warning': return '!';
      case 'info':    return 'ℹ';
    }
  }
}
