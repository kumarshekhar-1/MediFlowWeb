import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DoctorCreationPayload } from '../models/doctor.model';
import { environment } from '../../../environments/environment';
export interface ClinicRegistrationPayload {
  clinicName: string;
  ownerName: string;
  ownerPhoneNumber: string;   // must be +91XXXXXXXXXX
  ownerEmail: string;
  clinicRegistrationNumber: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;            // 6 digits
  specializations: string[];  // at least one
  latitude: number;
  longitude: number;
  clinicId?: string;
}

export interface ClinicApiResponse {
  clinicId: string;
  clinicName: string;
  ownerName: string;
  ownerPhoneNumber: string;
  ownerEmail: string;
  clinicRegistrationNumber: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  specializations: string[];
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  latitude?: number;
  longitude?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClinicApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/clinics`;


  /**
   * Add a doctor to a clinic.
   */
  addDoctor(clinicId: string, payload: DoctorCreationPayload): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/addDoctor`, payload, { params: { clinicId } });
  }

  /**
   * Get details of a single doctor.
   */
  getDoctor(clinicId: string, doctorId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/getDoctor`, { params: { clinicId, doctorId } });
  }

  /**
   * List paginated doctors for a clinic.
   */
  listDoctors(clinicId?: string, page = 0, size = 100, specialization?: string, search?: string): Observable<any> {
    let params: any = { page: String(page), size: String(size) };
    if (clinicId) params['clinicId'] = clinicId;
    if (specialization) params['specialization'] = specialization;
    if (search) params['search'] = search;
    return this.http.get<any>(`${this.baseUrl}/listDoctors`, { params });
  }

  /**
   * Update a doctor's details.
   */
  updateDoctor(clinicId: string, doctorId: string, payload: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/updateDoctor`, payload, { params: { clinicId, doctorId } });
  }

  /**
   * Add a receptionist to a clinic.
   */
  addReceptionist(clinicId: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/addReceptionist`, payload, { params: { clinicId } });
  }

  /**
   * List all receptionists for a clinic.
   */
  listReceptionists(clinicId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/listReceptionists`, { params: { clinicId } });
  }

  /**
   * Assign receptionist to doctor via PUT /clinics/assignReceptionist?clinicId=&doctorId=&receptionistId=
   */
  assignReceptionist(clinicId: string, doctorId: string, receptionistId: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/assignReceptionist`, {}, {
      params: { clinicId, doctorId, receptionistId }
    });
  }


  registerClinic(payload: ClinicRegistrationPayload): Observable<ClinicApiResponse> {
    return this.http.post<ClinicApiResponse>(`${this.baseUrl}/createClinic`, payload);
  }

  getClinic(clinicId: string): Observable<ClinicApiResponse> {
    return this.http.get<ClinicApiResponse>(`${this.baseUrl}/getClinic`, {
      params: { clinicId }
    });
  }

  /**
   * Update clinic profile details.
   */
  updateClinic(clinicId: string, payload: any): Observable<ClinicApiResponse> {
    return this.http.put<ClinicApiResponse>(`${this.baseUrl}/updateClinic`, payload, {
      params: { clinicId }
    });
  }

  /**
   * List paginated clinics.
   */
  listClinics(
    page: number = 0,
    size: number = 50,
    status?: string,
    city?: string,
    specialization?: string,
    clinicName?: string,
    latitude?: number,
    longitude?: number,
    radius?: number
  ): Observable<any> {
    const params: any = { page: String(page), size: String(size) };
    if (status) params.status = status;
    if (city) params.city = city;
    if (specialization) params.specialization = specialization;
    if (clinicName) params.clinicName = clinicName;
    if (latitude !== undefined && latitude !== null) params.latitude = String(latitude);
    if (longitude !== undefined && longitude !== null) params.longitude = String(longitude);
    if (radius !== undefined && radius !== null && radius > 0) params.radius = String(radius);
    return this.http.get<any>(`${this.baseUrl}/listClinics`, { params });
  }

  // Payload interface for doctor creation
  // Note: adjust types as needed to match backend DTO
  // e.g., mobileNumber must include +91 prefix
}
