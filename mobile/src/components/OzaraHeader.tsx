/**
 * ÖZARA Luxury Mobile Header
 * Features brand logo, persona switcher, and Gmail-style circular account avatar
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { ApiService, resolveImageUrl } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { InboxModal } from './InboxModal';

export const OzaraHeader: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { currentUser, openProfile } = useClub();

  const [unreadTotalCount, setUnreadTotalCount] = useState<number>(0);
  const [showInbox, setShowInbox] = useState<boolean>(false);

  const fetchUnreadCount = async () => {
    const uid = currentUser?.id;
    if (!uid) return;
    try {
      const summary = await ApiService.getInboxSummary(uid);
      setUnreadTotalCount(summary.total_unread || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 25000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const isIncomplete = currentUser && !currentUser.is_complete && currentUser.role === 'MEMBER';

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.topRow}>
        {/* ÖZARA Brand Wordmark */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>ÖZARA</Text>
          <Text style={styles.brandSub}>PRIVATE CLUB</Text>
        </View>

        {/* Right Controls: Inbox & Messages + Authenticated Member Avatar */}
        <View style={styles.controlsRow}>
          {/* Top Navigation Inbox Button */}
          <TouchableOpacity
            style={styles.bellTouchWrapper}
            onPress={() => setShowInbox(true)}
            activeOpacity={0.75}
            accessibilityLabel="Inbox & Messages">
            <View style={styles.bellIconBox}>
              <Ionicons name="mail-outline" size={19} color="#ffffff" />
            </View>
            {unreadTotalCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadTotalCount > 9 ? '9+' : unreadTotalCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarTouchWrapper}
            onPress={() => openProfile()}
            activeOpacity={0.8}
            accessibilityLabel="My Profile">
            <View style={styles.avatarGradientRing}>
              <View style={styles.avatarInnerGap}>
                <Image
                  source={{ uri: resolveImageUrl(currentUser?.avatar_url) }}
                  style={styles.avatarImg}
                />
              </View>
            </View>
            {isIncomplete && <View style={styles.incompleteDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Incomplete Profile Alert Banner (Question 18 Mandate) */}
      {isIncomplete && (
        <TouchableOpacity
          style={styles.incompleteBanner}
          onPress={() => openProfile()}
          activeOpacity={0.85}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerIcon}>⚠️</Text>
            <Text style={styles.bannerText}>
              Profile incomplete: <Text style={styles.bannerTextBold}>Question 18</Text> required.
            </Text>
          </View>
          <Text style={styles.bannerAction}>Complete →</Text>
        </TouchableOpacity>
      )}

      {/* In-App Inbox & Messaging Modal */}
      <InboxModal
        visible={showInbox}
        onClose={() => {
          setShowInbox(false);
          fetchUnreadCount();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: OzaraTheme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3,
    textAlign: 'center',
  },
  brandSub: {
    fontSize: 7.5,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 2,
    marginTop: -2,
    textAlign: 'center',
    alignSelf: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellTouchWrapper: {
    position: 'relative',
    padding: 2,
  },
  bellIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000000',
  },
  personaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  personaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textPrimary,
    maxWidth: 90,
  },
  avatarTouchWrapper: {
    position: 'relative',
    padding: 2,
  },
  avatarGradientRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: OzaraTheme.colors.accentCyan,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInnerGap: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    backgroundColor: '#000000',
    padding: 2,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  incompleteDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: OzaraTheme.colors.accentWarning,
    borderWidth: 2,
    borderColor: '#000',
  },
  incompleteBanner: {
    marginTop: 8,
    backgroundColor: OzaraTheme.colors.accentWarningBg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: OzaraTheme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bannerIcon: {
    fontSize: 12,
  },
  bannerText: {
    fontSize: 11,
    color: '#fbbf24',
    flex: 1,
  },
  bannerTextBold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  bannerAction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderMedium,
    borderRadius: OzaraTheme.radius.lg,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  personaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: OzaraTheme.radius.md,
    marginBottom: 6,
    gap: 12,
  },
  personaItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  personaAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  personaMeta: {
    flex: 1,
  },
  personaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  personaNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  founderBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    color: '#f59e0b',
  },
  memberBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#9ca3af',
  },
  personaHeadline: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  signOutBtn: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: OzaraTheme.radius.full,
    backgroundColor: OzaraTheme.colors.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: OzaraTheme.colors.accentViolet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
      web: {
        cursor: 'pointer',
        boxShadow: `0 4px 14px ${OzaraTheme.colors.accentViolet}55`,
      } as any,
    }),
  },
  signOutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
