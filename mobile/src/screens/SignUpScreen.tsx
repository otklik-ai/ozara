/**
 * ÖZARA Mobile: Sign Up & Invitation Gate Screen
 * Multi-state invite validation, non-blocking access request with admin notification to Elena Ermolov,
 * seamless session resumption (login to the exact spot where left off), and pre-populated 1:1 email registration.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { useClub } from '../context/ClubContext';
import {
  ApiService,
  CURRENT_ACCESS_CONDITIONS_VERSION,
  QuestionDefinition,
  resolveImageUrl,
} from '../services/api';
import { OzaraStorage, OZARA_STORAGE_KEYS } from '../services/storage';
import {
  COUNTRY_DIAL_CODES,
  CountryDialCode,
  DEFAULT_COUNTRY_DIAL_CODE,
  parsePhoneNumber,
  formatNationalNumber,
  buildFullPhoneNumber,
  formatWhatsAppNumber,
} from '../utils/phoneFormatter';

interface SignUpScreenProps {
  onBack: () => void;
  onCompleteSignUp: () => void;
  initialViewMode?: GateView;
}

type GateView = 'check_token' | 'request_access' | 'register_form' | 'questionnaire_page';

export interface CountryConfig {
  name: string;
  code: string;
  defaultChapter: string;
  states: Array<{
    name: string;
    cities: string[];
  }>;
}

export const COUNTRIES: CountryConfig[] = [
  {
    name: 'Australia',
    code: 'AU',
    defaultChapter: 'Silicon Valley',
    states: [
      { name: 'New South Wales', cities: ['Sydney'] },
      { name: 'Victoria', cities: ['Melbourne'] },
      { name: 'Queensland', cities: ['Brisbane'] },
      { name: 'Western Australia', cities: ['Perth'] },
      { name: 'South Australia', cities: ['Adelaide'] },
    ],
  },
  {
    name: 'Canada',
    code: 'CA',
    defaultChapter: 'New York',
    states: [
      { name: 'Ontario', cities: ['Toronto', 'Ottawa'] },
      { name: 'British Columbia', cities: ['Vancouver', 'Victoria'] },
      { name: 'Quebec', cities: ['Montreal', 'Quebec City'] },
      { name: 'Alberta', cities: ['Calgary', 'Edmonton'] },
    ],
  },
  {
    name: 'Cyprus',
    code: 'CY',
    defaultChapter: 'New York',
    states: [
      { name: 'Limassol District', cities: ['Limassol'] },
      { name: 'Nicosia District', cities: ['Nicosia'] },
      { name: 'Paphos District', cities: ['Paphos'] },
      { name: 'Larnaca District', cities: ['Larnaca'] },
    ],
  },
  {
    name: 'France',
    code: 'FR',
    defaultChapter: 'New York',
    states: [
      { name: 'Île-de-France', cities: ['Paris'] },
      { name: "Côte d'Azur", cities: ['Nice', 'Cannes', 'Saint-Tropez', 'Antibes'] },
      { name: 'Auvergne-Rhône-Alpes', cities: ['Lyon'] },
      { name: 'Nouvelle-Aquitaine', cities: ['Bordeaux'] },
    ],
  },
  {
    name: 'Germany',
    code: 'DE',
    defaultChapter: 'Boston',
    states: [
      { name: 'Berlin', cities: ['Berlin'] },
      { name: 'Bavaria', cities: ['Munich'] },
      { name: 'Hesse', cities: ['Frankfurt'] },
      { name: 'Hamburg', cities: ['Hamburg'] },
      { name: 'North Rhine-Westphalia', cities: ['Düsseldorf', 'Cologne'] },
    ],
  },
  {
    name: 'Hong Kong',
    code: 'HK',
    defaultChapter: 'Silicon Valley',
    states: [
      { name: 'Hong Kong', cities: ['Hong Kong'] },
    ],
  },
  {
    name: 'Italy',
    code: 'IT',
    defaultChapter: 'New York',
    states: [
      { name: 'Lombardy', cities: ['Milan'] },
      { name: 'Lazio', cities: ['Rome'] },
      { name: 'Tuscany', cities: ['Florence'] },
      { name: 'Piedmont', cities: ['Turin'] },
      { name: 'Veneto', cities: ['Venice'] },
    ],
  },
  {
    name: 'Japan',
    code: 'JP',
    defaultChapter: 'Silicon Valley',
    states: [
      { name: 'Kanto', cities: ['Tokyo', 'Yokohama'] },
      { name: 'Kansai', cities: ['Osaka', 'Kyoto', 'Kobe'] },
      { name: 'Chubu', cities: ['Nagoya'] },
      { name: 'Hokkaido', cities: ['Sapporo'] },
      { name: 'Kyushu', cities: ['Fukuoka'] },
    ],
  },
  {
    name: 'Kazakhstan',
    code: 'KZ',
    defaultChapter: 'New York',
    states: [
      { name: 'Astana', cities: ['Astana'] },
      { name: 'Almaty', cities: ['Almaty'] },
      { name: 'Shymkent', cities: ['Shymkent'] },
      { name: 'Karaganda Region', cities: ['Karaganda'] },
    ],
  },
  {
    name: 'Monaco',
    code: 'MC',
    defaultChapter: 'Miami',
    states: [
      { name: 'Principality of Monaco', cities: ['Monaco', 'Monte Carlo'] },
    ],
  },
  {
    name: 'Netherlands',
    code: 'NL',
    defaultChapter: 'Boston',
    states: [
      { name: 'North Holland', cities: ['Amsterdam'] },
      { name: 'South Holland', cities: ['Rotterdam', 'The Hague'] },
      { name: 'Utrecht', cities: ['Utrecht'] },
      { name: 'North Brabant', cities: ['Eindhoven'] },
    ],
  },
  {
    name: 'Saudi Arabia',
    code: 'SA',
    defaultChapter: 'New York',
    states: [
      { name: 'Riyadh Province', cities: ['Riyadh', 'Diriyah'] },
      { name: 'Makkah Province', cities: ['Jeddah', 'Mecca'] },
      { name: 'Eastern Province', cities: ['Khobar', 'Dammam', 'Dhahran'] },
    ],
  },
  {
    name: 'Singapore',
    code: 'SG',
    defaultChapter: 'Silicon Valley',
    states: [
      { name: 'Singapore', cities: ['Singapore'] },
    ],
  },
  {
    name: 'Spain',
    code: 'ES',
    defaultChapter: 'Miami',
    states: [
      { name: 'Catalonia', cities: ['Barcelona', 'Sitges', 'Girona'] },
      { name: 'Community of Madrid', cities: ['Madrid'] },
      { name: 'Balearic Islands', cities: ['Ibiza', 'Palma de Mallorca'] },
      { name: 'Andalusia', cities: ['Marbella', 'Malaga', 'Seville'] },
      { name: 'Valencian Community', cities: ['Valencia'] },
    ],
  },
  {
    name: 'Switzerland',
    code: 'CH',
    defaultChapter: 'Boston',
    states: [
      { name: 'Canton of Zurich', cities: ['Zurich', 'Winterthur'] },
      { name: 'Canton of Geneva', cities: ['Geneva'] },
      { name: 'Canton of Zug', cities: ['Zug', 'Baar'] },
      { name: 'Canton of Vaud', cities: ['Lausanne', 'Montreux'] },
      { name: 'Canton of Basel', cities: ['Basel'] },
      { name: 'Canton of Bern', cities: ['Bern'] },
    ],
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    defaultChapter: 'New York',
    states: [
      { name: 'Dubai', cities: ['Dubai'] },
      { name: 'Abu Dhabi', cities: ['Abu Dhabi'] },
      { name: 'Sharjah', cities: ['Sharjah'] },
      { name: 'Ras Al Khaimah', cities: ['Ras Al Khaimah'] },
      { name: 'Ajman', cities: ['Ajman'] },
    ],
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    defaultChapter: 'New York',
    states: [
      { name: 'Greater London', cities: ['London'] },
      { name: 'South East', cities: ['Oxford', 'Windsor'] },
      { name: 'East of England', cities: ['Cambridge'] },
      { name: 'Scotland', cities: ['Edinburgh', 'Glasgow'] },
      { name: 'North West', cities: ['Manchester', 'Liverpool'] },
      { name: 'West Midlands', cities: ['Birmingham'] },
    ],
  },
  {
    name: 'United States',
    code: 'US',
    defaultChapter: 'New York',
    states: [
      { name: 'New York', cities: ['New York', 'Albany', 'Buffalo'] },
      { name: 'California', cities: ['San Francisco', 'Palo Alto', 'Menlo Park', 'Mountain View', 'San Jose', 'Los Angeles', 'San Diego', 'Newport Beach'] },
      { name: 'Florida', cities: ['Miami', 'Palm Beach', 'Fort Lauderdale', 'Tampa', 'Orlando'] },
      { name: 'Texas', cities: ['Austin', 'Dallas', 'Houston'] },
      { name: 'Massachusetts', cities: ['Boston', 'Cambridge'] },
      { name: 'Washington', cities: ['Seattle', 'Bellevue'] },
      { name: 'Illinois', cities: ['Chicago'] },
    ],
  },
];

export const STANDARDIZED_CONNECTION_COUNTRIES = [
  'Open to connections anywhere',
  ...COUNTRIES.map((c) => c.name).sort((a, b) => a.localeCompare(b)),
];

export const STANDARDIZED_INDUSTRIES = [
  'Technology & Software',
  'Artificial Intelligence & Data',
  'Robotics, Hardware & Deep Tech',
  'Finance, Banking & FinTech',
  'Venture Capital & Private Equity',
  'Wealth Management & Family Offices',
  'Real Estate & Construction',
  'Healthcare & Medicine',
  'Biotechnology & Life Sciences',
  'Education & Academia',
  'Research & Development',
  'Law & Legal Services',
  'Consulting & Professional Services',
  'Energy, Climate & Sustainability',
  'Manufacturing & Industrial',
  'Retail, E-commerce & Consumer Goods',
  'Media, Entertainment & Creative Industries',
  'Marketing & Advertising',
  'Travel, Hospitality & Events',
  'Transportation & Logistics',
  'Agriculture & Food',
  'Government & Public Policy',
  'Nonprofit & Social Impact',
  'Other — please specify',
];

export const STANDARDIZED_ROLES = [
  'Founder / Co-founder',
  'CEO / Executive / Managing Director',
  'Business Owner',
  'Partner / General Partner',
  'Investor / Fund Manager / Family Office Principal',
  'Investor Relations Professional',
  'Software Engineering',
  'AI & Machine Learning',
  'Data & Analytics',
  'Product Management',
  'Design & Creative Professional',
  'IT & Infrastructure',
  'Professor / Academic / Researcher',
  'Doctor / Healthcare Professional',
  'Lawyer / Legal Professional',
  'Finance / Accounting Professional',
  'Real Estate Professional / Developer',
  'Consultant / Advisor',
  'Marketing / Sales / Business Development Professional',
  'Nonprofit / Public Sector Professional',
  'Student / Early-career Professional',
  'Other — please specify',
];

export const STANDARDIZED_LOCATIONS = [
  'Amsterdam',
  'Astana',
  'Australia',
  'Berlin',
  'Boston',
  'Canada',
  'Chicago',
  'Cyprus',
  'Dubai',
  'France',
  'Geneva',
  'Germany',
  'Hong Kong',
  'Italy',
  'Japan',
  'Kazakhstan',
  'Limassol',
  'London',
  'Los Angeles',
  'Miami',
  'Monaco',
  'Netherlands',
  'New York',
  'Paris',
  'San Francisco',
  'Saudi Arabia',
  'Seattle',
  'Singapore',
  'Spain',
  'Switzerland',
  'Sydney',
  'Tokyo',
  'Toronto',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Zurich',
];

export const getCitiesForCountry = (countryName: string): string[] => {
  if (!countryName) return [];
  const found = COUNTRIES.find((c) => c.name.toLowerCase() === countryName.toLowerCase());
  if (!found) return [];
  const cities = new Set<string>();
  found.states.forEach((s) => {
    s.cities.forEach((ct) => cities.add(ct));
  });

  const all = Array.from(cities);
  return all.sort((a, b) => a.localeCompare(b));
};

export const parseLocationList = (val: string): string[] => {
  if (!val || val === 'skipped') return [];
  if (val.includes(';')) {
    return val.split(';').map((s) => s.trim()).filter(Boolean);
  }
  return val.split(',').map((s) => s.trim()).filter(Boolean);
};

export const parseLocationValue = (val: string): { country: string; city: string } => {
  if (!val || val === 'skipped') return { country: '', city: '' };

  if (val.includes(',')) {
    const parts = val.split(',').map((p) => p.trim());
    const candidateCountry = parts[parts.length - 1];
    const candidateCity = parts.slice(0, parts.length - 1).join(', ');
    const matchedCountry = COUNTRIES.find(
      (c) => c.name.toLowerCase() === candidateCountry.toLowerCase()
    );
    if (matchedCountry) {
      return { country: matchedCountry.name, city: candidateCity };
    }
  }

  const matchedCountry = COUNTRIES.find(
    (c) => c.name.toLowerCase() === val.toLowerCase()
  );
  if (matchedCountry) {
    return { country: matchedCountry.name, city: '' };
  }

  for (const c of COUNTRIES) {
    const allCities = c.states.flatMap((s) => s.cities);
    const foundCity = allCities.find((ct) => ct.toLowerCase() === val.toLowerCase());
    if (foundCity) {
      return { country: c.name, city: foundCity };
    }
  }

  return { country: '', city: val };
};

export interface LocationSlot {
  country: string;
  city: string;
}

export const parseLocationSlots = (rawVal: string, maxSlots: number): LocationSlot[] => {
  const slots: LocationSlot[] = [];
  if (!rawVal || rawVal === 'skipped') {
    for (let i = 0; i < maxSlots; i++) {
      slots.push({ country: '', city: '' });
    }
    return slots;
  }

  let items: string[] = [];
  const trimmed = rawVal.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        items = parsed.map(String).filter(Boolean);
      }
    } catch {}
  }

  if (items.length === 0 && trimmed.includes(';')) {
    items = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
  }

  if (items.length === 0) {
    const parsedSingle = parseLocationValue(trimmed);
    if (parsedSingle.country && parsedSingle.city) {
      items = [trimmed];
    } else if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      const lastPart = parts[parts.length - 1];
      const isLastCountry = COUNTRIES.some(
        (c) => c.name.toLowerCase() === lastPart.toLowerCase()
      );
      if (isLastCountry && parts.length === 2) {
        items = [trimmed];
      } else {
        items = parts;
      }
    } else {
      items = [trimmed];
    }
  }

  for (const item of items) {
    if (slots.length >= maxSlots) break;
    const { country, city } = parseLocationValue(item);
    slots.push({ country: country || '', city: city || '' });
  }

  while (slots.length < maxSlots) {
    slots.push({ country: '', city: '' });
  }

  return slots;
};

export const STANDARDIZED_FOCUS_PRIORITIES = [
  'Building or launching a project',
  'Growing a business',
  'Finding clients',
  'Developing partnerships',
  'Raising funding',
  'Exploring investment opportunities',
  'Buying or selling a business',
  'Hiring or building a team',
  'Exploring career opportunities',
  'Expanding into new markets',
  'Research & innovation',
  'Learning & professional development',
  'Finding mentors or expert guidance',
  'Growing my professional network',
  'Other — please specify',
];

export const STANDARDIZED_CONNECTION_TYPES = [
  'Founders & Business Owners',
  'Executives & Business Leaders',
  'Investors',
  'Technology & Product Professionals',
  'Marketing & Growth Leaders',
  'Professors & Researchers',
  'Healthcare Professionals',
  'Legal, Tax & Finance Professionals',
  'Real Estate Professionals',
  'Consultants & Industry Experts',
  'Mentors',
  'Peers in My Profession',
  'Potential Co-founders & Collaborators',
  'Potential Business Partners',
  'Potential Clients',
  'Talent & Hiring Connections',
  'Experts in a Specific Country or Market',
  'Other — please specify',
  'Open to Meeting Different People',
];

export interface InterestCategoryGroup {
  category: string;
  options: string[];
}

export const STANDARDIZED_INTEREST_GROUPS: InterestCategoryGroup[] = [
  {
    category: 'Sports & fitness',
    options: [
      'Triathlon',
      'Running',
      'Cycling',
      'Swimming',
      'Tennis',
      'Padel',
      'Pickleball',
      'Golf',
      'Yoga',
      'Pilates',
      'Strength training',
    ],
  },
  {
    category: 'Outdoors & adventure',
    options: [
      'Hiking',
      'Trail running',
      'Skiing',
      'Snowboarding',
      'Climbing',
      'Sailing',
      'Diving',
      'Surfing',
      'Camping',
    ],
  },
  {
    category: 'Arts & culture',
    options: [
      'Contemporary art',
      'Photography',
      'Painting',
      'Architecture',
      'Theatre',
      'Opera',
      'Classical music',
      'Live music',
      'Film',
    ],
  },
  {
    category: 'Food & travel',
    options: [
      'Cooking',
      'Baking',
      'Wine tasting',
      'Coffee',
      'Food discovery',
      'Cultural travel',
      'Adventure travel',
    ],
  },
  {
    category: 'Learning & leisure',
    options: [
      'Reading',
      'Book clubs',
      'Writing',
      'Learning languages',
      'Chess',
      'Board games',
      'Gardening',
    ],
  },
  {
    category: 'Community',
    options: [
      'Volunteering',
      'Mentoring',
      'Animal welfare',
      'Environmental causes',
    ],
  },
];

export const STANDARDIZED_INTERESTS: string[] = STANDARDIZED_INTEREST_GROUPS.flatMap(g => g.options);

export const STANDARDIZED_CHAPTERS: string[] = [
  'Boston',
  'Miami',
  'Silicon Valley',
  'New York',
];

export const STANDARDIZED_INVOLVEMENT_ROLES: string[] = [
  'Happy to host',
  'Would help organize',
  'Attend only',
];

export const STANDARDIZED_CITIES_Q3: string[] = [
  'Amsterdam',
  'Astana',
  'Berlin',
  'Boston',
  'Chicago',
  'Dubai',
  'Geneva',
  'Hong Kong',
  'Limassol',
  'London',
  'Los Angeles',
  'Miami',
  'Monaco',
  'New York',
  'Paris',
  'San Francisco',
  'Seattle',
  'Singapore',
  'Sydney',
  'Tokyo',
  'Toronto',
  'Zurich',
];

export const STANDARDIZED_COUNTRIES_Q4: string[] = [
  'Australia',
  'Canada',
  'Cyprus',
  'France',
  'Germany',
  'Hong Kong',
  'Italy',
  'Japan',
  'Kazakhstan',
  'Monaco',
  'Netherlands',
  'Saudi Arabia',
  'Singapore',
  'Spain',
  'Switzerland',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
];

export const STANDARDIZED_LANGUAGES: string[] = [
  'English',
  'Arabic',
  'Russian',
  'French',
  'German',
  'Spanish',
  'Mandarin',
  'Kazakh',
];

export const STANDARDIZED_REACH_CHANNELS: string[] = [
  'WhatsApp',
  'Email',
  'Zoom',
  'In app',
  'Telegram',
  'Through the team',
];

export const STANDARDIZED_DIRECT_CONTACT: string[] = [
  'Yes',
  'Through the team first',
  'Not right now',
];

export const STANDARDIZED_AGE_BRACKETS: string[] = [
  'Under 35',
  '35-44',
  '45-54',
  '55-64',
  '65+',
];

export const STANDARDIZED_FAMILY_SITUATIONS: string[] = [
  'Partnered',
  'Single',
  'Partnered with children',
  'Children, grown',
];

export const STANDARDIZED_OFFERS: string[] = [
  'AI & Machine Learning',
  'Software Engineering',
  'Data & Analytics',
  'Product & Design',
  'Research & Academic Collaboration',
  'Education & Mentorship',
  'Healthcare & Medicine',
  'Legal Expertise',
  'Tax & Accounting',
  'Fundraising & Investor Introductions',
  'Investment & Due Diligence',
  'Real Estate',
  'Business Strategy & Operations',
  'Hiring & Team Building',
  'Marketing & Sales',
  'Partnerships & Introductions',
  'International Expansion',
  'Other — please specify',
];

export const QUESTION_SUGGESTIONS: Record<number, string[]> = {
  5: STANDARDIZED_LANGUAGES,
  6: STANDARDIZED_REACH_CHANNELS,
  7: STANDARDIZED_ROLES,
  8: STANDARDIZED_INDUSTRIES,

  14: STANDARDIZED_FOCUS_PRIORITIES,
  15: STANDARDIZED_INDUSTRIES,
  16: STANDARDIZED_CONNECTION_COUNTRIES,
  17: STANDARDIZED_CONNECTION_TYPES,
  18: STANDARDIZED_OFFERS,
  19: STANDARDIZED_DIRECT_CONTACT,
  20: STANDARDIZED_AGE_BRACKETS,
  21: STANDARDIZED_FAMILY_SITUATIONS,
  22: STANDARDIZED_INTERESTS,
  24: STANDARDIZED_CHAPTERS,
};

export const SCREEN_DEFINITIONS = [
  {
    screen: 1,
    title: 'Screen 1: Contact',
    subtitle: 'All Team only. This is what lets us reach the member and check who they are.',
  },
  {
    screen: 2,
    title: 'Screen 2: Profile',
    subtitle: 'The only screen other members can ever see, and only what the member switches on.',
  },
  {
    screen: 3,
    title: 'Screen 3: Residence and family',
    subtitle: 'All optional. Residence can be shown; everything else is Team only.',
  },
  {
    screen: 4,
    title: 'Screen 4: Wealth profile',
    subtitle: 'Only our team sees this. It helps us show you relevant deals and services.',
  },
  {
    screen: 5,
    title: 'Screen 5: Your current setup',
    subtitle: 'All optional and Team only. These three answers tell us which services to offer: tax, estate, insurance, relocation, liquidity planning.',
  },
  {
    screen: 6,
    title: 'Screen 6: Interests and next step',
    subtitle: 'Select what interests you and how you would like to proceed.',
  },
];

export const ALL_COUNTRIES_LIST: string[] = [
  'Australia', 'Austria', 'Bahamas', 'Bahrain', 'Belgium', 'Bermuda', 'Brazil',
  'Canada', 'Cayman Islands', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Dominican Republic', 'Egypt', 'Estonia', 'Finland', 'France',
  'Georgia', 'Germany', 'Greece', 'Hong Kong', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy',
  'Japan', 'Jersey', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait',
  'Latvia', 'Lebanon', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Malaysia', 'Malta', 'Mauritius', 'Mexico', 'Monaco', 'Montenegro', 'Morocco',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman',
  'Panama', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
  'Taiwan', 'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vietnam',
];

export const US_STATES_LIST: string[] = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida',
  'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

export const Q5_LANGUAGE_OPTIONS = ['English', 'Russian', 'Other'];
export const Q6_REFERRAL_OPTIONS = ['Referred by a member (name)', 'Event', 'Partner', 'Other'];
export const Q7_PROFILE_MODE_OPTIONS = ['Visible to members', 'Private (browse deals and events only)'];
export const Q9_MAIN_ROLE_OPTIONS = [
  'Business owner or founder',
  'Investor',
  'Fund manager or GP',
  'Executive',
  'Family office principal',
  'Real estate developer',
  'Professional advisor (lawyer, CPA, banker)',
  'Other',
];
export const Q11_OPEN_TO_OPTIONS = [
  'Raising capital',
  'Investing or co-investing',
  'Selling a business',
  'Buying a business',
  'Partnerships',
  'Hiring',
  'Speaking',
  'Networking',
];
export const Q15_MARITAL_STATUS_OPTIONS = [
  'Single',
  'Married',
  'Partnered',
  'Divorced',
  'Widowed',
  'Prefer not to say',
];
export const Q16_CHILDREN_OPTIONS = [
  'None',
  'Under 18',
  'Adult',
  'Both',
  'Prefer not to say',
];
export const Q17_NET_WORTH_OPTIONS = [
  'Under $1M',
  '$1M to $5M',
  '$5M to $10M',
  '$10M to $30M',
  '$30M to $100M',
  'Over $100M',
  'Prefer not to say',
];
export const Q18_LIQUID_ASSETS_OPTIONS = [
  'Under $500K',
  '$500K to $2M',
  '$2M to $10M',
  '$10M to $25M',
  'Over $25M',
  'Prefer not to say',
];
export const Q19_SOURCE_OF_WEALTH_OPTIONS = [
  'Operating business',
  'Sale of a business',
  'Real estate',
  'Investments',
  'Inheritance',
  'Salary and equity compensation',
  'Other',
];
export const Q20_INVESTOR_STATUS_OPTIONS = [
  'US accredited investor',
  'US qualified purchaser',
  'Professional investor (UK or EU)',
  'Not sure',
  'None of these',
];
export const Q21_ADVISORS_OPTIONS = [
  'Private bank or wealth manager',
  'CPA or tax advisor',
  'Estate attorney',
  'Insurance broker',
  'Family office',
  'Nobody yet',
  'Prefer not to say',
];
export const Q22_STRUCTURES_OPTIONS = [
  'Will',
  'Trust(s)',
  'Life insurance',
  'Holding company or other structures',
  'Business succession plan',
  'None yet',
  'Prefer not to say',
];
export const Q23_UPCOMING_OPTIONS = [
  'Selling a business or liquidity event',
  'Moving country',
  'Buying property',
  'Inheritance',
  'Marriage or divorce',
  'Children’s education',
  'Raising capital',
  'None of these',
];
export const Q24_INTERESTS_OPTIONS = [
  'Private deals',
  'Real estate',
  'Venture and startups',
  'Private credit',
  'Tax and relocation planning',
  'Estate and succession',
  'Insurance',
  'Next-generation education',
  'Concierge and lifestyle',
  'Events and networking',
];
export const Q25_NEXT_STEP_OPTIONS = [
  'Book a private call',
  'Show me deals and events only',
  'Just browsing for now',
];

export const CANONICAL_QUESTIONS: QuestionDefinition[] = [
  // Screen 1: Contact (All Team only)
  { id: 1, screen: 1, section: 'Screen 1: Contact', prompt: 'Full name', type: 'text', is_required: true, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },
  { id: 2, screen: 1, section: 'Screen 1: Contact', prompt: 'Email', type: 'email', is_required: true, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },
  { id: 3, screen: 1, section: 'Screen 1: Contact', prompt: 'Mobile phone', type: 'phone', is_required: true, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },
  { id: 4, screen: 1, section: 'Screen 1: Contact', prompt: 'Telegram and WhatsApp', type: 'two_text', placeholder: '@handle or number', is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },
  { id: 5, screen: 1, section: 'Screen 1: Contact', prompt: 'Preferred language', type: 'dropdown', options: Q5_LANGUAGE_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },
  { id: 6, screen: 1, section: 'Screen 1: Contact', prompt: 'How did you hear about us?', type: 'dropdown_text', options: Q6_REFERRAL_OPTIONS, is_required: true, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },

  // Screen 2: Profile (The only screen other members can ever see, and only what the member switches on)
  { id: 7, screen: 2, section: 'Screen 2: Profile', prompt: 'How do you want to be on the platform?', type: 'single', options: Q7_PROFILE_MODE_OPTIONS, is_required: true, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },
  { id: 8, screen: 2, section: 'Screen 2: Profile', prompt: 'Profile photo', type: 'upload', is_required: false, is_confidential: false, visibility_mode: 'switch', default_visibility: 'private' },
  { id: 9, screen: 2, section: 'Screen 2: Profile', prompt: 'Your main role', type: 'dropdown', options: Q9_MAIN_ROLE_OPTIONS, is_required: false, is_confidential: false, visibility_mode: 'switch', default_visibility: 'private' },
  { id: 10, screen: 2, section: 'Screen 2: Profile', prompt: 'Company and short bio', type: 'text', char_limit: 300, is_required: false, is_confidential: false, visibility_mode: 'switch', default_visibility: 'private' },
  { id: 11, screen: 2, section: 'Screen 2: Profile', prompt: 'What are you open to?', type: 'multi', options: Q11_OPEN_TO_OPTIONS, is_required: false, is_confidential: false, visibility_mode: 'switch', default_visibility: 'private' },

  // Screen 3: Residence and family (All optional. Residence can be shown; everything else is Team only. Encrypted)
  { id: 12, screen: 3, section: 'Screen 3: Residence and family', prompt: 'Where do you live?', helper: 'Country list (allow 2+ for people who split time)', type: 'country_multi', options: ALL_COUNTRIES_LIST, is_required: false, is_confidential: false, visibility_mode: 'switch', default_visibility: 'private', is_encrypted: true },
  { id: 13, screen: 3, section: 'Screen 3: Residence and family', prompt: 'Citizenships', helper: 'Countries only, never passport numbers', type: 'country_multi', options: ALL_COUNTRIES_LIST, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true },
  { id: 14, screen: 3, section: 'Screen 3: Residence and family', prompt: 'Where do you pay tax?', helper: 'Country list, plus US state if US', type: 'country_tax_multi', options: ALL_COUNTRIES_LIST, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true },
  { id: 15, screen: 3, section: 'Screen 3: Residence and family', prompt: 'Marital status', type: 'dropdown', options: Q15_MARITAL_STATUS_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true },
  { id: 16, screen: 3, section: 'Screen 3: Residence and family', prompt: 'Children', type: 'dropdown', options: Q16_CHILDREN_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true },

  // Screen 4: Wealth profile (All optional and all Team only, locked. No free text. Encrypted)
  { id: 17, screen: 4, section: 'Screen 4: Wealth profile', prompt: 'Approximate net worth', type: 'dropdown', options: Q17_NET_WORTH_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true, no_free_text: true },
  { id: 18, screen: 4, section: 'Screen 4: Wealth profile', prompt: 'Liquid investable assets', type: 'dropdown', options: Q18_LIQUID_ASSETS_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true, no_free_text: true },
  { id: 19, screen: 4, section: 'Screen 4: Wealth profile', prompt: 'Main source of wealth', type: 'multi', options: Q19_SOURCE_OF_WEALTH_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true, no_free_text: true },
  { id: 20, screen: 4, section: 'Screen 4: Wealth profile', prompt: 'Investor status', helper: 'Q20 is self-reported. If a deal legally requires verified status, the app must ask for proof at that point, not here.', type: 'multi', options: Q20_INVESTOR_STATUS_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true, no_free_text: true },

  // Screen 5: Your current setup (All optional and Team only. No free text. Encrypted)
  { id: 21, screen: 5, section: 'Screen 5: Your current setup', prompt: 'Who advises you today?', type: 'multi', options: Q21_ADVISORS_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true, no_free_text: true },
  { id: 22, screen: 5, section: 'Screen 5: Your current setup', prompt: 'What do you already have in place?', type: 'multi', options: Q22_STRUCTURES_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true, no_free_text: true },
  { id: 23, screen: 5, section: 'Screen 5: Your current setup', prompt: 'Anything coming up in the next 2 years?', type: 'multi', options: Q23_UPCOMING_OPTIONS, is_required: false, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private', is_encrypted: true, no_free_text: true },

  // Screen 6: Interests and next step
  { id: 24, screen: 6, section: 'Screen 6: Interests and next step', prompt: 'What interests you?', type: 'multi', options: Q24_INTERESTS_OPTIONS, is_required: false, is_confidential: false, visibility_mode: 'switch', default_visibility: 'private' },
  { id: 25, screen: 6, section: 'Screen 6: Interests and next step', prompt: 'What would you like next?', type: 'single', options: Q25_NEXT_STEP_OPTIONS, is_required: true, is_confidential: true, visibility_mode: 'team_only', default_visibility: 'private' },
];

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ onBack, onCompleteSignUp, initialViewMode }) => {
  const insets = useSafeAreaInsets();
  const {
    refreshUserData,
    switchPersona,
    pendingAccessEmail,
    setPendingAccessEmail,
    setAppView,
    verifiedPhone,
    invitationCode,
    invitationEmail,
    invitationFullName,
    setInvitationFullName,
  } = useClub();

  const activePhone = verifiedPhone || OzaraStorage.getItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE) || '';
  const initToken = invitationCode || OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_CODE) || '';
  const initEmail = invitationEmail || OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL) || '';
  const initFullName = invitationFullName || OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME) || '';

  // Navigation mode within SignUp flow - defaults to questionnaire_page if account created, or initialViewMode
  const [viewMode, setViewModeState] = useState<GateView>(() => {
    if (initialViewMode) return initialViewMode;
    const hasAccount =
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID) &&
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.TERMS_ACCEPTED_VERSION);
    if (hasAccount) return 'questionnaire_page';
    const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.SIGNUP_STEP) as GateView | null;
    if (saved && ['check_token', 'request_access', 'register_form', 'questionnaire_page'].includes(saved)) {
      return saved;
    }
    if (initToken) return 'register_form';
    return 'check_token';
  });

  const setViewMode = (mode: GateView) => {
    setViewModeState(mode);
    if (['check_token', 'request_access', 'register_form', 'questionnaire_page'].includes(mode)) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.SIGNUP_STEP, mode);
    } else {
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.SIGNUP_STEP);
    }
  };

  // Submitted access request notification context
  const [submittedEmail, setSubmittedEmail] = useState<string>(() => {
    return initEmail || pendingAccessEmail || OzaraStorage.getItem(OZARA_STORAGE_KEYS.PENDING_EMAIL) || '';
  });

  // Token entry state
  const [tokenInput, setTokenInput] = useState(initToken);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Access request form state
  const [reqFullName, setReqFullName] = useState(initFullName);
  const [reqEmail, setReqEmail] = useState(initEmail || submittedEmail || '');
  const [reqRole, setReqRole] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');

  // Approved token state (prepopulated from valid invitation gate)
  const [approvedToken, setApprovedToken] = useState(initToken);
  const [verifiedEmail, setVerifiedEmail] = useState(initEmail);
  const [isApproved, setIsApproved] = useState(Boolean(initToken));

  // Face ID post-onboarding modal
  const [showFaceIdModal, setShowFaceIdModal] = useState(false);

  // Subscription payment post-onboarding modal for paid members
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isActivatingSubscription, setIsActivatingSubscription] = useState(false);

  // Sync token when context loads
  useEffect(() => {
    if (invitationCode) {
      setApprovedToken(invitationCode);
      setIsApproved(true);
      if (viewMode === 'check_token') {
        setViewMode('register_form');
      }
    }
    if (invitationEmail) {
      setVerifiedEmail(invitationEmail);
    }
    if (invitationFullName && !fullName) {
      setFullName(invitationFullName);
    }
  }, [invitationCode, invitationEmail, invitationFullName]);

  // Registration form state
  const [fullName, setFullName] = useState(initFullName);
  const [headline, setHeadline] = useState('');
  const [chapter, setChapter] = useState('Dubai');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Standardized Location & Industry States (Separate fields)
  const [selectedCountry, setSelectedCountry] = useState('United Arab Emirates');
  const [selectedState, setSelectedState] = useState('Dubai');
  const [selectedCity, setSelectedCity] = useState('Dubai');
  const [customCity, setCustomCity] = useState('');
  const [showCustomCity, setShowCustomCity] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('Financial Services & FinTech');
  const [selectedRole, setSelectedRole] = useState('Founder & CEO');

  // Access Request Form structured location & industry
  const [reqIndustry, setReqIndustry] = useState('Artificial Intelligence & DeepTech');
  const [reqCountry, setReqCountry] = useState('United Arab Emirates');
  const [reqCity, setReqCity] = useState('Dubai');

  // Modal / Dropdown active selector states
  const [activeDropdown, setActiveDropdown] = useState<'country' | 'state' | 'city' | 'industry' | 'role' | 'req_industry' | 'req_country' | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');

  const currentDropdownOptions = useMemo(() => {
    let list: string[] = [];
    if (activeDropdown === 'country' || activeDropdown === 'req_country') {
      list = COUNTRIES.map((c) => c.name);
    } else if (activeDropdown === 'state') {
      const c = COUNTRIES.find((x) => x.name === selectedCountry);
      list = c ? c.states.map((s) => s.name) : [];
    } else if (activeDropdown === 'city') {
      const c = COUNTRIES.find((x) => x.name === selectedCountry);
      const s = c?.states.find((y) => y.name === selectedState);
      list = s ? s.cities : [];
    } else if (activeDropdown === 'industry' || activeDropdown === 'req_industry') {
      list = STANDARDIZED_INDUSTRIES;
    } else if (activeDropdown === 'role') {
      list = STANDARDIZED_ROLES;
    }

    if (!dropdownSearch.trim()) return list;
    const term = dropdownSearch.toLowerCase();
    return list.filter((item) => item.toLowerCase().includes(term));
  }, [activeDropdown, selectedCountry, selectedState, dropdownSearch]);

  const handleSelectCountry = (countryName: string) => {
    if (activeDropdown === 'req_country') {
      setReqCountry(countryName);
      const found = COUNTRIES.find((c) => c.name === countryName);
      if (found && found.states[0]?.cities[0]) {
        setReqCity(found.states[0].cities[0]);
      }
      setActiveDropdown(null);
      setDropdownSearch('');
      return;
    }
    setSelectedCountry(countryName);
    const found = COUNTRIES.find((c) => c.name === countryName);
    if (found) {
      const firstState = found.states[0]?.name || '';
      setSelectedState(firstState);
      const firstCity = found.states[0]?.cities[0] || '';
      setSelectedCity(firstCity);
      if (found.defaultChapter) {
        setChapter(found.defaultChapter);
      }
    }
    setActiveDropdown(null);
    setDropdownSearch('');
  };

  const handleSelectState = (stateName: string) => {
    setSelectedState(stateName);
    const countryObj = COUNTRIES.find((c) => c.name === selectedCountry);
    const stateObj = countryObj?.states.find((s) => s.name === stateName);
    if (stateObj && stateObj.cities.length > 0) {
      setSelectedCity(stateObj.cities[0]);
    }
    setActiveDropdown(null);
    setDropdownSearch('');
  };

  const handleSelectCity = (cityName: string) => {
    setSelectedCity(cityName);
    setCustomCity('');
    setShowCustomCity(false);
    setActiveDropdown(null);
    setDropdownSearch('');
  };

  const handleSelectIndustry = (ind: string) => {
    if (activeDropdown === 'req_industry') {
      setReqIndustry(ind);
    } else {
      setSelectedIndustry(ind);
    }
    setActiveDropdown(null);
    setDropdownSearch('');
  };

  const handleSelectRole = (r: string) => {
    setSelectedRole(r);
    if (!headline.trim()) {
      setHeadline(r);
    }
    setActiveDropdown(null);
    setDropdownSearch('');
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            if (event.target?.result) {
              const dataUrl = event.target.result as string;
              setAvatarUrl(dataUrl);
              setAnswers((prev) => ({
                ...prev,
                8: {
                  value: dataUrl,
                  visibility: prev[8]?.visibility || 'private',
                },
              }));
              const uid = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
              if (uid) {
                ApiService.updateAvatar(uid, dataUrl).catch((err) => {
                  console.warn('Failed to save avatar to server:', err);
                });
              }
            }
          };
          reader.readAsDataURL(file);
        }
      };
      fileInput.click();
    } else {
      if (Alert.prompt) {
        Alert.prompt(
          'Profile Picture URL',
          'Enter a direct link to your executive portrait image:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Set Portrait',
              onPress: (val?: string) => {
                if (val && val.trim()) {
                  const clean = val.trim();
                  setAvatarUrl(clean);
                  setAnswers((prev) => ({
                    ...prev,
                    8: {
                      value: clean,
                      visibility: prev[8]?.visibility || 'private',
                    },
                  }));
                  const uid = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
                  if (uid) {
                    ApiService.updateAvatar(uid, clean).catch((err) => {
                      console.warn('Failed to save avatar to server:', err);
                    });
                  }
                }
              },
            },
          ],
          'plain-text',
          avatarUrl
        );
      } else {
        setShowUrlInput(true);
      }
    }
  };

  // Fallback guard: redirect any legacy got_token state back to check_token
  useEffect(() => {
    if ((viewMode as string) === 'got_token') {
      setViewMode('check_token');
    }
  }, [viewMode]);

  // 25 Canonical Questions across 6 Screens
  const [questions] = useState<QuestionDefinition[]>(() => CANONICAL_QUESTIONS);
  const [currentScreen, setCurrentScreen] = useState<number>(() => {
    try {
      const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CURRENT_SCREEN);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 6) return parsed;
      }
    } catch {}
    return 1;
  });
  const [consentChecked, setConsentChecked] = useState<boolean>(() => {
    try {
      return OzaraStorage.getItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CONSENT_CHECKED) === 'true';
    } catch {}
    return false;
  });

  useEffect(() => {
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CURRENT_SCREEN, String(currentScreen));
  }, [currentScreen]);

  useEffect(() => {
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CONSENT_CHECKED, consentChecked ? 'true' : 'false');
  }, [consentChecked]);

  const [answers, setAnswers] = useState<Record<number, { value: string; visibility: 'shared' | 'private' }>>(() => {
    let initialAns: Record<number, { value: string; visibility: 'shared' | 'private' }> = {};
    try {
      const rawDraft = OzaraStorage.getItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (parsed && typeof parsed === 'object') {
          initialAns = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse draft answers from storage:', e);
    }
    const defaultName = initFullName || fullName || '';
    if ((!initialAns[1] || !initialAns[1].value || initialAns[1].value === 'skipped') && defaultName) {
      initialAns[1] = { value: defaultName, visibility: 'private' };
    }
    if ((!initialAns[2] || !initialAns[2].value || initialAns[2].value === 'skipped') && verifiedEmail) {
      initialAns[2] = { value: verifiedEmail, visibility: 'private' };
    }
    if ((!initialAns[3] || !initialAns[3].value || initialAns[3].value === 'skipped') && activePhone) {
      initialAns[3] = { value: activePhone, visibility: 'private' };
    }
    return initialAns;
  });

  // Keep Q1 (Full name), Q2 (Email), Q3 (Mobile phone) continuously populated from registration context
  useEffect(() => {
    const effectiveName = fullName || initFullName;
    setAnswers((prev) => {
      let next = prev;
      if (effectiveName && (!prev[1] || !prev[1].value || prev[1].value === 'skipped')) {
        next = { ...next, 1: { value: effectiveName, visibility: 'private' } };
      }
      if (verifiedEmail && (!prev[2] || !prev[2].value || prev[2].value === 'skipped')) {
        next = { ...next, 2: { value: verifiedEmail, visibility: 'private' } };
      }
      if (activePhone && (!prev[3] || !prev[3].value || prev[3].value === 'skipped')) {
        next = { ...next, 3: { value: activePhone, visibility: 'private' } };
      }
      return next;
    });
  }, [fullName, initFullName, verifiedEmail, activePhone]);

  const [registeredUserId, setRegisteredUserId] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID) || '';
  });
  const [isSavingAnswers, setIsSavingAnswers] = useState(false);
  const [activeQuestionDropdownId, setActiveQuestionDropdownId] = useState<number | null>(null);
  const [qSelectedCountry, setQSelectedCountry] = useState<Record<string | number, string>>(() => {
    try {
      const rawCountries = OzaraStorage.getItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_COUNTRIES);
      if (rawCountries) {
        const parsed = JSON.parse(rawCountries);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {}
    return {};
  });
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const autosaveTimerRef = useRef<any>(null);
  const [dropdownSearchQuery, setDropdownSearchQuery] = useState<string>('');
  const dropdownSearchInputRef = useRef<TextInput | null>(null);
  const [specifyingOtherQuestionId, setSpecifyingOtherQuestionId] = useState<number | null>(null);
  const [customOtherText, setCustomOtherText] = useState<string>('');
  const otherTextInputRef = useRef<TextInput | null>(null);
  const [whatsAppCountrySearchQuery, setWhatsAppCountrySearchQuery] = useState<string>('');

  // Auto-focus search input whenever any question dropdown opens
  useEffect(() => {
    setDropdownSearchQuery('');
    setSpecifyingOtherQuestionId(null);
    setCustomOtherText('');
    if (activeQuestionDropdownId !== null) {
      const timer = setTimeout(() => {
        dropdownSearchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeQuestionDropdownId]);

  // Web keyboard handler for dropdowns (Escape to close)
  useEffect(() => {
    if (activeQuestionDropdownId === null) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setActiveQuestionDropdownId(null);
          setDropdownSearchQuery('');
          setSpecifyingOtherQuestionId(null);
          setCustomOtherText('');
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [activeQuestionDropdownId]);

  // Close active dropdown when clicking anywhere outside that window
  useEffect(() => {
    if (activeQuestionDropdownId === null) return;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handlePointerDown = (event: MouseEvent | TouchEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (
          target.closest &&
          target.closest(`[data-testid="dropdown-wrap-${activeQuestionDropdownId}"], [data-dropdown-wrap="${activeQuestionDropdownId}"]`)
        ) {
          return;
        }
        setActiveQuestionDropdownId(null);
        setDropdownSearchQuery('');
      };

      const timer = setTimeout(() => {
        document.addEventListener('pointerdown', handlePointerDown, true);
      }, 0);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('pointerdown', handlePointerDown, true);
      };
    }
  }, [activeQuestionDropdownId]);

  // Synchronously persist draft answers to cross-platform storage (survives laptop close/page refresh)
  useEffect(() => {
    if (answers && Object.keys(answers).length > 0) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS, JSON.stringify(answers));
    }
  }, [answers]);

  useEffect(() => {
    if (qSelectedCountry && Object.keys(qSelectedCountry).length > 0) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_COUNTRIES, JSON.stringify(qSelectedCountry));
    }
  }, [qSelectedCountry]);

  // Web window beforeunload hook: ensure draft is flushed to storage before tab/window closes
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleBeforeUnload = () => {
        if (answers && Object.keys(answers).length > 0) {
          OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS, JSON.stringify(answers));
        }
        if (qSelectedCountry && Object.keys(qSelectedCountry).length > 0) {
          OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_COUNTRIES, JSON.stringify(qSelectedCountry));
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [answers, qSelectedCountry]);

  const displayFullName = fullName || verifiedEmail || 'Member';

  const buildAnswerPayload = (
    sourceAnswers: Record<number, { value: string; visibility: 'shared' | 'private' }> = answers
  ) => {
    const isPrivateProfileMode =
      sourceAnswers[7]?.value === 'Private (browse deals and events only)';

    const payload = Object.entries(sourceAnswers)
      .filter(([qIdStr, item]) => {
        const qId = parseInt(qIdStr, 10);
        return qId >= 1 && qId <= 25 && item && item.value && item.value.trim().length > 0;
      })
      .map(([qIdStr, item]) => {
        const qId = parseInt(qIdStr, 10);
        const qDef = CANONICAL_QUESTIONS.find((q) => q.id === qId);
        const isSwitchable = qDef?.visibility_mode === 'switch';
        const effectiveVis: 'shared' | 'private' =
          !isSwitchable || isPrivateProfileMode ? 'private' : item.visibility || 'private';
        return {
          question_id: qId,
          value: item.value.trim(),
          visibility: effectiveVis,
        };
      });

    const nameVal = displayFullName !== 'Member' ? displayFullName : fullName || '';
    if (nameVal && !payload.some((a) => a.question_id === 1)) {
      payload.push({ question_id: 1, value: nameVal, visibility: 'private' });
    }
    if (verifiedEmail && !payload.some((a) => a.question_id === 2)) {
      payload.push({ question_id: 2, value: verifiedEmail, visibility: 'private' });
    }
    if (activePhone && !payload.some((a) => a.question_id === 3)) {
      payload.push({ question_id: 3, value: activePhone, visibility: 'private' });
    }
    return payload;
  };

  // Debounced server-side draft sync: saves progress to user's questionnaire_answers in database
  useEffect(() => {
    const uid = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (!uid || viewMode !== 'questionnaire_page') return;

    const answerPayload = buildAnswerPayload(answers);
    if (answerPayload.length === 0) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveStatus('saving');

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await ApiService.saveAnswersBulk(uid, answerPayload, {
          onboarding_screen: currentScreen,
          questionnaire_consent: consentChecked,
        });
        setAutosaveStatus('saved');
      } catch (e) {
        setAutosaveStatus('saved');
      }
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [answers, registeredUserId, viewMode, displayFullName, fullName, verifiedEmail, activePhone, currentScreen, consentChecked]);

  // Hydrate user profile from server if registeredUserId is present
  useEffect(() => {
    const uid = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (uid) {
      ApiService.getProfile(uid, uid)
        .then((p: any) => {
          if (p) {
            if (p.full_name) {
              setFullName(p.full_name);
              setInvitationFullName(p.full_name);
              OzaraStorage.setItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME, p.full_name);
            }
            if (p.email) setVerifiedEmail(p.email);
            if (p.avatar_url) setAvatarUrl(p.avatar_url);
            if (p.headline && p.headline !== 'New Member' && p.headline !== 'Verified Executive') {
              setHeadline(p.headline);
            }
            if (p.chapter?.name) setChapter(p.chapter.name);

            if (p.onboarding_screen && p.onboarding_screen >= 1 && p.onboarding_screen <= 6) {
              const savedLocal = OzaraStorage.getItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CURRENT_SCREEN);
              if (!savedLocal) {
                setCurrentScreen(p.onboarding_screen);
              }
            }
            if (p.questionnaire_consent) {
              setConsentChecked(true);
            }

            const serverAnswers = (p.answers && Array.isArray(p.answers)) ? p.answers : (p.shared_answers || []);
            const loaded: Record<number, { value: string; visibility: 'shared' | 'private' }> = {};
            if (Array.isArray(serverAnswers) && serverAnswers.length > 0) {
              serverAnswers.forEach((ans: any) => {
                const val = ans.value_text !== undefined ? ans.value_text : ans.value;
                if (val && val !== 'unanswered' && ans.question_id >= 1 && ans.question_id <= 25) {
                  const qDef = CANONICAL_QUESTIONS.find((q) => q.id === ans.question_id);
                  const isSwitchable = qDef?.visibility_mode === 'switch';
                  loaded[ans.question_id] = {
                    value: typeof val === 'string' ? val : JSON.stringify(val),
                    visibility: isSwitchable ? (ans.visibility || 'private') : 'private',
                  };
                }
              });
            }
            if (p.full_name && (!loaded[1] || !loaded[1].value || loaded[1].value === 'skipped')) {
              loaded[1] = { value: p.full_name, visibility: 'private' };
            }
            if (p.email && (!loaded[2] || !loaded[2].value || loaded[2].value === 'skipped')) {
              loaded[2] = { value: p.email, visibility: 'private' };
            }
            if (p.phone && (!loaded[3] || !loaded[3].value || loaded[3].value === 'skipped')) {
              loaded[3] = { value: p.phone, visibility: 'private' };
            }
            if (p.avatar_url && (!loaded[8] || !loaded[8].value || loaded[8].value === 'skipped')) {
              loaded[8] = { value: p.avatar_url, visibility: 'private' };
            }
            if (Object.keys(loaded).length > 0) {
              setAnswers((prev) => {
                const merged = { ...loaded, ...prev };
                if (p.full_name && (!merged[1] || !merged[1].value || merged[1].value === 'skipped')) {
                  merged[1] = { value: p.full_name, visibility: 'private' };
                }
                if (p.email && (!merged[2] || !merged[2].value || merged[2].value === 'skipped')) {
                  merged[2] = { value: p.email, visibility: 'private' };
                }
                if (p.phone && (!merged[3] || !merged[3].value || merged[3].value === 'skipped')) {
                  merged[3] = { value: p.phone, visibility: 'private' };
                }
                return merged;
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [registeredUserId, viewMode]);

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'M';
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'M';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const displaySubtitle = (headline && headline !== 'New Member' && headline !== 'Verified Executive')
    ? (chapter ? `${headline} • ${chapter} Chapter` : headline)
    : (verifiedEmail && verifiedEmail !== displayFullName ? verifiedEmail : '');

  const handleAnswerChange = (questionId: number, value: string) => {
    if (questionId === 1) {
      setFullName(value);
    }
    if (questionId === 2) {
      setVerifiedEmail(value);
    }
    const qDef = CANONICAL_QUESTIONS.find((q) => q.id === questionId);
    const isSwitchable = qDef?.visibility_mode === 'switch';

    setAnswers((prev) => {
      const isPrivateModeAfterChange =
        questionId === 7
          ? value === 'Private (browse deals and events only)'
          : prev[7]?.value === 'Private (browse deals and events only)';

      const next: Record<number, { value: string; visibility: 'shared' | 'private' }> = {
        ...prev,
        [questionId]: {
          value,
          visibility:
            !isSwitchable || isPrivateModeAfterChange
              ? 'private'
              : prev[questionId]?.visibility || 'private',
        },
      };

      // If Q7 is set to Private mode, force all switchable answers (Q8, Q9, Q10, Q11, Q12, Q24) to 'private'
      if (questionId === 7 && value === 'Private (browse deals and events only)') {
        for (const switchQId of [8, 9, 10, 11, 12, 24]) {
          if (next[switchQId]) {
            next[switchQId] = { ...next[switchQId], visibility: 'private' };
          }
        }
      }
      return next;
    });
  };

  const handleSkipQuestion = (questionId: number) => {
    if ([1, 2, 3, 6, 7, 25].includes(questionId)) return; // Required questions cannot be skipped
    const qDef = CANONICAL_QUESTIONS.find((q) => q.id === questionId);
    const isSwitchable = qDef?.visibility_mode === 'switch';
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        value: 'skipped',
        visibility: isSwitchable ? prev[questionId]?.visibility || 'private' : 'private',
      },
    }));
  };

  const toggleAnswerVisibility = (questionId: number) => {
    const qDef = CANONICAL_QUESTIONS.find((q) => q.id === questionId);
    if (!qDef || qDef.visibility_mode !== 'switch') return; // Team only questions are locked

    if (answers[7]?.value === 'Private (browse deals and events only)') {
      const msg =
        "Your profile mode (Question 7) is currently set to 'Private (browse deals and events only)'. Switch Question 7 to 'Visible to members' first to make individual profile answers visible.";
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Profile Mode is Private', msg);
      return;
    }

    setAnswers((prev) => {
      const current = prev[questionId]?.visibility || 'private';
      return {
        ...prev,
        [questionId]: {
          value: prev[questionId]?.value || '',
          visibility: current === 'private' ? 'shared' : 'private',
        },
      };
    });
  };

  const isQuestionAnswered = (qId: number, currentAns = answers): boolean => {
    const item = currentAns[qId];
    if (!item || !item.value || !item.value.trim() || item.value === 'skipped') return false;
    if (qId === 6) {
      // Q6 is Dropdown + text: verify dropdown option is selected
      try {
        const parsed = JSON.parse(item.value);
        return Boolean(parsed && parsed.source && String(parsed.source).trim());
      } catch {
        return item.value.trim().length > 0;
      }
    }
    return true;
  };

  const answeredCount = Object.keys(answers)
    .map((k) => parseInt(k, 10))
    .filter((qId) => qId >= 1 && qId <= 25 && isQuestionAnswered(qId)).length;

  // Background polling ref for non-blocking approval detection
  const pollTimerRef = useRef<any>(null);

  const CHAPTERS = ['Dubai', 'New York', 'London', 'Astana', 'Singapore', 'Miami', 'Silicon Valley', 'Barcelona', 'Limassol'];

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Non-blocking background check for admin approval while on check_token if request was submitted
  useEffect(() => {
    if (viewMode === 'check_token' && submittedEmail.trim()) {
      const emailToCheck = submittedEmail.trim().toLowerCase();

      const checkStatus = async () => {
        try {
          const res = await ApiService.checkAccessStatus(emailToCheck);
          if (res.status === 'approved' && res.has_token) {
            setIsApproved(true);
            if (res.fullName) setFullName(res.fullName);
          } else if (res.status === 'none') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setSubmittedEmail('');
            setPendingAccessEmail('');
            setIsApproved(false);
            OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
          }
        } catch (err) {
          // Silent polling retry in background
        }
      };

      const initialTimer = setTimeout(checkStatus, 1200);
      pollTimerRef.current = setInterval(checkStatus, 4000);

      return () => {
        clearTimeout(initialTimer);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      };
    }
  }, [viewMode, submittedEmail]);

  const handleStartOver = (goToWelcome = false) => {
    setSubmittedEmail('');
    setReqEmail('');
    setReqFullName('');
    setReqRole('');
    setReqNotes('');
    setTokenInput('');
    setApprovedToken('');
    setVerifiedEmail('');
    setIsApproved(false);
    setPendingAccessEmail('');
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_TOKEN);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.SIGNUP_STEP);
    if (goToWelcome) {
      onBack();
    } else {
      setViewMode('check_token');
    }
  };

  // 1. Verify Token & Pre-populate Email
  const handleVerifyToken = async (explicitToken?: string) => {
    const raw = (explicitToken || tokenInput).trim();
    if (!raw) {
      setVerifyError('Please enter your invitation code.');
      return;
    }

    try {
      setIsVerifying(true);
      setVerifyError('');
      const res = await ApiService.verifyInviteToken(raw);

      if (res.valid && res.email) {
        setApprovedToken(res.token);
        setVerifiedEmail(res.email);
        if (res.fullName) {
          setFullName(res.fullName);
          setInvitationFullName(res.fullName);
          OzaraStorage.setItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME, res.fullName);
        }
        if (res.role) setHeadline(res.role);

        setViewMode('register_form');
      } else {
        setVerifyError(res.status || 'Invalid invitation code.');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Invitation token verification failed. Please check the code or request access.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Submit Request Access
  const handleSendAccessRequest = async () => {
    if (!reqFullName.trim() || !reqEmail.trim()) {
      setRequestError('Full name and business email are required.');
      return;
    }

    try {
      setIsRequesting(true);
      setRequestError('');
      const normalizedEmail = reqEmail.trim().toLowerCase();
      const structuredRoleHeadline = reqRole.trim() 
        ? `${reqRole.trim()} • ${reqIndustry} (${reqCity}, ${reqCountry})`
        : `${reqIndustry} (${reqCity}, ${reqCountry})`;

      const res = await ApiService.requestAccess({
        fullName: reqFullName.trim(),
        email: normalizedEmail,
        role: structuredRoleHeadline,
        notes: reqNotes.trim(),
        phone: activePhone || undefined,
      });

      setPendingAccessEmail(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setFullName(reqFullName.trim());
      setInvitationFullName(reqFullName.trim());
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME, reqFullName.trim());
      if (reqRole.trim()) setHeadline(reqRole.trim());

      if (res.status === 'approved' && res.token) {
        setIsApproved(true);
        setViewMode('check_token');
      } else {
        setViewMode('check_token');
      }
    } catch (err: any) {
      setRequestError(err.message || 'Could not submit access request.');
    } finally {
      setIsRequesting(false);
    }
  };

  // 3. Step A: Register User Coordinates and Advance to Questionnaire
  const handleProceedToQuestions = async () => {
    if (!fullName.trim() || !verifiedEmail.trim()) {
      const msg = 'Please provide your full name.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Required Field', msg);
      return;
    }

    try {
      setIsSubmitting(true);
      const finalCityVal = (showCustomCity && customCity.trim()) ? customCity.trim() : selectedCity;
      const compositeHeadline = headline.trim() || `${selectedRole} • ${selectedIndustry}`;

      const res = await ApiService.registerUser({
        email: verifiedEmail.trim().toLowerCase(),
        full_name: fullName.trim(),
        headline: compositeHeadline,
        token: approvedToken,
        country: selectedCountry,
        state: selectedState,
        city: finalCityVal,
        industry: selectedIndustry,
        chapter_id: `ch_${chapter.toLowerCase().replace(/\s+/g, '_')}`,
        accepted_conditions_version: CURRENT_ACCESS_CONDITIONS_VERSION,
        avatar_url: avatarUrl.trim() || undefined,
        phone: activePhone || undefined,
      });

      if (res.success && res.user) {
        setRegisteredUserId(res.user.id);
        OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, res.user.id);
        setCurrentScreen(1);
        setViewMode('questionnaire_page');
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('already exists')) {
        setViewMode('questionnaire_page');
      } else {
        const msg = err.message || 'Could not save profile details.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Registration Notice', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate required questions and free-text compliance for a given screen (or all screens on completion)
  const validateScreenOrAll = (screenToValidate: number, checkAllRequired = false): boolean => {
    const requiredIds = checkAllRequired
      ? [1, 2, 3, 6, 7, 25]
      : CANONICAL_QUESTIONS.filter((q) => q.screen === screenToValidate && q.is_required).map((q) => q.id);

    for (const reqId of requiredIds) {
      if (!isQuestionAnswered(reqId)) {
        const qDef = CANONICAL_QUESTIONS.find((q) => q.id === reqId);
        const msg = `Question ${reqId} ("${qDef?.prompt || ''}") is required before continuing.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Required Question', msg);
        if (checkAllRequired && qDef?.screen && qDef.screen !== currentScreen) {
          setCurrentScreen(qDef.screen);
        }
        return false;
      }
    }

    // Content moderation guardrail on free-text fields (Q6 detail text and Q10 short bio)
    const PROHIBITED_REGEX =
      /\b(raising|pre-money|pre\s*money|ticket|irr)\b|[$€£]\s*\d+[\d,.]*(?:\s*(?:k|m|b|million|billion))?|\bguaranteed\b.{0,20}\breturn\b|\brisk[- ]free\b.{0,20}\bprofit\b|\bvalued at \$\d+/i;

    const freeTextQuestionIds = checkAllRequired
      ? [6, 10]
      : [6, 10].filter((id) => CANONICAL_QUESTIONS.find((q) => q.id === id)?.screen === screenToValidate);

    for (const qId of freeTextQuestionIds) {
      const item = answers[qId];
      if (!item || !item.value || item.value === 'skipped') continue;
      let textToInspect = item.value.trim();
      if (qId === 6) {
        try {
          const parsed = JSON.parse(textToInspect);
          textToInspect = parsed.detail || '';
        } catch {}
      }
      if (textToInspect && PROHIBITED_REGEX.test(textToInspect)) {
        const match = textToInspect.match(PROHIBITED_REGEX);
        const flaggedWord = match ? match[0] : '';
        const qDef = CANONICAL_QUESTIONS.find((q) => q.id === qId);
        const msg = `Question ${qId} ("${qDef?.prompt}"): The term "${flaggedWord}" was flagged under community content rules.\n\nMembers describe what they do and what they are interested in. Members do not post specific offerings, amounts being raised, valuations, terms, returns, or minimum investments.`;
        if (Platform.OS === 'web') window.alert('Content Guidance: ' + msg);
        else Alert.alert('Content Guidance', msg);
        return false;
      }
    }

    if ((screenToValidate === 6 || checkAllRequired) && !consentChecked) {
      const msg =
        'Please confirm that your answers are accurate and agree to the privacy policy before completing onboarding.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Consent Required', msg);
      return false;
    }

    return true;
  };

  // Save current screen and advance to the next screen (or complete on Screen 6)
  const handleSaveAndNextScreen = async () => {
    setActiveQuestionDropdownId(null);
    if (currentScreen < 6) {
      if (!validateScreenOrAll(currentScreen, false)) return;
      const nextScreen = currentScreen + 1;
      setCurrentScreen(nextScreen);
      const targetUserId = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
      if (targetUserId) {
        try {
          setIsSavingAnswers(true);
          const payload = buildAnswerPayload(answers);
          await ApiService.saveAnswersBulk(targetUserId, payload, {
            onboarding_screen: nextScreen,
            questionnaire_consent: consentChecked,
          });
          setAutosaveStatus('saved');
        } catch (err) {
          console.warn('Screen save warning:', err);
        } finally {
          setIsSavingAnswers(false);
        }
      }
    } else {
      await handleCompleteQuestionnaire();
    }
  };

  // Screen 5: "Skip, discuss on a call" button
  const handleSkipScreen5 = async () => {
    setActiveQuestionDropdownId(null);
    const updatedAnswers: Record<number, { value: string; visibility: 'shared' | 'private' }> = {
      ...answers,
      21: answers[21]?.value ? answers[21] : { value: 'skipped', visibility: 'private' },
      22: answers[22]?.value ? answers[22] : { value: 'skipped', visibility: 'private' },
      23: answers[23]?.value ? answers[23] : { value: 'skipped', visibility: 'private' },
    };
    setAnswers(updatedAnswers);
    setCurrentScreen(6);
    const targetUserId = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (targetUserId) {
      try {
        setIsSavingAnswers(true);
        const payload = buildAnswerPayload(updatedAnswers);
        await ApiService.saveAnswersBulk(targetUserId, payload, {
          onboarding_screen: 6,
          questionnaire_consent: consentChecked,
        });
      } catch {} finally {
        setIsSavingAnswers(false);
      }
    }
  };

  // Save after current screen & let member finish later
  const handleSaveAndFinishLater = async () => {
    setActiveQuestionDropdownId(null);
    const targetUserId = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    try {
      setIsSavingAnswers(true);
      if (targetUserId) {
        const payload = buildAnswerPayload(answers);
        await ApiService.saveAnswersBulk(targetUserId, payload, {
          onboarding_screen: currentScreen,
          questionnaire_consent: consentChecked,
        });
      }
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS, JSON.stringify(answers));
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CURRENT_SCREEN, String(currentScreen));
      const msg = `Your progress on Screen ${currentScreen} of 6 has been saved. You can return at any time to finish your onboarding.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Progress Saved', msg);
    } catch {
      const msg = `Your progress on Screen ${currentScreen} of 6 is saved locally.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Progress Saved', msg);
    } finally {
      setIsSavingAnswers(false);
    }
  };

  // 4. Step B: Save all Questionnaire Answers & Enter Club (Screen 6 submission)
  const handleCompleteQuestionnaire = async () => {
    const targetUserId =
      registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (!targetUserId) {
      setViewMode('register_form');
      return;
    }

    if (!validateScreenOrAll(6, true)) {
      return;
    }

    try {
      setIsSavingAnswers(true);
      const answerPayload = buildAnswerPayload(answers);

      if (answerPayload.length > 0) {
        await ApiService.saveAnswersBulk(targetUserId, answerPayload, {
          onboarding_screen: 6,
          questionnaire_consent: true,
        });
      }

      await refreshUserData();
      switchPersona(targetUserId);

      // Check whether applicant was approved as Paid vs. Complimentary membership
      const profileRes = await ApiService.getProfile(targetUserId, targetUserId).catch(() => null);
      const isPaid = profileRes?.membership_tier === 'paid';
      const isSubActive = profileRes?.subscription_status === 'active';

      if (isPaid && !isSubActive) {
        setShowSubscriptionModal(true);
        return;
      }

      setPendingAccessEmail('');
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_TOKEN);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.SIGNUP_STEP);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_COUNTRIES);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CURRENT_SCREEN);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CONSENT_CHECKED);
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.APP_VIEW, 'tabs');
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, targetUserId);
      setAppView('tabs');

      const welcomeMsg = `Welcome to ÖZARA, ${fullName || 'Member'}! Your complimentary membership is activated.`;
      if (Platform.OS === 'web') {
        setShowFaceIdModal(true);
      } else {
        Alert.alert('Welcome to ÖZARA', welcomeMsg, [
          { text: 'Continue', onPress: () => setShowFaceIdModal(true) },
        ]);
      }
    } catch (err: any) {
      console.warn('Error saving questionnaire answers:', err);
      const msg = err.message || 'Could not complete questionnaire. Please check your answers.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Questionnaire Notice', msg);
    } finally {
      setIsSavingAnswers(false);
    }
  };

  const handleActivateSubscription = async () => {
    const targetUserId =
      registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (!targetUserId) return;

    try {
      setIsActivatingSubscription(true);
      await ApiService.activateMembershipSubscription(targetUserId);
      await refreshUserData();
      setShowSubscriptionModal(false);

      setPendingAccessEmail('');
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_TOKEN);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.SIGNUP_STEP);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_COUNTRIES);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CURRENT_SCREEN);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_CONSENT_CHECKED);
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.APP_VIEW, 'tabs');
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, targetUserId);
      setAppView('tabs');

      const welcomeMsg = `Welcome to ÖZARA, ${fullName || 'Member'}! Your membership subscription is activated.`;
      if (Platform.OS === 'web') {
        setShowFaceIdModal(true);
      } else {
        Alert.alert('Welcome to ÖZARA', welcomeMsg, [
          { text: 'Continue', onPress: () => setShowFaceIdModal(true) },
        ]);
      }
    } catch (err: any) {
      const msg = err.message || 'Unable to process subscription payment. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Subscription Notice', msg);
    } finally {
      setIsActivatingSubscription(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (viewMode === 'questionnaire_page') {
              if (currentScreen > 1) {
                setCurrentScreen(currentScreen - 1);
              } else {
                setViewMode('register_form');
              }
            } else if (viewMode === 'register_form') {
              onBack();
            } else if (viewMode === 'request_access') {
              onBack();
            } else {
              handleStartOver(true);
            }
          }}
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.brandTitle}>ÖZARA</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 120 },
        ]}
        showsVerticalScrollIndicator={false}>
        
        {/* ========================================================= */}
        {/* STATE 1: CHECK INVITATION TOKEN                           */}
        {/* ========================================================= */}
        {viewMode === 'check_token' && (
          <View>
            <View style={styles.badgeRow}>
              <View style={styles.privatePill}>
                <Ionicons name="key-outline" size={11} color={OzaraTheme.colors.accentViolet} style={{ marginRight: 4 }} />
                <Text style={styles.privatePillText}>INVITATION ONLY</Text>
              </View>
            </View>

            <Text style={styles.title}>Did you receive an invitation?</Text>
            <Text style={styles.subtitle}>
              ÖZARA is a confidential private network for vetted founders and leaders. If you were invited, insert your unique token below.
            </Text>

            {/* Non-Blocking Access Request Notification Banner */}
            {!!submittedEmail && (
              <View style={[styles.submittedCard, isApproved && styles.submittedCardApproved]}>
                <View style={styles.submittedCardHeader}>
                  <Ionicons
                    name={isApproved ? "checkmark-circle" : "time-outline"}
                    size={18}
                    color={isApproved ? "#10b981" : "#fbbf24"}
                  />
                  <Text style={[styles.submittedCardTitle, isApproved ? { color: "#10b981" } : { color: "#fbbf24" }]}>
                    {isApproved ? "Invitation Approved!" : "Access Request Sent"}
                  </Text>
                </View>
                <Text style={styles.submittedCardDesc}>
                  {isApproved ? (
                    <>
                      Elena Ermolov has approved your membership request. Your unique invitation code was sent to <Text style={{ color: '#ffffff', fontWeight: '700' }}>{submittedEmail}</Text>.
                    </>
                  ) : (
                    <>
                      A membership notification has been sent to Elena Ermolov (<Text style={{ color: '#ffffff', fontWeight: '600' }}>ermolov.elena@gmail.com</Text>).
                    </>
                  )}
                </Text>
                {!isApproved && (
                  <Text style={styles.submittedCardSub}>
                    Submitted email: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{submittedEmail}</Text>
                  </Text>
                )}
                <Text style={[styles.submittedCardHint, isApproved && { color: '#6ee7b7' }]}>
                  {isApproved
                    ? "Please check your email, copy the invitation code, and insert it below to complete your registration."
                    : "Once approved, you will receive your invitation code via email. Insert it below as soon as you receive it."}
                </Text>
                <TouchableOpacity onPress={() => handleStartOver()} style={{ marginTop: 8 }}>
                  <Text style={{ color: OzaraTheme.colors.accentCyan, fontSize: 12, fontWeight: '600' }}>
                    ← Use a different email or start over
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Token Input Box */}
            <View style={styles.card}>
              <Text style={styles.label}>INVITATION TOKEN</Text>
              <TextInput
                style={[styles.input, styles.tokenInput]}
                placeholder="e.g. OZARA-8492-3174"
                placeholderTextColor={OzaraTheme.colors.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                value={tokenInput}
                onChangeText={(val) => {
                  setTokenInput(val);
                  setVerifyError('');
                }}
              />
              {!!verifyError && <Text style={styles.errorText}>{verifyError}</Text>}

              <TouchableOpacity
                style={[styles.submitBtn, isVerifying && styles.submitBtnDisabled]}
                onPress={() => handleVerifyToken()}
                disabled={isVerifying}
                activeOpacity={0.85}>
                {isVerifying ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Verify Token & Continue →</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Request Access Gateway Card (if user has not yet requested) */}
            {!submittedEmail && (
              <View style={styles.requestAccessCard}>
                <View style={styles.requestIconWrap}>
                  <Ionicons name="mail-unread-outline" size={24} color={OzaraTheme.colors.accentCyan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestTitle}>Don't have an invite code?</Text>
                  <Text style={styles.requestDesc}>
                    You may request membership access directly from ÖZARA leadership for confidential review.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.requestBtn}
                  onPress={() => {
                    setRequestError('');
                    setViewMode('request_access');
                  }}
                  activeOpacity={0.8}>
                  <Text style={styles.requestBtnText}>Request Access</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* STATE 2: REQUEST ACCESS FORM                              */}
        {/* ========================================================= */}
        {viewMode === 'request_access' && (
          <View>
            <View style={styles.badgeRow}>
              <View style={styles.cyanPill}>
                <Ionicons name="shield-checkmark-outline" size={11} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 4 }} />
                <Text style={styles.cyanPillText}>MEMBERSHIP COMMITTEE</Text>
              </View>
            </View>

            <Text style={styles.title}>Request Club Access</Text>
            <Text style={styles.subtitle}>
              Applications are reviewed directly by Elena Ermolov and the ÖZARA founding team.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>FULL NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Elena Rostova"
                placeholderTextColor={OzaraTheme.colors.textDim}
                value={reqFullName}
                onChangeText={setReqFullName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>BUSINESS EMAIL *</Text>
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor={OzaraTheme.colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                value={reqEmail}
                onChangeText={setReqEmail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>PROFESSIONAL ROLE / HEADLINE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Managing Partner, DeepTech Capital"
                placeholderTextColor={OzaraTheme.colors.textDim}
                value={reqRole}
                onChangeText={setReqRole}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>PRIMARY INDUSTRY / SECTOR *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setActiveDropdown('req_industry')}
                activeOpacity={0.75}>
                <Ionicons name="briefcase-outline" size={16} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 8 }} />
                <Text style={styles.dropdownSelectorText}>{reqIndustry}</Text>
                <Ionicons name="chevron-down" size={16} color={OzaraTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>PRIMARY JURISDICTION / COUNTRY *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setActiveDropdown('req_country')}
                activeOpacity={0.75}>
                <Ionicons name="globe-outline" size={16} color={OzaraTheme.colors.accentViolet} style={{ marginRight: 8 }} />
                <Text style={styles.dropdownSelectorText}>{reqCountry} ({reqCity})</Text>
                <Ionicons name="chevron-down" size={16} color={OzaraTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>NOTE / REASON FOR JOINING</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                placeholder="Optional background or chapter interest..."
                placeholderTextColor={OzaraTheme.colors.textDim}
                multiline
                numberOfLines={3}
                value={reqNotes}
                onChangeText={setReqNotes}
              />
            </View>

            {!!requestError && <Text style={styles.errorText}>{requestError}</Text>}

            <TouchableOpacity
              style={[styles.submitBtn, isRequesting && styles.submitBtnDisabled]}
              onPress={handleSendAccessRequest}
              disabled={isRequesting}
              activeOpacity={0.85}>
              {isRequesting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Send Access Request →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.altLink}
              onPress={() => setViewMode('check_token')}
              activeOpacity={0.7}>
              <Text style={styles.altLinkText}>Already have an invite code? Insert token</Text>
            </TouchableOpacity>
          </View>
        )}


        {/* ========================================================= */}
        {/* STATE 4: FINAL MEMBERSHIP REGISTRATION FORM               */}
        {/* ========================================================= */}
        {viewMode === 'register_form' && (
          <View>
            <Text style={styles.title}>Apply for Membership</Text>

            {/* PREPOPULATED & LOCKED BUSINESS EMAIL */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>BUSINESS EMAIL</Text>
              <TextInput
                style={[styles.input, styles.inputLocked]}
                value={verifiedEmail}
                editable={false}
                selectTextOnFocus={false}
              />
              <Text style={styles.lockHint}>
                🔒 Pre-populated from invitation token. Locked to prevent unauthorized transfer.
              </Text>
            </View>

            {/* VERIFIED PHONE NUMBER */}
            {activePhone ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>VERIFIED PHONE NUMBER</Text>
                <TextInput
                  style={[styles.input, styles.inputLocked]}
                  value={activePhone}
                  editable={false}
                  selectTextOnFocus={false}
                />
                <Text style={styles.lockHint}>
                  🔒 Verified via SMS authentication. Bound to your member account for security.
                </Text>
              </View>
            ) : null}

            {/* PROFILE PICTURE / EXECUTIVE PORTRAIT */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>PROFILE PICTURE</Text>
              <View style={styles.avatarRow}>
                <TouchableOpacity
                  style={styles.avatarCircleBtn}
                  onPress={handlePickImage}
                  activeOpacity={0.8}>
                  {avatarUrl ? (
                    <Image
                      source={{ uri: resolveImageUrl(avatarUrl) }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={36} color={OzaraTheme.colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    <Ionicons name="camera" size={13} color="#ffffff" />
                  </View>
                </TouchableOpacity>

                <View style={styles.avatarInfoCol}>
                  <Text style={styles.avatarTitle}>Executive Portrait</Text>
                  <Text style={styles.avatarHint}>
                    Upload your profile photo or provide an image link.
                  </Text>
                  <View style={styles.avatarActionRow}>
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={handlePickImage}
                      activeOpacity={0.75}>
                      <Ionicons name="cloud-upload-outline" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                      <Text style={styles.uploadBtnText}>Upload Photo</Text>
                    </TouchableOpacity>
                    {avatarUrl ? (
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => setAvatarUrl('')}
                        activeOpacity={0.7}>
                        <Text style={styles.removePhotoText}>Reset</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => setShowUrlInput(!showUrlInput)}
                        activeOpacity={0.7}>
                        <Text style={styles.removePhotoText}>
                          {showUrlInput ? 'Hide Link' : 'Paste Link'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {showUrlInput && (
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="https://example.com/portrait.jpg"
                  placeholderTextColor={OzaraTheme.colors.textDim}
                  value={avatarUrl}
                  onChangeText={setAvatarUrl}
                  autoCapitalize="none"
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>FULL NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Elena Rostova"
                placeholderTextColor={OzaraTheme.colors.textDim}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* EXECUTIVE ROLE CATEGORY DROPDOWN */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>EXECUTIVE ROLE CATEGORY *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setActiveDropdown('role')}
                activeOpacity={0.75}>
                <Ionicons name="person-outline" size={16} color={OzaraTheme.colors.accentViolet} style={{ marginRight: 8 }} />
                <Text style={styles.dropdownSelectorText}>{selectedRole}</Text>
                <Ionicons name="chevron-down" size={16} color={OzaraTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* SPECIFIC VENTURE / HEADLINE */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>SPECIFIC TITLE / VENTURE (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Managing Partner, DeepTech Capital"
                placeholderTextColor={OzaraTheme.colors.textDim}
                value={headline}
                onChangeText={setHeadline}
              />
            </View>

            {/* PRIMARY INDUSTRY DROPDOWN */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>PRIMARY INDUSTRY / SECTOR *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setActiveDropdown('industry')}
                activeOpacity={0.75}>
                <Ionicons name="briefcase-outline" size={16} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 8 }} />
                <Text style={styles.dropdownSelectorText}>{selectedIndustry}</Text>
                <Ionicons name="chevron-down" size={16} color={OzaraTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* LOCATION: SEPARATE COUNTRY, STATE, CITY FIELDS */}
            <View style={styles.locationSection}>
              <Text style={styles.label}>HEADQUARTERS & LOCATION COORDINATES</Text>
              <View style={styles.locationRow}>
                {/* COUNTRY */}
                <View style={styles.locationCol}>
                  <Text style={styles.subLabel}>COUNTRY *</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelectorSmall}
                    onPress={() => setActiveDropdown('country')}
                    activeOpacity={0.75}>
                    <Text style={styles.dropdownSelectorSmallText} numberOfLines={1}>
                      {selectedCountry}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={OzaraTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* STATE / REGION */}
                <View style={styles.locationCol}>
                  <Text style={styles.subLabel}>STATE / REGION *</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelectorSmall}
                    onPress={() => setActiveDropdown('state')}
                    activeOpacity={0.75}>
                    <Text style={styles.dropdownSelectorSmallText} numberOfLines={1}>
                      {selectedState}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={OzaraTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* CITY */}
                <View style={styles.locationCol}>
                  <Text style={styles.subLabel}>CITY *</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelectorSmall}
                    onPress={() => setActiveDropdown('city')}
                    activeOpacity={0.75}>
                    <Text style={styles.dropdownSelectorSmallText} numberOfLines={1}>
                      {selectedCity}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={OzaraTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Custom City entry option */}
              <TouchableOpacity
                onPress={() => setShowCustomCity(!showCustomCity)}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 11, color: OzaraTheme.colors.accentCyan, fontWeight: '600' }}>
                  {showCustomCity ? '← Select from list' : '+ Other city / district'}
                </Text>
              </TouchableOpacity>

              {showCustomCity && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Enter specific city or municipality..."
                  placeholderTextColor={OzaraTheme.colors.textDim}
                  value={customCity}
                  onChangeText={setCustomCity}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>PRIMARY CHAPTER</Text>
              <View style={styles.chapterChips}>
                {CHAPTERS.map((ch) => {
                  const isSelected = chapter === ch;
                  return (
                    <TouchableOpacity
                      key={ch}
                      style={[styles.chapterChip, isSelected && styles.chapterChipSelected]}
                      onPress={() => setChapter(ch)}
                      activeOpacity={0.75}>
                      <Text style={[styles.chapterChipText, isSelected && styles.chapterChipTextSelected]}>
                        {ch}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Notice card for Questionnaire */}
            <View style={styles.questionnaireNoticeCard}>
              <View style={styles.noticeIconWrap}>
                <Ionicons name="document-text-outline" size={22} color={OzaraTheme.colors.accentCyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Next: Member Questionnaire</Text>
                <Text style={styles.noticeDesc}>
                  On the next screen, you will be prompted to answer our 30 profile questions. Question 18 is required to verify your profile; all others are optional.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleProceedToQuestions}
              disabled={isSubmitting}
              activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Preparing Profile...' : 'Next: Answer Profile Questions →'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.privacyNote}>
              🔒 Your privacy is strictly protected. Member responses and contact coordinates remain confidential.
            </Text>
          </View>
        )}

        {/* ========================================================= */}
        {/* STATE 4: 6-SCREEN, 25-QUESTION ONBOARDING QUESTIONNAIRE   */}
        {/* ========================================================= */}
        {viewMode === 'questionnaire_page' && (() => {
          const activeScreenDef =
            SCREEN_DEFINITIONS.find((s) => s.screen === currentScreen) || SCREEN_DEFINITIONS[0];
          const screenQuestions = questions.filter((q) => q.screen === currentScreen);
          const isPrivateProfileMode =
            answers[7]?.value === 'Private (browse deals and events only)';

          return (
            <View style={styles.questionnairePageContainer}>
              {/* Progress Bar Header (1 of 6) + Finish Later */}
              <View style={styles.card}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.cyanPill}>
                      <Text style={styles.cyanPillText}>
                        SCREEN {currentScreen} OF 6
                      </Text>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                      {activeScreenDef.title}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleSaveAndFinishLater}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: 'rgba(148, 163, 184, 0.25)',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    }}>
                    <Ionicons name="bookmark-outline" size={13} color={OzaraTheme.colors.accentCyan} />
                    <Text style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: '600' }}>
                      Save & finish later
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 6-Step Segmented Progress Bar */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                  {SCREEN_DEFINITIONS.map((s) => {
                    const isActive = s.screen === currentScreen;
                    const isCompleted = s.screen < currentScreen;
                    return (
                      <TouchableOpacity
                        key={s.screen}
                        style={{ flex: 1 }}
                        activeOpacity={0.8}
                        onPress={() => {
                          setActiveQuestionDropdownId(null);
                          setCurrentScreen(s.screen);
                        }}>
                        <View
                          style={{
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: isActive
                              ? OzaraTheme.colors.accentCyan
                              : isCompleted
                              ? OzaraTheme.colors.accentViolet
                              : 'rgba(255, 255, 255, 0.1)',
                          }}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 10,
                            marginTop: 4,
                            fontWeight: isActive ? '700' : '500',
                            color: isActive
                              ? '#ffffff'
                              : isCompleted
                              ? '#cbd5e1'
                              : '#64748b',
                          }}>
                          {s.screen}. {s.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Screen Title & Subtitle */}
                <View style={{ marginTop: 6 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}>
                    <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800' }}>
                      Screen {activeScreenDef.screen}: {activeScreenDef.title}
                    </Text>
                    {currentScreen >= 3 && currentScreen <= 5 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          borderWidth: 1,
                          borderColor: 'rgba(16, 185, 129, 0.35)',
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                        }}>
                        <Ionicons
                          name="lock-closed"
                          size={11}
                          color="#34d399"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: '#34d399', fontSize: 10.5, fontWeight: '700' }}>
                          Encrypted • Team Only
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      color: '#94a3b8',
                      fontSize: 13,
                      lineHeight: 19,
                      marginTop: 4,
                    }}>
                    {activeScreenDef.subtitle}
                  </Text>
                </View>

                {/* Screen 4 Mandatory Top Line */}
                {currentScreen === 4 && (
                  <View
                    style={{
                      marginTop: 12,
                      backgroundColor: 'rgba(56, 189, 248, 0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(56, 189, 248, 0.3)',
                      borderRadius: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                    <Ionicons name="shield-checkmark" size={16} color="#38bdf8" />
                    <Text style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', flex: 1 }}>
                      Only our team sees this. It helps us show you relevant deals and services.
                    </Text>
                  </View>
                )}

                {/* Screen 5 Mandatory "Skip, discuss on a call" Button */}
                {currentScreen === 5 && (
                  <TouchableOpacity
                    onPress={handleSkipScreen5}
                    activeOpacity={0.8}
                    style={{
                      marginTop: 12,
                      backgroundColor: 'rgba(124, 58, 237, 0.14)',
                      borderWidth: 1,
                      borderColor: 'rgba(124, 58, 237, 0.45)',
                      borderRadius: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="call-outline" size={15} color="#c4b5fd" />
                      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
                        Skip, discuss on a call
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={15} color="#c4b5fd" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Questions List for Current Screen */}
              <View
                style={[
                  styles.minimalQuestionsContainer,
                  activeQuestionDropdownId !== null && { zIndex: 99999 },
                ]}>
                {screenQuestions.map((q) => {
                  const ans = answers[q.id];
                  const currentVal = ans?.value || '';
                  const isSkipped = currentVal === 'skipped';
                  const isSwitchable = q.visibility_mode === 'switch';
                  const currentVis: 'shared' | 'private' =
                    !isSwitchable || isPrivateProfileMode
                      ? 'private'
                      : ans?.visibility || 'private';
                  const isThisDropdownOpen =
                    activeQuestionDropdownId === q.id ||
                    activeQuestionDropdownId === q.id * 100 + 1 ||
                    activeQuestionDropdownId === q.id * 100 + 2;

                  const parseMultiTags = (raw: string): string[] => {
                    if (!raw || raw === 'skipped') return [];
                    const trimmed = raw.trim();
                    if (trimmed.startsWith('[')) {
                      try {
                        const arr = JSON.parse(trimmed);
                        if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
                      } catch {}
                    }
                    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                      try {
                        const parsed = JSON.parse(trimmed);
                        if (Array.isArray(parsed.tags)) return parsed.tags.map(String).filter(Boolean);
                        if (Array.isArray(parsed.countries)) return parsed.countries.map(String).filter(Boolean);
                      } catch {}
                    }
                    return trimmed
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                  };

                  return (
                    <View
                      key={q.id}
                      style={[
                        styles.minimalQuestionItem,
                        { marginBottom: 16 },
                        isThisDropdownOpen && { zIndex: 999999, elevation: 30 },
                      ]}>
                      {/* Question Header & Visibility Rule Control */}
                      <View style={styles.promptHeaderRow}>
                        <Text style={styles.minimalPromptText}>
                          <Text style={{ color: '#94a3b8', fontWeight: '700' }}>{q.id}. </Text>
                          {q.prompt}
                          {q.is_required ? (
                            <Text style={styles.requiredStar}> *</Text>
                          ) : null}
                        </Text>

                        <View style={styles.promptActionsRow}>
                          {!q.is_required && !isSkipped && (
                            <TouchableOpacity
                              onPress={() => handleSkipQuestion(q.id)}
                              style={styles.headerSkipBtn}
                              activeOpacity={0.7}>
                              <Text style={styles.headerSkipBtnText}>Skip</Text>
                            </TouchableOpacity>
                          )}

                          {q.visibility_mode === 'team_only' ? (
                            <View
                              style={[
                                styles.visTogglePill,
                                styles.visTogglePillPrivate,
                                { opacity: 0.9 },
                              ]}>
                              <Ionicons
                                name="lock-closed"
                                size={10}
                                color="#fbbf24"
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.visLockedPillText}>Team only</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[
                                styles.visTogglePill,
                                currentVis === 'private' && styles.visTogglePillPrivate,
                              ]}
                              onPress={() => toggleAnswerVisibility(q.id)}
                              activeOpacity={0.7}>
                              <Ionicons
                                name={currentVis === 'private' ? 'lock-closed' : 'eye-outline'}
                                size={10}
                                color={currentVis === 'private' ? '#fbbf24' : '#38bdf8'}
                                style={{ marginRight: 4 }}
                              />
                              <Text
                                style={[
                                  styles.visTogglePillText,
                                  currentVis === 'private' && { color: '#fbbf24' },
                                ]}>
                                {isPrivateProfileMode
                                  ? 'Private (locked by Q7)'
                                  : currentVis === 'private'
                                  ? 'Private · Switch'
                                  : 'Visible · Switch'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {isSkipped ? (
                        <View style={styles.skippedRow}>
                          <Text style={styles.skippedText}>Skipped for now</Text>
                          <TouchableOpacity
                            onPress={() => handleAnswerChange(q.id, '')}
                            style={styles.undoSkipBtn}>
                            <Text style={styles.undoSkipBtnText}>Answer Question</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          {/* Q1: Full name (Text) */}
                          {q.id === 1 && (
                            <TextInput
                              style={styles.minimalTextInput}
                              placeholder="Your full name"
                              placeholderTextColor="#64748b"
                              value={currentVal}
                              onChangeText={(txt) => handleAnswerChange(1, txt)}
                              autoCapitalize="words"
                              autoCorrect={false}
                            />
                          )}

                          {/* Q2: Email (Email) */}
                          {q.id === 2 && (
                            <TextInput
                              style={styles.minimalTextInput}
                              placeholder="name@domain.com"
                              placeholderTextColor="#64748b"
                              value={currentVal}
                              onChangeText={(txt) => handleAnswerChange(2, txt)}
                              keyboardType="email-address"
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          )}

                          {/* Q3: Mobile phone (Phone with country code) */}
                          {q.id === 3 && (() => {
                            const dialKey = 'q3_dial';
                            let selectedDial = qSelectedCountry[dialKey] || '+1';
                            let localNumber = currentVal;
                            const matchedDial = COUNTRY_DIAL_CODES.find((d) =>
                              currentVal.startsWith(d.dialCode + ' ')
                            );
                            if (matchedDial) {
                              selectedDial = matchedDial.dialCode;
                              localNumber = currentVal.slice(matchedDial.dialCode.length + 1);
                            } else if (currentVal.startsWith('+')) {
                              const parts = currentVal.split(' ');
                              if (parts.length > 1) {
                                selectedDial = parts[0];
                                localNumber = parts.slice(1).join(' ');
                              }
                            }
                            const dialDropdownId = 301;
                            const isDialOpen = activeQuestionDropdownId === dialDropdownId;

                            return (
                              <View style={[styles.twoDropdownRow, isDialOpen && { zIndex: 999999 }]}>
                                <View
                                  style={[styles.twoDropdownCol, { flex: 0.42 }, isDialOpen && { zIndex: 999999 }]}
                                  {...(Platform.OS === 'web' ? { 'data-dropdown-wrap': String(dialDropdownId) } : {})}>
                                  <TouchableOpacity
                                    style={[
                                      styles.minimalDropdownTrigger,
                                      isDialOpen && styles.minimalDropdownTriggerActive,
                                    ]}
                                    onPress={() =>
                                      setActiveQuestionDropdownId(isDialOpen ? null : dialDropdownId)
                                    }
                                    activeOpacity={0.8}>
                                    <Text style={styles.minimalDropdownTriggerText} numberOfLines={1}>
                                      {selectedDial}
                                    </Text>
                                    <Ionicons
                                      name={isDialOpen ? 'chevron-up' : 'chevron-down'}
                                      size={14}
                                      color="#94a3b8"
                                    />
                                  </TouchableOpacity>
                                  {isDialOpen && (
                                    <View style={styles.minimalDropdownMenu}>
                                      <View style={styles.dropdownSearchHeader}>
                                        <Ionicons name="search" size={13} color="#64748b" />
                                        <TextInput
                                          ref={dropdownSearchInputRef}
                                          style={styles.dropdownSearchInput}
                                          placeholder="Search country or code..."
                                          placeholderTextColor="#64748b"
                                          value={dropdownSearchQuery}
                                          onChangeText={setDropdownSearchQuery}
                                        />
                                      </View>
                                      <ScrollView
                                        style={{ maxHeight: 200, padding: 6 }}
                                        nestedScrollEnabled>
                                        {COUNTRY_DIAL_CODES.filter(
                                          (d) =>
                                            !dropdownSearchQuery.trim() ||
                                            d.name
                                              .toLowerCase()
                                              .includes(dropdownSearchQuery.toLowerCase()) ||
                                            d.dialCode.includes(dropdownSearchQuery.trim())
                                        ).map((d) => (
                                          <TouchableOpacity
                                            key={`${d.code}-${d.dialCode}`}
                                            style={[
                                              styles.minimalDropdownOption,
                                              selectedDial === d.dialCode &&
                                                styles.minimalDropdownOptionSelected,
                                            ]}
                                            onPress={() => {
                                              setQSelectedCountry((prev) => ({
                                                ...prev,
                                                [dialKey]: d.dialCode,
                                              }));
                                              handleAnswerChange(
                                                3,
                                                localNumber.trim()
                                                  ? `${d.dialCode} ${localNumber.trim()}`
                                                  : d.dialCode
                                              );
                                              setActiveQuestionDropdownId(null);
                                            }}>
                                            <Text style={styles.minimalDropdownOptionText}>
                                              {d.flag} {d.name} ({d.dialCode})
                                            </Text>
                                          </TouchableOpacity>
                                        ))}
                                      </ScrollView>
                                    </View>
                                  )}
                                </View>
                                <View style={[styles.twoDropdownCol, { flex: 0.58 }]}>
                                  <TextInput
                                    style={styles.minimalTextInput}
                                    placeholder="Mobile number"
                                    placeholderTextColor="#64748b"
                                    value={localNumber}
                                    onChangeText={(txt) => {
                                      const cleaned = txt.replace(/[^\d\s\-()]/g, '');
                                      handleAnswerChange(
                                        3,
                                        cleaned.trim() ? `${selectedDial} ${cleaned}` : ''
                                      );
                                    }}
                                    keyboardType="phone-pad"
                                  />
                                </View>
                              </View>
                            );
                          })()}

                          {/* Q4: Telegram and WhatsApp (Two text fields) */}
                          {q.id === 4 && (() => {
                            let tgVal = '';
                            let waVal = '';
                            if (currentVal) {
                              try {
                                const parsed = JSON.parse(currentVal);
                                tgVal = parsed.telegram || '';
                                waVal = parsed.whatsapp || '';
                              } catch {
                                tgVal = currentVal;
                              }
                            }
                            const updateQ4 = (nextTg: string, nextWa: string) => {
                              if (!nextTg.trim() && !nextWa.trim()) {
                                handleAnswerChange(4, '');
                              } else {
                                handleAnswerChange(
                                  4,
                                  JSON.stringify({ telegram: nextTg, whatsapp: nextWa })
                                );
                              }
                            };
                            return (
                              <View style={styles.twoDropdownRow}>
                                <View style={styles.twoDropdownCol}>
                                  <TextInput
                                    style={styles.minimalTextInput}
                                    placeholder="Telegram: @handle or number"
                                    placeholderTextColor="#64748b"
                                    value={tgVal}
                                    onChangeText={(txt) => updateQ4(txt, waVal)}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                  />
                                </View>
                                <View style={styles.twoDropdownCol}>
                                  <TextInput
                                    style={styles.minimalTextInput}
                                    placeholder="WhatsApp: @handle or number"
                                    placeholderTextColor="#64748b"
                                    value={waVal}
                                    onChangeText={(txt) => updateQ4(tgVal, txt)}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                  />
                                </View>
                              </View>
                            );
                          })()}

                          {/* Q6: How did you hear about us? (Dropdown + text) */}
                          {q.id === 6 && (() => {
                            let sourceVal = '';
                            let detailVal = '';
                            if (currentVal) {
                              try {
                                const parsed = JSON.parse(currentVal);
                                sourceVal = parsed.source || '';
                                detailVal = parsed.detail || '';
                              } catch {
                                if (Q6_REFERRAL_OPTIONS.includes(currentVal)) {
                                  sourceVal = currentVal;
                                } else {
                                  const parts = currentVal.split(':');
                                  sourceVal = parts[0]?.trim() || '';
                                  detailVal = parts.slice(1).join(':').trim();
                                }
                              }
                            }
                            const isOpen = activeQuestionDropdownId === 6;
                            const updateQ6 = (nextSource: string, nextDetail: string) => {
                              if (!nextSource && !nextDetail) {
                                handleAnswerChange(6, '');
                              } else {
                                handleAnswerChange(
                                  6,
                                  JSON.stringify({ source: nextSource, detail: nextDetail })
                                );
                              }
                            };

                            return (
                              <View
                                style={[styles.twoDropdownRow, isOpen && { zIndex: 999999 }]}
                                {...(Platform.OS === 'web' ? { 'data-dropdown-wrap': '6' } : {})}>
                                <View style={[styles.twoDropdownCol, isOpen && { zIndex: 999999 }]}>
                                  <TouchableOpacity
                                    style={[
                                      styles.minimalDropdownTrigger,
                                      isOpen && styles.minimalDropdownTriggerActive,
                                    ]}
                                    onPress={() => setActiveQuestionDropdownId(isOpen ? null : 6)}
                                    activeOpacity={0.8}>
                                    <Text
                                      style={[
                                        styles.minimalDropdownTriggerText,
                                        !sourceVal && styles.minimalDropdownPlaceholder,
                                      ]}
                                      numberOfLines={1}>
                                      {sourceVal || 'Select how you heard about us...'}
                                    </Text>
                                    <Ionicons
                                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                                      size={14}
                                      color="#94a3b8"
                                    />
                                  </TouchableOpacity>
                                  {isOpen && (
                                    <View style={styles.minimalDropdownMenu}>
                                      <View style={{ padding: 6 }}>
                                        {Q6_REFERRAL_OPTIONS.map((opt) => (
                                          <TouchableOpacity
                                            key={opt}
                                            style={[
                                              styles.minimalDropdownOption,
                                              sourceVal === opt &&
                                                styles.minimalDropdownOptionSelected,
                                            ]}
                                            onPress={() => {
                                              updateQ6(opt, detailVal);
                                              setActiveQuestionDropdownId(null);
                                            }}>
                                            <Text
                                              style={[
                                                styles.minimalDropdownOptionText,
                                                sourceVal === opt &&
                                                  styles.minimalDropdownOptionTextSelected,
                                              ]}>
                                              {opt}
                                            </Text>
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                    </View>
                                  )}
                                </View>
                                <View style={styles.twoDropdownCol}>
                                  <TextInput
                                    style={styles.minimalTextInput}
                                    placeholder={
                                      sourceVal === 'Referred by a member (name)'
                                        ? 'Referring member name'
                                        : 'Name or details (optional)'
                                    }
                                    placeholderTextColor="#64748b"
                                    value={detailVal}
                                    onChangeText={(txt) => updateQ6(sourceVal, txt)}
                                  />
                                </View>
                              </View>
                            );
                          })()}

                          {/* Q7 & Q25: Single choice cards */}
                          {(q.id === 7 || q.id === 25) && (
                            <View style={{ gap: 8 }}>
                              {(q.options || []).map((opt) => {
                                const isSelected = currentVal === opt;
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    onPress={() => handleAnswerChange(q.id, opt)}
                                    activeOpacity={0.8}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      backgroundColor: isSelected
                                        ? 'rgba(6, 182, 212, 0.14)'
                                        : '#0c1222',
                                      borderWidth: 1,
                                      borderColor: isSelected
                                        ? OzaraTheme.colors.accentCyan
                                        : 'rgba(255, 255, 255, 0.1)',
                                      borderRadius: 8,
                                      paddingVertical: 11,
                                      paddingHorizontal: 14,
                                    }}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                      <Text
                                        style={{
                                          color: isSelected ? '#ffffff' : '#e2e8f0',
                                          fontSize: 13.5,
                                          fontWeight: isSelected ? '700' : '500',
                                        }}>
                                        {opt}
                                      </Text>
                                      {q.id === 7 && opt === 'Visible to members' && (
                                        <Text
                                          style={{
                                            color: '#94a3b8',
                                            fontSize: 11.5,
                                            marginTop: 2,
                                          }}>
                                          Other verified members see only what you switch on (photo, role, bio, open to, residence, interests).
                                        </Text>
                                      )}
                                      {q.id === 7 &&
                                        opt === 'Private (browse deals and events only)' && (
                                          <Text
                                            style={{
                                              color: '#94a3b8',
                                              fontSize: 11.5,
                                              marginTop: 2,
                                            }}>
                                            All switches are forced to Private and you do not appear in the directory. No photo needed.
                                          </Text>
                                        )}
                                    </View>
                                    <Ionicons
                                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                      size={18}
                                      color={
                                        isSelected ? OzaraTheme.colors.accentCyan : '#64748b'
                                      }
                                    />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* Q8: Profile photo (Upload) */}
                          {q.id === 8 && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: '#0c1222',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: 8,
                                padding: 12,
                              }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                {avatarUrl || (currentVal && currentVal !== 'skipped') ? (
                                  <Image
                                    source={{
                                      uri: resolveImageUrl(avatarUrl || currentVal),
                                    }}
                                    style={{ width: 44, height: 44, borderRadius: 22 }}
                                  />
                                ) : (
                                  <View
                                    style={{
                                      width: 44,
                                      height: 44,
                                      borderRadius: 22,
                                      backgroundColor: 'rgba(124, 58, 237, 0.2)',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}>
                                    <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                                      {getInitials(displayFullName)}
                                    </Text>
                                  </View>
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '600' }}>
                                    {avatarUrl || currentVal
                                      ? 'Portrait uploaded'
                                      : isPrivateProfileMode
                                      ? 'Private mode active — no photo needed'
                                      : 'Optional member portrait'}
                                  </Text>
                                  <Text style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 2 }}>
                                    {currentVis === 'shared' && !isPrivateProfileMode
                                      ? 'Visible to verified members'
                                      : 'Currently Private (seen only by team unless switched on)'}
                                  </Text>
                                </View>
                              </View>
                              <TouchableOpacity
                                style={styles.uploadPictureBtn}
                                onPress={handlePickImage}
                                activeOpacity={0.8}>
                                <Ionicons
                                  name="cloud-upload-outline"
                                  size={14}
                                  color="#ffffff"
                                  style={{ marginRight: 6 }}
                                />
                                <Text style={styles.uploadPictureBtnText}>Upload photo</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* Q10: Company and short bio (Text, 300 characters) */}
                          {q.id === 10 && (
                            <View>
                              <TextInput
                                style={styles.minimalTextArea}
                                placeholder={
                                  q.placeholder || 'Company name and a brief bio (max 300 characters)'
                                }
                                placeholderTextColor="#64748b"
                                multiline
                                maxLength={300}
                                value={currentVal}
                                onChangeText={(txt) => {
                                  if (txt.length <= 300) handleAnswerChange(10, txt);
                                }}
                              />
                              <View
                                style={{
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: 4,
                                }}>
                                <Text style={{ color: '#64748b', fontSize: 11, flex: 1, paddingRight: 8 }}>
                                  Members describe what they do and what they are interested in. Do not post specific offerings, valuations, or terms.
                                </Text>
                                <Text style={styles.charCounterText}>
                                  {currentVal.length}/300
                                </Text>
                              </View>
                            </View>
                          )}

                          {/* Standard Dropdown Questions: Q5, Q9, Q15, Q16, Q17, Q18 */}
                          {q.field_type === 'dropdown' && (() => {
                            const isOpen = activeQuestionDropdownId === q.id;
                            const opts = q.options || [];
                            return (
                              <View
                                style={[styles.minimalDropdownWrap, isOpen && { zIndex: 999999 }]}
                                {...(Platform.OS === 'web'
                                  ? { 'data-dropdown-wrap': String(q.id) }
                                  : {})}>
                                <TouchableOpacity
                                  style={[
                                    styles.minimalDropdownTrigger,
                                    isOpen && styles.minimalDropdownTriggerActive,
                                  ]}
                                  onPress={() =>
                                    setActiveQuestionDropdownId(isOpen ? null : q.id)
                                  }
                                  activeOpacity={0.8}>
                                  <Text
                                    style={[
                                      styles.minimalDropdownTriggerText,
                                      !currentVal && styles.minimalDropdownPlaceholder,
                                    ]}
                                    numberOfLines={1}>
                                    {currentVal || q.placeholder || 'Select an option...'}
                                  </Text>
                                  <Ionicons
                                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                                    size={14}
                                    color="#94a3b8"
                                  />
                                </TouchableOpacity>

                                {isOpen && (
                                  <View style={styles.minimalDropdownMenu}>
                                    <ScrollView
                                      style={{ maxHeight: 240, padding: 6 }}
                                      nestedScrollEnabled>
                                      {opts.map((opt) => {
                                        const isSelected = currentVal === opt;
                                        return (
                                          <TouchableOpacity
                                            key={opt}
                                            style={[
                                              styles.minimalDropdownOption,
                                              isSelected && styles.minimalDropdownOptionSelected,
                                            ]}
                                            onPress={() => {
                                              handleAnswerChange(q.id, opt);
                                              setActiveQuestionDropdownId(null);
                                            }}>
                                            <Text
                                              style={[
                                                styles.minimalDropdownOptionText,
                                                isSelected &&
                                                  styles.minimalDropdownOptionTextSelected,
                                              ]}>
                                              {opt}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  </View>
                                )}
                              </View>
                            );
                          })()}

                          {/* Multi-Select Questions: Q11, Q19, Q20, Q21, Q22, Q23, Q24 */}
                          {q.field_type === 'multi' && (() => {
                            const selectedList = parseMultiTags(currentVal);
                            const opts = q.options || [];
                            const exclusiveOptions = [
                              'Prefer not to say',
                              'None yet',
                              'Nobody yet',
                              'None of these',
                              'Not sure',
                            ];

                            const toggleMultiOption = (opt: string) => {
                              let next: string[];
                              if (selectedList.includes(opt)) {
                                next = selectedList.filter((x) => x !== opt);
                              } else if (exclusiveOptions.includes(opt)) {
                                next = [opt];
                              } else {
                                next = [
                                  ...selectedList.filter((x) => !exclusiveOptions.includes(x)),
                                  opt,
                                ];
                              }
                              handleAnswerChange(q.id, next.join(', '));
                            };

                            return (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {opts.map((opt) => {
                                  const isSelected = selectedList.includes(opt);
                                  return (
                                    <TouchableOpacity
                                      key={opt}
                                      onPress={() => toggleMultiOption(opt)}
                                      activeOpacity={0.8}
                                      style={[
                                        styles.qSugChip,
                                        {
                                          paddingVertical: 8,
                                          paddingHorizontal: 12,
                                        },
                                        isSelected && styles.qSugChipSelected,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.qSugChipText,
                                          { fontSize: 12.5 },
                                          isSelected && styles.qSugChipTextSelected,
                                        ]}>
                                        {isSelected ? `✓ ${opt}` : opt}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            );
                          })()}

                          {/* Country Multi-Select Questions: Q12 (Where do you live?), Q13 (Citizenships), Q14 (Where do you pay tax?) */}
                          {(q.field_type === 'country_multi' ||
                            q.field_type === 'country_tax_multi') && (() => {
                            let selectedCountries: string[] = [];
                            let selectedUsStates: string[] = [];

                            if (q.id === 14 && currentVal && currentVal.trim().startsWith('{')) {
                              try {
                                const parsed = JSON.parse(currentVal);
                                selectedCountries = Array.isArray(parsed.countries)
                                  ? parsed.countries
                                  : [];
                                selectedUsStates = Array.isArray(parsed.us_states)
                                  ? parsed.us_states
                                  : [];
                              } catch {}
                            } else {
                              selectedCountries = parseMultiTags(currentVal);
                            }

                            const saveCountryTaxState = (
                              nextCountries: string[],
                              nextStates: string[]
                            ) => {
                              if (q.id === 14) {
                                const cleanStates = nextCountries.includes('United States')
                                  ? nextStates
                                  : [];
                                if (nextCountries.length === 0) {
                                  handleAnswerChange(14, '');
                                } else if (cleanStates.length > 0) {
                                  handleAnswerChange(
                                    14,
                                    JSON.stringify({
                                      countries: nextCountries,
                                      us_states: cleanStates,
                                    })
                                  );
                                } else {
                                  handleAnswerChange(14, nextCountries.join(', '));
                                }
                              } else {
                                handleAnswerChange(q.id, nextCountries.join(', '));
                              }
                            };

                            const isOpen = activeQuestionDropdownId === q.id;
                            const stateDropdownId = 1401;
                            const isStateOpen = activeQuestionDropdownId === stateDropdownId;
                            const filteredCountries = ALL_COUNTRIES_LIST.filter(
                              (c) =>
                                !dropdownSearchQuery.trim() ||
                                c.toLowerCase().includes(dropdownSearchQuery.toLowerCase())
                            );

                            return (
                              <View>
                                <View
                                  style={[styles.minimalDropdownWrap, isOpen && { zIndex: 999999 }]}
                                  {...(Platform.OS === 'web'
                                    ? { 'data-dropdown-wrap': String(q.id) }
                                    : {})}>
                                  <TouchableOpacity
                                    style={[
                                      styles.multiTriggerContainer,
                                      isOpen && styles.minimalDropdownTriggerActive,
                                    ]}
                                    onPress={() =>
                                      setActiveQuestionDropdownId(isOpen ? null : q.id)
                                    }
                                    activeOpacity={0.8}>
                                    {selectedCountries.length > 0 ? (
                                      <View style={styles.multiTagsWrap}>
                                        {selectedCountries.map((c) => (
                                          <View key={c} style={styles.multiTagChip}>
                                            <Text style={styles.multiTagChipText}>{c}</Text>
                                            <TouchableOpacity
                                              style={styles.multiTagRemoveBtn}
                                              onPress={() =>
                                                saveCountryTaxState(
                                                  selectedCountries.filter((x) => x !== c),
                                                  selectedUsStates
                                                )
                                              }>
                                              <Ionicons
                                                name="close-circle"
                                                size={14}
                                                color="#94a3b8"
                                              />
                                            </TouchableOpacity>
                                          </View>
                                        ))}
                                      </View>
                                    ) : (
                                      <Text
                                        style={[
                                          styles.minimalDropdownTriggerText,
                                          styles.minimalDropdownPlaceholder,
                                        ]}>
                                        {q.placeholder || 'Select countries...'}
                                      </Text>
                                    )}
                                    <Ionicons
                                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                                      size={14}
                                      color="#94a3b8"
                                    />
                                  </TouchableOpacity>

                                  {isOpen && (
                                    <View style={styles.minimalDropdownMenu}>
                                      <View style={styles.dropdownSearchHeader}>
                                        <Ionicons name="search" size={13} color="#64748b" />
                                        <TextInput
                                          ref={dropdownSearchInputRef}
                                          style={styles.dropdownSearchInput}
                                          placeholder="Search country..."
                                          placeholderTextColor="#64748b"
                                          value={dropdownSearchQuery}
                                          onChangeText={setDropdownSearchQuery}
                                        />
                                      </View>
                                      <ScrollView
                                        style={{ maxHeight: 220, padding: 6 }}
                                        nestedScrollEnabled>
                                        {filteredCountries.map((c) => {
                                          const isSelected = selectedCountries.includes(c);
                                          return (
                                            <TouchableOpacity
                                              key={c}
                                              style={[
                                                styles.minimalDropdownOption,
                                                isSelected &&
                                                  styles.minimalDropdownOptionSelected,
                                              ]}
                                              onPress={() => {
                                                const next = isSelected
                                                  ? selectedCountries.filter((x) => x !== c)
                                                  : [...selectedCountries, c];
                                                saveCountryTaxState(next, selectedUsStates);
                                              }}>
                                              <Text
                                                style={[
                                                  styles.minimalDropdownOptionText,
                                                  isSelected &&
                                                    styles.minimalDropdownOptionTextSelected,
                                                ]}>
                                                {isSelected ? `✓ ${c}` : c}
                                              </Text>
                                            </TouchableOpacity>
                                          );
                                        })}
                                      </ScrollView>
                                      <View style={styles.multiDoneBar}>
                                        <Text style={styles.multiCountNotice}>
                                          {selectedCountries.length} selected
                                        </Text>
                                        <TouchableOpacity
                                          style={styles.multiDoneBtn}
                                          onPress={() => setActiveQuestionDropdownId(null)}>
                                          <Text style={styles.multiDoneBtnText}>Done</Text>
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  )}
                                </View>

                                {q.id === 13 && (
                                  <Text style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                                    Countries only — never enter passport numbers.
                                  </Text>
                                )}

                                {/* Q14 US State selector when United States is selected */}
                                {q.id === 14 && selectedCountries.includes('United States') && (
                                  <View
                                    style={[
                                      styles.minimalDropdownWrap,
                                      { marginTop: 8 },
                                      isStateOpen && { zIndex: 999999 },
                                    ]}
                                    {...(Platform.OS === 'web'
                                      ? { 'data-dropdown-wrap': String(stateDropdownId) }
                                      : {})}>
                                    <TouchableOpacity
                                      style={[
                                        styles.multiTriggerContainer,
                                        isStateOpen && styles.minimalDropdownTriggerActive,
                                      ]}
                                      onPress={() =>
                                        setActiveQuestionDropdownId(
                                          isStateOpen ? null : stateDropdownId
                                        )
                                      }
                                      activeOpacity={0.8}>
                                      {selectedUsStates.length > 0 ? (
                                        <View style={styles.multiTagsWrap}>
                                          {selectedUsStates.map((st) => (
                                            <View key={st} style={styles.multiTagChip}>
                                              <Text style={styles.multiTagChipText}>
                                                US: {st}
                                              </Text>
                                              <TouchableOpacity
                                                style={styles.multiTagRemoveBtn}
                                                onPress={() =>
                                                  saveCountryTaxState(
                                                    selectedCountries,
                                                    selectedUsStates.filter((x) => x !== st)
                                                  )
                                                }>
                                                <Ionicons
                                                  name="close-circle"
                                                  size={14}
                                                  color="#94a3b8"
                                                />
                                              </TouchableOpacity>
                                            </View>
                                          ))}
                                        </View>
                                      ) : (
                                        <Text
                                          style={[
                                            styles.minimalDropdownTriggerText,
                                            styles.minimalDropdownPlaceholder,
                                          ]}>
                                          Select US state(s) for tax residency...
                                        </Text>
                                      )}
                                      <Ionicons
                                        name={isStateOpen ? 'chevron-up' : 'chevron-down'}
                                        size={14}
                                        color="#94a3b8"
                                      />
                                    </TouchableOpacity>

                                    {isStateOpen && (
                                      <View style={styles.minimalDropdownMenu}>
                                        <ScrollView
                                          style={{ maxHeight: 200, padding: 6 }}
                                          nestedScrollEnabled>
                                          {US_STATES_LIST.map((st) => {
                                            const isStSelected = selectedUsStates.includes(st);
                                            return (
                                              <TouchableOpacity
                                                key={st}
                                                style={[
                                                  styles.minimalDropdownOption,
                                                  isStSelected &&
                                                    styles.minimalDropdownOptionSelected,
                                                ]}
                                                onPress={() => {
                                                  const nextSt = isStSelected
                                                    ? selectedUsStates.filter((x) => x !== st)
                                                    : [...selectedUsStates, st];
                                                  saveCountryTaxState(selectedCountries, nextSt);
                                                }}>
                                                <Text
                                                  style={[
                                                    styles.minimalDropdownOptionText,
                                                    isStSelected &&
                                                      styles.minimalDropdownOptionTextSelected,
                                                  ]}>
                                                  {isStSelected ? `✓ ${st}` : st}
                                                </Text>
                                              </TouchableOpacity>
                                            );
                                          })}
                                        </ScrollView>
                                        <View style={styles.multiDoneBar}>
                                          <Text style={styles.multiCountNotice}>
                                            {selectedUsStates.length} US state(s)
                                          </Text>
                                          <TouchableOpacity
                                            style={styles.multiDoneBtn}
                                            onPress={() => setActiveQuestionDropdownId(null)}>
                                            <Text style={styles.multiDoneBtnText}>Done</Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })()}
                        </>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Screen 6 Required Consent Checkbox */}
              {currentScreen === 6 && (
                <TouchableOpacity
                  onPress={() => setConsentChecked(!consentChecked)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    backgroundColor: consentChecked
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(15, 23, 42, 0.9)',
                    borderWidth: 1,
                    borderColor: consentChecked
                      ? 'rgba(16, 185, 129, 0.45)'
                      : 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 18,
                  }}>
                  <Ionicons
                    name={consentChecked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={consentChecked ? '#10b981' : '#94a3b8'}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 19, flex: 1 }}>
                    I confirm my answers are accurate and agree to the privacy policy. Answers marked private are seen only by the team.{' '}
                    <Text style={styles.requiredStar}>*</Text>
                  </Text>
                </TouchableOpacity>
              )}

              {/* Bottom Screen Navigation Buttons */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 8,
                  marginBottom: 20,
                }}>
                {currentScreen > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      setActiveQuestionDropdownId(null);
                      setCurrentScreen(currentScreen - 1);
                    }}
                    activeOpacity={0.8}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      backgroundColor: '#0f172a',
                    }}>
                    <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '600' }}>
                      ← Previous
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.minimalSubmitBtn,
                    { flex: 1, marginTop: 0, marginBottom: 0 },
                    isSavingAnswers && styles.submitBtnDisabled,
                  ]}
                  onPress={handleSaveAndNextScreen}
                  disabled={isSavingAnswers}
                  activeOpacity={0.85}>
                  {isSavingAnswers ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.minimalSubmitBtnText}>
                      {currentScreen < 6
                        ? `Save & Continue (${currentScreen} of 6) →`
                        : 'Complete Onboarding'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.autosaveFooterNoteRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={13}
                  color={OzaraTheme.colors.accentCyan}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.autosaveFooterNoteText}>
                  Saved after every screen ({currentScreen} of 6). You can edit any answer and any visibility switch at any time from your profile.
                </Text>
              </View>
            </View>
          );
        })()}

      </ScrollView>

      {/* Universal Standardized Dropdown Selection Modal */}
      <Modal
        visible={Boolean(activeDropdown)}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setActiveDropdown(null);
          setDropdownSearch('');
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setActiveDropdown(null);
              setDropdownSearch('');
            }}
          />
          <View style={[styles.dropdownModalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.dropdownModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownModalTitle}>
                  {activeDropdown === 'country' && 'Select Country'}
                  {activeDropdown === 'req_country' && 'Select Jurisdiction / Country'}
                  {activeDropdown === 'state' && `Select State / Region (${selectedCountry})`}
                  {activeDropdown === 'city' && `Select City (${selectedState})`}
                  {(activeDropdown === 'industry' || activeDropdown === 'req_industry') && 'Select Primary Industry'}
                  {activeDropdown === 'role' && 'Select Role Category'}
                </Text>
                <Text style={styles.dropdownModalSubtitle}>Clean standardized executive selection</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setActiveDropdown(null);
                  setDropdownSearch('');
                }}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Optional search query */}
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search or filter options..."
              placeholderTextColor={OzaraTheme.colors.textDim}
              value={dropdownSearch}
              onChangeText={setDropdownSearch}
              autoFocus={true}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (currentDropdownOptions.length > 0) {
                  const opt = currentDropdownOptions[0];
                  if (activeDropdown === 'country' || activeDropdown === 'req_country') handleSelectCountry(opt);
                  else if (activeDropdown === 'state') handleSelectState(opt);
                  else if (activeDropdown === 'city') handleSelectCity(opt);
                  else if (activeDropdown === 'industry' || activeDropdown === 'req_industry') handleSelectIndustry(opt);
                  else if (activeDropdown === 'role') handleSelectRole(opt);
                }
              }}
            />

            <ScrollView style={styles.dropdownListScroll} showsVerticalScrollIndicator={false}>
              {currentDropdownOptions.map((opt, index) => {
                const isSelected =
                  ((activeDropdown === 'country' || activeDropdown === 'req_country') && (selectedCountry === opt || reqCountry === opt)) ||
                  (activeDropdown === 'state' && selectedState === opt) ||
                  (activeDropdown === 'city' && selectedCity === opt) ||
                  ((activeDropdown === 'industry' || activeDropdown === 'req_industry') && (selectedIndustry === opt || reqIndustry === opt)) ||
                  (activeDropdown === 'role' && selectedRole === opt);

                return (
                  <TouchableOpacity
                    key={`${opt}-${index}`}
                    style={[styles.dropdownOptionItem, isSelected && styles.dropdownOptionItemSelected]}
                    onPress={() => {
                      if (activeDropdown === 'country' || activeDropdown === 'req_country') handleSelectCountry(opt);
                      else if (activeDropdown === 'state') handleSelectState(opt);
                      else if (activeDropdown === 'city') handleSelectCity(opt);
                      else if (activeDropdown === 'industry' || activeDropdown === 'req_industry') handleSelectIndustry(opt);
                      else if (activeDropdown === 'role') handleSelectRole(opt);
                    }}
                    activeOpacity={0.75}>
                    <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                      {opt}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={OzaraTheme.colors.accentCyan} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Subscription Dues Payment Modal for Paid Members */}
      <Modal
        visible={showSubscriptionModal}
        transparent
        animationType="fade">
        <View style={styles.subModalBackdrop}>
          <View style={styles.subModalCard}>
            <View style={styles.subModalBadge}>
              <Ionicons name="card-outline" size={20} color={OzaraTheme.colors.accentGold} />
              <Text style={styles.subModalBadgeText}>ANNUAL MEMBERSHIP</Text>
            </View>

            <Text style={styles.subModalTitle}>Activate Your Membership</Text>
            <Text style={styles.subModalDesc}>
              Welcome to ÖZARA. To activate your account and access the private network, please complete your annual membership dues.
            </Text>

            <View style={styles.subPricingCard}>
              <View style={styles.subPricingHeader}>
                <Text style={styles.subPricingTier}>Full Membership</Text>
                <Text style={styles.subPricingAmount}>$1,200 <Text style={styles.subPricingCadence}>/ year</Text></Text>
              </View>
              <Text style={styles.subPricingSub}>
                Flat annual membership dues. No transaction fees or commission percentages.
              </Text>
              
              <View style={styles.subFeatureList}>
                <View style={styles.subFeatureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={OzaraTheme.colors.accentCyan} />
                  <Text style={styles.subFeatureText}>Verified private directory and global network</Text>
                </View>
                <View style={styles.subFeatureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={OzaraTheme.colors.accentCyan} />
                  <Text style={styles.subFeatureText}>Invitations to curated gatherings & summits</Text>
                </View>
                <View style={styles.subFeatureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={OzaraTheme.colors.accentCyan} />
                  <Text style={styles.subFeatureText}>Direct introductions & peer-to-peer messaging</Text>
                </View>
                <View style={styles.subFeatureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={OzaraTheme.colors.accentCyan} />
                  <Text style={styles.subFeatureText}>Exclusive real estate & international opportunities</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.subPayBtn, isActivatingSubscription && styles.subPayBtnDisabled]}
              onPress={handleActivateSubscription}
              disabled={isActivatingSubscription}
              activeOpacity={0.85}>
              {isActivatingSubscription ? (
                <ActivityIndicator size="small" color="#030712" />
              ) : (
                <Text style={styles.subPayBtnText}>Pay $1,200 & Activate Membership</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.subSecureNote}>
              🔒 Secure payment. Membership is billed annually and can be managed directly in your settings.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Face ID Sign-In Convenience Modal */}
      <Modal
        visible={showFaceIdModal}
        transparent
        animationType="fade">
        <View style={styles.faceIdBackdrop}>
          <View style={styles.faceIdCard}>
            <View style={styles.faceIdIconContainer}>
              <Ionicons name="scan-outline" size={38} color="#a78bfa" />
            </View>
            <Text style={styles.faceIdTitle}>Enable Face ID?</Text>
            <Text style={styles.faceIdDesc}>
              Sign in faster and securely on this device with Face ID or biometrics.
            </Text>
            <Text style={styles.faceIdFootnote}>
              Face ID is an optional sign-in convenience and does not replace community membership verification.
            </Text>
            <TouchableOpacity
              style={styles.enableFaceIdBtn}
              onPress={() => {
                OzaraStorage.setItem(OZARA_STORAGE_KEYS.FACE_ID_ENABLED, 'true');
                setShowFaceIdModal(false);
                onCompleteSignUp();
              }}
              activeOpacity={0.85}>
              <Text style={styles.enableFaceIdBtnText}>Enable Face ID</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipFaceIdBtn}
              onPress={() => {
                setShowFaceIdModal(false);
                onCompleteSignUp();
              }}
              activeOpacity={0.75}>
              <Text style={styles.skipFaceIdBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  faceIdBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  faceIdCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0d1424',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
  },
  faceIdIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  faceIdTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  faceIdDesc: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  faceIdFootnote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 24,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  enableFaceIdBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: OzaraTheme.colors.accentPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  enableFaceIdBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  skipFaceIdBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipFaceIdBtnText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  backText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  badgeRow: {
    marginBottom: 12,
  },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: OzaraTheme.colors.accentVioletBg,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: OzaraTheme.radius.full,
  },
  privatePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.accentViolet,
    letterSpacing: 1.5,
  },
  cyanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: OzaraTheme.radius.full,
  },
  cyanPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.accentCyan,
    letterSpacing: 1.5,
  },
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: OzaraTheme.radius.full,
  },
  successPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  submittedCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: OzaraTheme.radius.lg,
    padding: 16,
    marginBottom: 20,
  },
  submittedCardApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  submittedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  submittedCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  submittedCardDesc: {
    fontSize: 12.5,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  submittedCardSub: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    marginBottom: 6,
  },
  submittedCardHint: {
    fontSize: 11.5,
    color: OzaraTheme.colors.accentCyan,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    padding: 20,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  verifiedTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#ffffff',
  },
  tokenInput: {
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '700',
    color: '#ffffff',
    borderColor: 'rgba(124, 58, 237, 0.5)',
    backgroundColor: '#0e1530',
  },
  inputLocked: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    color: '#94a3b8',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  lockHint: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    marginTop: 5,
    lineHeight: 15,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 16,
    borderRadius: OzaraTheme.radius.full,
    alignItems: 'center',
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: OzaraTheme.colors.accentViolet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      web: {
        cursor: 'pointer',
      },
    }),
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  requestAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderRadius: OzaraTheme.radius.lg,
    padding: 16,
    marginTop: 8,
  },
  requestIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  requestDesc: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 16,
  },
  requestBtn: {
    backgroundColor: OzaraTheme.colors.accentCyan,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: OzaraTheme.radius.full,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  requestBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  tokenRevealCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: OzaraTheme.radius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  tokenRevealLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  tokenBox: {
    backgroundColor: '#090e1c',
    borderWidth: 1.5,
    borderColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: OzaraTheme.radius.md,
    marginBottom: 14,
  },
  tokenCodeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 4,
  },
  boundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boundText: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
  },
  chapterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chapterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    backgroundColor: '#0f172a',
  },
  chapterChipSelected: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    borderColor: OzaraTheme.colors.accentViolet,
  },
  chapterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
  },
  chapterChipTextSelected: {
    color: '#ffffff',
  },
  altLink: {
    alignSelf: 'center',
    marginTop: 14,
    padding: 6,
  },
  altLinkText: {
    color: OzaraTheme.colors.accentCyan,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  privacyNote: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  questionnaireNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderRadius: OzaraTheme.radius.md,
    padding: 16,
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  noticeIconWrap: {
    marginTop: 2,
  },
  noticeTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeDesc: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 4,
  },
  statsCol: {
    flexDirection: 'column',
  },
  statsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: OzaraTheme.colors.accentCyan,
  },
  q18StatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
  },
  q18Answered: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  q18Pending: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  q18StatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  qCard: {
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    padding: 16,
    marginBottom: 14,
  },
  qCardRequired: {
    borderColor: 'rgba(99, 102, 241, 0.45)',
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  qCardConfidential: {
    borderColor: 'rgba(251, 191, 36, 0.35)',
    backgroundColor: 'rgba(251, 191, 36, 0.03)',
  },
  qCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  qNumPill: {
    backgroundColor: '#161f36',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qNumPillRequired: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  qNumPillConfidential: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  qNumPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 0.5,
  },
  qNumPillTextRequired: {
    color: '#818cf8',
  },
  qNumPillTextConfidential: {
    color: '#fbbf24',
  },
  requiredPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  requiredPillText: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  confidentialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  confidentialPillText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  visToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  visToggleBtnPrivate: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  visToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: OzaraTheme.colors.accentCyan,
  },
  visLockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  visLockedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fbbf24',
  },
  qPromptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 20,
    marginBottom: 8,
  },
  qPromptTextRequired: {
    color: '#ffffff',
  },
  q23HintText: {
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 16,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  qInput: {
    backgroundColor: '#080c18',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    minHeight: 46,
    textAlignVertical: 'top',
  },
  qInputRequiredEmpty: {
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  bottomCompleteCard: {
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    padding: 20,
    marginTop: 12,
    marginBottom: 24,
  },
  bottomCompleteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  bottomCompleteHint: {
    flex: 1,
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 18,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    padding: 16,
  },
  avatarCircleBtn: {
    position: 'relative',
    width: 76,
    height: 76,
    borderRadius: 38,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: OzaraTheme.colors.accentCyan,
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#161f36',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: OzaraTheme.colors.accentViolet,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#080c18',
  },
  avatarInfoCol: {
    flex: 1,
  },
  avatarTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  avatarHint: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  avatarActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: OzaraTheme.radius.full,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  uploadBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  removePhotoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  removePhotoText: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  memberBriefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    padding: 16,
    marginTop: 16,
  },
  memberBriefAvatarWrap: {
    position: 'relative',
    width: 84,
    height: 84,
  },
  memberBriefAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: OzaraTheme.colors.accentCyan,
  },
  memberBriefAvatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberBriefAvatarInitials: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  memberBriefAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: OzaraTheme.colors.accentViolet,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0c1222',
  },
  memberBriefName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  memberBriefHeadline: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  dropdownSelectorText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  locationSection: {
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  locationCol: {
    flex: 1,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  dropdownSelectorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  dropdownSelectorSmallText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  dropdownModalCard: {
    backgroundColor: '#0c1222',
    borderTopLeftRadius: OzaraTheme.radius.xl,
    borderTopRightRadius: OzaraTheme.radius.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '75%',
    padding: 20,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dropdownModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  dropdownModalSubtitle: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: '#161f36',
    borderRadius: OzaraTheme.radius.full,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  modalSearchInput: {
    backgroundColor: '#080c18',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 12,
  },
  dropdownListScroll: {
    maxHeight: 320,
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: OzaraTheme.radius.md,
    marginBottom: 4,
    backgroundColor: '#090e1c',
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  dropdownOptionItemSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  dropdownOptionText: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  qSugBlock: {
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: OzaraTheme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  qSugTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: OzaraTheme.colors.accentCyan,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  qSugRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  qSugChip: {
    backgroundColor: '#161f36',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  qSugChipSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: OzaraTheme.colors.accentCyan,
  },
  qSugChipText: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    fontWeight: '500',
  },
  qSugChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  welcomeIntroBlock: {
    marginBottom: 26,
    paddingTop: 10,
    maxWidth: 780,
  },
  welcomeTitle: {
    fontSize: Platform.OS === 'web' ? 28 : 25,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  welcomeTitleBrand: {
    color: '#ffffff',
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  welcomeSubtitle: {
    fontSize: Platform.OS === 'web' ? 17 : 16,
    fontWeight: '500',
    color: 'rgba(226, 232, 240, 0.95)',
    letterSpacing: -0.2,
    marginBottom: 16,
    lineHeight: 24,
  },
  welcomeParagraph: {
    fontSize: 14.5,
    color: '#94a3b8',
    lineHeight: 23,
    letterSpacing: 0.1,
    marginBottom: 10,
  },
  uploadPictureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  uploadPictureBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  questionnairePageContainer: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  minimalQuestionsContainer: {
    marginTop: 8,
    marginBottom: 28,
    position: 'relative',
    overflow: 'visible',
    width: '100%',
  },
  minimalQuestionItem: {
    marginBottom: 10,
    paddingBottom: 0,
    borderBottomWidth: 0,
    position: 'relative',
    overflow: 'visible',
  },
  minimalPromptText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#f1f5f9',
    lineHeight: 18,
    flex: 1,
  },
  requiredStar: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '500',
  },
  minimalDropdownWrap: {
    marginBottom: 4,
    position: 'relative',
    overflow: 'visible',
  },
  multiTriggerAndMenuWrap: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },
  twoDropdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 5,
    position: 'relative',
    overflow: 'visible',
  },
  twoDropdownCol: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    overflow: 'visible',
  },
  threeFieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  threeFieldsCol: {
    flex: 1,
    minWidth: 0,
  },
  twoDropdownSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  dropdownTriggerDisabled: {
    opacity: 0.5,
    backgroundColor: '#070a14',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  multiTriggerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    minHeight: 44,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  multiTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  multiTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    maxWidth: '100%',
  },
  multiTagChipText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  multiTagRemoveBtn: {
    padding: 2,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  multiDoneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 4,
  },
  multiCountNotice: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  multiDoneBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  multiDoneBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  minimalDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  minimalDropdownTriggerActive: {
    borderColor: OzaraTheme.colors.accentCyan,
  },
  minimalDropdownTriggerText: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  minimalDropdownPlaceholder: {
    color: '#64748b',
  },
  minimalDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 999999,
    backgroundColor: '#090e1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    padding: 0,
    marginTop: 4,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
      } as any,
      default: {
        elevation: 20,
      },
    }),
  },
  dropdownSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#060a14',
  },
  dropdownSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 2,
    paddingHorizontal: 6,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  minimalDropdownOption: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 2,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  minimalDropdownOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  minimalDropdownOptionText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '400',
  },
  minimalDropdownOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  minimalTextInput: {
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 13,
    minHeight: 42,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  minimalTextInputEmpty: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  otherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 6,
    marginLeft: 24,
    marginRight: 6,
  },
  otherInputField: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  otherInputBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 5,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  otherInputBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  otherSpecifiedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    marginBottom: 4,
    marginLeft: 24,
    marginRight: 6,
  },
  otherSpecifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  otherSpecifiedChipText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '500',
    marginRight: 4,
  },
  minimalSubmitBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 16,
    zIndex: 1,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  minimalSubmitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  autosaveFooterNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 60,
    paddingHorizontal: 16,
    zIndex: 1,
  },
  autosaveFooterNoteText: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  contentRuleCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  contentRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contentRuleTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  contentRuleText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeaderCard: {
    marginTop: 18,
    marginBottom: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionHeaderTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionHeaderSubtitle: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  promptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  promptActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSkipBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  headerSkipBtnText: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11.5,
    fontWeight: '500',
  },
  visTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  visTogglePillPrivate: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  visTogglePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38bdf8',
  },
  visLockedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fbbf24',
  },
  skippedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skippedText: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  undoSkipBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  undoSkipBtnText: {
    color: OzaraTheme.colors.accentCyan,
    fontSize: 12,
    fontWeight: '600',
  },
  qActionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  skipBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  skipBtnText: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  minimalTextArea: {
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    minHeight: 52,
    maxWidth: 640,
    width: '100%',
    textAlignVertical: 'top',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  charCounterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  charCounterText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  primaryTagChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38bdf8',
  },
  primaryTagBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
  },
  primaryTagBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rankTagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 5,
  },
  rankTagBadgeText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
  },
  makePrimaryChipBtn: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 2,
    marginRight: 4,
  },
  makePrimaryChipBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '600',
  },
  primaryDropdownOptionSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  primaryDropdownOptionTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  primaryOptionBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  primaryOptionBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rankOptionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  rankOptionBadgeText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
  },
  singleLineNoteWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  q6DetailsContainer: {
    marginTop: 8,
    paddingTop: 6,
    gap: 8,
  },
  q6DetailRow: {
    gap: 4,
  },
  q6ChannelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  q6ChannelTitle: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  q6ChannelInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  q6ChannelInfoText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    width: '100%',
  },
  phoneCountryPickerContainer: {
    position: 'relative',
  },
  phoneCountryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  phoneCountryTriggerActive: {
    borderColor: OzaraTheme.colors.accentCyan,
    backgroundColor: '#0d1527',
  },
  phoneCountryFlag: {
    fontSize: 15,
  },
  phoneCountryDialCode: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ffffff',
  },
  phoneCountryDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: 270,
    zIndex: 99999,
    backgroundColor: '#090e1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
      } as any,
      default: {
        elevation: 20,
      },
    }),
  },
  singleLineInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
  },
  singleLineNoteInputField: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  singleLineCharCounter: {
    color: '#64748b',
    fontSize: 11,
    marginLeft: 8,
    fontWeight: '500',
  },
  q18NoteWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  q18NoteLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  q18NoteInputField: {
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    minHeight: 52,
    maxWidth: 640,
    width: '100%',
    textAlignVertical: 'top',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  questionHelperText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  dropdownCategoryHeader: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 6,
    marginBottom: 3,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: OzaraTheme.colors.accentCyan,
  },
  dropdownCategoryHeaderText: {
    color: OzaraTheme.colors.accentCyan,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  subModalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0c1222',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  subModalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
    marginBottom: 16,
  },
  subModalBadgeText: {
    color: OzaraTheme.colors.accentGold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  subModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  subModalDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  subPricingCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  subPricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  subPricingTier: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  subPricingAmount: {
    color: OzaraTheme.colors.accentGold,
    fontSize: 22,
    fontWeight: '800',
  },
  subPricingCadence: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '400',
  },
  subPricingSub: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  subFeatureList: {
    gap: 8,
  },
  subFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subFeatureText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  subPayBtn: {
    width: '100%',
    backgroundColor: OzaraTheme.colors.accentGold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  subPayBtnDisabled: {
    opacity: 0.6,
  },
  subPayBtnText: {
    color: '#0a0f1d',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subSecureNote: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});

