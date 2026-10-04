/**
 * ÖZARA Mobile: Access Conditions Bottom-Sheet Modal
 * Appears when user taps "Sign up" or when a new user views the welcome screen.
 * Dims the screen behind it, pauses image marquee animation,
 * and requires agreeing to Access Conditions before entering registration.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AccessConditionsModalProps {
  visible: boolean;
  isChecked: boolean;
  onToggleCheckbox: () => void;
  onClose: () => void;
  onAgreeAndContinue: () => void;
  onOpenConditions: () => void;
}

export const AccessConditionsModal: React.FC<AccessConditionsModalProps> = ({
  visible,
  isChecked,
  onToggleCheckbox,
  onClose,
  onAgreeAndContinue,
  onOpenConditions,
}) => {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={styles.overlayRoot} pointerEvents="auto">
      {/* Dimmed Background Overlay that closes on click outside */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Bottom Sheet Modal Card */}
      <View
        style={[
          styles.sheetContainer,
          { paddingBottom: Math.max(insets.bottom, 20) + 12 },
        ]}>
        {/* Top Drag Handle Indicator */}
        <View style={styles.dragIndicatorWrap}>
          <View style={styles.dragIndicator} />
        </View>

        {/* Modal Header with Title & Close Button */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <View style={styles.badgeRow}>
              <Ionicons name="shield-checkmark" size={13} color={OzaraTheme.colors.accentViolet} />
              <Text style={styles.badgeText}>COMMUNITY GOVERNANCE</Text>
            </View>
            <Text style={styles.title}>Before you join</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Body Content */}
        <ScrollView
          style={styles.bodyScrollView}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.bodyParagraph}>
            ÖZARA is an invite-only community for professional connections, events, and exploring real estate opportunities.
          </Text>

          <Text style={styles.bodyParagraph}>
            Community membership does not automatically provide access to investments. Individual opportunities may require additional eligibility checks and verification.
          </Text>

          <View style={styles.riskHighlightBox}>
            <Ionicons name="warning-outline" size={16} color="#FBBF24" style={styles.riskIcon} />
            <Text style={styles.riskParagraph}>
              Investments involve risk, including the possible loss of your entire investment. Returns are not guaranteed.
            </Text>
          </View>

          {/* Checkbox Row with Underlined Link */}
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]}
              onPress={onToggleCheckbox}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {isChecked && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </TouchableOpacity>

            <View style={styles.checkboxLabelWrap}>
              <Text style={styles.checkboxLabelText}>
                I have read and agree to the{' '}
                <Text
                  style={styles.underlinedLink}
                  onPress={onOpenConditions}>
                  Access Conditions
                </Text>
                .
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionsFooter}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !isChecked && styles.primaryBtnDisabled,
            ]}
            onPress={isChecked ? onAgreeAndContinue : undefined}
            activeOpacity={isChecked ? 0.85 : 1}
            disabled={!isChecked}>
            <Text
              style={[
                styles.primaryBtnText,
                !isChecked && styles.primaryBtnTextDisabled,
              ]}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
    zIndex: 99999,
    justifyContent: 'flex-end',
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        zIndex: 99999,
      },
    }),
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    zIndex: 1,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(3px)' as any,
      },
    }),
  },
  sheetContainer: {
    backgroundColor: '#0B1020',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.88,
    zIndex: 2,
    ...Platform.select({
      web: {
        maxWidth: 520,
        alignSelf: 'center',
        width: '100%',
        boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.8)',
      },
    }),
  },
  dragIndicatorWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleWrap: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  badgeText: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  bodyScrollView: {
    marginTop: 16,
  },
  bodyContent: {
    paddingBottom: 12,
  },
  bodyParagraph: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  riskHighlightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  riskIcon: {
    marginTop: 2,
  },
  riskParagraph: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  checkboxBoxChecked: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    borderColor: OzaraTheme.colors.accentViolet,
  },
  checkboxLabelWrap: {
    flex: 1,
  },
  checkboxLabelText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  underlinedLink: {
    color: '#A78BFA',
    textDecorationLine: 'underline',
    fontWeight: '700',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  actionsFooter: {
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet, // #7C3AED
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    ...Platform.select({
      web: {
        cursor: 'not-allowed' as any,
      },
    }),
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  primaryBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
