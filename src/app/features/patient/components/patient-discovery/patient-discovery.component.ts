import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CustomSelectComponent, SelectOption } from '../../../../shared/components/custom-select.component';
import { ClinicApiService } from '../../../../core/services/clinic-api.service';
import { Doctor } from '../../../../core/models/clinic.models';
import { Subject, Subscription, asapScheduler } from 'rxjs';
import { debounceTime, distinctUntilChanged, observeOn } from 'rxjs/operators';

@Component({
  selector: 'app-patient-discovery',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CustomSelectComponent],
  templateUrl: './patient-discovery.component.html',
  styleUrl: './patient-discovery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientDiscoveryComponent implements OnInit, OnDestroy {
  private readonly clinicApi = inject(ClinicApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  apiDoctors: any[] = [];
  apiDoctorsLoading: boolean = false;
  apiClinics: any[] = [];
  apiClinicsLoading: boolean = false;
  doctorSearch = '';
  selectedSpecialty = 'ALL';
  discoveryClinicId = 'ALL';
  specialties = ['General Physician', 'Cardiologist', 'Pediatrician', 'Dermatologist'];

  doctorsList: Doctor[] = [];
  filteredDoctors: Doctor[] = [];
  discoveryClinicSelectOptions: SelectOption[] = [{ value: 'ALL', label: 'All Clinics & Hospitals' }];

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  @Output() bookDoctor = new EventEmitter<Doctor>();

  ngOnInit(): void {
    this.loadClinics();
    this.loadAllDoctors();

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((query) => {
      this.doctorSearch = query;
      const specFilter = this.selectedSpecialty === 'ALL' ? undefined : this.selectedSpecialty;
      const clinicFilter = this.discoveryClinicId === 'ALL' ? undefined : this.discoveryClinicId;
      this.loadAllDoctors(clinicFilter, specFilter);
    });
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  loadAllDoctors(clinicId?: string, specialization?: string): void {
    if (this.apiDoctorsLoading) return;
    this.apiDoctorsLoading = true;

    this.clinicApi.listDoctors(clinicId, 0, 100, specialization, this.doctorSearch)
      .pipe(observeOn(asapScheduler))
      .subscribe({
        next: (res) => {
          const list = res?.content ?? (Array.isArray(res) ? res : []);
          this.apiDoctors = list;
          this.apiDoctorsLoading = false;
          this.updateDoctorsListAndFilters();
          this.cdr.markForCheck();
        },
        error: () => {
          this.apiDoctors = [];
          this.apiDoctorsLoading = false;
          this.updateDoctorsListAndFilters();
          this.cdr.markForCheck();
        }
      });
  }

  loadClinics(): void {
    if (this.apiClinicsLoading) return;
    this.apiClinicsLoading = true;

    this.clinicApi.listClinics(0, 50)
      .pipe(observeOn(asapScheduler))
      .subscribe({
        next: (res) => {
          this.apiClinicsLoading = false;
          const list = res?.content ?? (Array.isArray(res) ? res : []);
          this.apiClinics = list;
          
          const options: SelectOption[] = [{ value: 'ALL', label: 'All Clinics & Hospitals' }];
          list.forEach((c: any) => {
            options.push({
              value: c.clinicId,
              label: c.clinicName,
              subLabel: `${c.addressLine || c.city || ''}`
            });
          });
          this.discoveryClinicSelectOptions = options;
          this.updateDoctorsListAndFilters();
          this.cdr.markForCheck();
        },
        error: () => {
          this.apiClinicsLoading = false;
        }
      });
  }

  onSearchChanged(query: string): void {
    this.searchSubject.next(query);
  }

  onSpecialtySelected(spec: string): void {
    this.selectedSpecialty = spec;
    const specFilter = spec === 'ALL' ? undefined : spec;
    const clinicFilter = this.discoveryClinicId === 'ALL' ? undefined : this.discoveryClinicId;
    this.loadAllDoctors(clinicFilter, specFilter);
  }

  onDiscoveryClinicSelected(clinicId: string): void {
    this.discoveryClinicId = clinicId;
    const clinicFilter = clinicId === 'ALL' ? undefined : clinicId;
    const specFilter = this.selectedSpecialty === 'ALL' ? undefined : this.selectedSpecialty;
    this.loadAllDoctors(clinicFilter, specFilter);
  }

  onBookClick(doc: Doctor): void {
    this.bookDoctor.emit(doc);
  }

  updateDoctorsListAndFilters(): void {
    const apiList = this.apiDoctors;
    const clinics = this.apiClinics;
    
    this.doctorsList = apiList.map((d: any) => {
      const cln = clinics.find((c: any) => c.clinicId === d.clinicId);
      const clinicName = cln?.clinicName || 'MediFlow Clinic';
      return {
        id: d.doctorId,
        userId: `usr-${d.doctorId}`,
        hospitalId: d.clinicId || '',
        hospitalName: d.clinicName || clinicName,
        name: d.name,
        phone: d.mobileNumber || '',
        email: d.email || '',
        registrationNo: d.registrationNumber || '',
        council: '',
        qualification: d.qualification || '',
        specialization: d.specialization || '',
        experienceYears: d.experienceYears || 0,
        consultationFee: Number(d.consultationFee || 0),
        languages: d.languages || [],
        workingDays: d.schedules && d.schedules.length > 0 
          ? d.schedules.map((s: any) => s.dayOfWeek ? (s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase()) : '')
          : [],
        workingHours: d.schedules && d.schedules.length > 0
          ? `${d.schedules[0].startTime?.substring(0, 5) || ''} - ${d.schedules[0].endTime?.substring(0, 5) || ''}`
          : '',
        slotDurationMins: d.avgConsultationTimeMinutes || 15,
        onlineConsultation: true
      };
    });

    this.filteredDoctors = [...this.doctorsList];
  }
}
