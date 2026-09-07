import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="nprogress-bar" [class.visible]="loading.isLoading()">
      <div class="nprogress-fill"></div>
      <div class="nprogress-glow"></div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .nprogress-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }

    .nprogress-bar.visible {
      opacity: 1;
    }

    .nprogress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #7c3aed, #2563eb);
      background-size: 200% 100%;
      border-radius: 0 2px 2px 0;
      animation: progress-slide 1.4s ease-in-out infinite;
    }

    .nprogress-glow {
      position: absolute;
      top: 0;
      right: 0;
      width: 80px;
      height: 100%;
      background: radial-gradient(ellipse at right, rgba(124, 58, 237, 0.6) 0%, transparent 70%);
      filter: blur(3px);
    }

    @keyframes progress-slide {
      0%   { background-position: 200% 0; width: 20%; }
      50%  { background-position: 0% 0;   width: 75%; }
      100% { background-position: -200% 0; width: 95%; }
    }
  `]
})
export class ProgressBarComponent {
  loading = inject(LoadingService);
}
