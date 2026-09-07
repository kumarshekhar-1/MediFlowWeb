import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionStateService } from '../../../../core/services/session-state.service';

@Component({
  selector: 'app-owner-audit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owner-audit.component.html'
})
export class OwnerAuditComponent {
  readonly db = inject(SessionStateService);
}
