/**
 * ÖZARA Mobile: Phone Authentication Screen
 * Ultra-luxury dark navy aesthetic with violet accents
 * 
 * Flows:
 * 1. Enter Phone Number:
 *    - Back arrow returning to Invest onboarding screen
 *    - Country selector with flag & dialing code
 *    - Phone-number field with numeric keypad
 *    - "Send code" button (disabled until valid)
 *    - Small contact icon beside button opening admin contact panel
 * 2. Verification Code:
 *    - Resend option with countdown timer
 *    - "Change number" option
 *    - Dynamic provider messaging (only mentions WhatsApp if enabled)
 *    - States: loading, invalid-code, expired-code, delivery-error
 * 3. Routing:
 *    - Phone verification confirms ownership of the number
 *    - Existing approved members enter the app
 *    - New users continue through Access Conditions and Invitation validation
 *    - Users without an invitation can contact admins to request access
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import { ApiService, Persona } from '../services/api';
import { useClub } from '../context/ClubContext';
import { ContactModal } from '../components/ContactModal';
import { AccessConditionsModal } from '../components/AccessConditionsModal';

interface CountryItem {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
  format: string;
}

const COUNTRIES_LIST: CountryItem[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸', dialCode: '+1', format: '(202) 555-0199' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', dialCode: '+971', format: '50 123 4567' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', dialCode: '+44', format: '7911 123456' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭', dialCode: '+41', format: '79 123 45 67' },
  { name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿', dialCode: '+7', format: '701 123 4567' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬', dialCode: '+65', format: '8123 4567' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', dialCode: '+966', format: '50 123 4567' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦', dialCode: '+974', format: '3312 3456' },
  { name: 'Monaco', code: 'MC', flag: '🇲🇨', dialCode: '+377', format: '6 12 34 56 78' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', dialCode: '+49', format: '151 12345678' },
  { name: 'France', code: 'FR', flag: '🇫🇷', dialCode: '+33', format: '6 12 34 56 78' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹', dialCode: '+39', format: '312 3456789' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸', dialCode: '+34', format: '612 34 56 78' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', dialCode: '+1', format: '(416) 555-0199' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', dialCode: '+61', format: '412 345 678' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', dialCode: '+81', format: '90 1234 5678' },
  { name: 'Hong Kong', code: 'HK', flag: '🇭🇰', dialCode: '+852', format: '9123 4567' },
];

interface PhoneAuthScreenProps {
  onBack: () => void;
  onEnterClub: () => void;
  onGoToSignUp: () => void;
}

type AuthStep = 'enter_phone' | 'enter_code';

export const PhoneAuthScreen: React.FC<PhoneAuthScreenProps> = ({
  onBack,
  onEnterClub,
  onGoToSignUp,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const containerWidth = Math.min(windowWidth, 430);

  const {
    switchPersona,
    setVerifiedPhone,
    conditionsAgreed,
    setConditionsAgreedState,
    openConditions,
  } = useClub();

  const [step, setStep] = useState<AuthStep>('enter_phone');
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(COUNTRIES_LIST[0]);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [code, setCode] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'invalid' | 'expired' | 'delivery' | null>(null);

  const [countdown, setCountdown] = useState<number>(45);
  const [isResendActive, setIsResendActive] = useState<boolean>(false);

  const [showCountryModal, setShowCountryModal] = useState<boolean>(false);
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [showConditionsModal, setShowConditionsModal] = useState<boolean>(false);

  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(false);

  const codeInputRef = useRef<TextInput>(null);

  // Check backend auth config on mount
  useEffect(() => {
    ApiService.getPhoneAuthConfig()
      .then((cfg) => {
        if (cfg) {
          setWhatsappEnabled(Boolean(cfg.whatsapp_verification_enabled));
        }
      })
      .catch(() => {});
  }, []);

  // Countdown timer for code resend
  useEffect(() => {
    if (step !== 'enter_code') return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsResendActive(true);
    }
  }, [step, countdown]);

  const fullNormalizedPhone = `${selectedCountry.dialCode}${phoneNumber.replace(/\D/g, '')}`;

  // Validate phone number: minimum 7 digits
  const rawDigits = phoneNumber.replace(/\D/g, '');
  const isPhoneValid = rawDigits.length >= 7 && rawDigits.length <= 15;

  const handleSendCode = async () => {
    if (!isPhoneValid || isLoading) return;

    setErrorMessage(null);
    setErrorType(null);
    setIsLoading(true);

    try {
      const res = await ApiService.sendPhoneVerificationCode({
        phone: fullNormalizedPhone,
        country_code: selectedCountry.code,
      });

      if (res && res.success) {
        setStep('enter_code');
        setCode('');
        setCountdown(45);
        setIsResendActive(false);
        setTimeout(() => codeInputRef.current?.focus(), 300);
      } else {
        setErrorType('delivery');
        setErrorMessage(res?.message || 'Unable to deliver verification code. Please try again.');
      }
    } catch (err: any) {
      console.error('[PhoneAuth] Send code error:', err);
      setErrorType('delivery');
      setErrorMessage(err.message || 'Delivery error: Unable to dispatch verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const finalCode = (codeToVerify || code).trim();
    if (finalCode.length < 4 || isLoading) return;

    setErrorMessage(null);
    setErrorType(null);
    setIsLoading(true);

    try {
      const res = await ApiService.verifyPhoneCode({
        phone: fullNormalizedPhone,
        code: finalCode,
      });

      if (res && res.verified) {
        // Ownership verified
        setVerifiedPhone(fullNormalizedPhone);

        if (res.is_existing_member && res.user) {
          // Case A: Existing approved member -> log in and enter app directly
          switchPersona(res.user.id);
          onEnterClub();
        } else {
          // Case B: New user / candidate -> continue through Access Conditions and Invitation validation
          if (!conditionsAgreed) {
            setShowConditionsModal(true);
          } else {
            onGoToSignUp();
          }
        }
      } else {
        setErrorType('invalid');
        setErrorMessage('Invalid verification code. Please check and try again.');
      }
    } catch (err: any) {
      console.error('[PhoneAuth] Verify error:', err);
      if (err.message && err.message.toLowerCase().includes('expired')) {
        setErrorType('expired');
        setErrorMessage('Verification code has expired. Please request a new code.');
      } else {
        setErrorType('invalid');
        setErrorMessage(err.message || 'Invalid verification code. Please check and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isResendActive || isLoading) return;
    setErrorMessage(null);
    setErrorType(null);
    setIsLoading(true);

    try {
      const res = await ApiService.sendPhoneVerificationCode({
        phone: fullNormalizedPhone,
        country_code: selectedCountry.code,
      });

      if (res && res.success) {
        setCode('');
        setCountdown(45);
        setIsResendActive(false);
      } else {
        setErrorType('delivery');
        setErrorMessage(res?.message || 'Unable to resend verification code.');
      }
    } catch (err: any) {
      setErrorType('delivery');
      setErrorMessage(err.message || 'Delivery error: Unable to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCountries = COUNTRIES_LIST.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dialCode.includes(countrySearch) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={[styles.mainWrapper, { width: containerWidth }]}>
        {/* Top Header Navigation Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (step === 'enter_code') {
                setStep('enter_phone');
                setErrorMessage(null);
                setErrorType(null);
              } else {
                onBack();
              }
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Log in or sign up</Text>

          <View style={styles.topBarRightPlaceholder} />
        </View>

        {/* Content Body */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flexBody}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {step === 'enter_phone' ? (
              /* ==============================================================
                 STEP 1: ENTER PHONE NUMBER
                 ============================================================== */
              <View style={styles.stepContent}>
                {/* Headline & Description */}
                <View style={styles.copyHeader}>
                  <Text style={styles.headline}>Enter your phone number</Text>
                  <Text style={styles.description}>
                    We’ll send you a verification code.
                  </Text>
                </View>

                {/* Error Banner */}
                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" style={styles.errorIcon} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Phone Input Row */}
                <View style={styles.phoneInputRow}>
                  {/* Country Selector Button */}
                  <TouchableOpacity
                    style={styles.countryBtn}
                    onPress={() => setShowCountryModal(true)}
                    activeOpacity={0.75}>
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryDialCode}>{selectedCountry.dialCode}</Text>
                    <Ionicons name="chevron-down" size={14} color="#94a3b8" style={styles.chevron} />
                  </TouchableOpacity>

                  {/* Phone Number Field */}
                  <TextInput
                    style={styles.phoneInput}
                    placeholder={selectedCountry.format}
                    placeholderTextColor="#64748b"
                    value={phoneNumber}
                    onChangeText={(t) => {
                      setPhoneNumber(t);
                      if (errorMessage) {
                        setErrorMessage(null);
                        setErrorType(null);
                      }
                    }}
                    keyboardType="phone-pad"
                    autoFocus
                    editable={!isLoading}
                  />
                </View>
              </View>
            ) : (
              /* ==============================================================
                 STEP 2: ENTER VERIFICATION CODE
                 ============================================================== */
              <View style={styles.stepContent}>
                <View style={styles.copyHeader}>
                  <Text style={styles.headline}>Enter verification code</Text>
                  <View style={styles.destinationRow}>
                    <Text style={styles.description}>
                      Sent to{' '}
                      <Text style={styles.highlightText}>
                        {selectedCountry.dialCode} {phoneNumber}
                      </Text>
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setStep('enter_phone');
                        setErrorMessage(null);
                        setErrorType(null);
                      }}
                      style={styles.changeNumberBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.changeNumberText}>Change number</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dynamic Provider Messaging */}
                  <View style={styles.providerBadge}>
                    <Ionicons
                      name={whatsappEnabled ? 'logo-whatsapp' : 'chatbox-ellipses-outline'}
                      size={13}
                      color={whatsappEnabled ? '#25D366' : '#a78bfa'}
                    />
                    <Text style={styles.providerBadgeText}>
                      {whatsappEnabled ? 'Verification via WhatsApp' : 'Verification code dispatched via SMS'}
                    </Text>
                  </View>
                </View>

                {/* Error Banner */}
                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" style={styles.errorIcon} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* 6-Digit Code Input Cells */}
                <View style={styles.codeCellContainer}>
                  {[0, 1, 2, 3, 4, 5].map((index) => {
                    const digit = code[index] || '';
                    const isCurrent = code.length === index;
                    return (
                      <View
                        key={`cell-${index}`}
                        style={[
                          styles.codeCell,
                          digit ? styles.codeCellFilled : null,
                          isCurrent ? styles.codeCellActive : null,
                          errorType ? styles.codeCellError : null,
                        ]}>
                        <Text style={styles.codeDigit}>{digit}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Hidden Overlay Input with SMS Autofill Support */}
                <TextInput
                  ref={codeInputRef}
                  style={styles.hiddenCodeInput}
                  value={code}
                  onChangeText={(val) => {
                    const clean = val.replace(/\D/g, '').slice(0, 6);
                    setCode(clean);
                    if (errorMessage) {
                      setErrorMessage(null);
                      setErrorType(null);
                    }
                    if (clean.length === 6) {
                      handleVerifyCode(clean);
                    }
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  autoFocus
                  editable={!isLoading}
                />

                {/* Resend Option */}
                <View style={styles.resendContainer}>
                  {isResendActive ? (
                    <TouchableOpacity
                      onPress={handleResendCode}
                      disabled={isLoading}
                      style={styles.resendBtn}>
                      <Text style={styles.resendBtnText}>Resend code</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.resendCountdownText}>
                      Resend code in <Text style={styles.countdownSec}>{countdown}s</Text>
                    </Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Action Row (Fixed above safe area) */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 6 }]}>
            {step === 'enter_phone' ? (
              <View style={styles.actionRow}>
                {/* Send Code Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (!isPhoneValid || isLoading) && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleSendCode}
                  disabled={!isPhoneValid || isLoading}
                  activeOpacity={0.85}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send code</Text>
                  )}
                </TouchableOpacity>

                {/* Small Contact Icon Beside Button */}
                <TouchableOpacity
                  style={styles.contactIconBtn}
                  onPress={() => setShowContactModal(true)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actionRow}>
                {/* Verify Code Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (code.length < 4 || isLoading) && styles.primaryBtnDisabled,
                  ]}
                  onPress={() => handleVerifyCode()}
                  disabled={code.length < 4 || isLoading}
                  activeOpacity={0.85}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify and continue</Text>
                  )}
                </TouchableOpacity>

                {/* Small Contact Icon Beside Button */}
                <TouchableOpacity
                  style={styles.contactIconBtn}
                  onPress={() => setShowContactModal(true)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Country Selector Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCountryModal(false)}
          />

          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => setShowCountryModal(false)}
                style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Country Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={17} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country or code..."
                placeholderTextColor="#64748b"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = selectedCountry.code === item.code;
                return (
                  <TouchableOpacity
                    style={[styles.countryItemRow, isSelected && styles.countryItemRowSelected]}
                    onPress={() => {
                      setSelectedCountry(item);
                      setShowCountryModal(false);
                      setCountrySearch('');
                    }}
                    activeOpacity={0.7}>
                    <Text style={styles.itemFlag}>{item.flag}</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDialCode}>{item.dialCode}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={OzaraTheme.colors.accentViolet} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                );
              }}
              style={styles.countryList}
            />
          </View>
        </View>
      </Modal>

      {/* Admin Contact Panel Modal (Accessible via small icon beside buttons) */}
      <ContactModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

      {/* Access Conditions Bottom-Sheet Modal for New Candidates */}
      <AccessConditionsModal
        visible={showConditionsModal}
        isChecked={conditionsAgreed}
        onToggleCheckbox={() => setConditionsAgreedState(!conditionsAgreed)}
        onClose={() => setShowConditionsModal(false)}
        onOpenConditions={() => openConditions('phone_auth')}
        onAgreeAndContinue={() => {
          setShowConditionsModal(false);
          setConditionsAgreedState(true);
          onGoToSignUp();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080c18', // Deep luxury navy
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainWrapper: {
    flex: 1,
    backgroundColor: '#080c18',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  pageTitle: {
    color: '#94a3b8',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  topBarRightPlaceholder: {
    width: 36,
  },
  flexBody: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  stepContent: {
    width: '100%',
  },
  copyHeader: {
    marginBottom: 24,
  },
  headline: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  description: {
    color: '#94a3b8',
    fontSize: 14.5,
    lineHeight: 22,
    fontWeight: '400',
  },
  highlightText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  changeNumberBtn: {
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  changeNumberText: {
    color: '#a78bfa', // Violet accent
    fontSize: 13.5,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 14,
  },
  providerBadgeText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e1428',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  countryFlag: {
    fontSize: 18,
  },
  countryDialCode: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 2,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#0e1428',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  codeCellContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 18,
  },
  codeCell: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#0e1428',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCellFilled: {
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#111832',
  },
  codeCellActive: {
    borderColor: OzaraTheme.colors.accentViolet,
    backgroundColor: '#151d3b',
  },
  codeCellError: {
    borderColor: '#ef4444',
  },
  codeDigit: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  hiddenCodeInput: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    height: 70,
    opacity: 0.01,
    fontSize: 1,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendCountdownText: {
    color: '#64748b',
    fontSize: 13.5,
  },
  countdownSec: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  resendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  resendBtnText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#080c18',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: OzaraTheme.radius.full,
    backgroundColor: OzaraTheme.colors.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: OzaraTheme.colors.accentViolet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
      web: {
        cursor: 'pointer',
        boxShadow: `0 4px 18px ${OzaraTheme.colors.accentViolet}55`,
      } as any,
    }),
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  contactIconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalSheet: {
    backgroundColor: '#0a0f22',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '75%',
    ...Platform.select({
      web: {
        maxWidth: 440,
        alignSelf: 'center',
        width: '100%',
      } as any,
    }),
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10152b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  countryList: {
    maxHeight: 320,
  },
  countryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  countryItemRowSelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderRadius: 8,
  },
  itemFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  itemName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '500',
  },
  itemDialCode: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },
});
