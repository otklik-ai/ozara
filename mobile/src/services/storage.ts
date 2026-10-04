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
