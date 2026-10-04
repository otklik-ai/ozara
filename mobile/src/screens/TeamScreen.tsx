/**
 * ÖZARA Mobile: Team / Leadership Screen
 * Exact AXEVIL-inspired design for the two co-founders
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { resolveImageUrl } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

interface LeaderItem {
  id: string;
  name: string;
  rolePill: string;
  avatar: string;
  bio: string;
  tags: string[];
}

const LEADERS: LeaderItem[] = [
  {
    id: 'usr_alexandra',
    name: 'Alexandra Hill',
    rolePill: 'Co-founder & Managing Partner',
    avatar: '/avatars/alexandra_hill.jpg',
    bio: '15+ years in wealth management and AI transformation. Founder of AI × Visibility, Advisory Board Member at Frontier Path Ventures, Mentor at HBS FIELD X, and MIT Sloan Fellow. Ranked #23 on AdvisorHub Advisors to Watch.',
    tags: ['Boston, USA', 'MIT Sloan', 'AI × Wealth Advisory'],
  },
  {
    id: 'usr_julia',
    name: 'Julia Shchukina',
    rolePill: 'Co-founder & Managing Partner',
    avatar: '/avatars/julia_shchukina.jpg',
    bio: 'Founder of international real estate investment company EDELUXE (operating in 50+ countries) and original founder of investor club "Power of Connections". Real estate investor across 70+ countries and philanthropic founder.',
    tags: ['Dubai & Global', 'EDELUXE', 'Real Estate & Syndicates'],
  },
];

export const TeamScreen: React.FC = () => {
  const { openProfile } = useClub();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.maxContainer}>
        {/* Header Block */}
        <View style={styles.headerBlock}>
          <View style={styles.tagRow}>
            <View style={styles.tagDot} />
            <Text style={styles.tagText}>1.0 LEADERSHIP</Text>
          </View>
          <Text style={styles.headline}>Industry leading experts,{'\n'}at your side</Text>
          <Text style={styles.subtext}>
            Founders, investment partners, and ecosystem curators. Distributed across Boston, Dubai, and Silicon Valley.
          </Text>
        </View>

        {/* Leadership 2-Card Grid */}
        <View style={[styles.cardsList, isWide && styles.cardsListWide]}>
          {LEADERS.map(leader => (
            <View
              key={leader.id}
              style={[styles.leaderCard, isWide && styles.leaderCardWide]}>
              {/* Portrait with Floating Pill */}
              <View style={styles.portraitWrap}>
                <Image
                  source={{ uri: resolveImageUrl(leader.avatar) }}
                  style={[
                    styles.portraitImg,
                    Platform.OS === 'web'
                      ? ({ objectFit: 'cover', objectPosition: 'center 15%' } as any)
                      : {},
                  ]}
                  resizeMode="cover"
                />
                <View style={styles.rolePill}>
                  <View style={styles.pillDot} />
                  <Text style={styles.rolePillText}>{leader.rolePill}</Text>
                </View>
              </View>

              {/* Info Section */}
              <View style={styles.cardInfo}>
                <Text style={styles.leaderName}>{leader.name}</Text>
                <Text style={styles.leaderBio}>{leader.bio}</Text>

                {/* Tags */}
                <View style={styles.tagsRow}>
                  {leader.tags.map((tag, idx) => (
                    <View key={idx} style={styles.tagPill}>
                      <Text style={styles.tagTextSmall}>{tag}</Text>
                    </View>
                  ))}
                </View>

                {/* View Full Profile Action */}
                <TouchableOpacity
                  style={styles.viewProfileBtn}
                  onPress={() => openProfile(leader.id)}
                  activeOpacity={0.8}>
                  <Text style={styles.viewProfileBtnText}>View Full Profile</Text>
                  <Ionicons name="chevron-forward" size={13} color="#000000" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>
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
    alignItems: 'center',
  },
  maxContainer: {
    width: '100%',
    maxWidth: 960,
  },
  headerBlock: {
    marginBottom: 24,
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
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 18,
    maxWidth: 600,
  },
  cardsList: {
    width: '100%',
    gap: 20,
  },
  cardsListWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  leaderCard: {
    width: '100%',
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.xl,
    padding: 14,
  },
  leaderCardWide: {
    flex: 1,
    maxWidth: 460,
  },
  portraitWrap: {
    width: '100%',
    aspectRatio: 0.88,
    maxHeight: 460,
    borderRadius: OzaraTheme.radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },
  portraitImg: {
    width: '100%',
    height: '100%',
  },
  rolePill: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 15, 19, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: OzaraTheme.radius.full,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#9ca3af',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  cardInfo: {
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 4,
  },
  leaderName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  leaderBio: {
    fontSize: 12.5,
    lineHeight: 18.5,
    color: OzaraTheme.colors.textSecondary,
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 18,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: OzaraTheme.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  tagTextSmall: {
    fontSize: 11,
    color: '#d1d5db',
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 11,
  },
  viewProfileBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#000000',
  },
});
