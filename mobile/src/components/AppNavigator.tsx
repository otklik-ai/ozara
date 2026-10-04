/**
 * ÖZARA Mobile: Root Application Navigator
 * Manages full-screen particle intro, dark welcome page, signup flow, and club tabs.
 * Invariant: Intro is shown once, and users resume directly where they left off upon reload/login.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useClub } from '../context/ClubContext';
import { LimeIntroScreen } from './LimeIntroScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { PhoneAuthScreen } from '../screens/PhoneAuthScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { OzaraTabs } from './OzaraTabs';
import { AccessConditionsScreen } from '../screens/AccessConditionsScreen';
import { OzaraTheme } from '../constants/ozara-theme';

// Module-level session flag
let introAlreadyShownInSession = false;

export const AppNavigator: React.FC = () => {
  const { appView, setAppView, closeConditions } = useClub();
  const [welcomeInitialSlide, setWelcomeInitialSlide] = useState<number>(0);
  
  // Always show the opening purple screen with appearing logo on initial app load / refresh
  const [showIntro, setShowIntro] = useState(!introAlreadyShownInSession);

  const handleIntroComplete = () => {
    introAlreadyShownInSession = true;
    setShowIntro(false);
  };

  return (
    <View style={styles.container}>
      {/* Active App Screen */}
      {appView === 'welcome' && (
        <WelcomeScreen
          initialSlideIndex={welcomeInitialSlide}
          onGoToSignUp={() => setAppView('signup')}
          onEnterClub={() => setAppView('tabs')}
          onGoToPhoneAuth={() => setAppView('phone_auth')}
        />
      )}

      {appView === 'phone_auth' && (
        <PhoneAuthScreen
          onBack={() => {
            setWelcomeInitialSlide(2); // Return directly to Invest screen (Screen 3)
            setAppView('welcome');
          }}
          onEnterClub={() => setAppView('tabs')}
          onGoToSignUp={() => setAppView('signup')}
        />
      )}

      {appView === 'signup' && (
        <SignUpScreen
          onBack={() => setAppView('welcome')}
          onCompleteSignUp={() => setAppView('tabs')}
        />
      )}

      {appView === 'conditions' && (
        <AccessConditionsScreen onBack={closeConditions} />
      )}

      {appView === 'tabs' && <OzaraTabs />}

      {/* Full-Screen Particle Intro Overlay (Only on very first entrance) */}
      {showIntro && <LimeIntroScreen onComplete={handleIntroComplete} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
  },
});
