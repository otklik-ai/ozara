/**
 * ÖZARA Mobile: Access Conditions Screen
 * Standalone legal terms and disclosure documentation.
 * Accessible from:
 * 1. Bottom-sheet modal ("Access Conditions" underlined link)
 * 2. Welcome page footer
 * 3. Settings / Profile Drawer
 *
 * Invariants:
 * - Draft placeholders ([LEGAL COMPANY NAME], [JURISDICTION], etc.) kept visible & flagged.
 * - No Axevil registration details, regulatory claims, or international legal notices.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

interface AccessConditionsScreenProps {
  onBack: () => void;
}

export const AccessConditionsScreen: React.FC<AccessConditionsScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>ÖZARA</Text>
          <Text style={styles.headerSub}>LEGAL &amp; COMPLIANCE</Text>
        </View>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 32 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Document Title & Meta */}
        <View style={styles.titleSection}>
          <View style={styles.versionBadge}>
            <Ionicons name="shield-checkmark" size={12} color={OzaraTheme.colors.accentViolet} />
            <Text style={styles.versionBadgeText}>OFFICIAL TERMS · v2026-10-v1</Text>
          </View>
          <Text style={styles.docTitle}>Access Conditions</Text>
          <Text style={styles.lastUpdated}>Last updated: October 3, 2026</Text>
        </View>

        {/* Development Flag / Notice Banner */}
        <View style={styles.draftNoticeCard}>
          <View style={styles.draftNoticeHeader}>
            <Ionicons name="information-circle-outline" size={16} color="#FBBF24" />
            <Text style={styles.draftNoticeTitle}>DRAFT NOTICE · PENDING LEGAL LAUNCH</Text>
          </View>
          <Text style={styles.draftNoticeBody}>
            Company entity registration placeholders below are highlighted in draft form for developer inspection and will be finalized prior to public launch.
          </Text>
        </View>

        {/* Section 1: About ÖZARA */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>About ÖZARA</Text>
          <Text style={styles.paragraph}>
            ÖZARA is an invite-only platform for professional networking, events, and discovering real estate opportunities.
          </Text>
          <Text style={styles.paragraph}>
            The platform is operated by{' '}
            <Text style={styles.placeholderHighlight}>[LEGAL COMPANY NAME]</Text>, registered in{' '}
            <Text style={styles.placeholderHighlight}>[JURISDICTION]</Text>, with its registered address at{' '}
            <Text style={styles.placeholderHighlight}>[ADDRESS]</Text>. Contact:{' '}
            <Text style={styles.placeholderHighlight}>[CONTACT EMAIL]</Text>.
          </Text>
        </View>

        {/* Section 2: Community access */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Community access</Text>
          <Text style={styles.paragraph}>
            Membership is subject to invitation and approval. Members must provide accurate information and follow the platform’s Terms of Use.
          </Text>
          <Text style={styles.paragraph}>
            Access to networking and events is separate from eligibility to participate in an investment opportunity.
          </Text>
        </View>

        {/* Section 3: Information on the platform */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Information on the platform</Text>
          <Text style={styles.paragraph}>
            General educational and community content is provided for informational purposes and does not constitute personalized investment, legal, or tax advice.
          </Text>
          <Text style={styles.paragraph}>
            Any specific investment opportunity is subject to its own documents, eligibility requirements, and applicable laws. Marketing images and illustrative examples do not establish actual project availability, institutional partnerships, or investment outcomes.
          </Text>
        </View>

        {/* Section 4: Access to investment opportunities */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Access to investment opportunities</Text>
          <Text style={styles.paragraph}>
            Access may depend on your location, the structure of the opportunity, and applicable eligibility requirements.
          </Text>
          <Text style={styles.paragraph}>
            Identity checks and, where required, investor-status verification must be completed before access to restricted materials or participation is approved.
          </Text>
          <View style={styles.calloutBox}>
            <Ionicons name="alert-circle-outline" size={16} color={OzaraTheme.colors.accentViolet} />
            <Text style={styles.calloutText}>
              Accepting these Access Conditions does not verify your investor status or approve you for an investment.
            </Text>
          </View>
        </View>

        {/* Section 5: Investment risks */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Investment risks</Text>
            <View style={styles.riskBadge}>
              <Text style={styles.riskBadgeText}>CAPITAL AT RISK</Text>
            </View>
          </View>
          <Text style={styles.paragraph}>
            Real estate and private investments can lose value, generate less income than expected, experience delays, and be difficult to sell.
          </Text>
          <Text style={styles.paragraph}>
            Risks may include market changes, financing costs, construction delays, operating expenses, vacancies, and legal or tax changes. You may lose some or all of the money invested.
          </Text>
          <Text style={[styles.paragraph, styles.boldWarning]}>
            Forecasts and past performance do not guarantee future results.
          </Text>
        </View>

        {/* Section 6: Your decision */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Your decision</Text>
          <Text style={styles.paragraph}>
            Review the relevant project documents, costs, risks, and restrictions before making a decision. Seek independent professional advice where appropriate.
          </Text>
        </View>

        {/* Section 7: Location restrictions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Location restrictions</Text>
          <Text style={styles.paragraph}>
            Some opportunities may be unavailable in your jurisdiction. Eligibility and access are assessed separately for each opportunity.
          </Text>
        </View>

        {/* Section 8: Acknowledgment */}
        <View style={[styles.sectionCard, styles.ackCard]}>
          <View style={styles.ackHeader}>
            <Ionicons name="checkmark-done-circle" size={20} color={OzaraTheme.colors.accentViolet} />
            <Text style={styles.ackHeading}>Acknowledgment</Text>
          </View>
          <Text style={styles.paragraph}>
            By selecting “Continue,” you acknowledge these Access Conditions and understand that investment participation requires a separate approval process.
          </Text>
        </View>

        {/* Bottom Dismiss Button */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={onBack}
          activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Return to ÖZARA</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
    zIndex: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  headerSub: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  titleSection: {
    marginBottom: 20,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  versionBadgeText: {
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  docTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  lastUpdated: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  draftNoticeCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  draftNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  draftNoticeTitle: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  draftNoticeBody: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  riskBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  riskBadgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  paragraph: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  placeholderHighlight: {
    color: '#FBBF24',
    fontWeight: '700',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  calloutText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  boldWarning: {
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 0,
  },
  ackCard: {
    borderColor: 'rgba(124, 58, 237, 0.4)',
    backgroundColor: 'rgba(124, 58, 237, 0.06)',
  },
  ackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ackHeading: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  doneBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
