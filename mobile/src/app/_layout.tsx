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

    // Configure browser dark color-scheme and autofill styling
    if (typeof document !== 'undefined') {
      let meta = document.querySelector('meta[name="color-scheme"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'color-scheme');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'dark');
      if (document.documentElement) {
        document.documentElement.style.colorScheme = 'dark';
      }

      if (!document.getElementById('ozara-autofill-styles')) {
        const style = document.createElement('style');
        style.id = 'ozara-autofill-styles';
        style.textContent = `
          :root, html, body {
            color-scheme: dark !important;
          }
          input, textarea, select {
            color-scheme: dark !important;
          }
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active,
          textarea:-webkit-autofill,
          textarea:-webkit-autofill:hover,
          textarea:-webkit-autofill:focus,
          textarea:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 1000px #080c18 inset !important;
            -webkit-text-fill-color: #ffffff !important;
            caret-color: #ffffff !important;
            color: #ffffff !important;
            transition: background-color 5000s ease-in-out 0s !important;
          }
        `;
        document.head.appendChild(style);
      }
    }

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
