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

    // Preload Inter font immediately at root startup
    if (typeof document !== 'undefined' && !document.getElementById('ozara-google-fonts')) {
      const link = document.createElement('link');
      link.id = 'ozara-google-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@800;900&display=swap';
      document.head.appendChild(link);
    }
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
