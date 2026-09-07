import { Component, EventEmitter, Input, Output, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import * as L from 'leaflet';

export interface LocationPickResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
}

@Component({
  selector: 'app-map-pin-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './map-pin-picker.component.html',
  styleUrl: './map-pin-picker.component.scss'
})
export class MapPinPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialAddress: string = 'Indiranagar, Bengaluru';
  @Input() initialLat: number = 12.9719;
  @Input() initialLng: number = 77.6412;

  @Output() locationSelected = new EventEmitter<LocationPickResult>();

  @ViewChild('leafletMapContainer', { static: false }) mapContainerRef!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private searchTimeout: any = null;
  private reverseGeoTimeout: any = null;

  searchQuery = signal<string>('');
  searchResults = signal<any[]>([]);
  selectedAreaName = signal<string>('Selected Location');
  selectedFullAddress = signal<string>('Locating on map...');

  currentLat = signal<number>(12.9719);
  currentLng = signal<number>(77.6412);
  currentCity = signal<string>('Bengaluru');
  currentState = signal<string>('Karnataka');
  currentPin = signal<string>('560038');

  ngAfterViewInit() {
    this.currentLat.set(this.initialLat || 12.9719);
    this.currentLng.set(this.initialLng || 77.6412);
    setTimeout(() => {
      this.initLeafletMap();
    }, 100);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.reverseGeoTimeout) {
      clearTimeout(this.reverseGeoTimeout);
    }
  }

  private initLeafletMap() {
    if (!this.mapContainerRef) return;

    const lat = this.currentLat();
    const lng = this.currentLng();

    // Initialize Leaflet map
    this.map = L.map(this.mapContainerRef.nativeElement, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true
    });

    // Add high-resolution OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Custom Red Pin Icon using Leaflet DivIcon with SVG
    const customPinIcon = L.divIcon({
      className: 'custom-leaflet-marker-pin',
      html: `
        <div class="pin-svg-wrap">
          <svg width="36" height="46" viewBox="0 0 24 24" fill="#e11d48" stroke="#ffffff" stroke-width="1.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.8" fill="#ffffff"/>
          </svg>
          <div class="pin-pulse-shadow"></div>
        </div>
      `,
      iconSize: [36, 46],
      iconAnchor: [18, 46]
    });

    // Create Draggable Marker
    this.marker = L.marker([lat, lng], {
      draggable: true,
      icon: customPinIcon
    }).addTo(this.map);

    // Handle Drag End event
    this.marker.on('dragend', () => {
      if (this.marker) {
        const pos = this.marker.getLatLng();
        this.onCoordinatesChanged(pos.lat, pos.lng);
      }
    });

    // Handle Map Click to move marker
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.marker) {
        this.marker.setLatLng(e.latlng);
        this.onCoordinatesChanged(e.latlng.lat, e.latlng.lng);
      }
    });

    this.onCoordinatesChanged(lat, lng);
  }

  onSearchQueryChange(query: string) {
    this.searchQuery.set(query);
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimeout = setTimeout(() => {
      this.performSearch(query);
    }, 400);
  }

  private performSearch(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=in`;
    fetch(url, {
      headers: {
        'Accept-Language': 'en'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map((item: any) => {
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.village || addr.suburb || 'Bengaluru';
            const state = addr.state || 'Karnataka';
            const pin = addr.postcode || '560038';
            const name = addr.road || addr.suburb || addr.neighbourhood || item.display_name.split(',')[0];
            return {
              name,
              city,
              state,
              pin,
              lat: Number(item.lat),
              lng: Number(item.lon),
              displayName: item.display_name
            };
          });
          this.searchResults.set(mapped);
        }
      })
      .catch(err => console.warn('Nominatim search failed:', err));
  }

  private onCoordinatesChanged(lat: number, lng: number) {
    this.currentLat.set(Number(lat.toFixed(6)));
    this.currentLng.set(Number(lng.toFixed(6)));

    // Debounce reverse geocode — only fire once user stops changing coordinates
    if (this.reverseGeoTimeout) {
      clearTimeout(this.reverseGeoTimeout);
    }
    this.reverseGeoTimeout = setTimeout(() => {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      fetch(url, {
        headers: {
          'Accept-Language': 'en'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.address) {
            const addr = data.address;
            const city = addr.city || addr.town || addr.village || addr.county || 'Bengaluru';
            const state = addr.state || 'Karnataka';
            const pin = addr.postcode || '560038';
            const name = addr.road || addr.suburb || addr.neighbourhood || data.display_name.split(',')[0];

            this.selectedAreaName.set(name);
            this.selectedFullAddress.set(data.display_name);
            this.currentCity.set(city);
            this.currentState.set(state);
            this.currentPin.set(pin);

            this.emitCurrentLocation();
          }
        })
        .catch(err => {
          console.warn('Nominatim reverse geocode failed:', err);
          this.selectedAreaName.set('Selected Location');
          this.selectedFullAddress.set(`Latitude: ${lat}, Longitude: ${lng}`);
          this.emitCurrentLocation();
        });
    }, 600);
  }

  selectSearchResult(loc: any) {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.currentLat.set(loc.lat);
    this.currentLng.set(loc.lng);

    if (this.map && this.marker) {
      this.map.setView([loc.lat, loc.lng], 16, { animate: true });
      this.marker.setLatLng([loc.lat, loc.lng]);
    }

    this.selectedAreaName.set(loc.name);
    this.selectedFullAddress.set(loc.displayName || `${loc.name}, ${loc.city}, ${loc.state} ${loc.pin}`);
    this.currentCity.set(loc.city);
    this.currentState.set(loc.state);
    this.currentPin.set(loc.pin);
    this.emitCurrentLocation();
  }

  detectGps() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          this.onCoordinatesChanged(lat, lng);

          if (this.map && this.marker) {
            this.map.setView([lat, lng], 16, { animate: true });
            this.marker.setLatLng([lat, lng]);
          }
        },
        () => {
          // Fallback to initial view
          this.onCoordinatesChanged(this.initialLat, this.initialLng);
        }
      );
    }
  }

  private emitCurrentLocation() {
    this.locationSelected.emit({
      lat: this.currentLat(),
      lng: this.currentLng(),
      formattedAddress: this.selectedFullAddress(),
      area: this.selectedAreaName(),
      city: this.currentCity(),
      state: this.currentState(),
      pincode: this.currentPin()
    });
  }
}
