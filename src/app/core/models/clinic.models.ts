export type UserRole = 'OWNER' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT';

export type AppointmentStatus = 
  | 'PENDING_PAYMENT'
  | 'BOOKED' 
  | 'CONFIRMED' 
  | 'CHECKED_IN' 
  | 'WAITING' 
  | 'IN_CONSULTATION' 
  | 'CONSULTATION_COMPLETED' 
  | 'BILL_GENERATED' 
  | 'PAID' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'RESCHEDULED' 
  | 'NO_SHOW';

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'NET_BANKING';
export type InvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'REFUNDED';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE';
  clinicId?: string;
  createdAt: string;
}

export interface Clinic {
  id: string;
  name: string;
  type: 'CLINIC' | 'HOSPITAL' | 'DIAGNOSTIC_CENTRE';
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact: string;
  email: string;
  regNumber: string;
  ownerId: string;
  logoUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  emergencyContact?: string;
  rating?: number;
  totalReviews?: number;
  distanceKm?: number; // Calculated dynamically from user's current GPS location
}

export interface Doctor {
  id: string;
  userId: string;
  hospitalId: string;
  name: string;
  phone: string;
  email: string;
  registrationNo: string;
  council: string;
  qualification: string;
  specialization: string;
  experienceYears: number;
  consultationFee: number;
  languages: string[];
  workingDays: string[];
  workingHours: string; // e.g. "09:00 AM - 05:00 PM"
  slotDurationMins: number;
  onlineConsultation: boolean;
  avatar?: string;
  hospitalName?: string;
}

export interface Receptionist {
  id: string;
  userId: string;
  hospitalId: string;
  name: string;
  phone: string;
  email: string;
  employeeId: string;
  branch: string;
  assignedDoctorIds: string[];
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Patient {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth: string;
  age?: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup?: string;
  allergies?: string[];
  existingConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  address?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clinicId: string;
  clinicName?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientAge?: number;
  patientGender?: string;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string;       // e.g. "10:30 AM"
  status: AppointmentStatus;
  tokenNumber: string;    // e.g. "T-01"
  queuePosition?: number;
  reason?: string;
  symptoms?: string[];
  notes?: string;
  consultationFee?: number;
  paymentStatus?: string;
  cancelReason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  strength: string; // e.g. "650 mg", "40 mg"
  form: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Ointment' | 'Drops';
  category: string;
  defaultFrequency: string; // e.g. "1-0-1"
  defaultDuration: string;  // e.g. "5 days"
  defaultRoute: string;     // e.g. "Oral"
}

export interface PrescriptionItem {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  form: string;
  dosage: string;      // e.g. "1 Tablet"
  frequency: string;   // e.g. "1-0-1 (After Food)"
  duration: string;    // e.g. "5 Days"
  route: string;       // e.g. "Oral"
  instructions: string;// e.g. "Take after breakfast and dinner with water"
}

export interface Prescription {
  id: string;
  consultationId: string;
  appointmentId: string;
  clinicId: string;
  clinicName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  doctorRegNo: string;
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  prescriptionNumber: string;
  symptoms: string[];
  diagnosis: string;
  clinicalNotes?: string;
  items: PrescriptionItem[];
  advice: string[];
  customAdvice?: string;
  followUpDate?: string;
  followUpDays?: number;
  issuedAt: string;
}

export interface PrescriptionTemplate {
  id: string;
  doctorId: string;
  title: string;
  diagnosis: string;
  symptoms: string[];
  items: Omit<PrescriptionItem, 'id'>[];
  advice: string[];
}

export interface ClinicService {
  id: string;
  clinicId: string;
  name: string;
  category: 'CONSULTATION' | 'LAB_TEST' | 'PROCEDURE' | 'NURSING' | 'MEDICINE';
  price: number;
  active: boolean;
}

export interface InvoiceItem {
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  appointmentId?: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  transactionRef?: string;
  createdAt: string;
  paidAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  clinicId: string;
  amount: number;
  method: PaymentMethod;
  transactionId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  paidAt: string;
  recordedBy: string;
}

export interface Expense {
  id: string;
  clinicId: string;
  category: 'UTILITIES' | 'SALARIES' | 'EQUIPMENT' | 'MEDICAL_SUPPLIES' | 'MAINTENANCE' | 'OTHER';
  description: string;
  amount: number;
  date: string;
  recordedBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  clinicId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  timestamp: string;
}
