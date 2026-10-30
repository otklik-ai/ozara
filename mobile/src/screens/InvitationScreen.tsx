/**
 * ÖZARA Mobile: Invitation Verification & Access Request Screen
 * Ultra-luxury dark navy palette with violet accents and geometric typography.
 *
 * Sequence Invariant:
 * New members must validate their invitation code on the server BEFORE phone verification.
 * An invitation link auto-populates the code automatically.
 *
 * "Request access" allows uninvited visitors to apply directly with:
 * - Full name
 * - Email
 * - LinkedIn URL or short professional background
 * Submissions route to Alexandra & Julia without SMS, Face ID, or identity checks.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import { ApiService } from '../services/api';
import { useClub } from '../context/ClubContext';
import { OzaraStorage, OZARA_STORAGE_KEYS } from '../services/storage';

interface InvitationScreenProps {
  onBack: () => void;
  onValidInvitation: () => void;
  onGoToSignIn?: (prefilledEmail?: string, prefilledPhone?: string) => void;
  clearOnMount?: boolean;
}

export const InvitationScreen: React.FC<InvitationScreenProps> = ({
  onBack,
  onValidInvitation,
  onGoToSignIn,
  clearOnMount = false,
}) => {
  const insets = useSafeAreaInsets();
  const { width: rnWindowWidth } = useWindowDimensions();
  const effectiveWidth = (rnWindowWidth && rnWindowWidth > 0)
    ? rnWindowWidth
    : (typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 390);
  const containerWidth = Math.min(Math.max(effectiveWidth, 320), 430);

  const {
    invitationCode,
    setInvitationCode,
    setInvitationEmail,
    setInvitationFullName,
    setAuthMode,
    setAppView,
    setPendingAccessEmail,
  } = useClub();

  const [inputCode, setInputCode] = useState<string>(() => {
    if (clearOnMount) {
      return '';
    }
    // 1. Check URL query parameters (code / token / invite)
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code') || params.get('token') || params.get('invite');
        if (urlCode && urlCode.trim()) {
          return urlCode.trim().toUpperCase();
        }
      } catch (_) {}
    }
    // 2. Check context / stored code
    return invitationCode || OzaraStorage.getItem(OZARA_STORAGE_KEYS.INVITATION_CODE) || '';
  });

  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  // Request Access Modal State
  type RequestModalState = 'form' | 'success' | 'pending_request' | 'existing_account' | 'declined_request';
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [modalState, setModalState] = useState<RequestModalState>('form');
  const [reqFullName, setReqFullName] = useState<string>('');
  const [reqEmail, setReqEmail] = useState<string>('');
  const [reqIsSubmitting, setReqIsSubmitting] = useState<boolean>(false);
  const [reqErrorMessage, setReqErrorMessage] = useState<string | null>(null);
  const [matchedEmail, setMatchedEmail] = useState<string>('');
  const [matchedPhone, setMatchedPhone] = useState<string | null>(null);

  // Auto-sync input code if passed in props or storage
  useEffect(() => {
    if (clearOnMount) {
      setInputCode('');
      setErrorMessage(null);
      setErrorType(null);
      return;
    }
    if (invitationCode && !inputCode) {
      setInputCode(invitationCode);
    }
  }, [invitationCode, clearOnMount]);

  const handleVerify = async () => {
    const clean = inputCode.trim();
    if (!clean) {
      setErrorMessage('Please enter your invitation code.');
      setErrorType('missing');
      return;
    }

    setErrorMessage(null);
    setErrorType(null);
    setIsChecking(true);

    try {
      const res = await ApiService.verifyInviteToken(clean);
      if (res && res.valid) {
        // Store validated invitation details for subsequent phone verification & registration
        setInvitationCode(res.token);
        setInvitationEmail(res.email);
        if (res.fullName) {
          setInvitationFullName(res.fullName);
        }
        setAuthMode('new_member');

        // Proceed to phone verification
        onValidInvitation();
      } else {
        setErrorMessage('Invalid invitation code. Please check the code or request access.');
        setErrorType('invalid');
      }
    } catch (err: any) {
      const type = err.errorType || 'invalid';
      setErrorType(type);
      if (err.message) {
        setErrorMessage(err.message);
      } else if (type === 'expired') {
        setErrorMessage('This invitation code has expired. Please request a new invitation.');
      } else if (type === 'revoked') {
        setErrorMessage('This invitation code has been revoked.');
      } else if (type === 'claimed') {
        setErrorMessage('This invitation code has already been used to create an account.');
      } else if (type === 'declined') {
        setErrorMessage('This access request was declined by the membership committee.');
      } else {
        setErrorMessage('Invalid invitation code. Please check the code or request access.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenRequestModal = () => {
    setReqErrorMessage(null);
    setModalState('form');
    setShowRequestModal(true);
  };

  const handleCloseRequestModal = () => {
    setShowRequestModal(false);
    setReqErrorMessage(null);
    setModalState('form');
  };

  const handleSignInExisting = () => {
    const emailToUse = matchedEmail || reqEmail.trim().toLowerCase();
    const phoneToUse = matchedPhone;
    setShowRequestModal(false);
    setModalState('form');
    setAuthMode('sign_in');
    if (emailToUse) {
      setPendingAccessEmail?.(emailToUse);
      OzaraStorage.setItem(OZARA_STORAGE_KEYS.ACCOUNT_EMAIL, emailToUse);
    }
    if (onGoToSignIn) {
      onGoToSignIn(emailToUse, phoneToUse || undefined);
    } else {
      setAppView('phone_auth');
    }
  };

  const handleSubmitRequestAccess = async () => {
    const trimmedName = reqFullName.trim();
    const cleanEmail = reqEmail.trim().toLowerCase();

    if (!trimmedName) {
      setReqErrorMessage('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setReqErrorMessage('Please enter a valid business email.');
      return;
    }

    setReqErrorMessage(null);
    setReqIsSubmitting(true);

    try {
      // 1. Check existing account and request status through backend before creating a new request
      const statusRes = await ApiService.checkEmailStatus(cleanEmail);

      if (statusRes.status === 'pending_request') {
        // State 1: Pending request
        // Title: “Your request is received”
        // Message: “Our hosts will be in touch by email.”
        // Button: “Got it”
        setMatchedEmail(cleanEmail);
        setModalState('pending_request');
        return;
      }

      if (statusRes.status === 'existing_account') {
        // State 2: Existing account
        // Title: “You’re already in the circle”
        // Message: “Sign in to your ÖZARA account.”
        // Button: “Sign in”
        setMatchedEmail(cleanEmail);
        setMatchedPhone(statusRes.phone || null);
        setModalState('existing_account');
        return;
      }

      if (statusRes.status === 'declined_request') {
        // State 3: Declined request
        // Title: “Not this time”
        // Message: “We’re unable to offer an invitation at this time.”
        // Button: “Close”
        setMatchedEmail(cleanEmail);
        setModalState('declined_request');
        return;
      }

      // If email is new, continue the normal request flow
      const res = await ApiService.requestAccess({
        fullName: trimmedName,
        email: cleanEmail,
      });

      if (res && res.success) {
        setModalState('success');
      } else {
        if (res?.status === 'pending_request' || res?.status === 'existing_account' || res?.status === 'declined_request') {
          setMatchedEmail(cleanEmail);
          setModalState(res.status as RequestModalState);
          return;
        }
        setReqErrorMessage(res?.message || 'Unable to submit request. Please try again.');
      }
    } catch (err: any) {
      // If check fails, show retry message; do not treat email as new
      setReqErrorMessage(err.message || 'Unable to verify request status. Please check your connection and try again.');
    } finally {
      setReqIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.mainWrapper, { width: containerWidth }]}>
        {/* Top Header Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.topBrandContainer}>
            <Text style={styles.brandTitle}>ÖZARA</Text>
            <Text style={styles.brandSub}>PRIVATE CLUB</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Content Body */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Shield Icon Accent */}
            <View style={styles.shieldIconContainer}>
              <View style={styles.shieldGlow} />
              <Ionicons name="key-outline" size={28} color="#a78bfa" />
            </View>

            {/* Invitation Code Input Card */}
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Invitation code</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={inputCode}
                  onChangeText={(text) => {
                    setInputCode(text.toUpperCase());
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  spellCheck={false}
                  editable={!isChecking}
                />
                {inputCode.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => {
                      setInputCode('');
                      setInvitationCode('');
                      OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_CODE);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={18} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Error Message Banner */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color="#f87171"
                    style={{ marginRight: 6, marginTop: 1 }}
                  />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              )}

              {/* Continue Button (Disabled while checking) */}
              <TouchableOpacity
                style={[
                  styles.continueBtn,
                  (!inputCode.trim() || isChecking) && styles.continueBtnDisabled,
                ]}
                onPress={handleVerify}
                disabled={!inputCode.trim() || isChecking}
                activeOpacity={0.85}>
                {isChecking ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={[styles.continueBtnText, { marginLeft: 8 }]}>
                      Verifying...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.continueBtnText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Request Access Action Link */}
            <TouchableOpacity
              style={styles.requestAccessLink}
              onPress={handleOpenRequestModal}
              activeOpacity={0.75}>
              <Text style={styles.requestAccessText}>
                Don’t have an invitation?{' '}
                <Text style={styles.requestAccessBold}>Request access</Text>
              </Text>
            </TouchableOpacity>

            {/* Subtle Security Footnote */}
            <View style={styles.securityFootnote}>
              <Text style={styles.securityFootnoteText}>
                Invitations are strictly single-use and bound to authorized members.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ============================================================ */}
      {/* Request Access Modal Form                                    */}
      {/* ============================================================ */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={handleCloseRequestModal}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={handleCloseRequestModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalAvoidContainer}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => {
                if (e && e.stopPropagation) e.stopPropagation();
              }}
              style={[
                styles.modalCard,
                { width: containerWidth - 32 },
                modalState !== 'form' && styles.modalCardSuccess,
              ]}>
              {modalState === 'pending_request' || modalState === 'existing_account' || modalState === 'declined_request' ? (
                /* Existing-Email Minimal Modal States (No extra icons or illustrations) */
                <View style={styles.statusModalContent}>
                  <TouchableOpacity
                    style={styles.modalCloseBtnAbsolute}
                    onPress={handleCloseRequestModal}
                    activeOpacity={0.7}>
                    <Ionicons name="close" size={18} color="#94a3b8" />
                  </TouchableOpacity>

                  <Text style={styles.statusModalTitle}>
                    {modalState === 'pending_request' && 'Your request is received'}
                    {modalState === 'existing_account' && 'You’re already in the circle'}
                    {modalState === 'declined_request' && 'Not this time'}
                  </Text>

                  <Text style={styles.statusModalMessage}>
                    {modalState === 'pending_request' && 'Our hosts will be in touch by email.'}
                    {modalState === 'existing_account' && 'Sign in to your ÖZARA account.'}
                    {modalState === 'declined_request' && 'We’re unable to offer an invitation at this time.'}
                  </Text>

                  <TouchableOpacity
                    style={styles.statusModalActionBtn}
                    onPress={() => {
                      if (modalState === 'existing_account') {
                        handleSignInExisting();
                      } else {
                        handleCloseRequestModal();
                      }
                    }}
                    activeOpacity={0.85}>
                    <Text style={styles.statusModalActionBtnText}>
                      {modalState === 'pending_request' && 'Got it'}
                      {modalState === 'existing_account' && 'Sign in'}
                      {modalState === 'declined_request' && 'Close'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : modalState === 'success' ? (
                /* Success Confirmation State: Clean & Minimalistic (No top bar) */
                <View style={styles.reqSuccessContainer}>
                  <View style={styles.successCheckCircle}>
                    <Ionicons name="checkmark" size={32} color="#10b981" />
                  </View>
                  <Text style={styles.reqSuccessTitle}>Request Received</Text>
                  <Text style={styles.reqSuccessText}>
                    Your request has been received. Our team will review it and contact you by email if approved.
                  </Text>
                  <TouchableOpacity
                    style={styles.reqSuccessDoneBtn}
                    onPress={handleCloseRequestModal}
                    activeOpacity={0.85}>
                    <Text style={styles.reqSuccessDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Minimalist Top Close Button */}
                  <TouchableOpacity
                    style={styles.modalCloseBtnAbsolute}
                    onPress={handleCloseRequestModal}
                    activeOpacity={0.7}>
                    <Ionicons name="close" size={18} color="#94a3b8" />
                  </TouchableOpacity>

                  {/* Interactive Form State */}
                  <View style={styles.modalBodyWrap}>
                  <ScrollView
                    style={styles.modalScroll}
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled">
                    <View style={styles.modalIntroWrap}>
                      <Text style={styles.modalFormTitle}>Fill out the form</Text>
                      <Text style={styles.modalFormSubtitle}>
                        We will review it and get back to you via email.
                      </Text>
                    </View>

                    {/* Field 1: Full Name */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        Full name <Text style={styles.reqAsterisk}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        value={reqFullName}
                        onChangeText={(t) => {
                          setReqFullName(t);
                          if (reqErrorMessage) setReqErrorMessage(null);
                        }}
                        autoCapitalize="words"
                        editable={!reqIsSubmitting}
                      />
                    </View>

                    {/* Field 2: Business Email */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        Business email <Text style={styles.reqAsterisk}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        value={reqEmail}
                        onChangeText={(t) => {
                          setReqEmail(t);
                          if (reqErrorMessage) setReqErrorMessage(null);
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!reqIsSubmitting}
                      />
                    </View>


                  </ScrollView>

                  {/* Pinned Action Footer: Always visible directly on screen */}
                  <View style={styles.modalFooter}>
                    {reqErrorMessage && (
                      <View style={styles.modalErrorBanner}>
                        <Ionicons name="alert-circle" size={15} color="#f87171" style={{ marginRight: 6 }} />
                        <Text style={styles.modalErrorText}>{reqErrorMessage}</Text>
                      </View>
                    )}

                    {/* Primary Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.submitReqBtn,
                        reqIsSubmitting && styles.continueBtnDisabled,
                      ]}
                      onPress={handleSubmitRequestAccess}
                      disabled={reqIsSubmitting}
                      activeOpacity={0.85}>
                      {reqIsSubmitting ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator size="small" color="#ffffff" />
                          <Text style={[styles.submitReqBtnText, { marginLeft: 8 }]}>
                            Submitting...
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.submitReqBtnText}>Request access</Text>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.modalDisclaimer}>
                      Submitting this form does not grant membership. Applicants do not need SMS or identity verification to submit.
                    </Text>
                  </View>
                </View>
              </>
            )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    maxWidth: 430,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBrandContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 2.5,
    marginTop: -1,
    fontFamily: OzaraTheme.typography.fontFamily,
  },

  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },

  shieldIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  shieldGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },

  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  description: {
    fontSize: 15,
    fontWeight: '400',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    fontFamily: OzaraTheme.typography.fontFamily,
  },

  inputCard: {
    width: '100%',
    backgroundColor: '#0d1424',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.22)',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a78bfa',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080c18',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 16,
    ...Platform.select({
      web: {
        cursor: 'text',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      } as any,
    }),
  },
  inputContainerFocused: {
    borderColor: 'rgba(167, 139, 250, 0.85)',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.25)',
      } as any,
    }),
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1.5,
    fontFamily: OzaraTheme.typography.fontFamily,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none',
        cursor: 'text',
      } as any,
    }),
  },
  clearBtn: {
    padding: 4,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#f87171',
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: OzaraTheme.typography.fontFamily,
  },

  continueBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: OzaraTheme.colors.accentPurple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OzaraTheme.colors.accentPurple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  requestAccessLink: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  requestAccessText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  requestAccessBold: {
    color: '#a78bfa',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  securityFootnote: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 24,
  },
  securityFootnoteText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontFamily: OzaraTheme.typography.fontFamily,
    lineHeight: 16,
  },

  /* Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalAvoidContainer: {
    width: '100%',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#0d1424',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.28)',
    borderRadius: 22,
    padding: 22,
    maxWidth: 480,
    maxHeight: '92%',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
  },
  modalCloseBtnAbsolute: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  modalSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#a78bfa',
    letterSpacing: 2,
    marginTop: 2,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  modalBodyWrap: {
    flexShrink: 1,
    paddingTop: 2,
  },
  modalScroll: {
    flexShrink: 1,
    maxHeight: Platform.OS === 'web' ? 400 : 320,
  },
  modalScrollContent: {
    paddingBottom: 6,
  },
  modalIntroWrap: {
    marginBottom: 16,
    paddingRight: 36,
  },
  modalFormTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
    marginBottom: 4,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  modalFormSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18.5,
    fontFamily: OzaraTheme.typography.fontFamily,
  },

  fieldGroup: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  reqAsterisk: {
    color: '#f87171',
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#080c18',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    color: '#ffffff',
    fontSize: 13.5,
    fontFamily: OzaraTheme.typography.fontFamily,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        boxShadow: 'none',
      } as any,
    }),
  },
  modalInputMulti: {
    height: 50,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: 'top',
  },

  modalFooter: {
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },

  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  modalErrorText: {
    fontSize: 11.5,
    color: '#f87171',
    fontWeight: '500',
    fontFamily: OzaraTheme.typography.fontFamily,
  },

  submitReqBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: OzaraTheme.colors.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  submitReqBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  modalDisclaimer: {
    fontSize: 10.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 15,
    fontFamily: OzaraTheme.typography.fontFamily,
    marginBottom: 4,
  },

  modalCardSuccess: {
    paddingTop: 34,
    paddingBottom: 28,
    paddingHorizontal: 24,
    maxWidth: 440,
  },

  /* Existing-Email Minimal Modal States (No extra icons or illustrations) */
  statusModalContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: '100%',
  },
  statusModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  statusModalMessage: {
    fontSize: 14.5,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  statusModalActionBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: OzaraTheme.colors.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  statusModalActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
    fontFamily: OzaraTheme.typography.fontFamily,
  },

  /* Request Success Confirmation */
  reqSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  successCheckCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1.5,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  reqSuccessTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 10,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  reqSuccessText: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 26,
    maxWidth: 320,
    fontFamily: OzaraTheme.typography.fontFamily,
  },
  reqSuccessDoneBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: OzaraTheme.colors.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  reqSuccessDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: OzaraTheme.typography.fontFamily,
  },
});
