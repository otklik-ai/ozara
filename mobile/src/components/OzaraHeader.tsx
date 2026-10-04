/**
 * ÖZARA Luxury Mobile Header
 * Features brand logo, persona switcher, and Gmail-style circular account avatar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { resolveImageUrl } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

export const OzaraHeader: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { currentUser, personas, switchPersona, openProfile, setAppView } = useClub();
  const [personaModalVisible, setPersonaModalVisible] = useState(false);

  const isIncomplete = currentUser && !currentUser.is_complete && currentUser.role === 'MEMBER';

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.topRow}>
        {/* ÖZARA Brand Wordmark */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>ÖZARA</Text>
          <Text style={styles.brandSub}>PRIVATE CLUB</Text>
        </View>

        {/* Right Controls: Persona Switcher & Gmail-Style Avatar */}
        <View style={styles.controlsRow}>
          {/* Persona Switcher Pill */}
          <TouchableOpacity
            style={styles.personaPill}
            onPress={() => setPersonaModalVisible(true)}
            activeOpacity={0.7}>
            <Text style={styles.personaLabel} numberOfLines={1}>
              {currentUser?.full_name?.split(' ')[0] || 'User'}
            </Text>
            <Ionicons name="chevron-down" size={12} color={OzaraTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Gmail-Style Circular Profile Avatar Button */}
          <TouchableOpacity
            style={styles.avatarTouchWrapper}
            onPress={() => openProfile()}
            activeOpacity={0.8}>
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

      {/* Persona Selection Modal */}
      <Modal
        visible={personaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPersonaModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPersonaModalVisible(false)}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Active Persona</Text>
              <TouchableOpacity onPress={() => setPersonaModalVisible(false)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={personas}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === currentUser?.id;
                return (
                  <TouchableOpacity
                    style={[styles.personaItem, isSelected && styles.personaItemSelected]}
                    onPress={() => {
                      switchPersona(item.id);
                      setPersonaModalVisible(false);
                    }}>
                    <Image
                      source={{ uri: resolveImageUrl(item.avatar_url) }}
                      style={styles.personaAvatar}
                    />
                    <View style={styles.personaMeta}>
                      <View style={styles.personaNameRow}>
                        <Text style={styles.personaNameText}>{item.full_name}</Text>
                        <Text
                          style={[
                            styles.roleBadgeText,
                            item.role === 'FOUNDER' ? styles.founderBadge : styles.memberBadge,
                          ]}>
                          {item.role === 'FOUNDER' ? 'Co-founder' : 'Member'}
                        </Text>
                      </View>
                      <Text style={styles.personaHeadline} numberOfLines={1}>
                        {item.headline}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={OzaraTheme.colors.accentCyan} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={() => {
                setPersonaModalVisible(false);
                setAppView('welcome');
              }}
              activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={16} color={OzaraTheme.colors.textMuted} />
              <Text style={styles.signOutText}>Sign Out to Welcome Page</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    gap: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: OzaraTheme.colors.textMuted,
  },
});
