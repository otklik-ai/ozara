/**
 * ÖZARA Mobile: Networking Screen
 * Explainable recommendations, search, category filters, and call booking
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { ApiService, Recommendation, resolveImageUrl } from '../services/api';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

const FILTER_TAGS = ['All', 'Enterprise AI', 'FinTech', 'Real Estate', 'Logistics', 'Cross-Border'];

export const NetworkingScreen: React.FC = () => {
  const { currentUserId, openProfile } = useClub();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // Booking Modal State
  const [bookingModalTarget, setBookingModalTarget] = useState<Recommendation | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string>('');
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);

  // Intro Modal State
  const [introModalTarget, setIntroModalTarget] = useState<Recommendation | null>(null);
  const [introNeed, setIntroNeed] = useState<string>('');
  const [introSubmitting, setIntroSubmitting] = useState<boolean>(false);

  const loadData = async (query?: string) => {
    try {
      setLoading(true);
      const data = await ApiService.getRecommendations(currentUserId, query);
      setRecommendations(data);
    } catch (err) {
      console.warn('Error loading recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(searchQuery);
  }, [currentUserId, searchQuery]);

  const filteredMembers = recommendations.filter(m => {
    if (activeFilter === 'All') return true;
    const filterLower = activeFilter.toLowerCase();
    const matchesTag = m.matched_tags?.some(t => t.value.toLowerCase().includes(filterLower));
    const matchesHeadline = m.headline.toLowerCase().includes(filterLower);
    return matchesTag || matchesHeadline;
  });

  const handleBookCallSubmit = async () => {
    if (!bookingModalTarget) return;
    try {
      setBookingSubmitting(true);
      const res = await ApiService.bookCall(
        currentUserId,
        bookingModalTarget.id,
        bookingMessage || 'Would love to connect on peer collaboration opportunities.',
        [new Date(Date.now() + 86400000 * 3).toISOString()]
      );
      if (res.success) {
        Alert.alert(
          'Call Invitation Sent',
          `Your 20-min peer call request has been delivered to ${bookingModalTarget.full_name}.`
        );
        setBookingModalTarget(null);
        setBookingMessage('');
      }
    } catch (err: any) {
      Alert.alert('Booking Error', err.message || 'Could not schedule call');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleIntroSubmit = async () => {
    if (!introModalTarget) return;
    if (!introNeed.trim()) {
      Alert.alert('Context Needed', 'Please briefly share what specific topic you need an intro on.');
      return;
    }
    try {
      setIntroSubmitting(true);
      const res = await ApiService.requestIntro(
        currentUserId,
        introModalTarget.id,
        introNeed
      );
      if (res.success) {
        Alert.alert(
          'Introduction Requested',
          `Our founding team (Alexandra, Julia, Elena) has received your request and will facilitate a warm double-opt-in connection.`
        );
        setIntroModalTarget(null);
        setIntroNeed('');
      }
    } catch (err: any) {
      Alert.alert('Intro Request Error', err.message || 'Could not submit intro request');
    } finally {
      setIntroSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.headerBlock}>
        <View style={styles.tagRow}>
          <Ionicons name="sparkles" size={12} color={OzaraTheme.colors.accentCyan} />
          <Text style={styles.tagText}>EXPLAINABLE PEER GRAPH</Text>
        </View>
        <Text style={styles.headline}>High-Conviction Networking</Text>
        <Text style={styles.subtext}>
          Curated introductions driven by verified capabilities, active strategic needs, and chapter presence.
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={OzaraTheme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by expertise, industry, or name..."
          placeholderTextColor={OzaraTheme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={OzaraTheme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {FILTER_TAGS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.filterPill, activeFilter === tag && styles.filterPillActive]}
              onPress={() => setActiveFilter(tag)}>
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === tag && styles.filterPillTextActive,
                ]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color={OzaraTheme.colors.accentCyan} />
        </View>
      ) : (
        <View style={styles.cardsList}>
          {filteredMembers.map(member => (
            <TouchableOpacity
              key={member.id}
              style={styles.memberCard}
              activeOpacity={0.9}
              onPress={() => openProfile(member.id)}>
              {/* Member Top Row */}
              <View style={styles.cardHeader}>
                <Image
                  source={{ uri: resolveImageUrl(member.avatar_url) }}
                  style={styles.avatar}
                />
                <View style={styles.memberMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.memberName}>{member.full_name}</Text>
                    {member.match_score > 0 && (
                      <View style={styles.matchScoreBadge}>
                        <Text style={styles.matchScoreText}>
                          {Math.round(member.match_score * 100)}% Match
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberHeadline} numberOfLines={2}>
                    {member.headline}
                  </Text>
                  <View style={styles.chapterBadge}>
                    <Ionicons name="location-outline" size={11} color={OzaraTheme.colors.textMuted} />
                    <Text style={styles.chapterText}>
                      {member.chapter_name || `${member.city}, ${member.country}`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Explainable Match Rationale Pill */}
              {member.match_rationale ? (
                <View style={styles.rationaleBox}>
                  <View style={styles.rationaleHeader}>
                    <Text style={styles.rationaleTag}>✦ Why this match</Text>
                  </View>
                  <Text style={styles.rationaleText}>{member.match_rationale}</Text>
                </View>
              ) : null}

              {/* Tag Pills */}
              {member.matched_tags && member.matched_tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {member.matched_tags.map((t, idx) => (
                    <View key={idx} style={styles.tagPill}>
                      <Text style={styles.tagPillText}>{t.value}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action Buttons Row */}
              <View style={styles.actionsRow}>
                {member.contact_preference === 'direct_contact' ? (
                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={() => setBookingModalTarget(member)}>
                    <Ionicons name="calendar-outline" size={13} color="#000000" />
                    <Text style={styles.actionBtnPrimaryText}>Schedule 20-min Call</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={() => setIntroModalTarget(member)}>
                    <Ionicons name="mail-unread-outline" size={13} color="#000000" />
                    <Text style={styles.actionBtnPrimaryText}>Ask Team for Intro</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => openProfile(member.id)}>
                  <Text style={styles.actionBtnSecondaryText}>View Profile</Text>
                  <Ionicons name="chevron-forward" size={12} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Schedule Call Modal */}
      <Modal
        visible={!!bookingModalTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingModalTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Schedule Call with {bookingModalTarget?.full_name?.split(' ')[0]}
              </Text>
              <TouchableOpacity onPress={() => setBookingModalTarget(null)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Proposed time: Next Tuesday at 14:00 (Your local time)
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Add a brief agenda or note for the call..."
              placeholderTextColor={OzaraTheme.colors.textMuted}
              multiline
              numberOfLines={4}
              value={bookingMessage}
              onChangeText={setBookingMessage}
            />
            <TouchableOpacity
              style={[styles.modalSubmitBtn, bookingSubmitting && styles.btnDisabled]}
              onPress={handleBookCallSubmit}
              disabled={bookingSubmitting}>
              {bookingSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.modalSubmitText}>Confirm &amp; Send Invitation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Ask Team for Intro Modal */}
      <Modal
        visible={!!introModalTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setIntroModalTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask the Team for Intro</Text>
              <TouchableOpacity onPress={() => setIntroModalTarget(null)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {introModalTarget?.full_name} prefers warm introductions through the founding team (Alexandra, Julia, Elena).
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What specific challenge or initiative do you want to connect on?"
              placeholderTextColor={OzaraTheme.colors.textMuted}
              multiline
              numberOfLines={4}
              value={introNeed}
              onChangeText={setIntroNeed}
            />
            <TouchableOpacity
              style={[styles.modalSubmitBtn, introSubmitting && styles.btnDisabled]}
              onPress={handleIntroSubmit}
              disabled={introSubmitting}>
              {introSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.modalSubmitText}>Submit Intro Request</Text>
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
    color: OzaraTheme.colors.accentCyan,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    padding: 0,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: OzaraTheme.radius.full,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  filterPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#000000',
  },
  loaderBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  cardsList: {
    gap: 16,
  },
  memberCard: {
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderMedium,
  },
  memberMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  matchScoreBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.accentEmerald,
    borderRadius: OzaraTheme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchScoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.accentEmerald,
  },
  memberHeadline: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chapterText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  rationaleBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.18)',
    borderRadius: OzaraTheme.radius.md,
    padding: 10,
    marginBottom: 12,
  },
  rationaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  rationaleTag: {
    fontSize: 11,
    fontWeight: '700',
    color: OzaraTheme.colors.accentCyan,
  },
  rationaleText: {
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: OzaraTheme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagPillText: {
    fontSize: 11,
    color: '#d1d5db',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 8,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  actionBtnSecondary: {
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
  actionBtnSecondaryText: {
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
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
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
