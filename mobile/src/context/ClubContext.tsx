/**
 * ÖZARA Global Club Context
 * Manages active persona, user switching, navigation views, and persistent onboarding/session state.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService, Persona } from '../services/api';
import { OzaraStorage, OZARA_STORAGE_KEYS } from '../services/storage';

export type AppView = 'welcome' | 'invitation' | 'phone_auth' | 'face_id_setup' | 'create_account' | 'signup' | 'tabs' | 'conditions';

export type AuthMode = 'new_member' | 'sign_in';

interface ClubContextType {
  personas: Persona[];
  currentUser: Persona | null;
  currentUserId: string;
  switchPersona: (id: string) => void;
  signOut: () => void;
  profileDrawerUserId: string | null;
  openProfile: (userId?: string) => void;
  closeProfile: () => void;
  isLoading: boolean;
  refreshUserData: () => Promise<void>;
  appView: AppView;
  setAppView: (view: AppView) => void;
  conditionsReturnView: AppView;
  openConditions: (returnTo?: AppView) => void;
  closeConditions: () => void;
  conditionsAgreed: boolean;
  setConditionsAgreedState: (agreed: boolean) => void;
  pendingAccessEmail: string;
  setPendingAccessEmail: (email: string) => void;
  verifiedPhone: string;
  setVerifiedPhone: (phone: string) => void;
  invitationCode: string;
  setInvitationCode: (code: string) => void;
  invitationEmail: string;
  setInvitationEmail: (email: string) => void;
  invitationFullName: string;
  setInvitationFullName: (name: string) => void;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  welcomeSlideIndex: number;
  setWelcomeSlideIndex: (index: number) => void;
  resetOnboarding: () => void;
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export const ClubProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  
  // Persisted Session & Onboarding state - Strictly defaults to empty (no auto-login)
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID) || '';
  });

  const [conditionsAgreed, setConditionsAgreed] = useState<boolean>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.CONDITIONS_AGREED) === 'true';
  });

  const [pendingAccessEmail, setPendingAccessEmailState] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.PENDING_EMAIL) || '';
  });

  const [verifiedPhone, setVerifiedPhoneState] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE) || '';
  });

  const [invitationCode, setInvitationCodeState] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_CODE) || '';
  });

  const [invitationEmail, setInvitationEmailState] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL) || '';
  });

  const [invitationFullName, setInvitationFullNameState] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME) || '';
  });

  const [authMode, setAuthModeState] = useState<AuthMode>(() => {
    const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.AUTH_MODE) as AuthMode | null;
    return saved === 'sign_in' ? 'sign_in' : 'new_member';
  });

  const [welcomeSlideIndex, setWelcomeSlideIndexState] = useState<number>(() => {
    const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.WELCOME_SLIDE_INDEX);
    return saved ? parseInt(saved, 10) : 0;
  });

  const setVerifiedPhone = (phone: string) => {
    setVerifiedPhoneState(phone);
    if (phone) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE, phone);
    } else {
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE);
    }
  };

  const setInvitationCode = (code: string) => {
    setInvitationCodeState(code);
    if (code) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.INVITATION_CODE, code);
    } else {
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_CODE);
    }
  };

  const setInvitationEmail = (email: string) => {
    setInvitationEmailState(email);
    if (email) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL, email);
    } else {
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL);
    }
  };

  const setInvitationFullName = (name: string) => {
    setInvitationFullNameState(name);
    if (name) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME, name);
    } else {
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME);
    }
  };

  const setAuthMode = (mode: AuthMode) => {
    setAuthModeState(mode);
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.AUTH_MODE, mode);
  };

  const setWelcomeSlideIndex = (idx: number) => {
    setWelcomeSlideIndexState(idx);
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.WELCOME_SLIDE_INDEX, String(idx));
  };

  const [appView, setAppViewState] = useState<AppView>(() => {
    const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.APP_VIEW) as AppView | null;
    const savedUser = OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    // If not authenticated, always start at welcome screen
    if (!savedUser && (saved === 'tabs' || saved === 'signup')) {
      return 'welcome';
    }
    if (saved && ['welcome', 'invitation', 'phone_auth', 'face_id_setup', 'create_account', 'signup', 'tabs', 'conditions'].includes(saved)) {
      return saved;
    }
    return 'welcome';
  });

  const [profileDrawerUserId, setProfileDrawerUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [conditionsReturnView, setConditionsReturnView] = useState<AppView>('welcome');

  const setAppView = (view: AppView) => {
    setAppViewState(view);
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.APP_VIEW, view);
  };

  const setConditionsAgreedState = (agreed: boolean) => {
    setConditionsAgreed(agreed);
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.CONDITIONS_AGREED, agreed ? 'true' : 'false');
  };

  const setPendingAccessEmail = (email: string) => {
    setPendingAccessEmailState(email);
    if (email) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.PENDING_EMAIL, email);
    } else {
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
    }
  };

  const signOut = () => {
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.APP_VIEW);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.SIGNUP_STEP);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_CODE);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.AUTH_MODE);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.WELCOME_SLIDE_INDEX);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.CONDITIONS_AGREED);
    setCurrentUserId('');
    setPendingAccessEmailState('');
    setVerifiedPhoneState('');
    setInvitationCodeState('');
    setInvitationEmailState('');
    setInvitationFullNameState('');
    setAuthModeState('new_member');
    setWelcomeSlideIndexState(0);
    setConditionsAgreed(false);
    setAppView('welcome');
  };

  const resetOnboarding = signOut;

  const openConditions = (returnTo?: AppView) => {
    if (returnTo) {
      setConditionsReturnView(returnTo);
    } else {
      setConditionsReturnView(appView === 'conditions' ? 'welcome' : appView);
    }
    setAppView('conditions');
  };

  const closeConditions = () => {
    setAppView(conditionsReturnView || 'welcome');
  };

  const loadPersonas = async () => {
    try {
      setIsLoading(true);
      const data = await ApiService.getPersonas();
      setPersonas(data);
      // If current user is no longer in directory, reset session
      if (currentUserId && !data.some(p => p.id === currentUserId)) {
        console.log('[ClubContext] Logged-in user session no longer valid.');
        signOut();
      }
    } catch (err) {
      console.warn('[ClubContext] Error fetching personas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, []);

  const currentUser = personas.find(p => p.id === currentUserId) || null;

  const switchPersona = (id: string) => {
    setCurrentUserId(id);
    if (id) {
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, id);
    } else {
      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID);
    }
  };

  const openProfile = (userId?: string) => {
    setProfileDrawerUserId(userId || currentUserId);
  };

  const closeProfile = () => {
    setProfileDrawerUserId(null);
  };

  const refreshUserData = async () => {
    await loadPersonas();
  };

  return (
    <ClubContext.Provider
      value={{
        personas,
        currentUser,
        currentUserId,
        switchPersona,
        profileDrawerUserId,
        openProfile,
        closeProfile,
        isLoading,
        refreshUserData,
        appView,
        setAppView,
        conditionsReturnView,
        openConditions,
        closeConditions,
        conditionsAgreed,
        setConditionsAgreedState,
        pendingAccessEmail,
        setPendingAccessEmail,
        verifiedPhone,
        setVerifiedPhone,
        invitationCode,
        setInvitationCode,
        invitationEmail,
        setInvitationEmail,
        invitationFullName,
        setInvitationFullName,
        authMode,
        setAuthMode,
        welcomeSlideIndex,
        setWelcomeSlideIndex,
        resetOnboarding,
        signOut,
      }}>
      {children}
    </ClubContext.Provider>
  );
};

export const useClub = (): ClubContextType => {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
};
