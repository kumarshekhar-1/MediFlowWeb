import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PrescriptionMedicinePayload {
  medicineName: string;
  dosage: string;
  durationDays: number;
  instructions?: string;
  morningQty?: number;
  afternoonQty?: number;
  nightQty?: number;
  timing?: string;
  route?: string;
}

export interface CreatePrescriptionPayload {
  appointmentId: string;
  diagnosis: string;
  notes?: string;
  followUpDate?: string; // YYYY-MM-DD
  bloodPressure?: string;
  pulseRateBpm?: number;
  weightKg?: number;
  temperatureFahrenheit?: number;
  allergies?: string[];
  medicines: PrescriptionMedicinePayload[];
  investigationsAdvised?: string[];
}

export interface PrescriptionApiResponse {
  prescriptionId: string;
  appointmentId: string;
  clinicId: string;
  doctorId: string;
  patientId: string;
  diagnosis: string;
  notes?: string;
  followUpDate?: string;
  bloodPressure?: string;
  pulseRateBpm?: number;
  weightKg?: number;
  temperatureFahrenheit?: number;
  allergies?: string[];
  medicines: PrescriptionMedicinePayload[];
  investigationsAdvised?: string[];
  pdfAvailable?: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PrescriptionApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/clinics';

  /**
   * Create digital prescription via POST /clinics/{clinicId}/prescriptions
   */
  createPrescription(clinicId: string, payload: CreatePrescriptionPayload, doctorId?: string): Observable<PrescriptionApiResponse> {
    const headers: Record<string, string> = {
      'X-Clinic-Id': clinicId
    };
    if (doctorId) {
      headers['X-User-Id'] = doctorId;
      headers['X-User-Role'] = 'DOCTOR';
    } else {
      headers['X-User-Role'] = 'CLINIC_ADMIN';
    }

    return this.http.post<PrescriptionApiResponse>(`${this.baseUrl}/${clinicId}/prescriptions`, payload, {
      headers
    });
  }

  /**
   * Get prescription by ID
   */
  getPrescription(clinicId: string, prescriptionId: string): Observable<PrescriptionApiResponse> {
    return this.http.get<PrescriptionApiResponse>(`${this.baseUrl}/${clinicId}/prescriptions/${prescriptionId}`);
  }

  /**
   * Get prescription by appointment ID
   */
  getPrescriptionByAppointment(clinicId: string, appointmentId: string): Observable<PrescriptionApiResponse> {
    return this.http.get<PrescriptionApiResponse>(`${this.baseUrl}/${clinicId}/prescriptions/by-appointment/${appointmentId}`);
  }

  listByPatient(clinicId: string, patientId: string, page: number = 0, size: number = 10, doctorId?: string): Observable<any> {
    const params: any = { page, size };
    if (doctorId) {
      params.doctorId = doctorId;
    }
    return this.http.get<any>(`${this.baseUrl}/${clinicId}/prescriptions/by-patient/${patientId}`, { params });
  }

  /**
   * List prescriptions globally by patient ID (clinicId is optional in query parameter)
   */
  listByPatientGlobal(patientId: string, page: number = 0, size: number = 10, doctorId?: string, clinicId?: string): Observable<any> {
    const params: any = { page, size };
    if (doctorId) {
      params.doctorId = doctorId;
    }
    if (clinicId) {
      params.clinicId = clinicId;
    }
    const rootUrl = this.baseUrl.replace('/clinics', '');
    return this.http.get<any>(`${rootUrl}/prescriptions/by-patient/${patientId}`, { params });
  }

  /**
   * List prescriptions by doctor ID
   */
  listByDoctor(clinicId: string, doctorId: string, page: number = 0, size: number = 10): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${clinicId}/prescriptions/by-doctor/${doctorId}`, {
      params: { page, size }
    });
  }

  /**
   * Download Prescription PDF as Blob
   */
  downloadPdf(clinicId: string, prescriptionId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${clinicId}/prescriptions/${prescriptionId}/pdf`, {
      responseType: 'blob'
    });
  }



  /**
   * Auto-suggest medicines by name and optional diagnosis (e.g. GET /prescriptions/suggestions/medicines)
   */
  suggestMedicines(query: string, diagnosis?: string, limit: number = 10): Observable<any[]> {
    const params: any = { query, limit };
    if (diagnosis) {
      params.diagnosis = diagnosis;
    }
    return this.http.get<any[]>('http://localhost:8080/prescriptions/suggestions/medicines', { params });
  }

  /**
   * Auto-suggest diagnosis / diseases (e.g. GET /prescriptions/suggestions/diagnosis)
   */
  suggestDiagnosis(query: string, limit: number = 10): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:8080/prescriptions/suggestions/diagnosis', {
      params: { query, limit }
    });
  }
}
