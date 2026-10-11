/**
 * ÖZARA Mobile: Welcome / Create Account Screen
 * Appears following optional Face ID setup after phone & invitation validation.
 * 
 * Invariants:
 * - Minimal clean layout matching Axevil-style luxury reference.
 * - Small header: “Create account”
 * - Headline: “Welcome to ÖZARA”
 * - Description: “Your next chapter starts here.”
 * - Two fields only: Full name and Email with simple underlined inputs.
 * - Autofill enabled for name and email.
 * - Agreement notice: “By creating an account, you agree to our Terms & Conditions and acknowledge our Privacy Policy.”
 * - Terms & Conditions and Privacy Policy links open dedicated readable modals with configurable content.
 * - Primary button: “Create account” (disabled until both valid, loading state, error banners, duplicate prevention).
 * - Redeems single-use invitation atomically upon successful account creation.
 * - Records accepted Terms version ('2026-10-v1') and timestamp.
 * - Advances to member profile setup (30-question questionnaire), preserving progress.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import { ApiService, CURRENT_ACCESS_CONDITIONS_VERSION } from '../services/api';
import { OzaraStorage, OZARA_STORAGE_KEYS } from '../services/storage';
import { useClub } from '../context/ClubContext';

interface CreateAccountScreenProps {
  onBack: () => void;
  onAccountCreated: (userId: string) => void;
}

interface LegalDoc {
  title: string;
  version: string;
  last_updated: string;
  sections: Array<{ heading: string; content: string }>;
}

export const CreateAccountScreen: React.FC<CreateAccountScreenProps> = ({
  onBack,
  onAccountCreated,
}) => {
  const insets = useSafeAreaInsets();
  const { switchPersona } = useClub();

  // Inputs state
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isEmailLocked, setIsEmailLocked] = useState<boolean>(false);

  // Focus and inline validation state
  const [isNameFocused, setIsNameFocused] = useState<boolean>(false);
  const [isEmailFocused, setIsEmailFocused] = useState<boolean>(false);
  const [nameTouched, setNameTouched] = useState<boolean>(false);
  const [emailTouched, setEmailTouched] = useState<boolean>(false);

  // Submission & error state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Legal Modal states
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [legalData, setLegalData] = useState<LegalDoc | null>(null);
  const [isLegalLoading, setIsLegalLoading] = useState<boolean>(false);

  // Prepopulate from validated invitation and storage on mount
  useEffect(() => {
    const storedInviteEmail = OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL);
    const storedInviteName = OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME);
    const savedName = OzaraStorage.getItem(OZARA_STORAGE_KEYS.ACCOUNT_FULL_NAME);
    const savedEmail = OzaraStorage.getItem(OZARA_STORAGE_KEYS.ACCOUNT_EMAIL);

    if (savedName) {
      setFullName(savedName);
    } else if (storedInviteName) {
      setFullName(storedInviteName);
    }

    if (storedInviteEmail) {
      setEmail(storedInviteEmail);
      setIsEmailLocked(true);
    } else if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Validation helpers
  const isValidName = fullName.trim().length >= 2;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = emailRegex.test(email.trim());
  const isFormValid = isValidName && isValidEmail;

  // Persist name and email progress
  const handleNameChange = (val: string) => {
    setFullName(val);
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.ACCOUNT_FULL_NAME, val);
    if (errorMessage) setErrorMessage(null);
  };

  const handleEmailChange = (val: string) => {
    if (isEmailLocked) return;
    setEmail(val);
    OzaraStorage.setItem(OZARA_STORAGE_KEYS.ACCOUNT_EMAIL, val);
    if (errorMessage) setErrorMessage(null);
  };

  // Open dedicated legal documents
  const handleOpenLegal = async (type: 'terms' | 'privacy') => {
    setActiveLegalModal(type);
    setIsLegalLoading(true);
    try {
      if (type === 'terms') {
        const res = await ApiService.getLegalTerms();
        setLegalData(res);
      } else {
        const res = await ApiService.getLegalPrivacy();
        setLegalData(res);
      }
    } catch (err) {
      console.warn('[CreateAccount] Error fetching legal content:', err);
      // Fallback local content
      if (type === 'terms') {
        setLegalData({
          title: 'ÖZARA Private Membership Terms & Conditions',
          version: '2026-10-v1',
          last_updated: 'October 2026',
          sections: [
            {
              heading: '1. Private Community & Invite-Only Membership',
              content:
                'ÖZARA is a confidential, invite-only community for vetted founders, executive operators, and accredited investors. Membership facilitates direct peer networking, curated gatherings, and informational property showcases.',
            },
            {
              heading: '2. Identity Integrity & Invitation Transfer Restriction',
              content:
                'Invitations and access tokens are strictly single-use and bound 1:1 to verified member identities. Selling, transferring, or duplicating invitation credentials without leadership approval is prohibited.',
            },
            {
              heading: '3. Mutual Discretion & Confidentiality',
              content:
                'Discussions, contact details, and intelligence shared within ÖZARA private gatherings or direct member communications are confidential to the circle.',
            },
            {
              heading: '4. No Automated Financial Execution or Solicitation',
              content:
                'ÖZARA does not provide automated investment advice, handle fund custody, or guarantee returns. Unsolicited commercial solicitations and high-pressure fundraising are prohibited.',
            },
          ],
        });
      } else {
        setLegalData({
          title: 'ÖZARA Privacy Policy',
          version: '2026-10-v1',
          last_updated: 'October 2026',
          sections: [
            {
              heading: '1. Minimalist Data Collection Guarantee',
              content:
                'We collect only information you voluntarily submit to facilitate community interactions: full name, verified business email, verified phone number, chapter, and optional questionnaire responses. We strictly never collect date of birth, government ID numbers, bank account numbers, personal net worth, or real-time GPS locations.',
            },
            {
              heading: '2. Permanent Lock on Sensitive Information',
              content:
                'Question 23 responses are permanently confidential and accessible exclusively to ÖZARA founders (Alexandra and Julia). Question 23 has no sharing toggle and is mathematically excluded from search indexes, public member profiles, and recommendation algorithms.',
            },
            {
              heading: '3. Two-Person Governance Protection',
              content:
                'Bulk export of member records requires affirmative cryptographic approval from two independent administrators (Alexandra and Julia).',
            },
          ],
        });
      }
    } finally {
      setIsLegalLoading(false);
    }
  };

  // Submit Account Creation
  const handleCreateAccount = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const verifiedPhone =
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.VERIFIED_PHONE) || undefined;
    const invitationToken =
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_CODE) ||
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.PENDING_TOKEN) ||
      undefined;
    const isBiometricsEnabled =
      OzaraStorage.getItem(OZARA_STORAGE_KEYS.BIOMETRICS_ENABLED) === 'true';

    try {
      const res = await ApiService.registerUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: verifiedPhone,
        token: invitationToken,
        accepted_terms_version: '2026-10-v1',
        accepted_terms_at: new Date().toISOString(),
        biometrics_enabled: isBiometricsEnabled,
        accepted_conditions_version: CURRENT_ACCESS_CONDITIONS_VERSION,
      });

      if (res && res.success && res.user) {
        const createdUserId = res.userId || res.user.id;
        OzaraStorage.setItem(OZARA_STORAGE_KEYS.CURRENT_USER_ID, createdUserId);
        OzaraStorage.setItem(OZARA_STORAGE_KEYS.TERMS_ACCEPTED_VERSION, '2026-10-v1');

        // Switch to the newly created member session
        switchPersona(createdUserId);

        // Advance to questionnaire profile setup
        onAccountCreated(createdUserId);
      } else {
        setErrorMessage(
          (res as any)?.error || 'Unable to create account. Please check your details.'
        );
      }
    } catch (err: any) {
      console.error('[CreateAccount] Registration failed:', err);
      const msg = err.message || 'An error occurred during account creation. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1020" />

      {/* Top Header Bar with Back Button & Small Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.smallHeader}>Create account</Text>

        <View style={styles.topBarRightPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 16 },
          ]}
          keyboardShouldPersistTaps="handled">
          {/* Headline & Description */}
          <View style={styles.copyHeader}>
            <Text style={styles.headline}>Welcome to ÖZARA</Text>
            <Text style={styles.description}>Your next chapter starts here.</Text>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={17} color="#ef4444" style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Form Fields: Only Full Name and Email */}
          <View style={styles.formContainer}>
            {/* Field 1: Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Full name</Text>
              <TextInput
                style={[
                  styles.underlinedInput,
                  isNameFocused && styles.underlinedInputFocused,
                  nameTouched && !isValidName && styles.underlinedInputError,
                ]}
                placeholder="Marcus Vance"
                placeholderTextColor="#64748b"
                value={fullName}
                onChangeText={handleNameChange}
                onFocus={() => {
                  setIsNameFocused(true);
                  setNameTouched(true);
                }}
                onBlur={() => setIsNameFocused(false)}
                autoComplete="name"
                textContentType="name"
                keyboardType="default"
                returnKeyType="next"
                editable={!isSubmitting}
              />
              {nameTouched && !isValidName && (
                <Text style={styles.inlineFieldError}>Please enter your full name</Text>
              )}
            </View>

            {/* Field 2: Email */}
            <View style={styles.fieldGroup}>
              <View style={styles.emailLabelRow}>
                <Text style={styles.inputLabel}>Email</Text>
                {isEmailLocked && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#10b981" style={{ marginRight: 4 }} />
                    <Text style={styles.verifiedBadgeText}>Verified via invitation</Text>
                  </View>
                )}
              </View>

              <TextInput
                style={[
                  styles.underlinedInput,
                  isEmailFocused && styles.underlinedInputFocused,
                  emailTouched && !isValidEmail && styles.underlinedInputError,
                  isEmailLocked && styles.underlinedInputLocked,
                ]}
                placeholder="name@company.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={handleEmailChange}
                onFocus={() => {
                  setIsEmailFocused(true);
                  setEmailTouched(true);
                }}
                onBlur={() => setIsEmailFocused(false)}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                editable={!isEmailLocked && !isSubmitting}
              />
              {emailTouched && !isValidEmail && (
                <Text style={styles.inlineFieldError}>Please enter a valid email address</Text>
              )}
            </View>
          </View>

          {/* Spacer to push actions to bottom cleanly */}
          <View style={styles.flexibleSpacer} />

          {/* Bottom Actions Section: Legal Notice + Primary Button */}
          <View style={styles.bottomSection}>
            {/* Legal Agreement Copy */}
            <Text style={styles.legalNoticeText}>
              By creating an account, you agree to our{' '}
              <Text
                style={styles.legalLink}
                onPress={() => handleOpenLegal('terms')}>
                Terms & Conditions
              </Text>{' '}
              and acknowledge our{' '}
              <Text
                style={styles.legalLink}
                onPress={() => handleOpenLegal('privacy')}>
                Privacy Policy
              </Text>
              .
            </Text>

            {/* Primary Action Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!isFormValid || isSubmitting) && styles.primaryButtonDisabled,
              ]}
              onPress={handleCreateAccount}
              disabled={!isFormValid || isSubmitting}
              activeOpacity={0.85}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dedicated Legal Modal (Terms & Conditions / Privacy Policy) */}
      <Modal
        visible={activeLegalModal !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActiveLegalModal(null)}>
        <SafeAreaView style={styles.legalModalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#0B1020" />

          {/* Modal Header */}
          <View style={[styles.legalModalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setActiveLegalModal(null)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>

            <Text style={styles.legalModalTitle}>
              {activeLegalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
            </Text>

            <TouchableOpacity
              style={styles.legalDoneBtn}
              onPress={() => setActiveLegalModal(null)}
              activeOpacity={0.75}>
              <Text style={styles.legalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          {isLegalLoading ? (
            <View style={styles.legalLoadingWrap}>
              <ActivityIndicator size="large" color="#7C3AED" />
            </View>
          ) : (
            <ScrollView
              style={styles.legalScrollView}
              contentContainerStyle={[
                styles.legalScrollContent,
                { paddingBottom: Math.max(insets.bottom, 24) + 24 },
              ]}>
              <Text style={styles.legalDocTitle}>{legalData?.title}</Text>
              <Text style={styles.legalDocMeta}>
                Version {legalData?.version} • Updated {legalData?.last_updated}
              </Text>

              <View style={styles.legalDivider} />

              {legalData?.sections?.map((sec, idx) => (
                <View key={idx} style={styles.legalSection}>
                  <Text style={styles.legalHeading}>{sec.heading}</Text>
                  <Text style={styles.legalBody}>{sec.content}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
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
  smallHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.2,
    fontFamily: OzaraTheme.typography.fonts.medium,
  },
  topBarRightPlaceholder: {
    width: 40,
  },
  copyHeader: {
    marginTop: 20,
    marginBottom: 36,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
    fontFamily: OzaraTheme.typography.fonts.bold,
  },
  description: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 24,
    fontFamily: OzaraTheme.typography.fonts.regular,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  errorIcon: {
    marginRight: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#f87171',
    lineHeight: 18,
    fontFamily: OzaraTheme.typography.fonts.medium,
  },
  formContainer: {
    gap: 32,
  },
  fieldGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontFamily: OzaraTheme.typography.fonts.medium,
  },
  emailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: OzaraTheme.typography.fonts.medium,
  },
  underlinedInput: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#334155',
    color: '#ffffff',
    fontSize: 18,
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontFamily: OzaraTheme.typography.fonts.regular,
  },
  underlinedInputFocused: {
    borderBottomColor: '#7C3AED',
  },
  underlinedInputError: {
    borderBottomColor: '#ef4444',
  },
  underlinedInputLocked: {
    color: '#cbd5e1',
    borderBottomColor: '#1e293b',
  },
  inlineFieldError: {
    fontSize: 12,
    color: '#f87171',
    marginTop: 4,
    fontFamily: OzaraTheme.typography.fonts.regular,
  },
  flexibleSpacer: {
    flex: 1,
    minHeight: 48,
  },
  bottomSection: {
    marginTop: 'auto',
    gap: 18,
    paddingTop: 16,
  },
  legalNoticeText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: OzaraTheme.typography.fonts.regular,
  },
  legalLink: {
    color: '#a78bfa',
    fontWeight: '600',
    textDecorationLine: 'underline',
    fontFamily: OzaraTheme.typography.fonts.medium,
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
    backgroundColor: '#3b2063',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    fontFamily: OzaraTheme.typography.fonts.bold,
  },
  // Dedicated Legal Modal Styles
  legalModalContainer: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  legalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  legalModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: OzaraTheme.typography.fonts.bold,
  },
  legalDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  legalDoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a78bfa',
    fontFamily: OzaraTheme.typography.fonts.medium,
  },
  legalLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalScrollView: {
    flex: 1,
  },
  legalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  legalDocTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    fontFamily: OzaraTheme.typography.fonts.bold,
  },
  legalDocMeta: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    fontFamily: OzaraTheme.typography.fonts.regular,
  },
  legalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  legalSection: {
    marginBottom: 24,
  },
  legalHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    fontFamily: OzaraTheme.typography.fonts.bold,
  },
  legalBody: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    fontFamily: OzaraTheme.typography.fonts.regular,
  },
});
