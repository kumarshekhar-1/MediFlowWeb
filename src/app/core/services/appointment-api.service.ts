import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CreateAppointmentPayload {
  doctorId: string;
  patientId: string;
  appointmentDate: string; // YYYY-MM-DD
  slotStartTime: string;   // HH:mm:ss
  bookingSource: 'WEB' | 'WALK_IN' | 'WHATSAPP' | 'PHONE_CALL';
  reasonForVisit?: string;
  patientName: string;
  mobileNum: string;
}

export interface AppointmentApiResponse {
  appointmentId: string;
  clinicId: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialization?: string;
  patientId: string;
  receptionistId?: string;
  appointmentDate: string;
  slotStartTime: string;
  slotEndTime: string;
  status: string;
  paymentStatus: string;
  bookingSource: string;
  consultationFee: number;
  razorpayOrderId?: string;
  reasonForVisit?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/appointments`;

  /**
   * Book an appointment via POST /appointments/bookAppointment?clinicId=
   */
  bookAppointment(clinicId: string, payload: CreateAppointmentPayload): Observable<AppointmentApiResponse> {
    return this.http.post<AppointmentApiResponse>(`${this.baseUrl}/bookAppointment`, payload, {
      params: { clinicId }
    });
  }

  /**
   * List appointments for a patient.
   */
  listByPatient(clinicId: string | null | undefined, patientId: string, page: number = 0, size: number = 20): Observable<any> {
    let params: any = { patientId, page: String(page), size: String(size) };
    if (clinicId) params['clinicId'] = clinicId;
    return this.http.get<any>(`${this.baseUrl}/listByPatient`, { params });
  }

  /**
   * List appointments for a doctor by date.
   */
  listByDoctor(clinicId: string, doctorId: string, date: string, page: number = 0, size: number = 20): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/listByDoctor`, {
      params: { clinicId, doctorId, date, page, size }
    });
  }

  /**
   * Cancel an appointment.
   */
  cancelAppointment(clinicId: string, appointmentId: string, cancelReason: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/cancelAppointment`, { cancelReason }, {
      params: { clinicId, appointmentId }
    });
  }

  /**
   * Reschedule an appointment.
   */
  rescheduleAppointment(clinicId: string, appointmentId: string, payload: { newAppointmentDate: string; newSlotStartTime: string; reason?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/rescheduleAppointment`, payload, {
      params: { clinicId, appointmentId }
    });
  }

  /**
   * Get available consecutive 1-hour slots for a doctor on a date.
   */
  getAvailableSlots(clinicId: string, doctorId: string, date: string, intervalMinutes: number = 60): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/availableSlots`, {
      params: { clinicId, doctorId, date, intervalMinutes }
    });
  }

  /**
   * Confirm appointment payment via POST /appointments/confirmPayment?clinicId=&appointmentId=
   */
  confirmPayment(clinicId: string, appointmentId: string, payload: { razorpayOrderId: string; razorpayPaymentId: string }): Observable<AppointmentApiResponse> {
    return this.http.post<AppointmentApiResponse>(`${this.baseUrl}/confirmPayment`, payload, {
      params: { clinicId, appointmentId }
    });
  }

  /**
   * Get single appointment by ID
   */
  getAppointment(clinicId: string, appointmentId: string): Observable<AppointmentApiResponse> {
    return this.http.get<AppointmentApiResponse>(`${this.baseUrl}/getAppointment`, {
      params: { clinicId, appointmentId }
    });
  }

  /**
   * Mark appointment completed via POST /appointments/markComplete?clinicId=&appointmentId=
   */
  markComplete(clinicId: string, appointmentId: string): Observable<AppointmentApiResponse> {
    return this.http.post<AppointmentApiResponse>(`${this.baseUrl}/markComplete`, {}, {
      params: { clinicId, appointmentId }
    });
  }

  /**
   * Mark appointment as No-Show via POST /appointments/markNoShow?clinicId=&appointmentId=
   */
  markNoShow(clinicId: string, appointmentId: string): Observable<AppointmentApiResponse> {
    return this.http.post<AppointmentApiResponse>(`${this.baseUrl}/markNoShow`, {}, {
      params: { clinicId, appointmentId }
    });
  }
}
