/**
 * ÖZARA Mobile: Events Screen
 * Displays the real 2026/2027 calendar poster with destination cards, callouts, and RSVP
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ApiService, ClubEvent } from '../services/api';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

interface PosterEventMeta {
  code: string;
  flag: string;
  dateBadge: string;
  isCallout?: boolean;
  calloutTitle?: string;
  calloutDesc?: string;
  yearGroup: '2026' | '2027' | 'TBA';
}

const EVENT_METAS: Record<string, PosterEventMeta> = {
  evt_mia: {
    code: 'MIA',
    flag: '🇺🇸',
    dateBadge: 'Nov 13–15, 2026',
    yearGroup: '2026',
  },
  evt_phuket: {
    code: 'HKT',
    flag: '🇹🇭',
    dateBadge: 'Jan 2–9, 2027',
    isCallout: true,
    calloutTitle: 'New Year Retreat 2027',
    calloutDesc: 'Phuket • Koh Samui • Phang Nga Bay route',
    yearGroup: '2026',
  },
  evt_sv: {
    code: 'SFO',
    flag: '🇺🇸',
    dateBadge: 'Feb 19–22, 2027',
    yearGroup: '2026',
  },
  evt_geo: {
    code: 'TBS',
    flag: '🇬🇪',
    dateBadge: 'Apr 23–26, 2027',
    yearGroup: '2026',
  },
  evt_bcn: {
    code: 'BCN',
    flag: '🇪🇸',
    dateBadge: 'May 20–24, 2027',
    isCallout: true,
    calloutTitle: '7-Year Club Jubilee',
    calloutDesc: 'Grand celebratory summit & gala gathering in Barcelona',
    yearGroup: '2027',
  },
  evt_ca: {
    code: 'TAS',
    flag: '🇺🇿',
    dateBadge: 'Sep 10–17, 2027',
    yearGroup: '2027',
  },
  evt_ny_bos: {
    code: 'BOS',
    flag: '🇺🇸',
    dateBadge: 'June 2027',
    isCallout: true,
    calloutTitle: 'Top-7 Universities Program',
    calloutDesc: 'Harvard • MIT • Columbia • Yale • NYU • Princeton • Brown',
    yearGroup: '2027',
  },
};

export const EventsScreen: React.FC = () => {
  const { currentUserId } = useClub();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTabYear, setActiveTabYear] = useState<'all' | '2026' | '2027'>('all');

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getEvents(currentUserId);
      setEvents(data);
    } catch (err) {
      console.warn('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentUserId]);

  const handleRsvp = async (event: ClubEvent) => {
    try {
      const actionStatus = event.user_rsvp === 'registered' ? 'cancelled' : 'registered';
      const res = await ApiService.rsvpEvent(event.id, currentUserId, actionStatus);
      if (res.success) {
        setEvents(prev =>
          prev.map(e =>
            e.id === event.id
              ? {
                  ...e,
                  user_rsvp: (actionStatus === 'registered' ? 'registered' : 'none') as 'registered' | 'none',
                  registered_count: res.registered_count,
                }
              : e
          )
        );
        Alert.alert(
          actionStatus === 'registered' ? 'RSVP Confirmed' : 'RSVP Cancelled',
          actionStatus === 'registered'
            ? `Your seat at "${event.title}" is reserved.`
            : `You have removed your reservation for "${event.title}".`
        );
      }
    } catch (err: any) {
      Alert.alert('RSVP Error', err.message || 'Could not update RSVP');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Hero Poster Header */}
      <View style={styles.headerBlock}>
        <View style={styles.tagRow}>
          <View style={styles.tagDot} />
          <Text style={styles.tagText}>CALENDAR 2026 / 2027</Text>
        </View>
        <Text style={styles.headline}>Global Retreats &amp; Private Summits</Text>
        <Text style={styles.subtext}>
          High-conviction gatherings in world-class destinations for verified club founders.
        </Text>
      </View>

      {/* Year Filter Tabs */}
      <View style={styles.filterTabsRow}>
        {(['all', '2026', '2027'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeTabYear === tab && styles.filterTabActive]}
            onPress={() => setActiveTabYear(tab)}>
            <Text
              style={[
                styles.filterTabText,
                activeTabYear === tab && styles.filterTabTextActive,
              ]}>
              {tab === 'all' ? 'All Expeditions' : `Season ${tab}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color={OzaraTheme.colors.accentCyan} />
        </View>
      ) : (
        <View style={styles.eventsList}>
          {events.map(event => {
            const meta = EVENT_METAS[event.id] || {
              code: 'GLB',
              flag: '🌐',
              dateBadge: '2026–2027',
              yearGroup: '2026',
            };

            if (activeTabYear !== 'all' && meta.yearGroup !== activeTabYear) {
              return null;
            }

            const isRegistered = event.user_rsvp === 'registered';

            return (
              <View key={event.id} style={styles.eventCard}>
                {/* Top Badge Strip */}
                <View style={styles.cardTopStrip}>
                  <View style={styles.cityPill}>
                    <Text style={styles.cityFlag}>{meta.flag}</Text>
                    <Text style={styles.cityCode}>{meta.code}</Text>
                    <Text style={styles.cityDate}>{meta.dateBadge}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isRegistered ? styles.statusPillRegistered : styles.statusPillOpen,
                    ]}>
                    <View
                      style={[
                        styles.statusDot,
                        isRegistered ? styles.dotEmerald : styles.dotAmber,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        isRegistered ? styles.textEmerald : styles.textAmber,
                      ]}>
                      {isRegistered ? 'Seat Confirmed' : 'Registration Open'}
                    </Text>
                  </View>
                </View>

                {/* Event Title & Location */}
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color={OzaraTheme.colors.textMuted} />
                  <Text style={styles.locationText}>{event.location}</Text>
                </View>

                {/* Poster Callout Banner */}
                {meta.isCallout && (
                  <View style={styles.calloutBox}>
                    <Text style={styles.calloutTitle}>✦ {meta.calloutTitle}</Text>
                    <Text style={styles.calloutDesc}>{meta.calloutDesc}</Text>
                  </View>
                )}

                {/* Description */}
                <Text style={styles.eventDesc}>{event.description}</Text>

                {/* Card Footer: Attendees + RSVP Button */}
                <View style={styles.cardFooter}>
                  <View style={styles.capacityMeta}>
                    <Ionicons name="people-outline" size={14} color={OzaraTheme.colors.textSecondary} />
                    <Text style={styles.capacityText}>
                      {event.registered_count} / {event.capacity} Leaders Confirmed
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.rsvpBtn,
                      isRegistered ? styles.rsvpBtnRegistered : styles.rsvpBtnAction,
                    ]}
                    onPress={() => handleRsvp(event)}
                    activeOpacity={0.8}>
                    <Text
                      style={[
                        styles.rsvpBtnText,
                        isRegistered ? styles.rsvpTextRegistered : styles.rsvpTextAction,
                      ]}>
                      {isRegistered ? 'Attending ✓' : 'Reserve Seat'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Grand Tour Teaser Banner */}
          <View style={styles.teaserCard}>
            <View style={styles.teaserTag}>
              <Text style={styles.teaserTagText}>SUMMER 2027 • DATES TBA</Text>
            </View>
            <Text style={styles.teaserTitle}>European Grand Salon Tour</Text>
            <Text style={styles.teaserDesc}>
              London • Paris • Cannes • Zurich • Monaco
            </Text>
            <Text style={styles.teaserSub}>
              Curated private dinners, yacht salons, and family office roundtables across Europe's financial capitals.
            </Text>
          </View>
        </View>
      )}
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
    marginBottom: 20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: OzaraTheme.colors.accentCyan,
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
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: OzaraTheme.radius.full,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  filterTabActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#000000',
  },
  loaderBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  eventsList: {
    gap: 16,
  },
  eventCard: {
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    padding: 16,
  },
  cardTopStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: OzaraTheme.radius.full,
  },
  cityFlag: {
    fontSize: 12,
  },
  cityCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  cityDate: {
    fontSize: 10,
    color: OzaraTheme.colors.textSecondary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: OzaraTheme.radius.full,
  },
  statusPillOpen: {
    backgroundColor: OzaraTheme.colors.accentWarningBg,
  },
  statusPillRegistered: {
    backgroundColor: OzaraTheme.colors.accentEmeraldBg,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotAmber: {
    backgroundColor: OzaraTheme.colors.accentWarning,
  },
  dotEmerald: {
    backgroundColor: OzaraTheme.colors.accentEmerald,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textAmber: {
    color: '#fbbf24',
  },
  textEmerald: {
    color: OzaraTheme.colors.accentEmerald,
  },
  eventTitle: {
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
  calloutBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: OzaraTheme.radius.md,
    padding: 10,
    marginBottom: 10,
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: OzaraTheme.colors.accentCyan,
    marginBottom: 2,
  },
  calloutDesc: {
    fontSize: 11,
    color: '#e0f2fe',
    lineHeight: 15,
  },
  eventDesc: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
  },
  capacityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capacityText: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    fontWeight: '500',
  },
  rsvpBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: OzaraTheme.radius.full,
  },
  rsvpBtnAction: {
    backgroundColor: '#ffffff',
  },
  rsvpBtnRegistered: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.accentEmerald,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rsvpTextAction: {
    color: '#000000',
  },
  rsvpTextRegistered: {
    color: OzaraTheme.colors.accentEmerald,
  },
  teaserCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderRadius: OzaraTheme.radius.lg,
    padding: 16,
    marginTop: 8,
  },
  teaserTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: OzaraTheme.radius.full,
    marginBottom: 8,
  },
  teaserTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: OzaraTheme.colors.accentGold,
    letterSpacing: 0.5,
  },
  teaserTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  teaserDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: OzaraTheme.colors.accentGold,
    marginBottom: 6,
  },
  teaserSub: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 16,
  },
});
