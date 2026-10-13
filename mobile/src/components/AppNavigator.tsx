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
import { InvitationScreen } from '../screens/InvitationScreen';
import { PhoneAuthScreen } from '../screens/PhoneAuthScreen';
import { FaceIdSetupScreen } from '../screens/FaceIdSetupScreen';
import { CreateAccountScreen } from '../screens/CreateAccountScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { OzaraTabs } from './OzaraTabs';
import { AccessConditionsScreen } from '../screens/AccessConditionsScreen';
import { OzaraTheme } from '../constants/ozara-theme';

// Module-level session flag
let introAlreadyShownInSession = false;

export const AppNavigator: React.FC = () => {
  const {
    appView,
    setAppView,
    closeConditions,
    authMode,
    setAuthMode,
    setPendingAccessEmail,
    setVerifiedPhone,
  } = useClub();
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
          onGoToInvitation={(fromSlide) => {
            setWelcomeInitialSlide(fromSlide);
            setAppView('invitation');
          }}
          onGoToSignIn={() => {
            setAuthMode('sign_in');
            setAppView('phone_auth');
          }}
        />
      )}

      {appView === 'invitation' && (
        <InvitationScreen
          onBack={() => {
            // Returns to the exact intro screen they left, without replaying splash
            setAppView('welcome');
          }}
          onValidInvitation={() => {
            setAuthMode('new_member');
            setAppView('phone_auth');
          }}
          onGoToSignIn={(prefilledEmail?: string, prefilledPhone?: string) => {
            setAuthMode('sign_in');
            if (prefilledEmail) {
              setPendingAccessEmail(prefilledEmail);
            }
            if (prefilledPhone) {
              setVerifiedPhone(prefilledPhone);
            }
            setAppView('phone_auth');
          }}
        />
      )}

      {appView === 'phone_auth' && (
        <PhoneAuthScreen
          onBack={() => {
            if (authMode === 'new_member') {
              // Return to invitation screen
              setAppView('invitation');
            } else {
              // Return to the intro screen they left
              setAppView('welcome');
            }
          }}
          onEnterClub={() => setAppView('tabs')}
          onGoToSignUp={() => setAppView('face_id_setup')}
          onGoToFaceId={() => setAppView('face_id_setup')}
          onGoToInvitation={() => {
            setAuthMode('new_member');
            setAppView('invitation');
          }}
        />
      )}

      {appView === 'face_id_setup' && (
        <FaceIdSetupScreen
          onBack={() => setAppView('phone_auth')}
          onSuccess={() => setAppView('create_account')}
          onSkip={() => setAppView('create_account')}
        />
      )}

      {appView === 'create_account' && (
        <CreateAccountScreen
          onBack={() => setAppView('face_id_setup')}
          onAccountCreated={() => setAppView('signup')}
        />
      )}

      {appView === 'signup' && (
        <SignUpScreen
          onBack={() => {
            setAppView('create_account');
          }}
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
