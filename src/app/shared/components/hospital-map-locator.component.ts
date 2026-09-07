import { Component, inject, signal, computed, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { SessionStateService } from '../../core/services/session-state.service';
import { ClinicApiService } from '../../core/services/clinic-api.service';
import { Clinic } from '../../core/models/clinic.models';

@Component({
  selector: 'app-hospital-map-locator',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './hospital-map-locator.component.html',
  styleUrl: './hospital-map-locator.component.scss'
})
export class HospitalMapLocatorComponent implements OnInit {
  db = inject(SessionStateService);
  clinicApi = inject(ClinicApiService);
  sanitizer = inject(DomSanitizer);

  // Live clinics from API
  apiClinics = signal<any[]>([]);
  apiLoading = signal<boolean>(false);

  // User GPS origin (empty until detected or user grants GPS permission)
  userLat = signal<number | undefined>(undefined);
  userLng = signal<number | undefined>(undefined);
  userLocationName = signal<string>('Location Not Set (Click Detect GPS)');
  useGps = signal<boolean>(false);

  // Backend Filter Parameters (GET /clinics/listClinics)
  searchClinicName = signal<string>('');
  selectedSpecialization = signal<string>('');
  selectedDistanceFilter = signal<number>(10); // Default to nearby 10 km filter

  selectedClinic = signal<Clinic | null>(null);

  specializationsList = [
    'CARDIOLOGIST',
    'PEDIATRICIAN',
    'DENTIST',
    'GENERAL_PHYSICIAN',
    'GYNECOLOGIST',
    'DERMATOLOGIST',
    'ORTHOPEDIC'
  ];

  ngOnInit(): void {
    this.autoDetectLocationAndLoad();
  }

  private reverseGeocode(lat: number, lng: number): void {
    this.userLocationName.set(`Locating... (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        const addr = data?.address;
        if (addr) {
          const locParts = [
            addr.suburb || addr.neighbourhood || addr.residential || addr.town || addr.village,
            addr.city || addr.county || addr.state_district,
            addr.state
          ].filter(Boolean);

          if (locParts.length > 0) {
            this.userLocationName.set(locParts.slice(0, 2).join(', '));
            return;
          }
        }
        if (data?.display_name) {
          const shortName = data.display_name.split(',').slice(0, 2).join(',').trim();
          this.userLocationName.set(shortName);
          return;
        }
        this.userLocationName.set(`My Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      })
      .catch(() => {
        this.userLocationName.set(`My Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      });
  }

  autoDetectLocationAndLoad(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLat.set(pos.coords.latitude);
          this.userLng.set(pos.coords.longitude);
          this.useGps.set(true);
          this.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          this.loadClinics();
        },
        () => {
          // GPS permission denied or unavailable - load clinics without GPS radius requirement
          this.loadClinics();
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    } else {
      this.loadClinics();
    }
  }

  loadClinics(): void {
    this.apiLoading.set(true);
    const radius = this.selectedDistanceFilter() > 0 ? this.selectedDistanceFilter() : undefined;
    const clinicName = this.searchClinicName().trim() || undefined;
    const spec = this.selectedSpecialization().trim() || undefined;
    const status = 'ACTIVE';
    const lat = radius ? this.userLat() : undefined;
    const lng = radius ? this.userLng() : undefined;

    this.clinicApi.listClinics(
      0,
      50,
      status,
      undefined,
      spec,
      clinicName,
      lat,
      lng,
      radius
    ).subscribe({
      next: (res) => {
        const content = res?.content ?? (Array.isArray(res) ? res : []);
        this.apiClinics.set(content);
        this.apiLoading.set(false);
        const mapped = this.allClinics();
        if (mapped.length > 0) {
          this.selectedClinic.set(mapped[0]);
        }
      },
      error: () => {
        this.apiLoading.set(false);
      }
    });
  }

  resetFilters(): void {
    this.searchClinicName.set('');
    this.selectedSpecialization.set('');
    this.selectedDistanceFilter.set(0); // Show all
    this.loadClinics();
  }

  // Live API mapped clinics strictly using API response fields
  allClinics = computed<Clinic[]>(() => {
    const apiList = this.apiClinics();
    return apiList.map((c: any): Clinic => {
      const fullAddress = [c.addressLine, c.city, c.state, c.pincode].filter(Boolean).join(', ');
      return {
        id: c.clinicId || '',
        name: c.clinicName || c.clinicId || 'Clinic',
        type: (c.type || 'CLINIC') as any,
        address: fullAddress || c.city || '',
        city: c.city || '',
        state: c.state || '',
        pincode: c.pincode || '',
        contact: c.ownerPhoneNumber || '',
        email: c.ownerEmail || '',
        regNumber: c.clinicRegistrationNumber || '',
        ownerId: c.ownerName || '',
        status: (c.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
        rating: c.rating,
        totalReviews: c.totalReviews,
        latitude: c.latitude,
        longitude: c.longitude,
        openingHours: c.openingHours || '',
        emergencyContact: c.ownerPhoneNumber || ''
      };
    });
  });

  // Calculate distance between user and clinic using Haversine formula
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in KM
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.round(d * 10) / 10;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Clinics with calculated distance if coordinates exist
  clinicsWithDistance = computed(() => {
    const uLat = this.userLat();
    const uLng = this.userLng();

    return this.allClinics().map(c => {
      let distance: number | undefined = undefined;
      let travelMins: number | undefined = undefined;

      if (uLat !== undefined && uLng !== undefined && c.latitude && c.longitude) {
        distance = this.calculateDistance(uLat, uLng, c.latitude, c.longitude);
        travelMins = Math.max(3, Math.round(distance * 3.5));
      }

      return {
        ...c,
        distanceKm: distance,
        travelMins
      };
    })
    .sort((a, b) => {
      if (a.distanceKm === undefined) return 0;
      if (b.distanceKm === undefined) return 0;
      return a.distanceKm - b.distanceKm;
    });
  });

  // Raw string for Google Maps Embed URL
  rawMapUrl = computed<string>(() => {
    const sel = this.selectedClinic();
    const uLat = this.userLat();
    const uLng = this.userLng();

    if (!sel) return '';

    const hasCoords = sel.latitude != null && sel.longitude != null && Number(sel.latitude) !== 0 && Number(sel.longitude) !== 0;

    if (hasCoords) {
      const destLat = Number(sel.latitude);
      const destLng = Number(sel.longitude);

      if (uLat !== undefined && uLng !== undefined) {
        const dist = this.calculateDistance(uLat, uLng, destLat, destLng);
        // If user is at the clinic location (distance < 0.1km), zoom in directly on the clinic location pin (z=17)
        if (dist < 0.1) {
          return `https://maps.google.com/maps?q=${destLat},${destLng}&t=m&z=17&output=embed`;
        }
        // Show driving route from user position to clinic location (auto-fit route bounds)
        return `https://maps.google.com/maps?saddr=${uLat},${uLng}&daddr=${destLat},${destLng}&output=embed`;
      }
      // Focused street-level zoom pin marker on selected clinic (z=16)
      return `https://maps.google.com/maps?q=${destLat},${destLng}&z=16&output=embed`;
    }

    if (sel.address) {
      const dest = encodeURIComponent(`${sel.name}, ${sel.address}`);
      if (uLat !== undefined && uLng !== undefined) {
        return `https://maps.google.com/maps?saddr=${uLat},${uLng}&daddr=${dest}&output=embed`;
      }
      return `https://maps.google.com/maps?q=${dest}&z=15&output=embed`;
    }

    return '';
  });

  // Interactive Google Map Embed Safe URL for selected clinic
  mapEmbedUrl = computed<SafeResourceUrl>(() => {
    const url = this.rawMapUrl();
    if (!url) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  selectClinic(c: Clinic) {
    this.selectedClinic.set({ ...c });
  }

  // Event output when clicking Book Here
  bookClinic = output<Clinic>();

  openExternalGoogleMaps(c: Clinic) {
    const uLat = this.userLat();
    const uLng = this.userLng();
    if (c.latitude && c.longitude) {
      const originParam = (uLat !== undefined && uLng !== undefined) ? `origin=${uLat},${uLng}&` : '';
      const url = `https://www.google.com/maps/dir/?api=1&${originParam}destination=${c.latitude},${c.longitude}&travelmode=driving`;
      window.open(url, '_blank');
    } else if (c.address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + c.address)}`;
      window.open(url, '_blank');
    }
  }

  requestUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLat.set(pos.coords.latitude);
          this.userLng.set(pos.coords.longitude);
          this.useGps.set(true);
          this.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          this.loadClinics();
        },
        () => {
          alert('GPS location permission denied.');
        }
      );
    }
  }

  switchClinicAndBook(c: Clinic) {
    this.db.switchClinic(c.id);
    this.bookClinic.emit(c);
  }
}
