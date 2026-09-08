import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PatientRegistrationPayload {
  name: string;
  email: string;
  phoneNumber: string;
  emergencyContactNumber: string;
  address: string;
  pinCode: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  medicalHistory: string;
  patientId?: string;
}

export interface PatientApiResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class PatientApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/patient`;

  registerPatient(payload: PatientRegistrationPayload): Observable<PatientApiResponse> {
    return this.http.post<PatientApiResponse>(`${this.baseUrl}/registerPatient`, payload);
  }

  getPatientDetails(patientId: string): Observable<PatientRegistrationPayload> {
    return this.http.get<PatientRegistrationPayload>(`${this.baseUrl}/getPatientDetails`, {
      params: { patientId }
    });
  }

  getPatientByMobileNo(mobileNo: string): Observable<PatientRegistrationPayload[]> {
    return this.http.get<PatientRegistrationPayload[]>(`${this.baseUrl}/getPatientByMobileNo`, {
      params: { mobileNo }
    });
  }

  updatePatientDetails(payload: PatientRegistrationPayload): Observable<PatientApiResponse> {
    return this.http.put<PatientApiResponse>(`${this.baseUrl}/updatePatientDetails`, payload);
  }
}
