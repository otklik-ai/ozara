/**
 * ÖZARA Mobile: Main Luxury Tab Navigator
 * Combines OzaraHeader, 4 core screens, custom Bottom Tab Bar, and Profile Drawer Modal
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OzaraTheme } from '../constants/ozara-theme';
import { OzaraHeader } from './OzaraHeader';
import { EventsScreen } from '../screens/EventsScreen';
import { NetworkingScreen } from '../screens/NetworkingScreen';
import { InvestmentsScreen } from '../screens/InvestmentsScreen';
import { TeamScreen } from '../screens/TeamScreen';
import { ProfileDrawerModal } from './ProfileDrawerModal';
import { Ionicons } from '@expo/vector-icons';

type TabKey = 'events' | 'networking' | 'investments' | 'team';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabConfig[] = [
  {
    key: 'events',
    label: 'Events',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    key: 'networking',
    label: 'Networking',
    icon: 'people-outline',
    activeIcon: 'people',
  },
  {
    key: 'investments',
    label: 'Investments',
    icon: 'business-outline',
    activeIcon: 'business',
  },
  {
    key: 'team',
    label: 'Team',
    icon: 'ribbon-outline',
    activeIcon: 'ribbon',
  },
];

export const OzaraTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('events');

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <OzaraHeader />

      {/* Active Screen View */}
      <View style={styles.screenContainer}>
        {activeTab === 'events' && <EventsScreen />}
        {activeTab === 'networking' && <NetworkingScreen />}
        {activeTab === 'investments' && <InvestmentsScreen />}
        {activeTab === 'team' && <TeamScreen />}
      </View>

      {/* Luxury Bottom Tab Bar */}
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
                  color={isActive ? '#ffffff' : OzaraTheme.colors.textMuted}
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
    backgroundColor: OzaraTheme.colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 11, 14, 0.96)',
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
    paddingTop: 8,
    paddingHorizontal: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#ffffff',
  },
});
