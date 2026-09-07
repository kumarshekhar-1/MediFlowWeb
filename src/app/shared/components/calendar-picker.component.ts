import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule, MatCalendar } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-calendar-picker',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule, 
    MatDatepickerModule, 
    MatNativeDateModule, 
    MatCardModule, 
    MatButtonModule, 
    MatIconModule
  ],
  templateUrl: './calendar-picker.component.html',
  styleUrl: './calendar-picker.component.scss'
})
export class CalendarPickerComponent {
  @ViewChild(MatCalendar) matCalendar?: MatCalendar<Date>;
  @Input() scheduleLabel: string = '';

  @Input() set selectedDate(val: string) {
    if (val) {
      const parts = val.split('-');
      if (parts.length === 3) {
        this.selectedDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
    } else {
      this.selectedDateObj = null;
    }
  }

  private _allowedWeekdays: number[] = [];

  // Allowed days of week: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  @Input() set allowedWeekdays(val: number[]) {
    this._allowedWeekdays = val || [];
    this.dateFilter = this.createDateFilter(this._allowedWeekdays);
    if (this.matCalendar) {
      this.matCalendar.updateTodaysDate();
    }
  }
  get allowedWeekdays(): number[] {
    return this._allowedWeekdays;
  }

  @Output() dateChange = new EventEmitter<string>();

  selectedDateObj: Date | null = new Date();
  minDate: Date = new Date();

  createDateFilter(allowed: number[]) {
    return (d: Date | null): boolean => {
      if (!d) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) return false;

      if (allowed && allowed.length > 0) {
        return allowed.includes(d.getDay());
      }
      return true;
    };
  }

  dateFilter = this.createDateFilter([]);

  onDateSelected(date: Date | null) {
    if (date) {
      this.selectedDateObj = date;
      const formatted = this.formatDateString(date);
      this.dateChange.emit(formatted);
    }
  }

  setToday() {
    this.selectNearestAllowedDate(new Date());
  }

  setTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.selectNearestAllowedDate(tomorrow);
  }

  setNextWeek() {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    this.selectNearestAllowedDate(nextWeek);
  }

  private selectNearestAllowedDate(startDate: Date) {
    let d = new Date(startDate);
    const allowed = this.allowedWeekdays;
    if (allowed && allowed.length > 0) {
      for (let i = 0; i < 7; i++) {
        if (allowed.includes(d.getDay())) {
          break;
        }
        d.setDate(d.getDate() + 1);
      }
    }
    this.selectedDateObj = d;
    this.dateChange.emit(this.formatDateString(d));
  }

  private formatDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
