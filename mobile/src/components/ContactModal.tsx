/**
 * ÖZARA Mobile: Contact Panel Modal
 * Inspired by ultra-luxury dark cinematic aesthetic
 * 
 * Accessible via the "Intro" button across all three onboarding screens.
 * Allows prospective members and guests to contact Alexandra and Julia directly.
 * 
 * Invariants:
 * - Operates seamlessly before signup
 * - Closing returns user to their current onboarding screen without replaying intro
 * - Submissions routed server-side to configured admin inboxes
 * - Displays exact confirmation: "Thank you. Your message has been received."
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import { ApiService } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>(''); // Hidden spam bot trap

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const [whatsappConfigured, setWhatsappConfigured] = useState<boolean>(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);

  // Fetch WhatsApp configuration upon opening
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    ApiService.getContactConfig()
      .then((cfg) => {
        if (isMounted && cfg) {
          setWhatsappConfigured(Boolean(cfg.whatsapp_configured && cfg.whatsapp_number));
          setWhatsappNumber(cfg.whatsapp_number || null);
        }
      })
      .catch((err) => {
        console.warn('[ContactModal] Config fetch warning:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [visible]);

  if (!visible) return null;

  const handleClose = () => {
    if (isSuccess) {
      // Reset form fields after confirmed submission
      setName('');
      setEmail('');
      setMessage('');
      setHoneypot('');
      setIsSuccess(false);
      setErrorMessage(null);
    } else {
      setErrorMessage(null);
    }
    onClose();
  };

  const handleOpenWhatsApp = () => {
    if (!whatsappNumber) return;
    const cleanNumber = whatsappNumber.replace(/[^0-9+]/g, '');
    const prefilledText = encodeURIComponent('Hi! I’d like to learn more about joining the community.');
    const waUrl = `https://wa.me/${cleanNumber.replace('+', '')}?text=${prefilledText}`;
    Linking.openURL(waUrl).catch((err) => {
      console.warn('[ContactModal] Could not open WhatsApp:', err);
    });
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Please enter your name (at least 2 characters).');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    const cleanMessage = message.trim();
    if (!cleanMessage || cleanMessage.length < 10) {
      setErrorMessage('Please enter a message of at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await ApiService.submitContactMessage({
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
        website: honeypot.trim() || undefined,
      });

      if (response && response.success) {
        setIsSuccess(true);
      } else {
        setErrorMessage(response?.message || 'Failed to submit. Please try again.');
      }
    } catch (err: any) {
      console.error('[ContactModal] Submission error:', err);
      setErrorMessage(err.message || 'Network error. Please verify your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.overlayRoot} pointerEvents="auto">
      {/* Dimmed Background Overlay */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* Main Panel Sheet / Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}>
        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 20) + 14 },
          ]}>
          {/* Top Drag Indicator */}
          <View style={styles.dragIndicatorWrap}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Modal Header: Logo Wordmark & Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.logoWrap}>
              <Text style={styles.brandTitle}>ÖZARA</Text>
              <Text style={styles.brandSub}>PRIVATE CLUB</Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.bodyScrollView}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Success State */}
            {isSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconBadge}>
                  <Ionicons name="checkmark-circle" size={44} color="#10b981" />
                </View>

                <Text style={styles.successHeadline}>
                  “Thank you. Your message has been received.”
                </Text>

                <Text style={styles.successDescription}>
                  Our founders and team have received your note and will follow up with you shortly.
                </Text>

                {whatsappConfigured && (
                  <TouchableOpacity
                    style={styles.whatsAppSuccessBtn}
                    onPress={handleOpenWhatsApp}
                    activeOpacity={0.8}>
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={{ marginRight: 8 }} />
                    <Text style={styles.whatsAppBtnText}>Chat on WhatsApp</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleClose}
                  activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Contact Form State */
              <View>
                {/* Headline & Description */}
                <View style={styles.introCopyWrap}>
                  <Text style={styles.headline}>Let’s start a conversation.</Text>
                  <Text style={styles.description}>
                    Have a question about joining, events, or opportunities? Send a note to our team.
                  </Text>
                </View>

                {/* Error Banner */}
                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={17} color="#ef4444" style={styles.errorIcon} />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Form Fields */}
                <View style={styles.formContainer}>
                  {/* Name Field */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>NAME</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your full name"
                      placeholderTextColor="#64748b"
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      autoCapitalize="words"
                      editable={!isSubmitting}
                    />
                  </View>

                  {/* Email Field */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>EMAIL</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@domain.com"
                      placeholderTextColor="#64748b"
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                    />
                  </View>

                  {/* Message Field */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>MESSAGE</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="How can we assist you?"
                      placeholderTextColor="#64748b"
                      value={message}
                      onChangeText={(t) => {
                        setMessage(t);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      editable={!isSubmitting}
                    />
                  </View>

                  {/* Invisible Honeypot Spam Protection Field */}
                  <View style={styles.honeypotWrapper} pointerEvents="none">
                    <TextInput
                      style={styles.honeypotInput}
                      value={honeypot}
                      onChangeText={setHoneypot}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      isSubmitting && styles.primaryBtnDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.85}>
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Send message</Text>
                    )}
                  </TouchableOpacity>

                  {/* Optional WhatsApp Direct Link (when configured) */}
                  {whatsappConfigured && (
                    <TouchableOpacity
                      style={styles.whatsAppBtn}
                      onPress={handleOpenWhatsApp}
                      activeOpacity={0.8}
                      disabled={isSubmitting}>
                      <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={{ marginRight: 8 }} />
                      <Text style={styles.whatsAppBtnText}>Chat on WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 17, 0.78)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(6px)',
      } as any,
    }),
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#080c18', // Deep luxury navy
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.9,
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 440,
        alignSelf: 'center',
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        borderBottomWidth: 1,
        marginBottom: 20,
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.75), 0 0 30px rgba(124, 58, 237, 0.15)',
      } as any,
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  dragIndicatorWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoWrap: {
    alignItems: 'flex-start',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  brandSub: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  bodyScrollView: {
    marginTop: 14,
  },
  bodyContent: {
    paddingBottom: 16,
  },
  introCopyWrap: {
    marginBottom: 20,
  },
  headline: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  description: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
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
    marginBottom: 16,
    gap: 10,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorBannerText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  formContainer: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#a78bfa', // Violet accent label
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: '#0e1428',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: '#ffffff',
    fontSize: 15,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        transition: 'border-color 0.2s ease',
      } as any,
    }),
  },
  textArea: {
    minHeight: 108,
    paddingTop: 13,
  },
  honeypotWrapper: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
  },
  honeypotInput: {
    height: 0,
    width: 0,
  },
  primaryBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet, // Violet accent #7C3AED
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
    opacity: 0.65,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  whatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.25)',
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 13,
    marginTop: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  whatsAppSuccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.25)',
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 13,
    width: '100%',
    marginBottom: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  whatsAppBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  successIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  successHeadline: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 12,
  },
  successDescription: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
});
