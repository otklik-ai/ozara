import React, { useEffect } from 'react';
import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ClubProvider } from '@/context/ClubContext';
import { AppNavigator } from '@/components/AppNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    // Hide native splash screen immediately so custom lime intro takes over
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <ClubProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </ClubProvider>
    </ThemeProvider>
  );
}
