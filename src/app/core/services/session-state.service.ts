import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User, Clinic, Doctor, Receptionist, Patient, Appointment, Medicine, ClinicService, Invoice, Prescription, PrescriptionTemplate, Expense, AuditLog, UserRole } from '../models/clinic.models';
import { AuthTokenService } from './auth-token.service';

export interface LoginRequest {
  userId: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  userId: string;
  username: string;
  role: string;
  clinicId: string;
}

const GUEST_USER: User = {
  id: '',
  name: 'Guest',
  email: '',
  phone: '',
  role: 'PATIENT',
  status: 'ACTIVE',
  createdAt: new Date().toISOString()
};

@Injectable({
  providedIn: 'root'
})
export class SessionStateService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  readonly authToken = inject(AuthTokenService);

  // Core Session Signals derived directly from AuthTokenService (stored in localStorage under mediflow_auth_session)
  readonly isAuthenticated = signal<boolean>(this.authToken.isAuthenticated());
  readonly currentClinicId = signal<string>(this.authToken.clinicId() || '');
  readonly currentUser = signal<User>(this.buildUserFromAuth());
  readonly currentView = signal<'AUTH' | 'APP' | 'LANDING' | 'REGISTER_CLINIC' | 'REGISTER_PATIENT'>('LANDING');

  // Memory-only signals for components
  readonly services = signal<ClinicService[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly auditLogs = signal<AuditLog[]>([]);
  readonly doctors = signal<Doctor[]>([]);
  readonly receptionists = signal<Receptionist[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly clinics = signal<Clinic[]>([]);
  readonly clinicAppointments = signal<Appointment[]>([]);
  readonly templates = signal<PrescriptionTemplate[]>([]);
  readonly prescriptions = signal<Prescription[]>([]);
  readonly medicines = signal<Medicine[]>([]);

  // Computed views
  readonly clinicInvoices = computed(() => this.invoices().filter(i => i.clinicId === this.currentClinicId()));
  readonly clinicExpenses = computed(() => this.expenses().filter(e => e.clinicId === this.currentClinicId()));
  readonly clinicServices = computed(() => this.services().filter(s => s.clinicId === this.currentClinicId()));
  readonly appointments = computed(() => this.clinicAppointments());
  readonly clinicDoctors = computed(() => this.doctors().filter(d => d.hospitalId === this.currentClinicId()));
  readonly clinicReceptionists = computed(() => this.receptionists().filter(r => r.id));

  readonly currentDoctor = computed<Doctor>(() => {
    const user = this.currentUser();
    return {
      id: user.role === 'DOCTOR' ? user.id : '',
      userId: user.id,
      hospitalId: this.currentClinicId(),
      name: user.role === 'DOCTOR' ? user.name : '',
      phone: user.phone,
      email: user.email,
      specialization: '',
      qualification: '',
      registrationNo: '',
      experienceYears: 0,
      consultationFee: 0,
      languages: [],
      workingDays: [],
      workingHours: '',
      slotDurationMins: 15,
      onlineConsultation: false,
      avatar: 'assets/avatars/doctor-male.png',
      council: ''
    } as Doctor;
  });

  readonly currentPatient = computed<Patient>(() => {
    const user = this.currentUser();
    return {
      id: user.role === 'PATIENT' ? user.id : '',
      userId: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      age: 0,
      gender: 'MALE',
      bloodGroup: '',
      emergencyContact: { name: '', relationship: '', phone: '' },
      address: '',
      dateOfBirth: '',
      createdAt: new Date().toISOString()
    } as Patient;
  });

  readonly currentClinic = computed<Clinic>(() => {
    return {
      id: this.currentClinicId(),
      name: '',
      type: 'CLINIC',
      address: '',
      city: '',
      state: '',
      pincode: '',
      contact: '',
      email: '',
      regNumber: '',
      ownerId: '',
      status: 'ACTIVE',
      rating: 0,
      totalReviews: 0,
      latitude: 0,
      longitude: 0,
      openingHours: '',
      emergencyContact: ''
    } as Clinic;
  });

  constructor() {
    this.cleanLegacyStorage();
  }

  private buildUserFromAuth(): User {
    if (!this.authToken.isAuthenticated()) return GUEST_USER;
    return {
      id: this.authToken.userId() || '',
      name: this.authToken.username() || 'User',
      email: '',
      phone: '',
      role: this.authToken.frontendRole(),
      clinicId: this.authToken.clinicId() || undefined,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
  }

  private cleanLegacyStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mediflow_session_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  }

  switchClinic(clinicId: string): void {
    this.currentClinicId.set(clinicId);
    this.logAudit('SWITCH_CLINIC', 'Clinic', clinicId, `Switched context to clinic ${clinicId}`);
  }

  login(userId: string, password: string): Observable<LoginResponse> {
    const payload: LoginRequest = { userId, password };
    return this.http.post<LoginResponse>('http://localhost:8080/auth/login', payload).pipe(
      tap(res => {
        if (res && res.token) {
          // Store ONLY the login API response object in localStorage
          this.authToken.save({
            token: res.token,
            userId: res.userId,
            username: res.username || 'User',
            backendRole: res.role,
            clinicId: res.clinicId || null,
            expiresAt: Date.now() + (res.expiresInSeconds * 1000)
          });

          const mappedRole: UserRole = res.role === 'CLINIC_ADMIN' ? 'OWNER' : (res.role as any);
          const user: User = {
            id: res.userId,
            name: res.username || 'User',
            email: '',
            phone: '',
            role: mappedRole,
            clinicId: res.clinicId || undefined,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
          };
          this.currentUser.set(user);
          this.isAuthenticated.set(true);
          this.currentClinicId.set(res.clinicId || '');
        }
      })
    );
  }

  registerPatientPortal(mobileNo: string, patientName: string, password: string): Observable<any> {
    return this.http.post<any>('http://localhost:8080/auth/signin-patient', {
      mobileNo,
      patientName,
      password
    });
  }

  registerClinicPortal(mobileNo: string, clinicName: string, password: string): Observable<any> {
    return this.http.post<any>('http://localhost:8080/auth/signin-clinic', {
      mobileNo,
      clinicName,
      password
    });
  }

  logout(): void {
    this.authToken.clear();
    this.isAuthenticated.set(false);
    this.currentUser.set(GUEST_USER);
    this.currentClinicId.set('');
    this.currentView.set('LANDING');
    this.router.navigate(['/']);
  }

  // Mutators for local components (kept in signal memory)
  addService(service: Omit<ClinicService, 'id'>): void {
    const newService: ClinicService = {
      ...service,
      id: 'SRV_' + Math.random().toString(36).substr(2, 9)
    };
    this.services.set([...this.services(), newService]);
    this.logAudit('ADD_SERVICE', 'Service', newService.id, `Service ${service.name} added`);
  }

  addExpense(expense: Omit<Expense, 'id' | 'recordedBy'>): void {
    const newExpense: Expense = {
      ...expense,
      id: 'EXP_' + Math.random().toString(36).substr(2, 9),
      recordedBy: this.currentUser().name
    };
    this.expenses.set([...this.expenses(), newExpense]);
    this.logAudit('ADD_EXPENSE', 'Expense', newExpense.id, `Expense of amount ${expense.amount} added`);
  }

  updateAppointmentStatus(id: string, status: string): void {
    this.clinicAppointments.set(this.clinicAppointments().map(a => a.id === id ? { ...a, status: status as any } : a));
  }

  bookAppointment(payload: Partial<Appointment>): void {
    const newApt: Appointment = {
      ...payload,
      id: 'APT_' + Math.random().toString(36).substr(2, 9),
      status: 'WAITING',
      paymentStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      patientName: payload.patientName || 'Guest Patient',
      doctorName: payload.doctorName || 'Doctor',
      doctorSpecialization: payload.doctorSpecialization || 'Physician',
      patientPhone: payload.patientPhone || '',
      tokenNumber: payload.tokenNumber || 'T-01'
    } as any;
    this.clinicAppointments.set([...this.clinicAppointments(), newApt]);
  }

  createInvoice(payload: Omit<Invoice, 'id' | 'invoiceNumber' | 'status' | 'dueDate' | 'createdAt' | 'updatedAt' | 'subtotal' | 'total' | 'tax'> & { tax?: number }): Invoice {
    const subtotal = payload.items.reduce((sum: number, it: any) => sum + (it.amount || 0), 0);
    const total = Math.max(0, subtotal - (payload.discount || 0));
    const tax = payload.tax || 0;

    const newInvoice: Invoice = {
      ...payload,
      id: 'INV_' + Math.random().toString(36).substr(2, 9),
      invoiceNumber: 'INV-' + Date.now(),
      status: 'UNPAID',
      dueDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtotal,
      total,
      tax
    } as any;
    this.invoices.set([...this.invoices(), newInvoice]);
    return newInvoice;
  }

  recordPayment(invoiceId: string, amount: number, method: string): void {
    this.invoices.set(this.invoices().map(i => i.id === invoiceId ? { ...i, status: 'PAID' as any } : i));
  }

  saveTemplate(template: Omit<PrescriptionTemplate, 'id'>): void {
    const newTpl: PrescriptionTemplate = {
      ...template,
      id: 'TPL_' + Math.random().toString(36).substr(2, 9)
    };
    this.templates.set([...this.templates(), newTpl]);
  }

  createPrescription(prescription: Omit<Prescription, 'id' | 'createdAt' | 'prescriptionNumber' | 'issuedAt'>): Prescription {
    const newRx: Prescription = {
      ...prescription,
      id: 'RX_' + Math.random().toString(36).substr(2, 9),
      prescriptionNumber: 'RX-' + Date.now(),
      issuedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    } as any;
    this.prescriptions.set([...this.prescriptions(), newRx]);
    return newRx;
  }

  logAudit(action: string, entityType: string, entityId: string, details: string): void {
    const log = {
      id: 'AUD_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      userId: this.currentUser().id,
      userName: this.currentUser().name,
      userRole: this.currentUser().role,
      action,
      entityType,
      entityId,
      details
    };
    this.auditLogs.set([log, ...this.auditLogs()].slice(0, 200) as any);
  }
}
