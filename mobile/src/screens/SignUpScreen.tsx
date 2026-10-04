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
    name: 'United Arab Emirates',
    code: 'AE',
    defaultChapter: 'Dubai',
    states: [
      { name: 'Dubai', cities: ['Dubai', 'DIFC', 'Downtown Dubai', 'Palm Jumeirah', 'Dubai Marina', 'Business Bay'] },
      { name: 'Abu Dhabi', cities: ['Abu Dhabi', 'ADGM', 'Al Reem Island', 'Yas Island', 'Saadiyat Island'] },
      { name: 'Sharjah', cities: ['Sharjah'] },
      { name: 'Ras Al Khaimah', cities: ['Ras Al Khaimah', 'Al Marjan Island'] },
    ],
  },
  {
    name: 'United States',
    code: 'US',
    defaultChapter: 'New York',
    states: [
      { name: 'New York', cities: ['New York', 'Manhattan', 'Brooklyn', 'Hamptons', 'New York City'] },
      { name: 'California', cities: ['San Francisco', 'Silicon Valley', 'Palo Alto', 'Menlo Park', 'Los Angeles', 'San Diego', 'Newport Beach'] },
      { name: 'Florida', cities: ['Miami', 'Palm Beach', 'Fort Lauderdale', 'Brickell', 'Tampa', 'Orlando'] },
      { name: 'Texas', cities: ['Austin', 'Dallas', 'Houston'] },
      { name: 'Massachusetts', cities: ['Boston', 'Cambridge'] },
      { name: 'Washington', cities: ['Seattle', 'Bellevue'] },
      { name: 'Illinois', cities: ['Chicago'] },
    ],
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    defaultChapter: 'London',
    states: [
      { name: 'Greater London', cities: ['London', 'Mayfair', 'City of London', 'Kensington', 'Chelsea', 'Canary Wharf'] },
      { name: 'South East', cities: ['Oxford', 'Cambridge', 'Surrey', 'Windsor'] },
      { name: 'Scotland', cities: ['Edinburgh', 'Glasgow'] },
      { name: 'North West', cities: ['Manchester'] },
    ],
  },
  {
    name: 'Kazakhstan',
    code: 'KZ',
    defaultChapter: 'Astana',
    states: [
      { name: 'Astana', cities: ['Astana', 'AIFC (Astana Finance)', 'Yesil District', 'Saryarka'] },
      { name: 'Almaty', cities: ['Almaty', 'Medeu District', 'Bostandyk'] },
    ],
  },
  {
    name: 'Switzerland',
    code: 'CH',
    defaultChapter: 'London',
    states: [
      { name: 'Canton of Zurich', cities: ['Zurich', 'Winterthur'] },
      { name: 'Canton of Geneva', cities: ['Geneva'] },
      { name: 'Canton of Zug', cities: ['Zug (Crypto Valley)', 'Baar'] },
      { name: 'Canton of Vaud', cities: ['Lausanne', 'Montreux'] },
      { name: 'Canton of Basel', cities: ['Basel'] },
    ],
  },
  {
    name: 'Singapore',
    code: 'SG',
    defaultChapter: 'Singapore',
    states: [
      { name: 'Central Region', cities: ['Singapore', 'Marina Bay', 'Raffles Place', 'Orchard', 'Sentosa'] },
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
    ],
  },
  {
    name: 'Saudi Arabia',
    code: 'SA',
    defaultChapter: 'Dubai',
    states: [
      { name: 'Riyadh Province', cities: ['Riyadh', 'KAFD', 'Diplomatic Quarter', 'Diriyah'] },
      { name: 'Makkah Province', cities: ['Jeddah'] },
      { name: 'Eastern Province', cities: ['Khobar', 'Dammam'] },
    ],
  },
  {
    name: 'Monaco',
    code: 'MC',
    defaultChapter: 'Barcelona',
    states: [
      { name: 'Principality of Monaco', cities: ['Monaco', 'Monte Carlo', 'Larvotto', 'Fontvieille'] },
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
    ],
  },
  {
    name: 'France',
    code: 'FR',
    defaultChapter: 'London',
    states: [
      { name: 'Île-de-France', cities: ['Paris', 'Neuilly-sur-Seine'] },
      { name: "Côte d'Azur", cities: ['Nice', 'Cannes', 'Saint-Tropez'] },
    ],
  },
  {
    name: 'Hong Kong',
    code: 'HK',
    defaultChapter: 'Singapore',
    states: [
      { name: 'Hong Kong', cities: ['Central', 'Admiralty', 'Southside', 'Kowloon'] },
    ],
  },
];

