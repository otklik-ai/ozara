/**
 * ÖZARA Mobile: Cross-Platform Persistent Storage Service
 * Provides resilient persistence across Web (localStorage) and Native environments.
 * Used for session resumption, onboarding state, conditions acceptance, and pending invite tokens.
 */

import { Platform } from 'react-native';

export const OZARA_STORAGE_KEYS = {
  APP_VIEW: 'ozara_app_view',
  HAS_SEEN_INTRO: 'ozara_has_seen_intro',
  CONDITIONS_AGREED: 'ozara_conditions_agreed',
  PENDING_EMAIL: 'ozara_pending_email',
  PENDING_TOKEN: 'ozara_pending_token',
  CURRENT_USER_ID: 'ozara_current_user_id',
  SIGNUP_STEP: 'ozara_signup_step',
  VERIFIED_PHONE: 'ozara_verified_phone',
  INVITATION_CODE: 'ozara_invitation_code',
  INVITATION_EMAIL: 'ozara_invitation_email',
  INVITATION_FULL_NAME: 'ozara_invitation_full_name',
  AUTH_MODE: 'ozara_auth_mode',
  FACE_ID_ENABLED: 'ozara_face_id_enabled',
  BIOMETRICS_ENABLED: 'ozara_biometrics_enabled',
  TERMS_ACCEPTED_VERSION: 'ozara_terms_accepted_version',
  ACCOUNT_FULL_NAME: 'ozara_account_full_name',
  ACCOUNT_EMAIL: 'ozara_account_email',
  WELCOME_SLIDE_INDEX: 'ozara_welcome_slide_index',
  QUESTIONNAIRE_DRAFT_ANSWERS: 'ozara_questionnaire_draft_answers',
  QUESTIONNAIRE_DRAFT_COUNTRIES: 'ozara_questionnaire_draft_countries',
} as const;

class StorageService {
  readonly KEYS = OZARA_STORAGE_KEYS;
  private memoryStore: Map<string, string> = new Map();

  private isWebStorageAvailable(): boolean {
    if (Platform.OS !== 'web') return false;
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    try {
      if (this.isWebStorageAvailable()) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[StorageService] Failed to read ${key}:`, e);
    }
    return this.memoryStore.get(key) || null;
  }

  setItem(key: string, value: string): void {
    try {
      if (this.isWebStorageAvailable()) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[StorageService] Failed to write ${key}:`, e);
    }
    this.memoryStore.set(key, value);
  }

  removeItem(key: string): void {
    try {
      if (this.isWebStorageAvailable()) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[StorageService] Failed to remove ${key}:`, e);
    }
    this.memoryStore.delete(key);
  }
}

export const OzaraStorage = new StorageService();
