/**
 * ÖZARA Mobile: Main Luxury Tab Navigator
 * Combines OzaraHeader, 4 core screens, custom Bottom Tab Bar, and Profile Drawer Modal
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OzaraTheme } from '../constants/ozara-theme';
import { useClub, TabKey } from '../context/ClubContext';
import { OzaraHeader } from './OzaraHeader';
import { CommunityScreen } from '../screens/CommunityScreen';
import { NetworkingScreen } from '../screens/NetworkingScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { InvestmentsScreen } from '../screens/InvestmentsScreen';
import { ProfileDrawerModal } from './ProfileDrawerModal';
import { Ionicons } from '@expo/vector-icons';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabConfig[] = [
  {
    key: 'community',
    label: 'Community',
    icon: 'chatbubbles-outline',
    activeIcon: 'chatbubbles',
  },
  {
    key: 'networking',
    label: 'Network',
    icon: 'people-outline',
    activeIcon: 'people',
  },
  {
    key: 'events',
    label: 'Events',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    key: 'investments',
    label: 'Investments',
    icon: 'business-outline',
    activeIcon: 'business',
  },
];

export const OzaraTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { activeTab, setActiveTab } = useClub();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <OzaraHeader />

      {/* Active Screen View */}
      <View style={styles.screenContainer}>
        {activeTab === 'community' && <CommunityScreen />}
        {activeTab === 'networking' && <NetworkingScreen />}
        {activeTab === 'events' && <EventsScreen />}
        {activeTab === 'investments' && <InvestmentsScreen />}
      </View>

      {/* Luxury Bottom Tab Bar (Pinned and visible at all times) */}
      <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabBtn}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}>
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={20}
                  color={isActive ? '#38bdf8' : OzaraTheme.colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Global Slide-Over Profile & Questionnaire Modal */}
      <ProfileDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    backgroundColor: OzaraTheme.colors.background,
    overflow: 'hidden',
    position: 'relative',
  },
  screenContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  bottomTabBar: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 11, 14, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    paddingHorizontal: 8,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } : {}),
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabIconWrap: {
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: OzaraTheme.radius.full,
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
