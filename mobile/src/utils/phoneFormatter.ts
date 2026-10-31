/**
 * Phone and WhatsApp Number Formatting Utility
 * 
 * Supports:
 * - Separate Country Calling Code selector with Flags & Default +1 (US)
 * - Free national phone number editing without sticky prefixes
 * - Standard NANP format (xxx-xxx-xxxx) for +1
 * - Preserves international dial codes (e.g. +44, +971, +41, +33)
 */

export interface CountryDialCode {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
  placeholder: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸', dialCode: '+1', placeholder: 'xxx-xxx-xxxx' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', dialCode: '+1', placeholder: 'xxx-xxx-xxxx' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', dialCode: '+44', placeholder: '7911 123456' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', dialCode: '+971', placeholder: '50 123 4567' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭', dialCode: '+41', placeholder: '79 123 45 67' },
  { name: 'Monaco', code: 'MC', flag: '🇲🇨', dialCode: '+377', placeholder: '6 12 34 56 78' },
  { name: 'France', code: 'FR', flag: '🇫🇷', dialCode: '+33', placeholder: '6 12 34 56 78' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', dialCode: '+49', placeholder: '151 12345678' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹', dialCode: '+39', placeholder: '312 3456789' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸', dialCode: '+34', placeholder: '612 34 56 78' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬', dialCode: '+65', placeholder: '8123 4567' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', dialCode: '+966', placeholder: '50 123 4567' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦', dialCode: '+974', placeholder: '3312 3456' },
  { name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿', dialCode: '+7', placeholder: '701 123 4567' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', dialCode: '+61', placeholder: '412 345 678' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', dialCode: '+81', placeholder: '90 1234 5678' },
  { name: 'Hong Kong', code: 'HK', flag: '🇭🇰', dialCode: '+852', placeholder: '9123 4567' },
  { name: 'Austria', code: 'AT', flag: '🇦🇹', dialCode: '+43', placeholder: '664 1234567' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪', dialCode: '+32', placeholder: '470 12 34 56' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱', dialCode: '+31', placeholder: '6 12345678' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪', dialCode: '+46', placeholder: '70 123 45 67' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴', dialCode: '+47', placeholder: '412 34 567' },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰', dialCode: '+45', placeholder: '20 12 34 56' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮', dialCode: '+358', placeholder: '40 1234567' },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹', dialCode: '+351', placeholder: '912 345 678' },
  { name: 'Greece', code: 'GR', flag: '🇬🇷', dialCode: '+30', placeholder: '691 234 5678' },
  { name: 'Ireland', code: 'IE', flag: '🇮🇪', dialCode: '+353', placeholder: '83 123 4567' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷', dialCode: '+90', placeholder: '532 123 4567' },
  { name: 'Israel', code: 'IL', flag: '🇮🇱', dialCode: '+972', placeholder: '50 123 4567' },
  { name: 'Cyprus', code: 'CY', flag: '🇨🇾', dialCode: '+357', placeholder: '96 123456' },
  { name: 'Luxembourg', code: 'LU', flag: '🇱🇺', dialCode: '+352', placeholder: '621 123 456' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', dialCode: '+55', placeholder: '11 91234-5678' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽', dialCode: '+52', placeholder: '55 1234 5678' },
  { name: 'India', code: 'IN', flag: '🇮🇳', dialCode: '+91', placeholder: '98123 45678' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷', dialCode: '+82', placeholder: '10 1234 5678' },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿', dialCode: '+64', placeholder: '21 123 4567' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦', dialCode: '+27', placeholder: '82 123 4567' },
  { name: 'China', code: 'CN', flag: '🇨🇳', dialCode: '+86', placeholder: '138 1234 5678' },
  { name: 'Bahrain', code: 'BH', flag: '🇧🇭', dialCode: '+973', placeholder: '3612 3456' },
  { name: 'Kuwait', code: 'KW', flag: '🇰🇼', dialCode: '+965', placeholder: '5123 4567' },
  { name: 'Oman', code: 'OM', flag: '🇴🇲', dialCode: '+968', placeholder: '9123 4567' },
  { name: 'Georgia', code: 'GE', flag: '🇬🇪', dialCode: '+995', placeholder: '591 12 34 56' },
  { name: 'Armenia', code: 'AM', flag: '🇦🇲', dialCode: '+374', placeholder: '91 123456' },
  { name: 'Uzbekistan', code: 'UZ', flag: '🇺🇿', dialCode: '+998', placeholder: '90 123 45 67' },
  { name: 'Azerbaijan', code: 'AZ', flag: '🇦🇿', dialCode: '+994', placeholder: '50 123 45 67' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩', dialCode: '+62', placeholder: '812 3456 7890' },
  { name: 'Thailand', code: 'TH', flag: '🇹🇭', dialCode: '+66', placeholder: '81 234 5678' },
  { name: 'Vietnam', code: 'VN', flag: '🇻🇳', dialCode: '+84', placeholder: '91 234 5678' },
  { name: 'Malaysia', code: 'MY', flag: '🇲🇾', dialCode: '+60', placeholder: '12 345 6789' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭', dialCode: '+63', placeholder: '917 123 4567' },
  { name: 'Egypt', code: 'EG', flag: '🇪🇬', dialCode: '+20', placeholder: '100 123 4567' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', dialCode: '+234', placeholder: '803 123 4567' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪', dialCode: '+254', placeholder: '712 345678' },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴', dialCode: '+57', placeholder: '300 123 4567' },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷', dialCode: '+54', placeholder: '11 1234-5678' },
  { name: 'Chile', code: 'CL', flag: '🇨🇱', dialCode: '+56', placeholder: '9 1234 5678' },
];

export const DEFAULT_COUNTRY_DIAL_CODE: CountryDialCode = COUNTRY_DIAL_CODES[0];

/**
 * Splits a full stored phone number into country calling code and national number.
 */
export function parsePhoneNumber(fullPhone?: string | null): { country: CountryDialCode; nationalNumber: string } {
  if (!fullPhone) {
    return { country: DEFAULT_COUNTRY_DIAL_CODE, nationalNumber: '' };
  }
  const clean = fullPhone.trim();
  if (!clean) {
    return { country: DEFAULT_COUNTRY_DIAL_CODE, nationalNumber: '' };
  }

  if (clean.startsWith('+')) {
    // Sort candidate countries by dialCode length descending to match +971 before +9, +377 before +3, etc.
    const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sorted) {
      if (clean.startsWith(c.dialCode)) {
        const rest = clean.slice(c.dialCode.length).trim();
        return { country: c, nationalNumber: rest };
      }
    }
    // Generic match for other international prefixes e.g. +999
    const match = clean.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return {
        country: {
          name: 'International',
          code: 'INT',
          flag: '🌐',
          dialCode: match[1],
          placeholder: 'Phone number',
        },
        nationalNumber: match[2],
      };
    }
  }

  // If no '+' prefix, check if it starts with '1' and has 10-11 digits (NANP)
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return {
      country: DEFAULT_COUNTRY_DIAL_CODE,
      nationalNumber: formatNationalNumber(digits.slice(1), '+1'),
    };
  }

