import React from 'react';

/**
 * Explicit /app route so Expo Router on web treats /app and /app/ as valid matched routes.
 * The root _layout.tsx renders <AppNavigator /> for the entire application.
 */
export default function AppRoute() {
  return null;
}
