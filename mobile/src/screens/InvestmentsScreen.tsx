/**
 * ÖZARA Mobile: Investments Screen
 * Off-market real estate assets, yield summaries, inquiry modals, and disclaimers
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  ApiService,
  RealEstateListing,
  resolveImageUrl,
  CURRENT_ACCESS_CONDITIONS_VERSION,
} from '../services/api';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

export const InvestmentsScreen: React.FC = () => {
  const { currentUserId, refreshUserData, openConditions } = useClub();
  const [listings, setListings] = useState<RealEstateListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Inquiry Modal State
  const [activeListing, setActiveListing] = useState<RealEstateListing | null>(null);
  const [inquiryType, setInquiryType] = useState<'request_info' | 'request_call'>('request_call');
  const [inquiryNotes, setInquiryNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadListings = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getListings();
      setListings(data);
    } catch (err) {
      console.warn('Error loading listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const handleInquirySubmit = async () => {
    if (!activeListing) return;
    try {
      setSubmitting(true);
      const res = await ApiService.submitInquiry(
        activeListing.id,
        currentUserId,
        inquiryType,
        inquiryNotes || 'Interested in allocation availability and delivery timelines.'
      );
      if (res.success) {
        Alert.alert(
          'Inquiry Submitted',
          `Your inquiry for "${activeListing.title}" has been registered. An institutional asset manager will follow up with verified documentation.`
        );
        setActiveListing(null);
        setInquiryNotes('');
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('CONDITIONS_NOT_ACCEPTED') || errMsg.includes('Access Conditions')) {
        Alert.alert(
          'Access Conditions Required',
          `Participation in investment materials requires agreeing to the latest Access Conditions (v${CURRENT_ACCESS_CONDITIONS_VERSION}).`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Review Conditions',
              onPress: () => {
                setActiveListing(null);
                openConditions('tabs');
              },
            },
            {
              text: 'Accept Now',
              onPress: async () => {
                try {
                  await ApiService.acceptConditions(currentUserId, CURRENT_ACCESS_CONDITIONS_VERSION);
                  await refreshUserData();
                  Alert.alert('Accepted', 'Access Conditions accepted. You may now submit your inquiry.');
                } catch (e: any) {
                  Alert.alert('Error', e.message);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Inquiry Error', errMsg || 'Could not submit inquiry');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.headerBlock}>
        <View style={styles.tagRow}>
          <Ionicons name="business" size={12} color={OzaraTheme.colors.accentGold} />
          <Text style={styles.tagText}>OFF-MARKET REAL ESTATE</Text>
        </View>
        <Text style={styles.headline}>Curated Prime Portfolios</Text>
        <Text style={styles.subtext}>
          Vetted residential, hospitality, and commercial assets across Dubai, London, and Mediterranean capitals.
        </Text>
      </View>

      {/* Mandatory Regulatory Compliance Disclaimer */}
      <View style={styles.disclaimerCard}>
        <Ionicons name="shield-checkmark-outline" size={14} color={OzaraTheme.colors.accentGold} />
        <Text style={styles.disclaimerText}>
          Informational showcase only for verified club members. ÖZARA does not provide investment advice, conduct broker-dealer activities, or execute financial transactions.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color={OzaraTheme.colors.accentGold} />
        </View>
      ) : (
        <View style={styles.listingsList}>
          {listings.map(item => (
            <View key={item.id} style={styles.listingCard}>
              {/* Main Photo with floating tag */}
              <View style={styles.photoContainer}>
                <Image
                  source={{
                    uri: item.images?.[0]
                      ? resolveImageUrl(item.images[0])
                      : 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600',
                  }}
                  style={styles.propertyImg}
                />
                <View style={styles.propertyTypePill}>
                  <Text style={styles.propertyTypeText}>{item.property_type}</Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.cardDetails}>
                <Text style={styles.listingTitle}>{item.title}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color={OzaraTheme.colors.textMuted} />
                  <Text style={styles.locationText}>{item.location}</Text>
                </View>
                <Text style={styles.summaryText}>{item.short_summary}</Text>

                {/* Highlights Strip */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>STATUS</Text>
                    <Text style={styles.metricValue}>Off-Market Direct</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>CURATED BY</Text>
                    <Text style={styles.metricValue}>{item.created_by}</Text>
                  </View>
                </View>

                {/* Configurable Opportunity Eligibility Requirements */}
                {item.eligibility_requirements && (
                  <View style={styles.eligibilityBlock}>
                    <View style={styles.eligibilityHeader}>
                      <Ionicons name="shield-checkmark" size={11} color={OzaraTheme.colors.accentViolet} />
                      <Text style={styles.eligibilityTitle}>ELIGIBILITY REQUIREMENTS</Text>
                    </View>
                    <View style={styles.eligibilityTagsRow}>
                      {item.eligibility_requirements.requires_investor_status && (
                        <View style={styles.eligibilityTag}>
                          <Text style={styles.eligibilityTagText}>Verified Investor Status</Text>
                        </View>
                      )}
                      {item.eligibility_requirements.minimum_verification_tier && (
                        <View style={styles.eligibilityTag}>
                          <Text style={styles.eligibilityTagText}>
                            Tier: {item.eligibility_requirements.minimum_verification_tier}
                          </Text>
                        </View>
                      )}
                      {item.eligibility_requirements.max_ticket_size && (
                        <View style={styles.eligibilityTag}>
                          <Text style={styles.eligibilityTagText}>
                            Max Check: ${(item.eligibility_requirements.max_ticket_size / 1000000).toFixed(1)}M
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.inquireBtn}
                    onPress={() => {
                      setInquiryType('request_call');
                      setActiveListing(item);
                    }}>
                    <Ionicons name="call-outline" size={13} color="#000000" />
                    <Text style={styles.inquireBtnText}>Request Private Briefing</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.brochureBtn}
                    onPress={() => {
                      setInquiryType('request_info');
                      setActiveListing(item);
                    }}>
                    <Ionicons name="document-text-outline" size={13} color="#ffffff" />
                    <Text style={styles.brochureBtnText}>Request Deck</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Inquiry Modal */}
      <Modal
        visible={!!activeListing}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveListing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asset Inquiry</Text>
              <TouchableOpacity onPress={() => setActiveListing(null)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalAssetTitle} numberOfLines={1}>
              {activeListing?.title}
            </Text>

            {/* Type selector */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  inquiryType === 'request_call' && styles.typeOptionActive,
                ]}
                onPress={() => setInquiryType('request_call')}>
                <Text
                  style={[
                    styles.typeOptionText,
                    inquiryType === 'request_call' && styles.typeOptionTextActive,
                  ]}>
                  Request Call
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  inquiryType === 'request_info' && styles.typeOptionActive,
                ]}
                onPress={() => setInquiryType('request_info')}>
                <Text
                  style={[
                    styles.typeOptionText,
                    inquiryType === 'request_info' && styles.typeOptionTextActive,
                  ]}>
                  Request Documentation
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="What questions or allocation details do you need?"
              placeholderTextColor={OzaraTheme.colors.textMuted}
              multiline
              numberOfLines={4}
              value={inquiryNotes}
              onChangeText={setInquiryNotes}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, submitting && styles.btnDisabled]}
              onPress={handleInquirySubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.modalSubmitText}>Submit Inquiry</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 16,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: OzaraTheme.colors.accentGold,
    letterSpacing: 1,
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtext: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 18,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderRadius: OzaraTheme.radius.md,
    padding: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#fef3c7',
    lineHeight: 15,
    flex: 1,
  },
  loaderBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  listingsList: {
    gap: 20,
  },
  listingCard: {
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    overflow: 'hidden',
  },
  photoContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: '#000',
  },
  propertyImg: {
    width: '100%',
    height: '100%',
  },
  propertyTypePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  propertyTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  cardDetails: {
    padding: 16,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
  },
  summaryText: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  eligibilityBlock: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  eligibilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eligibilityTitle: {
    color: '#C4B5FD',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  eligibilityTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  eligibilityTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  eligibilityTagText: {
    color: '#E2E8F0',
    fontSize: 10.5,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inquireBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 8,
  },
  inquireBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  brochureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  brochureBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderTopLeftRadius: OzaraTheme.radius.xl,
    borderTopRightRadius: OzaraTheme.radius.xl,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderMedium,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalAssetTitle: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    marginBottom: 14,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: OzaraTheme.radius.full,
    alignItems: 'center',
    backgroundColor: OzaraTheme.colors.backgroundInput,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  typeOptionActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
  },
  typeOptionTextActive: {
    color: '#000000',
  },
  modalInput: {
    backgroundColor: OzaraTheme.colors.backgroundInput,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    padding: 12,
    color: '#ffffff',
    fontSize: 13,
    textAlignVertical: 'top',
    height: 100,
    marginBottom: 16,
  },
  modalSubmitBtn: {
    backgroundColor: '#ffffff',
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
});
