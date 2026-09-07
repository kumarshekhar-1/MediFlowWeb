export interface DoctorSchedule {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string; // Format: "HH:mm" (e.g. "09:00")
  endTime: string;   // Format: "HH:mm" (e.g. "17:00")
}

export interface DoctorCreationPayload {
  name: string;
  mobileNumber: string; // Must include +91 prefix
  registrationNumber: string;
  specialization: string;
  email: string;
  qualification?: string;
  avgConsultationTimeMinutes?: number;
  consultationFee?: number;
  receptionistId?: string;
  schedules: DoctorSchedule[];
}
