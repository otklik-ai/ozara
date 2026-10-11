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
    defaultChapter: 'Singapore',
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
    defaultChapter: 'Dubai',
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
    defaultChapter: 'London',
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
    defaultChapter: 'London',
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
    defaultChapter: 'Singapore',
    states: [
      { name: 'Hong Kong', cities: ['Hong Kong'] },
    ],
  },
  {
    name: 'Italy',
    code: 'IT',
    defaultChapter: 'Barcelona',
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
    defaultChapter: 'Singapore',
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
    defaultChapter: 'Astana',
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
    defaultChapter: 'Barcelona',
    states: [
      { name: 'Principality of Monaco', cities: ['Monaco', 'Monte Carlo'] },
    ],
  },
  {
    name: 'Netherlands',
    code: 'NL',
    defaultChapter: 'London',
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
    defaultChapter: 'Dubai',
    states: [
      { name: 'Riyadh Province', cities: ['Riyadh', 'Diriyah'] },
      { name: 'Makkah Province', cities: ['Jeddah', 'Mecca'] },
      { name: 'Eastern Province', cities: ['Khobar', 'Dammam', 'Dhahran'] },
    ],
  },
  {
    name: 'Singapore',
    code: 'SG',
    defaultChapter: 'Singapore',
    states: [
      { name: 'Singapore', cities: ['Singapore'] },
    ],
  },
  {
    name: 'Spain',
    code: 'ES',
    defaultChapter: 'Barcelona',
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
    defaultChapter: 'London',
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
    defaultChapter: 'Dubai',
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
    defaultChapter: 'London',
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

export const QUESTION_SUGGESTIONS: Record<number, string[]> = {
  1: [
    'Elena Rostova',
    'Marcus Vance',
    'David Chen',
    'Sarah Jenkins',
    'Kairat Nurtas',
  ],
  2: STANDARDIZED_LOCATIONS,
  3: STANDARDIZED_LOCATIONS,
  4: STANDARDIZED_LOCATIONS,
  5: [
    'English',
    'Arabic',
    'Russian',
    'French',
    'German',
    'Spanish',
    'Mandarin',
    'Kazakh',
  ],
  6: [
    'WhatsApp',
    'Email',
    'Zoom',
    'In app',
    'Telegram',
    'Through the team',
  ],
  7: STANDARDIZED_ROLES,
  8: STANDARDIZED_INDUSTRIES,

  14: STANDARDIZED_FOCUS_PRIORITIES,
  15: STANDARDIZED_INDUSTRIES,
  16: STANDARDIZED_CONNECTION_COUNTRIES,
  17: STANDARDIZED_CONNECTION_TYPES,
  18: [
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
  ],
  19: [
    'Yes',
    'Through the team first',
    'Not right now',
  ],
  20: [
    'Under 35',
    '35-44',
    '45-54',
    '55-64',
    '65+',
  ],
  21: [
    'Partnered',
    'Single',
    'Partnered with children',
    'Children, grown',
  ],
  22: STANDARDIZED_INTERESTS,
  24: STANDARDIZED_CHAPTERS,
};

const CANONICAL_QUESTIONS: QuestionDefinition[] = [
  // Section A. Where you are (Default: shared)
  { id: 1, section: "Section A. Where you are", prompt: "Full name", type: "text", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 2, section: "Section A. Where you are", prompt: "Location where you reside", type: "text", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 3, section: "Section A. Where you are", prompt: "Other locations where you spend real time each year", type: "city_multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 4, section: "Section A. Where you are", prompt: "Locations where you have a base, work, or run something", type: "country_multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 5, section: "Section A. Where you are", prompt: "Languages you do business in", type: "multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 6, section: "Section A. Where you are", prompt: "Best way to reach you", type: "multi", default_visibility: 'shared', is_required: false, is_confidential: false },

  // Section B. What you do (Default: shared. This is the LinkedIn layer.)
  { id: 7, section: "Section B. What you do", prompt: "Professional role", type: "multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 25, section: "Section B. What you do", prompt: "Job title", type: "text", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 26, section: "Section B. What you do", prompt: "Company / Organization", type: "text", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 27, section: "Section B. What you do", prompt: "Institution / University", type: "text", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 8, section: "Section B. What you do", prompt: "Industry & Sector", type: "multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 10, section: "Section B. What you do", prompt: "What do you do, in one sentence?", helper: "Describe your work in your own words.", placeholder: "e.g. I help founders turn AI research into practical products.", type: "text", default_visibility: 'shared', is_required: false, is_confidential: false, char_limit: 200 },
  { id: 12, section: "Section B. What you do", prompt: "Your background", helper: "Share previous companies, education, research, or projects you’re proud of.", type: "long_text", default_visibility: 'shared', is_required: false, is_confidential: false, char_limit: 600 },
  { id: 13, section: "Section B. What you do", prompt: "LinkedIn or website", placeholder: "linkedin.com/in/yourname or your website", type: "url", default_visibility: 'shared', is_required: false, is_confidential: false },

  // Section C. What you are working on now (Default: shared)
  { id: 14, section: "Section C. What you are working on now", prompt: "What are you focused on right now?", type: "multi_with_note", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 15, section: "Section C. What you are working on now", prompt: "Which industries would you like to explore?", type: "multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 16, section: "Section C. What you are working on now", prompt: "Where would you like to build connections?", helper: "Choose up to five countries, or select open anywhere.", type: "country_multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 17, section: "Section C. What you are working on now", prompt: "Who would you like to connect with right now?", helper: "Choose up to five types of connections.", type: "multi_with_note", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 18, section: "Section C. What you are working on now", prompt: "What can other members turn to you for?", helper: "Choose the areas where you can share experience, help, or introductions.", type: "multi_with_note", default_visibility: 'shared', is_required: true, is_confidential: false },
  { id: 19, section: "Section C. What you are working on now", prompt: "Are you open to direct contact from other members?", type: "single", default_visibility: 'shared', is_required: false, is_confidential: false },

  // Section D. Personal context (Default: private)
  { id: 20, section: "Section D. Personal context", prompt: "Age bracket", type: "bracket", default_visibility: 'private', is_required: false, is_confidential: false },
  { id: 21, section: "Section D. Personal context", prompt: "Family situation, if you want to say", type: "single", default_visibility: 'private', is_required: false, is_confidential: false },
  { id: 22, section: "Section D. Personal context", prompt: "What are your interests outside work?", type: "multi", default_visibility: 'shared', is_required: false, is_confidential: false },
  { id: 23, section: "Section D. Personal context", prompt: "Is there anything else you’d like our team to know?", helper: "Optional. Share any context or preferences you’d rather leave off your member profile.", placeholder: "Share any context or preferences you’d rather leave off your member profile.", type: "long_text", default_visibility: 'private', is_required: false, is_confidential: true, char_limit: 1000 },

  // Section E. Chapter and events (Default: shared)
  { id: 24, section: "Section E. Chapter and events", prompt: "Your home chapter, and how would you like to be involved?", type: "single", default_visibility: 'shared', is_required: false, is_confidential: false }
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
  } = useClub();

  const activePhone = verifiedPhone || OzaraStorage.getItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE) || '';
  const initToken = invitationCode || OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_CODE) || '';
  const initEmail = invitationEmail || OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL) || '';
  const initFullName = invitationFullName || OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME) || '';

  // Navigation mode within SignUp flow - defaults to questionnaire_page if account created, or initialViewMode
  const [viewMode, setViewModeState] = useState<GateView>(() => {
    if (initialViewMode) return initialViewMode;
    const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.SIGNUP_STEP) as GateView | null;
    if (saved && ['check_token', 'request_access', 'register_form', 'questionnaire_page'].includes(saved)) {
      return saved;
    }
    const hasAccount =
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID) &&
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.TERMS_ACCEPTED_VERSION);
    if (hasAccount) return 'questionnaire_page';
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

  // Questions & Answers state (Full name is excluded from list as it is shown at the top next to photo)
  const [questions] = useState<QuestionDefinition[]>(() => CANONICAL_QUESTIONS.filter((q) => q.id !== 1));
  const [answers, setAnswers] = useState<Record<number, { value: string; visibility: 'shared' | 'private' }>>(() => {
    try {
      const rawDraft = OzaraStorage.getItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse draft answers from storage:', e);
    }
    return {};
  });
  const [registeredUserId, setRegisteredUserId] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID) || '';
  });
  const [isSavingAnswers, setIsSavingAnswers] = useState(false);
  const [activeQuestionDropdownId, setActiveQuestionDropdownId] = useState<number | null>(null);
  const [qSelectedCountry, setQSelectedCountry] = useState<Record<number, string>>(() => {
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
        // If clicking inside the active dropdown or its trigger, keep it open to process click
        if (
          target.closest &&
          target.closest(`[data-testid="dropdown-wrap-${activeQuestionDropdownId}"], [data-dropdown-wrap="${activeQuestionDropdownId}"]`)
        ) {
          return;
        }
        // Clicked anywhere outside -> close dropdown
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

  // Debounced server-side draft sync: saves progress to user's questionnaire_answers in database
  useEffect(() => {
    const uid = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (!uid || viewMode !== 'questionnaire_page') return;

    const answerEntries = Object.entries(answers).filter(
      ([_, item]) => item.value && item.value.trim().length > 0
    );
    if (answerEntries.length === 0) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveStatus('saving');

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const answerPayload = answerEntries.map(([qIdStr, item]) => {
          const qId = parseInt(qIdStr, 10);
          let val = item.value.trim();
          if (qId === 13 && val && val !== 'skipped' && !/^[a-zA-Z]+:\/\//.test(val)) {
            val = `https://${val}`;
          }
          return {
            question_id: qId,
            value: val,
            visibility: item.visibility || 'shared',
          };
        });

        const nameVal = displayFullName !== 'Member' ? displayFullName : (fullName || '');
        if (nameVal && !answerPayload.some((a) => a.question_id === 1)) {
          answerPayload.push({
            question_id: 1,
            value: nameVal,
            visibility: 'shared',
          });
        }

        await ApiService.saveAnswersBulk(uid, answerPayload);
        setAutosaveStatus('saved');
      } catch (e) {
        // Even if offline or network fails, local storage still preserves the draft
        setAutosaveStatus('saved');
      }
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [answers, registeredUserId, viewMode, displayFullName, fullName]);

  // Hydrate user profile from server if registeredUserId is present
  useEffect(() => {
    const uid = registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (uid) {
      ApiService.getProfile(uid, uid)
        .then((p: any) => {
          if (p) {
            if (p.full_name) setFullName(p.full_name);
            if (p.email) setVerifiedEmail(p.email);
            if (p.avatar_url) setAvatarUrl(p.avatar_url);
            if (p.headline && p.headline !== 'New Member' && p.headline !== 'Verified Executive') {
              setHeadline(p.headline);
            }
            if (p.chapter?.name) setChapter(p.chapter.name);

            // Server answers can be in p.answers or p.shared_answers
            const serverAnswers = (p.answers && Array.isArray(p.answers)) ? p.answers : (p.shared_answers || []);
            if (Array.isArray(serverAnswers) && serverAnswers.length > 0) {
              const loaded: Record<number, { value: string; visibility: 'shared' | 'private' }> = {};
              serverAnswers.forEach((ans: any) => {
                const val = ans.value_text !== undefined ? ans.value_text : ans.value;
                if (val && val !== 'unanswered') {
                  loaded[ans.question_id] = {
                    value: typeof val === 'string' ? val : JSON.stringify(val),
                    visibility: ans.visibility || 'shared',
                  };
                }
              });
              if (Object.keys(loaded).length > 0) {
                // Merge server answers with local draft answers (draft takes priority for any unsaved changes)
                setAnswers((prev) => ({ ...loaded, ...prev }));
              }
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
    const qDef = CANONICAL_QUESTIONS.find(q => q.id === questionId);
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        value,
        visibility: prev[questionId]?.visibility || (questionId === 23 ? 'private' : (qDef?.default_visibility || 'shared')),
      },
    }));
  };

  const handleSkipQuestion = (questionId: number) => {
    const qDef = CANONICAL_QUESTIONS.find(q => q.id === questionId);
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        value: 'skipped',
        visibility: prev[questionId]?.visibility || (questionId === 23 ? 'private' : (qDef?.default_visibility || 'shared')),
      },
    }));
  };

  const toggleAnswerVisibility = (questionId: number) => {
    if (questionId === 23) return; // Permanently private, no toggle
    setAnswers((prev) => {
      const qDef = CANONICAL_QUESTIONS.find(q => q.id === questionId);
      const current = prev[questionId]?.visibility || (qDef?.default_visibility || 'shared');
      return {
        ...prev,
        [questionId]: {
          value: prev[questionId]?.value || '',
          visibility: current === 'private' ? 'shared' : 'private',
        },
      };
    });
  };

  const answeredCount = Object.values(answers).filter(
    (a) => a && a.value && a.value.trim().length > 0 && a.value !== 'skipped'
  ).length;

  const isQ18Answered = Boolean(
    answers[18] && answers[18].value && answers[18].value.trim().length > 0 && answers[18].value !== 'skipped'
  );

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
            // User inserts token from their email - do not auto-fill or auto-navigate away
          } else if (res.status === 'none') {
            // Record was removed from database, reset state
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
        if (res.fullName) setFullName(res.fullName);
        if (res.role) setHeadline(res.role);

        // Transition to Registration Form with pre-populated, locked email
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

  // 2. Submit Request Access (Sends email to Elena Ermolov, goes directly to Token page without blocking spinner)
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

      // Save email context so user can resume where they left off
      setPendingAccessEmail(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setFullName(reqFullName.trim());
      if (reqRole.trim()) setHeadline(reqRole.trim());

      if (res.status === 'approved' && res.token) {
        setIsApproved(true);
        setViewMode('check_token');
      } else {
        // Non-blocking redirect: Go directly to token insertion page with notification banner
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

  // 4. Step B: Save all Questionnaire Answers & Enter Club
  const handleCompleteQuestionnaire = async () => {
    const targetUserId =
      registeredUserId || OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    if (!targetUserId) {
      setViewMode('register_form');
      return;
    }

    if (!isQ18Answered) {
      const msg = "Question 18 ('What can you offer other members?') is required to mark your profile complete. A directory without member offers cannot function effectively.";
      if (Platform.OS === 'web') {
        const proceed = window.confirm(msg + "\n\nWould you like to enter anyway with an incomplete profile status?");
        if (!proceed) return;
      } else {
        Alert.alert("Question 18 Required", msg);
        return;
      }
    }

    // Content moderation guardrail (Securities & broker-dealer compliance)
    const PROHIBITED_REGEX = /\b(raising|pre-money|pre\s*money|ticket|irr)\b|[$€£]\s*\d+[\d,.]*(?:\s*(?:k|m|b|million|billion))?|\bguaranteed\b.{0,20}\breturn\b|\brisk[- ]free\b.{0,20}\bprofit\b|\bvalued at \$\d+/i;
    for (const [qIdStr, item] of Object.entries(answers)) {
      if (item && item.value && item.value !== 'skipped' && PROHIBITED_REGEX.test(item.value)) {
        const msg = "Members describe what they do and what they are interested in. Members do not post specific offerings, amounts being raised, valuations, terms, returns, or minimum investments.";
        if (Platform.OS === 'web') {
          window.alert("Content Guidance: " + msg);
        } else {
          Alert.alert("Content Guidance", msg);
        }
        return;
      }
    }

    try {
      setIsSavingAnswers(true);
      const answerPayload = Object.entries(answers)
        .filter(([_, item]) => item.value && item.value.trim().length > 0)
        .map(([qIdStr, item]) => {
          const qId = parseInt(qIdStr, 10);
          let val = item.value.trim();
          if (qId === 13 && val && val !== 'skipped' && !/^[a-zA-Z]+:\/\//.test(val)) {
            val = `https://${val}`;
          }
          return {
            question_id: qId,
            value: val,
            visibility: item.visibility || 'shared',
          };
        });

      // Automatically ensure Question 1 (Full name) is recorded in answers payload from member profile name
      const nameVal = displayFullName !== 'Member' ? displayFullName : (fullName || '');
      if (nameVal && !answerPayload.some((a) => a.question_id === 1)) {
        answerPayload.push({
          question_id: 1,
          value: nameVal,
          visibility: 'shared',
        });
      }

      if (answerPayload.length > 0) {
        await ApiService.saveAnswersBulk(targetUserId, answerPayload);
      }

      await refreshUserData();
      switchPersona(targetUserId);

      // Clear onboarding storage and set main view to tabs
      setPendingAccessEmail('');
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_TOKEN);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.SIGNUP_STEP);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_ANSWERS);
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.QUESTIONNAIRE_DRAFT_COUNTRIES);
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.APP_VIEW, 'tabs');
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, targetUserId);
      setAppView('tabs');

      const welcomeMsg = `Welcome to ÖZARA, ${fullName || 'Member'}! Your membership profile is activated.`;
      if (Platform.OS === 'web') {
        // Continue to optional Face ID setup
        setShowFaceIdModal(true);
      } else {
        Alert.alert('Welcome to ÖZARA', welcomeMsg, [
          { text: 'Continue', onPress: () => setShowFaceIdModal(true) },
        ]);
      }
    } catch (err: any) {
      console.warn('Error saving questionnaire answers:', err);
      setAppView('tabs');
      onCompleteSignUp();
    } finally {
      setIsSavingAnswers(false);
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
              setViewMode('register_form');
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
          { paddingBottom: Math.max(insets.bottom, 24) + 30 },
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
        {/* STATE 4: ONE MINIMALISTIC PAGE WITH ALL QUESTIONS         */}
        {/* ========================================================= */}
        {viewMode === 'questionnaire_page' && (
          <View>
            {/* Top Minimalist Welcome Block */}
            <View style={styles.welcomeIntroBlock}>
              <Text style={styles.welcomeTitle}>
                Welcome to <Text style={styles.welcomeTitleBrand}>ÖZARA</Text>.
              </Text>
              <Text style={styles.welcomeSubtitle}>A place among exceptional minds.</Text>
              <Text style={styles.welcomeParagraph}>
                We bring together founders, leaders, and investors who think boldly and share generously—people who open doors, offer fresh perspective, and create momentum for one another.
              </Text>
              <Text style={styles.welcomeParagraph}>
                Tell us a little about your world—what you’re building, what you’re looking for right now, and what you’d bring to the circle.
              </Text>
            </View>

            {/* Member Identity & Upload Picture */}
            <View style={styles.memberBriefCard}>
              <TouchableOpacity
                style={styles.memberBriefAvatarWrap}
                onPress={handlePickImage}
                activeOpacity={0.8}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: resolveImageUrl(avatarUrl) }}
                    style={styles.memberBriefAvatar}
                  />
                ) : (
                  <View style={styles.memberBriefAvatarPlaceholder}>
                    <Text style={styles.memberBriefAvatarInitials}>
                      {getInitials(displayFullName)}
                    </Text>
                  </View>
                )}
                <View style={styles.memberBriefAvatarBadge}>
                  <Ionicons name="camera" size={13} color="#ffffff" />
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberBriefName}>{displayFullName}</Text>
                {displaySubtitle ? (
                  <Text style={styles.memberBriefHeadline} numberOfLines={1}>
                    {displaySubtitle}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.uploadPictureBtn}
                onPress={handlePickImage}
                activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.uploadPictureBtnText}>Upload picture</Text>
              </TouchableOpacity>
            </View>

            {/* Minimalistic Questions List */}
            <View style={styles.minimalQuestionsContainer}>
              {questions.map((q, idx) => {
                if (q.id === 26 || q.id === 27) return null;

                if (q.id === 25) {
                  const ans25 = answers[25];
                  const ans26 = answers[26];
                  const ans27 = answers[27];
                  const val25 = ans25?.value && ans25.value !== 'skipped' ? ans25.value : '';
                  const val26 = ans26?.value && ans26.value !== 'skipped' ? ans26.value : '';
                  const val27 = ans27?.value && ans27.value !== 'skipped' ? ans27.value : '';
                  const isSkippedAll = ans25?.value === 'skipped' && ans26?.value === 'skipped' && ans27?.value === 'skipped';
                  const currentVisAll = ans25?.visibility || 'shared';

                  return (
                    <View key="triple-inline-25" style={styles.minimalQuestionItem}>
                      {/* Prompt Header & Visibility */}
                      <View style={styles.promptHeaderRow}>
                        <Text style={styles.minimalPromptText}>
                          Job title, organization & institution
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.visTogglePill,
                            currentVisAll === 'private' && styles.visTogglePillPrivate,
                          ]}
                          onPress={() => {
                            toggleAnswerVisibility(25);
                            toggleAnswerVisibility(26);
                            toggleAnswerVisibility(27);
                          }}
                          activeOpacity={0.7}>
                          <Ionicons
                            name={currentVisAll === 'private' ? "lock-closed-outline" : "globe-outline"}
                            size={11}
                            color={currentVisAll === 'private' ? "#fbbf24" : "#38bdf8"}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.visTogglePillText,
                              currentVisAll === 'private' && { color: '#fbbf24' },
                            ]}>
                            {currentVisAll === 'private' ? 'Private' : 'Shared'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {isSkippedAll ? (
                        <View style={styles.skippedRow}>
                          <Text style={styles.skippedText}>Question skipped</Text>
                          <TouchableOpacity
                            onPress={() => {
                              handleAnswerChange(25, '');
                              handleAnswerChange(26, '');
                              handleAnswerChange(27, '');
                            }}
                            style={styles.undoSkipBtn}>
                            <Text style={styles.undoSkipBtnText}>Answer question</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <View style={styles.threeFieldsRow}>
                            {/* Column 1: Job title */}
                            <View style={styles.threeFieldsCol}>
                              <Text style={styles.twoDropdownSubLabel} numberOfLines={1}>Job title</Text>
                              <TextInput
                                style={styles.minimalTextInput}
                                value={val25}
                                onChangeText={(txt) => handleAnswerChange(25, txt)}
                                placeholder=""
                                placeholderTextColor="#64748b"
                                autoCapitalize="words"
                                autoCorrect={false}
                              />
                            </View>

                            {/* Column 2: Company / Organization */}
                            <View style={styles.threeFieldsCol}>
                              <Text style={styles.twoDropdownSubLabel} numberOfLines={1}>Company / Organization</Text>
                              <TextInput
                                style={styles.minimalTextInput}
                                value={val26}
                                onChangeText={(txt) => handleAnswerChange(26, txt)}
                                placeholder=""
                                placeholderTextColor="#64748b"
                                autoCapitalize="words"
                                autoCorrect={false}
                              />
                            </View>

                            {/* Column 3: Institution / University */}
                            <View style={styles.threeFieldsCol}>
                              <Text style={styles.twoDropdownSubLabel} numberOfLines={1}>Institution / University</Text>
                              <TextInput
                                style={styles.minimalTextInput}
                                value={val27}
                                onChangeText={(txt) => handleAnswerChange(27, txt)}
                                placeholder=""
                                placeholderTextColor="#64748b"
                                autoCapitalize="words"
                                autoCorrect={false}
                              />
                            </View>
                          </View>

                          {/* Action Footer: Skip button */}
                          <View style={styles.qActionFooter}>
                            <TouchableOpacity
                              onPress={() => {
                                handleSkipQuestion(25);
                                handleSkipQuestion(26);
                                handleSkipQuestion(27);
                              }}
                              style={styles.skipBtn}
                              activeOpacity={0.7}>
                              <Text style={styles.skipBtnText}>Skip</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  );
                }

                const isQ18 = q.id === 18;
                const isQ23 = q.id === 23;
                const isQ24 = q.id === 24;
                const ans = answers[q.id];
                const currentVal = ans?.value || '';
                const isSkipped = currentVal === 'skipped';
                const currentVis = ans?.visibility || q.default_visibility || 'shared';
                const options = (q.type === 'long_text' || q.id === 23)
                  ? []
                  : (q.id === 16 ? STANDARDIZED_CONNECTION_COUNTRIES : (QUESTION_SUGGESTIONS[q.id] || []));
                const isDropdownOpen = activeQuestionDropdownId === q.id;

                const isLocationSingle = q.id === 2 || q.id === 3 || q.id === 4;
                const isGenericMulti = !isLocationSingle && (q.type?.includes('multi'));

                const countryDropdownId = q.id * 100 + 1;
                const cityDropdownId = q.id * 100 + 2;
                const isCountryDropdownOpen = activeQuestionDropdownId === countryDropdownId;
                const isCityDropdownOpen = activeQuestionDropdownId === cityDropdownId;
                const countryOptions = COUNTRIES.map((c) => c.name).sort((a, b) => a.localeCompare(b));

                const chapterDropdownId = q.id * 100 + 1;
                const involvementDropdownId = q.id * 100 + 2;
                const isChapterDropdownOpen = activeQuestionDropdownId === chapterDropdownId;
                const isInvolvementDropdownOpen = activeQuestionDropdownId === involvementDropdownId;

                // Parse Q24 Chapter & Involvement
                let activeChapter = '';
                let activeInvolvement = '';
                if (isQ24 && currentVal && currentVal !== 'skipped') {
                  if (currentVal.includes('—')) {
                    const parts = currentVal.split('—').map((s: string) => s.trim());
                    activeChapter = parts[0] || '';
                    activeInvolvement = parts[1] || '';
                  } else if (currentVal.includes(',')) {
                    const parts = currentVal.split(',').map((s: string) => s.trim());
                    activeChapter = parts[0] || '';
                    activeInvolvement = parts[1] || '';
                  } else if (STANDARDIZED_CHAPTERS.includes(currentVal)) {
                    activeChapter = currentVal;
                  } else if (STANDARDIZED_INVOLVEMENT_ROLES.includes(currentVal)) {
                    activeInvolvement = currentVal;
                  }
                }

                // Parse value for single location (no default country!)
                const locationVal = currentVal && currentVal !== 'skipped' ? currentVal : '';
                const { country: parsedCountry, city: parsedCity } = parseLocationValue(locationVal);
                const activeCountry = qSelectedCountry[q.id] !== undefined ? qSelectedCountry[q.id] : parsedCountry;
                const activeCity = parsedCity;
                const activeCityOptions = getCitiesForCountry(activeCountry);

                const searchTrimmed = dropdownSearchQuery.trim().toLowerCase();
                const filteredCountryOptions = (isCountryDropdownOpen && searchTrimmed)
                  ? countryOptions.filter((c) => c.toLowerCase().includes(searchTrimmed))
                  : countryOptions;
                const filteredCityOptions = (isCityDropdownOpen && searchTrimmed)
                  ? activeCityOptions.filter((c) => c.toLowerCase().includes(searchTrimmed))
                  : activeCityOptions;
                const isQ22 = q.id === 22;
                const filteredOptions = (isDropdownOpen && searchTrimmed)
                  ? (isQ22
                      ? options.filter((opt) => {
                          if (opt.toLowerCase().includes(searchTrimmed)) return true;
                          const parentGroup = STANDARDIZED_INTEREST_GROUPS.find(g => g.options.includes(opt));
                          return parentGroup ? parentGroup.category.toLowerCase().includes(searchTrimmed) : false;
                        })
                      : options.filter((opt) => opt.toLowerCase().includes(searchTrimmed)))
                  : options;

                return (
                  <View key={q.id} style={styles.minimalQuestionItem}>
                      {/* Prompt Header & Visibility (no question number in front) */}
                      <View style={styles.promptHeaderRow}>
                        <Text style={styles.minimalPromptText}>
                          {q.prompt}
                          {isQ18 && <Text style={styles.requiredStar}> (Required)</Text>}
                        </Text>

                        {/* Visibility Control */}
                        {isQ23 ? (
                          <View
                            style={[
                              styles.visTogglePill,
                              styles.visTogglePillPrivate,
                            ]}>
                            <Ionicons
                              name="lock-closed"
                              size={11}
                              color="#fbbf24"
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.visTogglePillText,
                                { color: '#fbbf24' },
                              ]}>
                              Private
                            </Text>
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
                              name={currentVis === 'private' ? "lock-closed" : "globe-outline"}
                              size={11}
                              color={currentVis === 'private' ? "#fbbf24" : "#38bdf8"}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.visTogglePillText,
                                currentVis === 'private' && { color: '#fbbf24' },
                              ]}>
                              {currentVis === 'private' ? 'Private' : 'Shared'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {q.helper ? (
                        <Text style={styles.questionHelperText}>{q.helper}</Text>
                      ) : null}

                      {isSkipped ? (
                        <View style={styles.skippedRow}>
                          <Text style={styles.skippedText}>Question skipped</Text>
                          <TouchableOpacity
                            onPress={() => handleAnswerChange(q.id, '')}
                            style={styles.undoSkipBtn}>
                            <Text style={styles.undoSkipBtnText}>Answer question</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          {/* Single Choice Country & City Dropdowns (Questions 1, 2, 3) */}
                          {isLocationSingle ? (
                            <View style={styles.twoDropdownRow}>
                              {/* Country Dropdown Column */}
                              <View
                                style={styles.twoDropdownCol}
                                testID={`dropdown-wrap-${countryDropdownId}`}
                                {...(Platform.OS === 'web' ? ({ 'data-dropdown-wrap': String(countryDropdownId) } as any) : {})}>
                                <Text style={styles.twoDropdownSubLabel}>Country</Text>
                                <TouchableOpacity
                                  style={[
                                    styles.minimalDropdownTrigger,
                                    isCountryDropdownOpen && styles.minimalDropdownTriggerActive,
                                  ]}
                                  onPress={() => {
                                    setActiveQuestionDropdownId(isCountryDropdownOpen ? null : countryDropdownId);
                                    setDropdownSearchQuery('');
                                  }}
                                  activeOpacity={0.75}>
                                  <Text
                                    style={[
                                      styles.minimalDropdownTriggerText,
                                      !activeCountry && styles.minimalDropdownPlaceholder,
                                    ]}
                                    numberOfLines={1}>
                                    {activeCountry || 'Select country...'}
                                  </Text>
                                  <Ionicons
                                    name={isCountryDropdownOpen ? "chevron-up" : "chevron-down"}
                                    size={14}
                                    color="#94a3b8"
                                  />
                                </TouchableOpacity>

                                {isCountryDropdownOpen && (
                                  <View style={styles.minimalDropdownMenu}>
                                    <View style={styles.dropdownSearchHeader}>
                                      <Ionicons name="search" size={13} color="#94a3b8" style={{ marginRight: 6 }} />
                                      <TextInput
                                        ref={dropdownSearchInputRef}
                                        style={styles.dropdownSearchInput}
                                        placeholder="Type country name..."
                                        placeholderTextColor="#64748b"
                                        value={dropdownSearchQuery}
                                        onChangeText={setDropdownSearchQuery}
                                        autoFocus={true}
                                        autoCorrect={false}
                                        autoCapitalize="none"
                                        clearButtonMode="while-editing"
                                        returnKeyType="done"
                                        onSubmitEditing={() => {
                                          if (filteredCountryOptions.length > 0) {
                                            const chosen = filteredCountryOptions[0];
                                            const validCities = getCitiesForCountry(chosen);
                                            const keepCity = activeCity && validCities.includes(activeCity) ? activeCity : '';
                                            setQSelectedCountry((prev) => ({ ...prev, [q.id]: chosen }));
                                            handleAnswerChange(q.id, keepCity ? `${keepCity}, ${chosen}` : chosen);
                                            setActiveQuestionDropdownId(cityDropdownId);
                                            setDropdownSearchQuery('');
                                          }
                                        }}
                                      />
                                      {dropdownSearchQuery.length > 0 && (
                                        <TouchableOpacity
                                          onPress={() => setDropdownSearchQuery('')}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                          <Ionicons name="close-circle" size={15} color="#94a3b8" />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                    <ScrollView
                                      style={{ maxHeight: 220, padding: 4 }}
                                      nestedScrollEnabled
                                      showsVerticalScrollIndicator={true}
                                      keyboardShouldPersistTaps="handled">
                                      {filteredCountryOptions.length === 0 ? (
                                        <View style={{ padding: 12, alignItems: 'center' }}>
                                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                                            No country matching "{dropdownSearchQuery}"
                                          </Text>
                                        </View>
                                      ) : (
                                        filteredCountryOptions.map((cName, cIdx) => {
                                          const isSelected = activeCountry === cName;
                                          return (
                                            <TouchableOpacity
                                              key={cIdx}
                                              style={[
                                                styles.minimalDropdownOption,
                                                isSelected && styles.minimalDropdownOptionSelected,
                                              ]}
                                              onPress={() => {
                                                const validCities = getCitiesForCountry(cName);
                                                const keepCity = activeCity && validCities.includes(activeCity) ? activeCity : '';
                                                setQSelectedCountry((prev) => ({ ...prev, [q.id]: cName }));
                                                handleAnswerChange(q.id, keepCity ? `${keepCity}, ${cName}` : cName);
                                                setActiveQuestionDropdownId(cityDropdownId);
                                                setDropdownSearchQuery('');
                                              }}
                                              activeOpacity={0.7}>
                                              <Text
                                                style={[
                                                  styles.minimalDropdownOptionText,
                                                  isSelected && styles.minimalDropdownOptionTextSelected,
                                                ]}>
                                                {cName}
                                              </Text>
                                            </TouchableOpacity>
                                          );
                                        })
                                      )}
                                    </ScrollView>
                                  </View>
                                )}
                              </View>

                              {/* City Dropdown Column */}
                              <View
                                style={styles.twoDropdownCol}
                                testID={`dropdown-wrap-${cityDropdownId}`}
                                {...(Platform.OS === 'web' ? ({ 'data-dropdown-wrap': String(cityDropdownId) } as any) : {})}>
                                <Text style={styles.twoDropdownSubLabel}>City</Text>
                                <TouchableOpacity
                                  style={[
                                    styles.minimalDropdownTrigger,
                                    isCityDropdownOpen && styles.minimalDropdownTriggerActive,
                                    !activeCountry && styles.dropdownTriggerDisabled,
                                  ]}
                                  onPress={() => {
                                    if (!activeCountry) {
                                      setActiveQuestionDropdownId(countryDropdownId);
                                      setDropdownSearchQuery('');
                                      return;
                                    }
                                    setActiveQuestionDropdownId(isCityDropdownOpen ? null : cityDropdownId);
                                    setDropdownSearchQuery('');
                                  }}
                                  activeOpacity={0.75}>
                                  <Text
                                    style={[
                                      styles.minimalDropdownTriggerText,
                                      !activeCity && styles.minimalDropdownPlaceholder,
                                      !activeCountry && { color: '#64748b' },
                                    ]}
                                    numberOfLines={1}>
                                    {!activeCountry ? 'Select country first' : (activeCity || 'Select city...')}
                                  </Text>
                                  <Ionicons
                                    name={isCityDropdownOpen ? "chevron-up" : "chevron-down"}
                                    size={14}
                                    color={activeCountry ? "#94a3b8" : "#475569"}
                                  />
                                </TouchableOpacity>

                                {isCityDropdownOpen && activeCountry && (
                                  <View style={styles.minimalDropdownMenu}>
                                    <View style={styles.dropdownSearchHeader}>
                                      <Ionicons name="search" size={13} color="#94a3b8" style={{ marginRight: 6 }} />
                                      <TextInput
                                        ref={dropdownSearchInputRef}
                                        style={styles.dropdownSearchInput}
                                        placeholder={`Type city in ${activeCountry}...`}
                                        placeholderTextColor="#64748b"
                                        value={dropdownSearchQuery}
                                        onChangeText={setDropdownSearchQuery}
                                        autoFocus={true}
                                        autoCorrect={false}
                                        autoCapitalize="none"
                                        clearButtonMode="while-editing"
                                        returnKeyType="done"
                                        onSubmitEditing={() => {
                                          if (filteredCityOptions.length > 0) {
                                            handleAnswerChange(q.id, `${filteredCityOptions[0]}, ${activeCountry}`);
                                            setActiveQuestionDropdownId(null);
                                            setDropdownSearchQuery('');
                                          } else if (dropdownSearchQuery.trim()) {
                                            handleAnswerChange(q.id, `${dropdownSearchQuery.trim()}, ${activeCountry}`);
                                            setActiveQuestionDropdownId(null);
                                            setDropdownSearchQuery('');
                                          }
                                        }}
                                      />
                                      {dropdownSearchQuery.length > 0 && (
                                        <TouchableOpacity
                                          onPress={() => setDropdownSearchQuery('')}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                          <Ionicons name="close-circle" size={15} color="#94a3b8" />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                    <ScrollView
                                      style={{ maxHeight: 220, padding: 4 }}
                                      nestedScrollEnabled
                                      showsVerticalScrollIndicator={true}
                                      keyboardShouldPersistTaps="handled">
                                      {filteredCityOptions.length === 0 ? (
                                        <View style={{ padding: 10 }}>
                                          <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                                            {activeCityOptions.length === 0
                                              ? `No predefined cities for ${activeCountry}`
                                              : `No cities matching "${dropdownSearchQuery}"`}
                                          </Text>
                                          {dropdownSearchQuery.trim().length > 0 && (
                                            <TouchableOpacity
                                              style={[styles.minimalDropdownOption, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}
                                              onPress={() => {
                                                handleAnswerChange(q.id, `${dropdownSearchQuery.trim()}, ${activeCountry}`);
                                                setActiveQuestionDropdownId(null);
                                                setDropdownSearchQuery('');
                                              }}>
                                              <Ionicons name="add-circle-outline" size={15} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 6 }} />
                                              <Text style={[styles.minimalDropdownOptionText, { color: OzaraTheme.colors.accentCyan }]}>
                                                Use custom: "{dropdownSearchQuery.trim()}"
                                              </Text>
                                            </TouchableOpacity>
                                          )}
                                        </View>
                                      ) : (
                                        <>
                                          {filteredCityOptions.map((ctName, ctIdx) => {
                                            const isSelected = activeCity === ctName;
                                            return (
                                              <TouchableOpacity
                                                key={ctIdx}
                                                style={[
                                                  styles.minimalDropdownOption,
                                                  isSelected && styles.minimalDropdownOptionSelected,
                                                ]}
                                                onPress={() => {
                                                  handleAnswerChange(q.id, `${ctName}, ${activeCountry}`);
                                                  setActiveQuestionDropdownId(null);
                                                  setDropdownSearchQuery('');
                                                }}
                                                activeOpacity={0.7}>
                                                <Text
                                                  style={[
                                                    styles.minimalDropdownOptionText,
                                                    isSelected && styles.minimalDropdownOptionTextSelected,
                                                  ]}>
                                                  {ctName}
                                                </Text>
                                              </TouchableOpacity>
                                            );
                                          })}
                                          {dropdownSearchQuery.trim().length > 0 && !filteredCityOptions.some(c => c.toLowerCase() === dropdownSearchQuery.trim().toLowerCase()) && (
                                            <TouchableOpacity
                                              style={[styles.minimalDropdownOption, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}
                                              onPress={() => {
                                                handleAnswerChange(q.id, `${dropdownSearchQuery.trim()}, ${activeCountry}`);
                                                setActiveQuestionDropdownId(null);
                                                setDropdownSearchQuery('');
                                              }}>
                                              <Ionicons name="add-circle-outline" size={15} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 6 }} />
                                              <Text style={[styles.minimalDropdownOptionText, { color: OzaraTheme.colors.accentCyan }]}>
                                                Use custom: "{dropdownSearchQuery.trim()}"
                                              </Text>
                                            </TouchableOpacity>
                                          )}
                                        </>
                                      )}
                                    </ScrollView>
                                  </View>
                                )}
                              </View>
                            </View>
                          ) : isGenericMulti ? (
                            /* 2. Multi-choice Dropdown Selector (Questions 2 & 3, plus any multi-type question) */
                            <View
                              style={styles.minimalDropdownWrap}
                              testID={`dropdown-wrap-${q.id}`}
                              {...(Platform.OS === 'web' ? ({ 'data-dropdown-wrap': String(q.id) } as any) : {})}>
                              {(() => {
                                const isQ7 = q.id === 7;
                                const isQ8 = q.id === 8;
                                const isQ14Note = q.id === 14;
                                const isQ15 = q.id === 15;
                                const isQ16 = q.id === 16;
                                const isQ17Note = q.id === 17;
                                const isQ18Note = q.id === 18;
                                const isQ22 = q.id === 22;
                                const isCompositeNote = isQ14Note || isQ17Note || isQ18Note;
                                const delimiter = (isQ8 || isQ15 || isQ22) ? '; ' : ', ';

                                const expandOption = (optStr: string): string[] => {
                                  if (!optStr) return [];
                                  if (optStr.toLowerCase().startsWith('other —') || optStr.toLowerCase() === 'other') {
                                    return [optStr];
                                  }
                                  // Em-dash and comma list, e.g. "Technology Professional — engineering, data, AI, product, IT"
                                  if (optStr.includes('—') && optStr.includes(',')) {
                                    const [head, tail] = optStr.split('—').map(s => s.trim());
                                    const subs = tail.split(',').map(s => {
                                      const clean = s.trim();
                                      if (clean.toLowerCase() === 'ai') return 'AI';
                                      if (clean.toLowerCase() === 'it') return 'IT';
                                      return clean.charAt(0).toUpperCase() + clean.slice(1);
                                    });
                                    return [head, ...subs].filter(Boolean);
                                  }
                                  // Slash-delimited options, e.g. "Investor / Fund Manager / Family Office Principal", "Founder / Co-founder"
                                  if (optStr.includes('/')) {
                                    return optStr.split('/').map(s => s.trim()).filter(Boolean);
                                  }
                                  if (isQ7 && optStr.includes(',')) {
                                    return optStr.split(',').map(s => s.trim()).filter(Boolean);
                                  }
                                  return [optStr];
                                };

                                let selectedList: string[] = [];
                                let noteText = '';

                                if (isCompositeNote) {
                                  if (currentVal) {
                                    try {
                                      if (currentVal.startsWith('{') && currentVal.endsWith('}')) {
                                        const parsed = JSON.parse(currentVal);
                                        selectedList = Array.isArray(parsed.tags) ? parsed.tags : [];
                                        noteText = typeof parsed.note === 'string' ? parsed.note : '';
                                      } else {
                                        if (isQ14Note || isQ17Note) {
                                          selectedList = [];
                                          noteText = currentVal;
                                        } else {
                                          selectedList = currentVal.split(',').map((s: string) => s.trim()).filter(Boolean);
                                        }
                                      }
                                    } catch {
                                      if (isQ14Note || isQ17Note) {
                                        selectedList = [];
                                        noteText = currentVal;
                                      } else {
                                        selectedList = currentVal.split(',').map((s: string) => s.trim()).filter(Boolean);
                                      }
                                    }
                                  }
                                } else if (isQ8 || isQ15 || isQ22) {
                                  selectedList = currentVal ? currentVal.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [];
                                } else {
                                  selectedList = currentVal ? currentVal.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                }

                                // Automatically expand composite options into individual chips so users can remove any with X
                                selectedList = Array.from(new Set(selectedList.flatMap((item: string) => expandOption(item))));

                                const saveSelected = (newList: string[], newNote?: string) => {
                                  if (isCompositeNote) {
                                    const noteToSave = newNote !== undefined ? newNote : noteText;
                                    handleAnswerChange(q.id, JSON.stringify({ tags: newList, note: noteToSave }));
                                  } else {
                                    handleAnswerChange(q.id, newList.join(delimiter));
                                  }
                                };

                                return (
                                  <>
                                    <TouchableOpacity
                                      style={[
                                        styles.multiTriggerContainer,
                                        isDropdownOpen && styles.minimalDropdownTriggerActive,
                                      ]}
                                      onPress={() => {
                                        setActiveQuestionDropdownId(isDropdownOpen ? null : q.id);
                                        setDropdownSearchQuery('');
                                      }}
                                      activeOpacity={0.75}>
                                      {selectedList.length === 0 ? (
                                        <Text style={[styles.minimalDropdownTriggerText, styles.minimalDropdownPlaceholder]}>
                                          {isQ8 ? 'Select up to 3 industries...' : isQ14Note ? 'Select priorities...' : isQ15 ? 'Select industries to explore...' : isQ16 ? 'Select countries (up to 5)...' : isQ17Note ? 'Select connection types (up to 5)...' : isQ18Note ? 'Select areas...' : isQ22 ? 'Select interests...' : 'Select options...'}
                                        </Text>
                                      ) : (
                                        <View style={styles.multiTagsWrap}>
                                          {selectedList.map((tag: string, tIdx: number) => {
                                            const isPrimary = isQ8 && tIdx === 0;
                                            return (
                                              <View key={tIdx} style={[styles.multiTagChip, isPrimary && styles.primaryTagChip]}>
                                                {isQ8 && tIdx === 0 && (
                                                  <View style={styles.primaryTagBadge}>
                                                    <Text style={styles.primaryTagBadgeText}>★ PRIMARY</Text>
                                                  </View>
                                                )}
                                                {isQ8 && tIdx > 0 && (
                                                  <View style={styles.rankTagBadge}>
                                                    <Text style={styles.rankTagBadgeText}>{tIdx === 1 ? '2nd' : '3rd'}</Text>
                                                  </View>
                                                )}
                                                <Text style={styles.multiTagChipText} numberOfLines={1}>{tag}</Text>
                                                {isQ8 && tIdx > 0 && (
                                                  <TouchableOpacity
                                                    onPress={(e) => {
                                                      e.stopPropagation?.();
                                                      const reordered = [tag, ...selectedList.filter(item => item !== tag)];
                                                      saveSelected(reordered);
                                                    }}
                                                    style={styles.makePrimaryChipBtn}>
                                                    <Text style={styles.makePrimaryChipBtnText}>Make Primary</Text>
                                                  </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                  onPress={(e) => {
                                                    e.stopPropagation?.();
                                                    const nextList = selectedList.filter((item: string) => item !== tag);
                                                    saveSelected(nextList);
                                                  }}
                                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                  style={styles.multiTagRemoveBtn}>
                                                  <Ionicons name="close" size={12} color="#cbd5e1" />
                                                </TouchableOpacity>
                                              </View>
                                            );
                                          })}
                                        </View>
                                      )}
                                      <Ionicons
                                        name={isDropdownOpen ? "chevron-up" : "chevron-down"}
                                        size={14}
                                        color="#94a3b8"
                                      />
                                    </TouchableOpacity>

                                    {isDropdownOpen && (
                                      <View style={styles.minimalDropdownMenu}>
                                        <View style={styles.dropdownSearchHeader}>
                                          <Ionicons name="search" size={13} color="#94a3b8" style={{ marginRight: 6 }} />
                                          <TextInput
                                            ref={dropdownSearchInputRef}
                                            style={styles.dropdownSearchInput}
                                            placeholder="Type to filter..."
                                            placeholderTextColor="#64748b"
                                            value={dropdownSearchQuery}
                                            onChangeText={setDropdownSearchQuery}
                                            autoFocus={true}
                                            autoCorrect={false}
                                            autoCapitalize="none"
                                            clearButtonMode="while-editing"
                                            returnKeyType="done"
                                            onSubmitEditing={() => {
                                              if (filteredOptions.length > 0) {
                                                const first = filteredOptions[0];
                                                const expanded = expandOption(first);
                                                const allSel = expanded.every((p: string) => selectedList.includes(p));
                                                if (allSel) {
                                                  saveSelected(selectedList.filter((item: string) => !expanded.includes(item)));
                                                } else {
                                                  if (isQ8 && selectedList.length >= 3) return;
                                                  if ((isQ16 || isQ17Note) && selectedList.length >= 5) return;
                                                  const nextList = [...selectedList];
                                                  expanded.forEach((p: string) => {
                                                    if (!nextList.includes(p)) {
                                                      if (isQ8 && nextList.length >= 3) return;
                                                      if ((isQ16 || isQ17Note) && nextList.length >= 5) return;
                                                      nextList.push(p);
                                                    }
                                                  });
                                                  saveSelected(nextList);
                                                }
                                                setDropdownSearchQuery('');
                                              } else if (dropdownSearchQuery.trim()) {
                                                const rawQuery = dropdownSearchQuery.trim();
                                                const customParts = (isQ7 && (rawQuery.includes(',') || rawQuery.includes('/')))
                                                  ? rawQuery.split(/[,/]/).map((s: string) => s.trim()).filter(Boolean)
                                                  : [rawQuery];
                                                const nextList = [...selectedList];
                                                customParts.forEach((cp: string) => {
                                                  if (!nextList.includes(cp)) {
                                                    if (isQ8 && nextList.length >= 3) return;
                                                    if ((isQ16 || isQ17Note) && nextList.length >= 5) return;
                                                    nextList.push(cp);
                                                  }
                                                });
                                                saveSelected(nextList);
                                                setDropdownSearchQuery('');
                                              }
                                            }}
                                          />
                                          {dropdownSearchQuery.length > 0 && (
                                            <TouchableOpacity
                                              onPress={() => setDropdownSearchQuery('')}
                                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                              <Ionicons name="close-circle" size={15} color="#94a3b8" />
                                            </TouchableOpacity>
                                          )}
                                        </View>
                                        <ScrollView
                                          style={{ maxHeight: 240, padding: 4 }}
                                          nestedScrollEnabled
                                          showsVerticalScrollIndicator={true}
                                          keyboardShouldPersistTaps="handled">
                                          {filteredOptions.length === 0 ? (
                                            <View style={{ padding: 12, alignItems: 'center' }}>
                                              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                                                No options matching "{dropdownSearchQuery}"
                                              </Text>
                                              {dropdownSearchQuery.trim().length > 0 && (
                                                <TouchableOpacity
                                                  style={[styles.minimalDropdownOption, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}
                                                  onPress={() => {
                                                    const rawQuery = dropdownSearchQuery.trim();
                                                    const customParts = (isQ7 && (rawQuery.includes(',') || rawQuery.includes('/')))
                                                      ? rawQuery.split(/[,/]/).map((s: string) => s.trim()).filter(Boolean)
                                                      : [rawQuery];
                                                    const nextList = [...selectedList];
                                                    customParts.forEach((cp: string) => {
                                                      if (!nextList.includes(cp)) {
                                                        if (isQ8 && nextList.length >= 3) return;
                                                        if ((isQ16 || isQ17Note) && nextList.length >= 5) return;
                                                        nextList.push(cp);
                                                      }
                                                    });
                                                    saveSelected(nextList);
                                                    setDropdownSearchQuery('');
                                                  }}>
                                                  <Ionicons name="add-circle-outline" size={15} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 6 }} />
                                                  <Text style={[styles.minimalDropdownOptionText, { color: OzaraTheme.colors.accentCyan }]}>
                                                    Add custom: "{dropdownSearchQuery.trim()}"
                                                  </Text>
                                                </TouchableOpacity>
                                              )}
                                            </View>
                                          ) : isQ22 ? (
                                            <>
                                              {STANDARDIZED_INTEREST_GROUPS.map((grp, gIdx) => {
                                                const qLow = dropdownSearchQuery.trim().toLowerCase();
                                                const catMatches = !qLow || grp.category.toLowerCase().includes(qLow);
                                                const matchingOpts = grp.options.filter(opt => !qLow || catMatches || opt.toLowerCase().includes(qLow));
                                                if (matchingOpts.length === 0) return null;

                                                return (
                                                  <View key={gIdx} style={{ marginBottom: 6 }}>
                                                    <View style={styles.dropdownCategoryHeader}>
                                                      <Text style={styles.dropdownCategoryHeaderText}>{grp.category.toUpperCase()}</Text>
                                                    </View>
                                                    {matchingOpts.map((opt, oIdx) => {
                                                      const isSelected = selectedList.includes(opt);
                                                      return (
                                                        <TouchableOpacity
                                                          key={oIdx}
                                                          style={[
                                                            styles.minimalDropdownOption,
                                                            isSelected && styles.minimalDropdownOptionSelected,
                                                            { flexDirection: 'row', alignItems: 'center' },
                                                          ]}
                                                          onPress={() => {
                                                            if (isSelected) {
                                                              saveSelected(selectedList.filter(item => item !== opt));
                                                            } else {
                                                              saveSelected([...selectedList, opt]);
                                                            }
                                                          }}
                                                          activeOpacity={0.7}>
                                                          <TouchableOpacity
                                                            onPress={() => {
                                                              if (isSelected) {
                                                                saveSelected(selectedList.filter(item => item !== opt));
                                                              } else {
                                                                saveSelected([...selectedList, opt]);
                                                              }
                                                            }}
                                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                            <Ionicons
                                                              name={isSelected ? "checkbox" : "square-outline"}
                                                              size={16}
                                                              color={isSelected ? OzaraTheme.colors.accentCyan : "#64748b"}
                                                              style={{ marginRight: 8 }}
                                                            />
                                                          </TouchableOpacity>
                                                          <Text
                                                            style={[
                                                              styles.minimalDropdownOptionText,
                                                              isSelected && styles.minimalDropdownOptionTextSelected,
                                                              { flex: 1 },
                                                            ]}>
                                                            {opt}
                                                          </Text>
                                                        </TouchableOpacity>
                                                      );
                                                    })}
                                                  </View>
                                                );
                                              })}
                                              {dropdownSearchQuery.trim().length > 0 && !STANDARDIZED_INTERESTS.some(o => o.toLowerCase() === dropdownSearchQuery.trim().toLowerCase()) && (
                                                <TouchableOpacity
                                                  style={[styles.minimalDropdownOption, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 }]}
                                                  onPress={() => {
                                                    const custom = dropdownSearchQuery.trim();
                                                    if (!selectedList.includes(custom)) {
                                                      saveSelected([...selectedList, custom]);
                                                    }
                                                    setDropdownSearchQuery('');
                                                  }}>
                                                  <Ionicons name="add-circle-outline" size={15} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 6 }} />
                                                  <Text style={[styles.minimalDropdownOptionText, { color: OzaraTheme.colors.accentCyan }]}>
                                                    Add custom: "{dropdownSearchQuery.trim()}"
                                                  </Text>
                                                </TouchableOpacity>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              {filteredOptions.map((opt, oIdx) => {
                                                const isOtherOption = opt.toLowerCase().includes('other — please specify') || opt.toLowerCase() === 'other' || opt.toLowerCase().startsWith('other —');
                                                const specifiedOtherItems = isOtherOption
                                                  ? selectedList.filter((item: string) => item.toLowerCase().startsWith('other:') || item.toLowerCase().startsWith('other -') || (item.toLowerCase().startsWith('other') && item !== 'other — please specify' && item !== 'other'))
                                                  : [];
                                                const expandedParts = expandOption(opt);
                                                const isExpandedCompound = expandedParts.length > 1;
                                                const isSelected = isOtherOption
                                                  ? (selectedList.includes(opt) || specifiedOtherItems.length > 0)
                                                  : isExpandedCompound
                                                    ? expandedParts.every((p: string) => selectedList.includes(p))
                                                    : selectedList.includes(opt);
                                                const isPartiallySelected = isExpandedCompound && !isSelected && expandedParts.some((p: string) => selectedList.includes(p));
                                                const isSpecifyingThis = isOtherOption && specifyingOtherQuestionId === q.id;

                                                const handleToggleOption = () => {
                                                  if (isOtherOption) {
                                                    if (isSelected) {
                                                      setSpecifyingOtherQuestionId(prev => (prev === q.id ? null : q.id));
                                                    } else {
                                                      setSpecifyingOtherQuestionId(q.id);
                                                      if (!selectedList.includes(opt)) {
                                                        if (isQ8 && selectedList.length >= 3) return;
                                                        saveSelected([...selectedList, opt]);
                                                      }
                                                    }
                                                  } else if (isExpandedCompound) {
                                                    if (isSelected) {
                                                      saveSelected(selectedList.filter((item: string) => !expandedParts.includes(item)));
                                                    } else {
                                                      const nextList = [...selectedList];
                                                      expandedParts.forEach((p: string) => {
                                                        if (!nextList.includes(p)) {
                                                          if (isQ8 && nextList.length >= 3) return;
                                                          nextList.push(p);
                                                        }
                                                      });
                                                      saveSelected(nextList);
                                                    }
                                                  } else {
                                                    const isOpenToConnectionsAnywhere = opt.toLowerCase().includes('open to connections anywhere');
                                                    if (isQ16) {
                                                      if (isOpenToConnectionsAnywhere) {
                                                        if (isSelected) {
                                                          saveSelected([]);
                                                        } else {
                                                          saveSelected(['Open to connections anywhere']);
                                                        }
                                                        return;
                                                      } else {
                                                        if (isSelected) {
                                                          saveSelected(selectedList.filter((item: string) => item !== opt));
                                                        } else {
                                                          const withoutOpen = selectedList.filter((item: string) => !item.toLowerCase().includes('open to connections anywhere'));
                                                          if (withoutOpen.length >= 5) {
                                                            if (Platform.OS === 'web') {
                                                              window.alert('Maximum 5 countries can be selected.');
                                                            } else {
                                                              Alert.alert('Maximum Reached', 'You can select up to five countries.');
                                                            }
                                                            return;
                                                          }
                                                          saveSelected([...withoutOpen, opt]);
                                                        }
                                                        return;
                                                      }
                                                    }

                                                    const isOpenToMeetingDifferent = opt.toLowerCase().includes('open to meeting different people');
                                                    if (isQ17Note) {
                                                      if (isOpenToMeetingDifferent) {
                                                        if (isSelected) {
                                                          saveSelected([]);
                                                        } else {
                                                          saveSelected(['Open to Meeting Different People']);
                                                        }
                                                        return;
                                                      } else {
                                                        if (isSelected) {
                                                          saveSelected(selectedList.filter((item: string) => item !== opt));
                                                        } else {
                                                          const withoutOpen = selectedList.filter((item: string) => !item.toLowerCase().includes('open to meeting different people'));
                                                          if (withoutOpen.length >= 5) {
                                                            if (Platform.OS === 'web') {
                                                              window.alert('Maximum 5 types of connections can be selected.');
                                                            } else {
                                                              Alert.alert('Maximum Reached', 'You can select up to five types of connections.');
                                                            }
                                                            return;
                                                          }
                                                          saveSelected([...withoutOpen, opt]);
                                                        }
                                                        return;
                                                      }
                                                    }

                                                    if (isSelected) {
                                                      saveSelected(selectedList.filter((item: string) => item !== opt));
                                                    } else {
                                                      if (isQ8 && selectedList.length >= 3) {
                                                        if (Platform.OS === 'web') {
                                                          window.alert('Maximum 3 industries can be selected.');
                                                        } else {
                                                          Alert.alert('Maximum Reached', 'You can select up to three industries.');
                                                        }
                                                        return;
                                                      }
                                                      saveSelected([...selectedList, opt]);
                                                    }
                                                  }
                                                };

                                                const handleToggleCheckboxOnly = () => {
                                                  if (isOtherOption) {
                                                    if (isSelected) {
                                                      const nextList = selectedList.filter((item: string) =>
                                                        item !== opt &&
                                                        !item.toLowerCase().startsWith('other:') &&
                                                        !item.toLowerCase().startsWith('other -') &&
                                                        !(item.toLowerCase().startsWith('other') && item !== 'other')
                                                      );
                                                      saveSelected(nextList);
                                                      setSpecifyingOtherQuestionId(null);
                                                      setCustomOtherText('');
                                                    } else {
                                                      setSpecifyingOtherQuestionId(q.id);
                                                      saveSelected([...selectedList, opt]);
                                                    }
                                                  } else if (isExpandedCompound) {
                                                    if (isSelected || isPartiallySelected) {
                                                      saveSelected(selectedList.filter((item: string) => !expandedParts.includes(item)));
                                                    } else {
                                                      const nextList = [...selectedList];
                                                      expandedParts.forEach((p: string) => {
                                                        if (!nextList.includes(p)) {
                                                          if (isQ8 && nextList.length >= 3) return;
                                                          nextList.push(p);
                                                        }
                                                      });
                                                      saveSelected(nextList);
                                                    }
                                                  } else {
                                                    handleToggleOption();
                                                  }
                                                };

                                                const handleAddSpecifiedOther = () => {
                                                  const trimmed = customOtherText.trim();
                                                  if (trimmed) {
                                                    const formatted = trimmed.toLowerCase().startsWith('other') ? trimmed : `Other: ${trimmed}`;
                                                    const cleanList = selectedList.filter((item: string) => item !== opt && item !== 'Other');
                                                    if (!cleanList.includes(formatted)) {
                                                      saveSelected([...cleanList, formatted]);
                                                    }
                                                    setCustomOtherText('');
                                                  }
                                                };

                                                const isOptPrimary = isQ8 && selectedList[0] === opt;
                                                const optRankIdx = isQ8 ? selectedList.indexOf(opt) : -1;

                                                return (
                                                  <View key={oIdx} style={{ marginBottom: 2 }}>
                                                    <TouchableOpacity
                                                      style={[
                                                        styles.minimalDropdownOption,
                                                        isSelected && styles.minimalDropdownOptionSelected,
                                                        isOptPrimary && styles.primaryDropdownOptionSelected,
                                                        { flexDirection: 'row', alignItems: 'center' },
                                                      ]}
                                                      onPress={handleToggleOption}
                                                      activeOpacity={0.7}>
                                                      <TouchableOpacity
                                                        onPress={handleToggleCheckboxOnly}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                        <Ionicons
                                                          name={isSelected ? "checkbox" : isPartiallySelected ? "remove-circle-outline" : "square-outline"}
                                                          size={16}
                                                          color={isSelected ? OzaraTheme.colors.accentCyan : isPartiallySelected ? "#38bdf8" : "#64748b"}
                                                          style={{ marginRight: 8 }}
                                                        />
                                                      </TouchableOpacity>
                                                      <Text
                                                        style={[
                                                          styles.minimalDropdownOptionText,
                                                          isSelected && styles.minimalDropdownOptionTextSelected,
                                                          isOptPrimary && styles.primaryDropdownOptionTextSelected,
                                                          { flex: 1 },
                                                        ]}>
                                                        {opt}
                                                      </Text>
                                                      {isOptPrimary && (
                                                        <View style={styles.primaryOptionBadge}>
                                                          <Text style={styles.primaryOptionBadgeText}>PRIMARY</Text>
                                                        </View>
                                                      )}
                                                      {!isOptPrimary && optRankIdx > 0 && (
                                                        <View style={styles.rankOptionBadge}>
                                                          <Text style={styles.rankOptionBadgeText}>{optRankIdx === 1 ? '2nd' : '3rd'}</Text>
                                                        </View>
                                                      )}
                                                      {isOtherOption && (
                                                        <TouchableOpacity
                                                          onPress={() => setSpecifyingOtherQuestionId(prev => (prev === q.id ? null : q.id))}
                                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                          style={{ paddingHorizontal: 4 }}>
                                                          <Ionicons
                                                            name={isSpecifyingThis ? "chevron-up" : "create-outline"}
                                                            size={15}
                                                            color={isSelected ? OzaraTheme.colors.accentCyan : "#94a3b8"}
                                                          />
                                                        </TouchableOpacity>
                                                      )}
                                                    </TouchableOpacity>

                                                    {/* Chips for already-specified other items */}
                                                    {isOtherOption && specifiedOtherItems.length > 0 && (
                                                      <View style={styles.otherSpecifiedChipsWrap}>
                                                        {specifiedOtherItems.map((specItem: string, sIdx: number) => (
                                                          <View key={sIdx} style={styles.otherSpecifiedChip}>
                                                            <Text style={styles.otherSpecifiedChipText} numberOfLines={1}>{specItem}</Text>
                                                            <TouchableOpacity
                                                              onPress={() => {
                                                                const nextList = selectedList.filter((item: string) => item !== specItem);
                                                                saveSelected(nextList);
                                                              }}
                                                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                                              <Ionicons name="close" size={12} color="#cbd5e1" />
                                                            </TouchableOpacity>
                                                          </View>
                                                        ))}
                                                      </View>
                                                    )}

                                                    {/* Inline input for typing in custom other role */}
                                                    {isOtherOption && isSpecifyingThis && (
                                                      <View style={styles.otherInputRow}>
                                                        <TextInput
                                                          ref={otherTextInputRef}
                                                          style={styles.otherInputField}
                                                          placeholder="Specify..."
                                                          placeholderTextColor="#64748b"
                                                          value={customOtherText}
                                                          onChangeText={setCustomOtherText}
                                                          autoFocus={true}
                                                          autoCapitalize="words"
                                                          returnKeyType="done"
                                                          onSubmitEditing={handleAddSpecifiedOther}
                                                        />
                                                        <TouchableOpacity
                                                          style={styles.otherInputBtn}
                                                          onPress={handleAddSpecifiedOther}
                                                          activeOpacity={0.8}>
                                                          <Ionicons name="add" size={13} color="#ffffff" style={{ marginRight: 2 }} />
                                                          <Text style={styles.otherInputBtnText}>Add</Text>
                                                        </TouchableOpacity>
                                                      </View>
                                                    )}
                                                  </View>
                                                );
                                              })}
                                            </>
                                          )}
                                        </ScrollView>
                                        <View style={styles.multiDoneBar}>
                                          <Text style={styles.multiCountNotice}>
                                            {isQ8
                                              ? `${selectedList.length}/3 selected (1st is Primary)`
                                              : (isQ16 || isQ17Note)
                                              ? `${selectedList.length}/5 selected`
                                              : `${selectedList.length} selected`}
                                          </Text>
                                          <TouchableOpacity
                                            style={styles.multiDoneBtn}
                                            onPress={() => {
                                              if (specifyingOtherQuestionId === q.id && customOtherText.trim()) {
                                                const trimmed = customOtherText.trim();
                                                const formatted = trimmed.toLowerCase().startsWith('other') ? trimmed : `Other: ${trimmed}`;
                                                const cleanList = selectedList.filter((item: string) => item !== 'Other — please specify' && item !== 'Other');
                                                if (!cleanList.includes(formatted)) {
                                                  saveSelected([...cleanList, formatted]);
                                                }
                                              }
                                              setActiveQuestionDropdownId(null);
                                              setDropdownSearchQuery('');
                                              setSpecifyingOtherQuestionId(null);
                                              setCustomOtherText('');
                                            }}
                                            activeOpacity={0.8}>
                                            <Text style={styles.multiDoneBtnText}>Done</Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    )}

                                    {/* Optional note field for Q14 */}
                                    {isQ14Note && (
                                      <View style={styles.singleLineNoteWrap}>
                                        <Text style={styles.q18NoteLabel}>Anything specific?</Text>
                                        <View style={styles.singleLineInputContainer}>
                                          <TextInput
                                            style={styles.singleLineNoteInputField}
                                            value={noteText}
                                            onChangeText={(txt) => {
                                              if (txt.length <= 250) {
                                                saveSelected(selectedList, txt);
                                              }
                                            }}
                                            placeholder="e.g. Looking for a research partner for an AI healthcare project."
                                            placeholderTextColor="#64748b"
                                            maxLength={250}
                                          />
                                          <Text style={styles.singleLineCharCounter}>{noteText.length}/250</Text>
                                        </View>
                                      </View>
                                    )}

                                    {/* Optional note field for Q17 */}
                                    {isQ17Note && (
                                      <View style={styles.singleLineNoteWrap}>
                                        <Text style={styles.q18NoteLabel}>Anyone specific?</Text>
                                        <View style={styles.singleLineInputContainer}>
                                          <TextInput
                                            style={styles.singleLineNoteInputField}
                                            value={noteText}
                                            onChangeText={(txt) => {
                                              if (txt.length <= 200) {
                                                saveSelected(selectedList, txt);
                                              }
                                            }}
                                            placeholder="e.g. An experienced real estate developer in Seattle."
                                            placeholderTextColor="#64748b"
                                            maxLength={200}
                                          />
                                          <Text style={styles.singleLineCharCounter}>{noteText.length}/200</Text>
                                        </View>
                                      </View>
                                    )}

                                    {/* Optional note field for Q18 */}
                                    {isQ18Note && (
                                      <View style={styles.q18NoteWrap}>
                                        <Text style={styles.q18NoteLabel}>Tell us a little more</Text>
                                        <TextInput
                                          style={styles.q18NoteInputField}
                                          value={noteText}
                                          onChangeText={(txt) => {
                                            if (txt.length <= 300) {
                                              saveSelected(selectedList, txt);
                                            }
                                          }}
                                          placeholder="e.g. I help teams build reliable data platforms and can introduce experienced data engineers."
                                          placeholderTextColor="#64748b"
                                          multiline={true}
                                          numberOfLines={3}
                                          maxLength={300}
                                        />
                                        <View style={styles.charCounterRow}>
                                          <Text style={styles.charCounterText}>{noteText.length}/300</Text>
                                        </View>
                                      </View>
                                    )}
                                  </>
                                );
                              })()}
                            </View>
                          ) : isQ24 ? (
                            /* Question 24: Dual dropdowns [ Boston ▼ ] [ Happy to host ▼ ] */
                            <View style={styles.twoDropdownRow}>
                              {/* First Dropdown: Home Chapter */}
                              <View
                                style={styles.twoDropdownCol}
                                testID={`dropdown-wrap-${chapterDropdownId}`}
                                {...(Platform.OS === 'web' ? ({ 'data-dropdown-wrap': String(chapterDropdownId) } as any) : {})}>
                                <TouchableOpacity
                                  style={[
                                    styles.minimalDropdownTrigger,
                                    isChapterDropdownOpen && styles.minimalDropdownTriggerActive,
                                  ]}
                                  onPress={() => {
                                    setActiveQuestionDropdownId(isChapterDropdownOpen ? null : chapterDropdownId);
                                    setDropdownSearchQuery('');
                                  }}
                                  activeOpacity={0.75}>
                                  <Text
                                    style={[
                                      styles.minimalDropdownTriggerText,
                                      !activeChapter && styles.minimalDropdownPlaceholder,
                                    ]}
                                    numberOfLines={1}>
                                    {activeChapter || 'Select chapter...'}
                                  </Text>
                                  <Ionicons
                                    name={isChapterDropdownOpen ? "chevron-up" : "chevron-down"}
                                    size={14}
                                    color="#94a3b8"
                                  />
                                </TouchableOpacity>

                                {isChapterDropdownOpen && (
                                  <View style={styles.minimalDropdownMenu}>
                                    <ScrollView
                                      style={{ maxHeight: 220, padding: 4 }}
                                      nestedScrollEnabled
                                      showsVerticalScrollIndicator={false}
                                      keyboardShouldPersistTaps="handled">
                                      {STANDARDIZED_CHAPTERS.map((ch, chIdx) => {
                                        const isSelected = activeChapter === ch;
                                        return (
                                          <TouchableOpacity
                                            key={chIdx}
                                            style={[
                                              styles.minimalDropdownOption,
                                              isSelected && styles.minimalDropdownOptionSelected,
                                            ]}
                                            onPress={() => {
                                              const nextVal = activeInvolvement ? `${ch} — ${activeInvolvement}` : ch;
                                              handleAnswerChange(q.id, nextVal);
                                              setChapter(ch);
                                              setActiveQuestionDropdownId(null);
                                              setDropdownSearchQuery('');
                                            }}
                                            activeOpacity={0.7}>
                                            <Text
                                              style={[
                                                styles.minimalDropdownOptionText,
                                                isSelected && styles.minimalDropdownOptionTextSelected,
                                              ]}>
                                              {ch}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  </View>
                                )}
                              </View>

                              {/* Second Dropdown: Involvement */}
                              <View
                                style={styles.twoDropdownCol}
                                testID={`dropdown-wrap-${involvementDropdownId}`}
                                {...(Platform.OS === 'web' ? ({ 'data-dropdown-wrap': String(involvementDropdownId) } as any) : {})}>
                                <TouchableOpacity
                                  style={[
                                    styles.minimalDropdownTrigger,
                                    isInvolvementDropdownOpen && styles.minimalDropdownTriggerActive,
                                  ]}
                                  onPress={() => {
                                    setActiveQuestionDropdownId(isInvolvementDropdownOpen ? null : involvementDropdownId);
                                    setDropdownSearchQuery('');
                                  }}
                                  activeOpacity={0.75}>
                                  <Text
                                    style={[
                                      styles.minimalDropdownTriggerText,
                                      !activeInvolvement && styles.minimalDropdownPlaceholder,
                                    ]}
                                    numberOfLines={1}>
                                    {activeInvolvement || 'Select involvement...'}
                                  </Text>
                                  <Ionicons
                                    name={isInvolvementDropdownOpen ? "chevron-up" : "chevron-down"}
                                    size={14}
                                    color="#94a3b8"
                                  />
                                </TouchableOpacity>

                                {isInvolvementDropdownOpen && (
                                  <View style={styles.minimalDropdownMenu}>
                                    <ScrollView
                                      style={{ maxHeight: 220, padding: 4 }}
                                      nestedScrollEnabled
                                      showsVerticalScrollIndicator={false}
                                      keyboardShouldPersistTaps="handled">
                                      {STANDARDIZED_INVOLVEMENT_ROLES.map((role, rIdx) => {
                                        const isSelected = activeInvolvement === role;
                                        return (
                                          <TouchableOpacity
                                            key={rIdx}
                                            style={[
                                              styles.minimalDropdownOption,
                                              isSelected && styles.minimalDropdownOptionSelected,
                                            ]}
                                            onPress={() => {
                                              const nextVal = activeChapter ? `${activeChapter} — ${role}` : role;
                                              handleAnswerChange(q.id, nextVal);
                                              setActiveQuestionDropdownId(null);
                                              setDropdownSearchQuery('');
                                            }}
                                            activeOpacity={0.7}>
                                            <Text
                                              style={[
                                                styles.minimalDropdownOptionText,
                                                isSelected && styles.minimalDropdownOptionTextSelected,
                                              ]}>
                                              {role}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  </View>
                                )}
                              </View>
                            </View>
                          ) : options.length > 0 ? (
                            /* 3. Single-choice Dropdown Selector */
                            <View
                              style={styles.minimalDropdownWrap}
                              testID={`dropdown-wrap-${q.id}`}
                              {...(Platform.OS === 'web' ? ({ 'data-dropdown-wrap': String(q.id) } as any) : {})}>
                              <TouchableOpacity
                                style={[
                                  styles.minimalDropdownTrigger,
                                  isDropdownOpen && styles.minimalDropdownTriggerActive,
                                ]}
                                onPress={() => {
                                  setActiveQuestionDropdownId(isDropdownOpen ? null : q.id);
                                  setDropdownSearchQuery('');
                                }}
                                activeOpacity={0.75}>
                                <Text
                                  style={[
                                    styles.minimalDropdownTriggerText,
                                    !currentVal && styles.minimalDropdownPlaceholder,
                                  ]}
                                  numberOfLines={1}>
                                  {currentVal || 'Select an option...'}
                                </Text>
                                <Ionicons
                                  name={isDropdownOpen ? "chevron-up" : "chevron-down"}
                                  size={14}
                                  color="#94a3b8"
                                />
                              </TouchableOpacity>

                              {isDropdownOpen && (
                                <View style={styles.minimalDropdownMenu}>
                                  <View style={styles.dropdownSearchHeader}>
                                    <Ionicons name="search" size={13} color="#94a3b8" style={{ marginRight: 6 }} />
                                    <TextInput
                                      ref={dropdownSearchInputRef}
                                      style={styles.dropdownSearchInput}
                                      placeholder="Type to filter..."
                                      placeholderTextColor="#64748b"
                                      value={dropdownSearchQuery}
                                      onChangeText={setDropdownSearchQuery}
                                      autoFocus={true}
                                      autoCorrect={false}
                                      autoCapitalize="none"
                                      clearButtonMode="while-editing"
                                      returnKeyType="done"
                                      onSubmitEditing={() => {
                                        if (filteredOptions.length > 0) {
                                          handleAnswerChange(q.id, filteredOptions[0]);
                                          setActiveQuestionDropdownId(null);
                                          setDropdownSearchQuery('');
                                        } else if (dropdownSearchQuery.trim()) {
                                          handleAnswerChange(q.id, dropdownSearchQuery.trim());
                                          setActiveQuestionDropdownId(null);
                                          setDropdownSearchQuery('');
                                        }
                                      }}
                                    />
                                    {dropdownSearchQuery.length > 0 && (
                                      <TouchableOpacity
                                        onPress={() => setDropdownSearchQuery('')}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Ionicons name="close-circle" size={15} color="#94a3b8" />
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                  <ScrollView
                                    style={{ maxHeight: 220, padding: 4 }}
                                    nestedScrollEnabled
                                    showsVerticalScrollIndicator={true}
                                    keyboardShouldPersistTaps="handled">
                                    {filteredOptions.length === 0 ? (
                                      <View style={{ padding: 12, alignItems: 'center' }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                                          No options matching "{dropdownSearchQuery}"
                                        </Text>
                                        {dropdownSearchQuery.trim().length > 0 && (
                                          <TouchableOpacity
                                            style={[styles.minimalDropdownOption, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}
                                            onPress={() => {
                                              handleAnswerChange(q.id, dropdownSearchQuery.trim());
                                              setActiveQuestionDropdownId(null);
                                              setDropdownSearchQuery('');
                                            }}>
                                            <Ionicons name="create-outline" size={15} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 6 }} />
                                            <Text style={[styles.minimalDropdownOptionText, { color: OzaraTheme.colors.accentCyan }]}>
                                              Use custom: "{dropdownSearchQuery.trim()}"
                                            </Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    ) : (
                                      <>
                                        {filteredOptions.map((opt, oIdx) => {
                                          const isSelected = currentVal === opt;
                                          return (
                                            <TouchableOpacity
                                              key={oIdx}
                                              style={[
                                                styles.minimalDropdownOption,
                                                isSelected && styles.minimalDropdownOptionSelected,
                                              ]}
                                              onPress={() => {
                                                handleAnswerChange(q.id, opt);
                                                setActiveQuestionDropdownId(null);
                                                setDropdownSearchQuery('');
                                              }}
                                              activeOpacity={0.7}>
                                              <Text
                                                style={[
                                                  styles.minimalDropdownOptionText,
                                                  isSelected && styles.minimalDropdownOptionTextSelected,
                                                ]}>
                                                {opt}
                                              </Text>
                                            </TouchableOpacity>
                                          );
                                        })}
                                        {dropdownSearchQuery.trim().length > 0 && !filteredOptions.some(o => o.toLowerCase() === dropdownSearchQuery.trim().toLowerCase()) && (
                                          <TouchableOpacity
                                            style={[styles.minimalDropdownOption, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}
                                            onPress={() => {
                                              handleAnswerChange(q.id, dropdownSearchQuery.trim());
                                              setActiveQuestionDropdownId(null);
                                              setDropdownSearchQuery('');
                                            }}>
                                            <Ionicons name="create-outline" size={15} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 6 }} />
                                            <Text style={[styles.minimalDropdownOptionText, { color: OzaraTheme.colors.accentCyan }]}>
                                              Use custom: "{dropdownSearchQuery.trim()}"
                                            </Text>
                                          </TouchableOpacity>
                                        )}
                                      </>
                                    )}
                                  </ScrollView>
                                </View>
                              )}
                            </View>
                          ) : (
                            /* 4. Text Input Field: multiline for Q12/long_text, URL for Q13, single-line with counter for others */
                            q.type === 'long_text' || q.id === 12 ? (
                              <View>
                                <TextInput
                                  style={[
                                    styles.minimalTextArea,
                                    !currentVal && styles.minimalTextInputEmpty,
                                  ]}
                                  placeholder={q.placeholder || ''}
                                  placeholderTextColor="#64748b"
                                  value={currentVal === 'skipped' ? '' : currentVal}
                                  onChangeText={(txt) => {
                                    const max = q.char_limit || 600;
                                    if (txt.length <= max) {
                                      handleAnswerChange(q.id, txt);
                                    }
                                  }}
                                  multiline={true}
                                  numberOfLines={4}
                                  maxLength={q.char_limit || 600}
                                  autoCorrect={false}
                                />
                                <View style={styles.charCounterRow}>
                                  <Text style={styles.charCounterText}>
                                    {(currentVal === 'skipped' ? '' : currentVal).length}/{q.char_limit || 600}
                                  </Text>
                                </View>
                              </View>
                            ) : q.type === 'url' || q.id === 13 ? (
                              <TextInput
                                style={[
                                  styles.minimalTextInput,
                                  !currentVal && styles.minimalTextInputEmpty,
                                ]}
                                placeholder={q.placeholder || 'linkedin.com/in/yourname or your website'}
                                placeholderTextColor="#64748b"
                                value={currentVal === 'skipped' ? '' : currentVal}
                                onChangeText={(txt) => handleAnswerChange(q.id, txt)}
                                onBlur={() => {
                                  if (currentVal && currentVal !== 'skipped') {
                                    const trimmed = currentVal.trim();
                                    if (trimmed && !/^[a-zA-Z]+:\/\//.test(trimmed)) {
                                      handleAnswerChange(q.id, `https://${trimmed}`);
                                    }
                                  }
                                }}
                                keyboardType="url"
                                autoCapitalize="none"
                                autoCorrect={false}
                              />
                            ) : (
                              <View>
                                <TextInput
                                  style={[
                                    styles.minimalTextInput,
                                    !currentVal && styles.minimalTextInputEmpty,
                                  ]}
                                  placeholder={q.placeholder || ''}
                                  placeholderTextColor="#64748b"
                                  value={currentVal === 'skipped' ? '' : currentVal}
                                  onChangeText={(txt) => {
                                    if (q.char_limit && txt.length > q.char_limit) return;
                                    handleAnswerChange(q.id, txt);
                                  }}
                                  autoCapitalize={q.id === 26 ? 'words' : 'sentences'}
                                  autoCorrect={false}
                                  maxLength={q.char_limit}
                                />
                                {q.char_limit ? (
                                  <View style={styles.charCounterRow}>
                                    <Text style={styles.charCounterText}>
                                      {(currentVal === 'skipped' ? '' : currentVal).length}/{q.char_limit}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            )
                          )}

                          {/* Action Footer: Skip button */}
                          <View style={styles.qActionFooter}>
                            {!isQ18 && (
                              <TouchableOpacity
                                onPress={() => handleSkipQuestion(q.id)}
                                style={styles.skipBtn}
                                activeOpacity={0.7}>
                                <Text style={styles.skipBtnText}>Skip</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </>
                      )}
                    </View>
                );
              })}
            </View>

            {/* Minimal Complete Profile Action Button */}
            <TouchableOpacity
              style={[styles.minimalSubmitBtn, isSavingAnswers && styles.submitBtnDisabled]}
              onPress={handleCompleteQuestionnaire}
              disabled={isSavingAnswers}
              activeOpacity={0.85}>
              {isSavingAnswers ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.minimalSubmitBtnText}>Complete Profile</Text>
              )}
            </TouchableOpacity>

            <View style={styles.autosaveFooterNoteRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 6 }} />
              <Text style={styles.autosaveFooterNoteText}>
                Your progress is saved continuously. You can safely close your browser anytime and resume right here.
              </Text>
            </View>
          </View>
        )}

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
  minimalQuestionsContainer: {
    marginTop: 8,
  },
  minimalQuestionItem: {
    marginBottom: 10,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  minimalPromptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    lineHeight: 19,
    marginBottom: 6,
  },
  requiredStar: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '500',
  },
  minimalDropdownWrap: {
    marginBottom: 4,
  },
  twoDropdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  twoDropdownCol: {
    flex: 1,
    minWidth: 0,
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
    backgroundColor: '#090e1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    padding: 0,
    marginTop: 4,
    overflow: 'hidden',
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
    marginTop: 12,
    marginBottom: 40,
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
    marginTop: -20,
    marginBottom: 40,
    paddingHorizontal: 16,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 13,
    minHeight: 90,
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
    minHeight: 60,
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
});

