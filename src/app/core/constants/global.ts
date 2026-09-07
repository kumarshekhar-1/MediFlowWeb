import { SelectOption } from '../../shared/components/custom-select.component';

export const SPECIALIZATION_OPTIONS: string[] = [
  'General Medicine',
  'Paediatrics',
  'Gynaecology & Obstetrics',
  'Orthopaedics',
  'Cardiology',
  'Dermatology',
  'ENT',
  'Ophthalmology',
  'Neurology',
  'Psychiatry',
  'Dentistry',
  'Radiology & Imaging',
  'Pathology & Diagnostics',
  'Physiotherapy',
  'Oncology',
  'Urology',
  'Nephrology',
  'Gastroenterology',
  'Pulmonology',
  'Emergency & Trauma'
];

export const GENDER_OPTIONS: SelectOption[] = [
  { value: 'MALE', label: 'Male', icon: '👨' },
  { value: 'FEMALE', label: 'Female', icon: '👩' },
  { value: 'OTHER', label: 'Other', icon: '🧑' }
];

export const BLOOD_GROUP_OPTIONS: SelectOption[] = [
  { value: 'A+', label: 'A Positive (A+)', badge: 'A+' },
  { value: 'A-', label: 'A Negative (A-)', badge: 'A-' },
  { value: 'B+', label: 'B Positive (B+)', badge: 'B+' },
  { value: 'B-', label: 'B Negative (B-)', badge: 'B-' },
  { value: 'O+', label: 'O Positive (O+)', badge: 'O+' },
  { value: 'O-', label: 'O Negative (O-)', badge: 'O-' },
  { value: 'AB+', label: 'AB Positive (AB+)', badge: 'AB+' },
  { value: 'AB-', label: 'AB Negative (AB-)', badge: 'AB-' }
];
