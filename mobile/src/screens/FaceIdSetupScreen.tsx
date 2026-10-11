/**
 * ÖZARA Mobile: Optional Face ID Setup Screen
 * Appears immediately following successful invitation validation and phone verification.
 * 
 * Invariants:
 * - Minimalist ÖZARA navy layout (#0B1020), white typography, violet accents (#7C3AED).
 * - Simple outline illustration combining a lock and facial recognition brackets.
 * - Headline: “A familiar face. Secure access.”
 * - Description: “Use Face ID to unlock ÖZARA on this device.” (adapts dynamically to Touch ID or Biometrics).
 * - Primary button: “Use Face ID”
 * - Secondary option: “Skip”
 * - Genuine device authentication: expo-local-authentication on native, WebAuthn platform passkey on web.
 * - If unsupported, automatically skips directly to Welcome / Create Account.
 * - If cancelled or fails, allows retrying or skipping.
 * - Carries preference through to registration without adding a separate PIN.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import { OzaraStorage, OZARA_STORAGE_KEYS } from '../services/storage';

interface FaceIdSetupScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  onSkip: () => void;
  memberEmail?: string;
  memberFullName?: string;
}

export const FaceIdSetupScreen: React.FC<FaceIdSetupScreenProps> = ({
  onBack,
  onSuccess,
  onSkip,
  memberEmail,
  memberFullName,
}) => {
  const insets = useSafeAreaInsets();
  const [biometricLabel, setBiometricLabel] = useState<string>('Face ID');
  const [isCheckingSupport, setIsCheckingSupport] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check genuine device authentication support on mount
  useEffect(() => {
    let isMounted = true;

    const checkSupport = async () => {
      if (Platform.OS === 'web') {
        if (
          typeof window === 'undefined' ||
          !window.PublicKeyCredential ||
          typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
        ) {
          // Unsupported on web browser -> automatically skip
          if (isMounted) onSkip();
          return;
        }

        try {
          const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (!available) {
            if (isMounted) onSkip();
            return;
          }

          // Detect device brand / OS for label adaptation
          const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
          if (/iPhone|iPad|iPod/i.test(ua)) {
            setBiometricLabel('Face ID');
          } else if (/Macintosh|Mac OS X/i.test(ua)) {
            setBiometricLabel('Touch ID');
          } else if (/Android/i.test(ua)) {
            setBiometricLabel('Biometrics');
          } else if (/Windows/i.test(ua)) {
            setBiometricLabel('Windows Hello');
          } else {
            setBiometricLabel('Biometrics');
          }

          if (isMounted) setIsCheckingSupport(false);
        } catch {
          if (isMounted) onSkip();
        }
      } else {
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (!hasHardware || !isEnrolled) {
            if (isMounted) onSkip();
            return;
          }

          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricLabel('Face ID');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricLabel(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
          } else {
            setBiometricLabel('Biometrics');
          }

          if (isMounted) setIsCheckingSupport(false);
        } catch {
          if (isMounted) onSkip();
        }
      }
    };

    checkSupport();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setAuthError(null);

    if (Platform.OS === 'web') {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const email =
          memberEmail ||
          OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL) ||
          'member@ozara.club';
        const name =
          memberFullName ||
          OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME) ||
          'ÖZARA Member';

        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: 'ÖZARA', id: window.location.hostname },
            user: {
              id: userId,
              name: email,
              displayName: name,
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' }, // ES256
              { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        });

        if (credential) {
          OzaraStorage.setItem(OZARA_STORAGE_KEYS.BIOMETRICS_ENABLED, 'true');
          OzaraStorage.setItem(OZARA_STORAGE_KEYS.FACE_ID_ENABLED, 'true');
          onSuccess();
        } else {
          setAuthError('Authentication was not completed. You can try again or skip.');
        }
      } catch (err: any) {
        console.warn('[FaceIdSetup] Web biometric error:', err);
        if (err.name === 'NotAllowedError') {
          setAuthError('Authentication was cancelled. You can try again or skip.');
        } else {
          setAuthError('Device authentication failed. You can try again or skip.');
        }
      } finally {
        setIsAuthenticating(false);
      }
    } else {
      try {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: `Unlock ÖZARA with ${biometricLabel}`,
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (res.success) {
          OzaraStorage.setItem(OZARA_STORAGE_KEYS.BIOMETRICS_ENABLED, 'true');
          OzaraStorage.setItem(OZARA_STORAGE_KEYS.FACE_ID_ENABLED, 'true');
          onSuccess();
        } else {
          setAuthError('Authentication was not completed. You can try again or skip.');
        }
      } catch (err: any) {
        console.warn('[FaceIdSetup] Native biometric error:', err);
        setAuthError('Authentication error. You can try again or skip.');
      } finally {
        setIsAuthenticating(false);
      }
    }
  };

  const handleSkip = () => {
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.BIOMETRICS_ENABLED, 'false');
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.FACE_ID_ENABLED, 'false');
    onSkip();
  };

  // If still checking support on mount, render empty navy canvas to prevent UI flicker
  if (isCheckingSupport) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B1020" />
        <ActivityIndicator size="small" color="#7C3AED" />
      </View>
    );
  }

  const primaryButtonText = `Use ${biometricLabel}`;
  const descriptionText = `Use ${biometricLabel} to unlock ÖZARA on this device.`;

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1020" />

      {/* Top Header / Back Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.topBarCenterPlaceholder} />
        <View style={styles.topBarRightPlaceholder} />
      </View>

      {/* Main Content Area: Generous Spacing & Outline Illustration */}
      <View style={styles.contentBody}>
        {/* Outline Illustration: Facial Recognition Brackets + Central Lock */}
        <View style={styles.illustrationWrapper}>
          <View style={styles.haloGlow} />

          <View style={styles.bracketContainer}>
            {/* 4 Corner Face Recognition Brackets */}
            <View style={[styles.bracket, styles.bracketTopLeft]} />
            <View style={[styles.bracket, styles.bracketTopRight]} />
            <View style={[styles.bracket, styles.bracketBottomLeft]} />
            <View style={[styles.bracket, styles.bracketBottomRight]} />

            {/* Central Outline Lock */}
            <View style={styles.lockContainer}>
              {/* Shackle */}
              <View style={styles.lockShackle} />
              {/* Body */}
              <View style={styles.lockBody}>
                {/* Keyhole */}
                <View style={styles.lockKeyhole} />
              </View>
            </View>
          </View>
        </View>

        {/* Typography: Headline & Description */}
        <View style={styles.textContainer}>
          <Text style={styles.headline}>A familiar face. Secure access.</Text>
          <Text style={styles.description}>{descriptionText}</Text>
        </View>

        {/* Optional Auth Notice / Retry Banner */}
        {authError && (
          <View style={styles.errorBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#fbbf24" style={styles.errorIcon} />
            <Text style={styles.errorText}>{authError}</Text>
          </View>
        )}
      </View>

      {/* Bottom Sticky Action Controls */}
      <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        <TouchableOpacity
          style={[styles.primaryButton, isAuthenticating && styles.primaryButtonDisabled]}
          onPress={handleAuthenticate}
          disabled={isAuthenticating}
          activeOpacity={0.85}>
          {isAuthenticating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isAuthenticating}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B1020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 52,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  topBarCenterPlaceholder: {
    flex: 1,
  },
  topBarRightPlaceholder: {
    width: 40,
  },
  contentBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  illustrationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 44,
    position: 'relative',
  },
  haloGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  bracketContainer: {
    width: 140,
    height: 140,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#7C3AED',
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 10,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 10,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 10,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 10,
  },
  lockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockShackle: {
    width: 32,
    height: 28,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    borderBottomWidth: 0,
    marginBottom: -2,
  },
  lockBody: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#0B1020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockKeyhole: {
    width: 3.5,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#7C3AED',
  },
  textContainer: {
    alignItems: 'center',
    maxWidth: 340,
  },
  headline: {
    fontSize: 27,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 14,
    lineHeight: 34,
    fontFamily: OzaraTheme.typography.fonts.bold,
  },
  description: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: OzaraTheme.typography.fonts.regular,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 24,
    maxWidth: 330,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#fbbf24',
    lineHeight: 18,
    flex: 1,
  },
  bottomControls: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    fontFamily: OzaraTheme.typography.fonts.bold,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94a3b8',
    fontFamily: OzaraTheme.typography.fonts.medium,
  },
});
