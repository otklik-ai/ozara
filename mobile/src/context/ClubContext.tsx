/**
 * ÖZARA Global Club Context
 * Manages active persona, user switching, navigation views, and persistent onboarding/session state.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService, Persona } from '../services/api';
import { OzaraStorage, OZARA_STORAGE_KEYS } from '../services/storage';

export type AppView = 'welcome' | 'signup' | 'tabs' | 'conditions';

interface ClubContextType {
  personas: Persona[];
  currentUser: Persona | null;
  currentUserId: string;
  switchPersona: (id: string) => void;
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
  resetOnboarding: () => void;
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export const ClubProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  
  // Persisted Session & Onboarding state
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID) || 'usr_elena';
  });

  const [conditionsAgreed, setConditionsAgreed] = useState<boolean>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.CONDITIONS_AGREED) === 'true';
  });

  const [pendingAccessEmail, setPendingAccessEmailState] = useState<string>(() => {
    return OzaraStorage.getItem(OZARA_STORAGE_KEYS.PENDING_EMAIL) || '';
  });

  const [appView, setAppViewState] = useState<AppView>(() => {
    const saved = OzaraStorage.getItem(OZARA_STORAGE_KEYS.APP_VIEW) as AppView | null;
    if (saved && ['welcome', 'signup', 'tabs', 'conditions'].includes(saved)) {
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

  const resetOnboarding = () => {
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.APP_VIEW);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_EMAIL);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.SIGNUP_STEP);
    setPendingAccessEmailState('');
    setAppView('welcome');
  };

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
      if (!data.some(p => p.id === currentUserId) && data.length > 0) {
        setCurrentUserId(data[0].id);
        OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, data[0].id);
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
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, id);
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
        resetOnboarding,
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