  // Default to US and retain clean input
  return {
    country: DEFAULT_COUNTRY_DIAL_CODE,
    nationalNumber: formatNationalNumber(clean, '+1'),
  };
}

/**
 * Formats national number as digits are typed.
 * For +1 (US / Canada), formats cleanly as xxx-xxx-xxxx without sticky +1.
 * Allows backspacing completely to empty.
 */
export function formatNationalNumber(raw: string, dialCode: string = '+1'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (dialCode === '+1') {
    // Strip everything except digits
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
  }

  // For international numbers, allow numbers, spaces, and hyphens without forcing format
  return trimmed.replace(/[^\d\s-]/g, '');
}

/**
 * Combines dialCode and nationalNumber into a full standardized phone string.
 */
export function buildFullPhoneNumber(dialCode: string, nationalNumber: string): string {
  const trimmed = nationalNumber.trim();
  if (!trimmed) return '';
  return `${dialCode} ${trimmed}`;
}

/**
 * Backward compatibility helper for existing code and tests.
 */
export function formatWhatsAppNumber(val: string): string {
  if (!val) return '';
  const { country, nationalNumber } = parsePhoneNumber(val);
  const formatted = formatNationalNumber(nationalNumber, country.dialCode);
  return buildFullPhoneNumber(country.dialCode, formatted);
}