export const STANDARDIZED_INDUSTRIES = [
  'Financial Services & FinTech',
  'Artificial Intelligence & DeepTech',
  'Private Equity & Venture Capital',
  'Family Offices & Wealth Management',
  'Real Estate & Sovereign Infrastructure',
  'Enterprise Software & SaaS',
  'Biotechnology & Life Sciences',
  'Energy, CleanTech & Commodities',
  'Cross-Border Logistics & Global Trade',
  'Legal, Sovereign & Corporate Advisory',
  'Defense, Aerospace & Cyber Security',
  'Luxury, Media & Private Aviation',
];

export const STANDARDIZED_ROLES = [
  'Founder & CEO',
  'Co-Founder & Executive',
  'Managing Partner / GP',
  'Family Office Principal',
  'Chief Executive Officer (CEO)',
  'Chief Technology Officer (CTO)',
  'Chief Investment Officer (CIO)',
  'Limited Partner / Angel Investor',
  'Board Director & Strategic Advisor',
];

export const QUESTION_SUGGESTIONS: Record<number, string[]> = {
  2: [
    'Artificial Intelligence & DeepTech',
    'FinTech & Digital Assets',
    'Private Equity & Sovereign Funds',
    'Real Estate & Infrastructure',
    'Enterprise Cloud & Security',
    'Biotech & Healthcare',
    'Commodities & CleanTech',
  ],
  5: [
    'MENA (UAE, Saudi Arabia, Qatar)',
    'North America (New York & US)',
    'Western Europe (UK & Switzerland)',
    'Central Asia & Kazakhstan (Astana)',
    'Southeast Asia & Singapore',
    'Latin America',
  ],
  7: [
    'Solo Founder / Principal',
    '2 - 10 Team Members (Boutique)',
    '11 - 50 Team Members (Growth Scale)',
    '51 - 250 Team Members (Established)',
    '250+ Global Enterprise',
  ],
  8: [
    '1:1 Strategic Advisory & Mentorship',
    'Syndicate Co-Investing',
    'Advisory Board & Governance',
    'Peer Brain Trust & Founder Salons',
  ],
  11: [
    '30-min Virtual Executive Briefing',
    'In-Person Breakfast / Coffee in Chapter',
    'Intimate Private Dinner',
    'Asynchronous Voice Notes',
  ],
  15: [
    'Dubai',
    'New York',
    'London',
    'Astana',
    'Singapore',
    'Miami',
    'Barcelona',
    'Limassol',
    'Zurich / Geneva',
  ],
  24: [
    'Intimate Founder Dinners (10-15 guests)',
    'Closed-Door Chatham House Salons',
    'Cross-Border Investment Summits',
    'Confidential Peer Masterminds',
  ],
  25: [
    'Yes, active for speaking & mentorship',
    'Selective: intimate salons only',
    'Not currently available',
  ],
  27: [
    'English',
    'Arabic',
    'Russian',
    'French',
    'German',
    'Spanish',
    'Mandarin',
  ],
  29: [
    'Direct Telegram (@handle)',
    'Direct WhatsApp',
    'Executive Assistant / Corporate Email',
    'Facilitated via Alexandra & Julia',
  ],
};

