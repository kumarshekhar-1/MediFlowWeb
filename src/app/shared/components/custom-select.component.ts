import { Component, EventEmitter, Input, Output, signal, computed, ElementRef, HostListener, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: string;
  badge?: string;
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ]
})
export class CustomSelectComponent implements ControlValueAccessor {
  private _options = signal<SelectOption[]>([]);
  private _selectedValue = signal<string>('');

  @Input()
  set options(val: SelectOption[]) {
    this._options.set(val || []);
  }
  get options(): SelectOption[] {
    return this._options();
  }

  @Input()
  set selectedValue(val: string) {
    this._selectedValue.set(val || '');
  }
  get selectedValue(): string {
    return this._selectedValue();
  }

  @Input() placeholder: string = 'Select an option...';
  @Input() searchable: boolean = true;
  @Input() disabled: boolean = false;
  @Output() selectionChange = new EventEmitter<string>();

  isOpen = signal<boolean>(false);
  searchTerm = signal<string>('');

  onChange: any = () => {};
  onTouched: any = () => {};

  constructor(private elementRef: ElementRef) {}

  selectedOption = computed(() => {
    return this._options().find(o => o.value === this._selectedValue());
  });

  filteredOptions = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
    if (!search) return this._options();
    return this._options().filter(o => 
      o.label.toLowerCase().includes(search) || 
      (o.subLabel && o.subLabel.toLowerCase().includes(search))
    );
  });

  toggleOpen() {
    if (this.disabled) return;
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.searchTerm.set('');
    }
  }

  selectOption(opt: SelectOption) {
    this._selectedValue.set(opt.value);
    this.selectionChange.emit(opt.value);
    this.onChange(opt.value);
    this.onTouched();
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  // ControlValueAccessor methods
  writeValue(value: any): void {
    this._selectedValue.set(value || '');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