const CANONICAL_QUESTIONS: QuestionDefinition[] = [
  { id: 1, prompt: "What is your primary professional focus today?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 2, prompt: "Which industries do you have deep operational experience in?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 3, prompt: "What are the core capabilities or expertise you can offer to peers?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 4, prompt: "What specific introductions, partnerships, or resources are you currently seeking?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 5, prompt: "What geographies or regional markets do you know best?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 6, prompt: "What major company, institution, or project are you most known for?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 7, prompt: "What is your current team size and corporate scale?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 8, prompt: "What are your preferred collaboration formats (advisory, co-investing, peer exchange)?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 9, prompt: "What is one counter-intuitive business insight you strongly believe?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 10, prompt: "Which key business books, thinkers, or frameworks shape your operating style?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 11, prompt: "What is your preferred method and time for high-value conversations?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 12, prompt: "What active side ventures, boards, or philanthropic initiatives do you support?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 13, prompt: "What personal hobbies, sports, or passions do you pursue outside work?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 14, prompt: "What universities, alumni networks, or executive programs are you affiliated with?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 15, prompt: "Which international cities do you visit most regularly throughout the year?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 16, prompt: "What is the biggest operational hurdle you solved in the past 24 months?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 17, prompt: "What technology or market trend do you believe is currently under-hyped?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 18, prompt: "What core priority or strategic milestone are you tackling over the next 12 months?", is_required: true, is_confidential: false, default_visibility: 'shared' },
  { id: 19, prompt: "How do you prefer to evaluate new peer connections before committing time?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 20, prompt: "What is a trusted service provider category you often recommend to peers?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 21, prompt: "What was your most impactful cross-border transaction or expansion experience?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 22, prompt: "What is your philosophy on building and preserving long-term relationship capital?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 23, prompt: "Confidential founder notes: What personal inflection point or confidential challenge are you navigating?", is_required: false, is_confidential: true, default_visibility: 'private' },
  { id: 24, prompt: "What type of community events or gatherings do you find most valuable?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 25, prompt: "Are you open to speaking on panels, hosting salons, or mentoring rising founders?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 26, prompt: "What are your criteria for joining an advisory board or angel syndicate?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 27, prompt: "Which languages do you conduct business in fluently?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 28, prompt: "What media, podcasts, or publications do you read consistently?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 29, prompt: "What is your preferred communication channel for urgent peer requests?", is_required: false, is_confidential: false, default_visibility: 'shared' },
  { id: 30, prompt: "What would make your ÖZARA membership exceptionally worthwhile this year?", is_required: false, is_confidential: false, default_visibility: 'shared' }
];

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ onBack, onCompleteSignUp }) => {
  const insets = useSafeAreaInsets();
  const {
    refreshUserData,
    switchPersona,
    pendingAccessEmail,
    setPendingAccessEmail,
    setAppView,
    verifiedPhone,
  } = useClub();

  const activePhone = verifiedPhone || OzaraStorage.getItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE) || '';

  // Navigation mode within SignUp flow - only restore valid interactive steps
  const [viewMode, setViewModeState] = useState<GateView>(() => {
    const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.SIGNUP_STEP) as GateView | null;
    if (saved && ['check_token', 'request_access', 'register_form', 'questionnaire_page'].includes(saved)) {
      return saved;
    }
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
    return pendingAccessEmail || OzaraStorage.getItem(OZARA_STORAGE_KEYS.PENDING_EMAIL) || '';
  });

  // Token entry state
  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Access request form state
  const [reqFullName, setReqFullName] = useState('');
  const [reqEmail, setReqEmail] = useState(submittedEmail || '');
  const [reqRole, setReqRole] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');

  // Approved token state
  const [approvedToken, setApprovedToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [isApproved, setIsApproved] = useState(false);

  // Registration form state
  const [fullName, setFullName] = useState('');
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
              setAvatarUrl(event.target.result as string);
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
                if (val && val.trim()) setAvatarUrl(val.trim());
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

  // Questions & Answers state
  const [questions] = useState<QuestionDefinition[]>(CANONICAL_QUESTIONS);
  const [answers, setAnswers] = useState<Record<number, { value: string; visibility: 'shared' | 'private' }>>({});
  const [registeredUserId, setRegisteredUserId] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID) || '';
  });
  const [isSavingAnswers, setIsSavingAnswers] = useState(false);

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        value,
        visibility: prev[questionId]?.visibility || (questionId === 23 ? 'private' : 'shared'),
      },
    }));
  };

  const toggleAnswerVisibility = (questionId: number) => {
    if (questionId === 23) return;
    setAnswers((prev) => {
      const current = prev[questionId]?.visibility || 'shared';
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
    (a) => a && a.value && a.value.trim().length > 0
  ).length;

  const isQ18Answered = Boolean(
    answers[18] && answers[18].value && answers[18].value.trim().length > 0
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
      const proceed = Platform.OS === 'web'
        ? window.confirm("Question 18 ('12-month strategic milestone') is required to mark your profile verified. You may enter the club now, but your profile will show an incomplete badge until answered. Would you like to enter anyway?")
        : true;
      if (!proceed) return;
    }

    try {
      setIsSavingAnswers(true);
      const answerPayload = Object.entries(answers)
        .filter(([_, item]) => item.value && item.value.trim().length > 0)
        .map(([qIdStr, item]) => ({
          question_id: parseInt(qIdStr, 10),
          value: item.value.trim(),
          visibility: item.visibility || 'shared',
        }));

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
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.APP_VIEW, 'tabs');
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, targetUserId);
      setAppView('tabs');

      const welcomeMsg = `Welcome to ÖZARA, ${fullName || 'Member'}! Your membership profile is activated.`;
      if (Platform.OS === 'web') window.alert(welcomeMsg);
      else Alert.alert('Welcome to ÖZARA', welcomeMsg);
      onCompleteSignUp();
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
              setViewMode('check_token');
            } else if (viewMode === 'request_access') {
              setViewMode('check_token');
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
            <View style={styles.badgeRow}>
              <View style={styles.cyanPill}>
                <Ionicons name="sparkles" size={11} color={OzaraTheme.colors.accentCyan} style={{ marginRight: 4 }} />
                <Text style={styles.cyanPillText}>MEMBER QUESTIONNAIRE • 30 QUESTIONS</Text>
              </View>
            </View>

            <Text style={styles.title}>Profile Questions</Text>
            <Text style={styles.subtitle}>
              Answer what resonates with your strategic focus. Question 18 is required to verify your profile; all others are optional.
            </Text>

            {/* Member Identity Preview */}
            <View style={styles.memberBriefCard}>
              <Image
                source={{ uri: resolveImageUrl(avatarUrl) }}
                style={styles.memberBriefAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberBriefName}>{fullName || 'Private Member'}</Text>
                <Text style={styles.memberBriefHeadline} numberOfLines={1}>
                  {headline || 'Verified Executive'} • {chapter} Chapter
                </Text>
              </View>
            </View>

            {/* Minimalist Progress Header */}
            <View style={styles.statsStrip}>
              <View style={styles.statsCol}>
                <Text style={styles.statsLabel}>PROGRESS</Text>
                <Text style={styles.statsValue}>{answeredCount} of 30 Answered</Text>
              </View>
              <View style={[styles.q18StatusBadge, isQ18Answered ? styles.q18Answered : styles.q18Pending]}>
                <Ionicons
                  name={isQ18Answered ? "checkmark-circle" : "alert-circle-outline"}
                  size={14}
                  color={isQ18Answered ? "#10b981" : "#fbbf24"}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.q18StatusText, isQ18Answered ? { color: "#10b981" } : { color: "#fbbf24" }]}>
                  {isQ18Answered ? "Question 18: Answered ✓" : "Question 18: Required ★"}
                </Text>
              </View>
            </View>

            {/* List of 30 Questions */}
            <View style={{ marginTop: 16 }}>
              {questions.map((q) => {
                const isQ18 = q.id === 18;
                const isQ23 = q.id === 23;
                const ans = answers[q.id];
                const currentVal = ans?.value || '';
                const currentVis = ans?.visibility || q.default_visibility;

                return (
                  <View
                    key={q.id}
                    style={[
                      styles.qCard,
                      isQ18 && styles.qCardRequired,
                      isQ23 && styles.qCardConfidential,
                    ]}>
                    {/* Top Row: Question number & visibility toggle */}
                    <View style={styles.qCardTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.qNumPill, isQ18 && styles.qNumPillRequired, isQ23 && styles.qNumPillConfidential]}>
                          <Text style={[styles.qNumPillText, isQ18 && styles.qNumPillTextRequired, isQ23 && styles.qNumPillTextConfidential]}>
                            Q{q.id < 10 ? `0${q.id}` : q.id}
                          </Text>
                        </View>
                        {isQ18 && (
                          <View style={styles.requiredPill}>
                            <Text style={styles.requiredPillText}>REQUIRED</Text>
                          </View>
                        )}
                        {isQ23 && (
                          <View style={styles.confidentialPill}>
                            <Ionicons name="lock-closed" size={10} color="#fbbf24" style={{ marginRight: 3 }} />
                            <Text style={styles.confidentialPillText}>CONFIDENTIAL (FOUNDERS ONLY)</Text>
                          </View>
                        )}
                      </View>

                      {/* Visibility Toggle */}
                      {!isQ23 ? (
                        <TouchableOpacity
                          style={[styles.visToggleBtn, currentVis === 'private' && styles.visToggleBtnPrivate]}
                          onPress={() => toggleAnswerVisibility(q.id)}
                          activeOpacity={0.75}>
                          <Ionicons
                            name={currentVis === 'private' ? "lock-closed" : "eye-outline"}
                            size={11}
                            color={currentVis === 'private' ? "#fbbf24" : OzaraTheme.colors.accentCyan}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.visToggleText, currentVis === 'private' && { color: "#fbbf24" }]}>
                            {currentVis === 'private' ? "Private" : "Shared"}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.visLockedPill}>
                          <Ionicons name="lock-closed" size={10} color="#fbbf24" style={{ marginRight: 3 }} />
                          <Text style={styles.visLockedText}>Locked Private</Text>
                        </View>
                      )}
                    </View>

                    {/* Question Prompt */}
                    <Text style={[styles.qPromptText, isQ18 && styles.qPromptTextRequired]}>
                      {q.prompt}
                    </Text>

                    {isQ23 && (
                      <Text style={styles.q23HintText}>
                        Visible solely to Alexandra Hill and Julia Shchukina for confidential founder guidance. Never exposed to search or member profiles.
                      </Text>
                    )}

                    {/* Standardized Selection Options (Clean data chips) */}
                    {QUESTION_SUGGESTIONS[q.id] && (
                      <View style={styles.qSugBlock}>
                        <Text style={styles.qSugTitle}>CURATED OPTIONS (TAP TO SELECT):</Text>
                        <View style={styles.qSugRow}>
                          {QUESTION_SUGGESTIONS[q.id].map((sug, sIdx) => {
                            const isSelected = currentVal.includes(sug);
                            return (
                              <TouchableOpacity
                                key={sIdx}
                                style={[styles.qSugChip, isSelected && styles.qSugChipSelected]}
                                onPress={() => {
                                  if ([2, 5, 27].includes(q.id)) {
                                    if (isSelected) {
                                      const parts = currentVal
                                        .split(', ')
                                        .map((p: string) => p.trim())
                                        .filter((p: string) => p !== sug && p.length > 0);
                                      handleAnswerChange(q.id, parts.join(', '));
                                    } else {
                                      const newVal = currentVal ? `${currentVal}, ${sug}` : sug;
                                      handleAnswerChange(q.id, newVal);
                                    }
                                  } else {
                                    handleAnswerChange(q.id, sug);
                                  }
                                }}
                                activeOpacity={0.75}>
                                <Text style={[styles.qSugChipText, isSelected && styles.qSugChipTextSelected]}>
                                  {isSelected ? `✓ ${sug}` : `+ ${sug}`}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Minimalist Input Field */}
                    <TextInput
                      style={[styles.qInput, isQ18 && !currentVal.trim() && styles.qInputRequiredEmpty]}
                      placeholder={isQ18 ? "Enter your 12-month priority milestone (required)..." : "Your response..."}
                      placeholderTextColor={OzaraTheme.colors.textDim}
                      multiline
                      value={currentVal}
                      onChangeText={(text) => handleAnswerChange(q.id, text)}
                    />
                  </View>
                );
              })}
            </View>

            {/* Bottom Complete Profile Action Card */}
            <View style={styles.bottomCompleteCard}>
              <View style={styles.bottomCompleteInfo}>
                <Ionicons
                  name={isQ18Answered ? "shield-checkmark" : "information-circle-outline"}
                  size={20}
                  color={isQ18Answered ? "#10b981" : "#fbbf24"}
                />
                <Text style={styles.bottomCompleteHint}>
                  {isQ18Answered
                    ? "✓ Question 18 is answered. Your profile will be marked verified immediately."
                    : "★ Question 18 is required to mark your profile verified. You may enter now and complete it anytime."}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, isSavingAnswers && styles.submitBtnDisabled]}
                onPress={handleCompleteQuestionnaire}
                disabled={isSavingAnswers}
                activeOpacity={0.85}>
                {isSavingAnswers ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Complete Profile & Enter Club →</Text>
                )}
              </TouchableOpacity>
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
              autoCapitalize="none"
              clearButtonMode="while-editing"
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 9,
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
    gap: 12,
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    padding: 12,
    marginTop: 16,
  },
  memberBriefAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: OzaraTheme.colors.accentCyan,
  },
  memberBriefName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  memberBriefHeadline: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
});
