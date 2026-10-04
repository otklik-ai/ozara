/**
 * ÖZARA Mobile: 3-Screen Onboarding Flow (Events → Network → Invest)
 * Inspired by Axevil Dark Cinematic Aesthetic
 * 
 * Screen 1 — Events: 2-Row infinite photo marquee, "A place among exceptional minds."
 * Screen 2 — Network: 3-iPhone hero mockup, "Get connected. Go further."
 * Screen 3 — Invest: 2-iPhone real estate & portfolio mockup, "Put your capital to work."
 * 
 * Navigation & Controls:
 * - 3 Progress dots between visual and copy (tap & swipe responsive)
 * - Horizontal swipe paging
 * - Left button: "Intro" (returns to Screen 1 without replaying launch animation)
 * - Right button: "Next" (Screens 1 & 2) / "Get started" (Screen 3, opens Access Conditions)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClub } from '../context/ClubContext';
import { AccessConditionsModal } from '../components/AccessConditionsModal';
import { ContactModal } from '../components/ContactModal';
import { ApiService, resolveImageUrl } from '../services/api';
import { OzaraTheme } from '../constants/ozara-theme';

// Local high-resolution hero mockups (Axevil aesthetic)
const NETWORK_HERO = require('../../assets/images/onboarding_network.jpg');
const INVEST_HERO = require('../../assets/images/onboarding_invest.jpg');

interface WelcomeScreenProps {
  onGoToSignUp: () => void;
  onEnterClub: () => void;
}

// -------------------------------------------------------------
// Screen 1: Marquee Dimensions & Infinite Scroll Component
// -------------------------------------------------------------
const CARD_WIDTH = 136;
const CARD_HEIGHT = 168;
const CARD_GAP = 12;
const VISUAL_CONTAINER_HEIGHT = 348; // Exactly fits 2 rows (168 + 12 + 168 = 348px)

interface MarqueeRowProps {
  images: string[];
  direction: 'left' | 'right';
  rowId: string;
  duration?: number;
  isPaused?: boolean;
}

const MarqueeRow: React.FC<MarqueeRowProps> = ({
  images,
  direction,
  rowId,
  duration = 24000,
  isPaused = false,
}) => {
  if (!images || images.length === 0) return null;

  const setWidth = images.length * (CARD_WIDTH + CARD_GAP);
  const renderImages = [...images, ...images, ...images, ...images];

  const animatedValue = useRef(
    new Animated.Value(direction === 'left' ? 0 : -setWidth)
  ).current;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (isPaused) {
      return;
    }

    const fromVal = direction === 'left' ? 0 : -setWidth;
    const toVal = direction === 'left' ? -setWidth : 0;

    animatedValue.setValue(fromVal);
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: toVal,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, [setWidth, direction, duration, isPaused]);

  const animationName = `marquee_${rowId}_${direction}`;

  return (
    <View style={styles.marqueeRowWrapper} pointerEvents="none">
      {Platform.OS === 'web' && (
        <style>{`
          @keyframes ${animationName} {
            0% {
              transform: translateX(${direction === 'left' ? '0px' : `-${setWidth}px`});
            }
            100% {
              transform: translateX(${direction === 'left' ? `-${setWidth}px` : '0px'});
            }
          }
          .${animationName} {
            display: flex;
            flex-direction: row;
            width: max-content;
            animation: ${animationName} ${duration}ms linear infinite;
            animation-play-state: ${isPaused ? 'paused' : 'running'};
            will-change: transform;
          }
        `}</style>
      )}

      {Platform.OS === 'web' ? (
        // @ts-ignore
        <div className={animationName} style={{ display: 'flex', flexDirection: 'row' }}>
          {renderImages.map((uri, idx) => (
            <View
              key={`${rowId}-img-${idx}`}
              style={[
                styles.card,
                {
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  marginRight: CARD_GAP,
                },
              ]}>
              <Image
                source={{ uri }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            </View>
          ))}
        </div>
      ) : (
        <Animated.View
          style={[
            styles.animatedStrip,
            {
              transform: [{ translateX: animatedValue }],
            },
          ]}>
          {renderImages.map((uri, idx) => (
            <View
              key={`${rowId}-img-${idx}`}
              style={[
                styles.card,
                {
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  marginRight: CARD_GAP,
                },
              ]}>
              <Image
                source={{ uri }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

// -------------------------------------------------------------
// Canonical Seed Pictures for Instant Marquee Render
// -------------------------------------------------------------
const DEFAULT_INTRO_PICS = [
  '/intro_pics/14a7fad9-48d3-4df2-92c7-bf0dfa08ecf9.png',
  '/intro_pics/2092114d-fbdb-4545-82ae-e0e666dcd898.png',
  '/intro_pics/374f8224-1117-48bd-9ee6-714b509fa0c3.png',
  '/intro_pics/39e643be-f0e4-45fb-b4dd-41fc63f03cac.png',
  '/intro_pics/51b420a3-6ad3-4021-b53a-4a0e3e105d54.png',
  '/intro_pics/8c4e4fb6-64f3-4d66-8082-10e20d74d08e.png',
  '/intro_pics/90667298-4d39-45d2-8914-61683919683f.png',
  '/intro_pics/A%20thoughtful%20acquisition%20conversation.png',
  '/intro_pics/Applied%20AI%20founder%20tests%20a%20robot.png',
  '/intro_pics/b05f7f2a-35ae-429e-a450-9d1ff0ef1c87.png',
];

// -------------------------------------------------------------
// Slide Content Configurations
// -------------------------------------------------------------
interface SlideData {
  id: 'events' | 'network' | 'invest';
  title: string;
  headlineMain: string;
  headlineHighlight?: string;
  description: string;
}

const ONBOARDING_SLIDES: SlideData[] = [
  {
    id: 'events',
    title: 'Events',
    headlineMain: 'A place among exceptional minds.',
    description: 'Private events. A selected circle. Conversations that open new possibilities.',
  },
  {
    id: 'network',
    title: 'Network',
    headlineMain: 'Get connected. ',
    headlineHighlight: 'Go further.',
    description: 'Find your people by location, interest, or industry. Ask your network a question—get expertise, introductions, and a way forward.',
  },
  {
    id: 'invest',
    title: 'Invest',
    headlineMain: 'Put your capital to work.',
    description: 'Explore real estate investment opportunities. Get to know the project, review the details, and decide what fits your goals.',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGoToSignUp,
  onEnterClub,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { openConditions, conditionsAgreed, setConditionsAgreedState } = useClub();

  // Bounded container width for optimal mobile app display on desktop web
  const containerWidth = Math.min(windowWidth, 430);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [images, setImages] = useState<string[]>(() =>
    DEFAULT_INTRO_PICS.map((pic) => resolveImageUrl(pic))
  );
  const [showConditionsModal, setShowConditionsModal] = useState<boolean>(!conditionsAgreed);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);

  const scrollRef = useRef<ScrollView>(null);

  // Fetch updated intro pics in background
  const fetchIntroPics = async () => {
    try {
      const serverPics = await ApiService.getIntroPics();
      if (serverPics && serverPics.length > 0) {
        const uniqueUrls = Array.from(
          new Set(serverPics.map((pic) => resolveImageUrl(pic)))
        );
        setImages(uniqueUrls);
      }
    } catch (err) {
      console.warn('[WelcomeScreen] Error fetching intro pics:', err);
    }
  };

  useEffect(() => {
    fetchIntroPics();
    const interval = setInterval(fetchIntroPics, 8000);
    return () => clearInterval(interval);
  }, []);

  const row1Images = images;
  const row2Images =
    images.length > 2
      ? [...images.slice(2), ...images.slice(0, 2)]
      : [...images].reverse();

  // Programmatic slide transition
  const goToSlide = (index: number) => {
    const target = Math.max(0, Math.min(2, index));
    setCurrentIndex(target);
    scrollRef.current?.scrollTo({ x: target * containerWidth, animated: true });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / containerWidth);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex <= 2) {
      setCurrentIndex(newIndex);
    }
  };

  // Button Action Handlers: Intro opens Contact Panel from all 3 screens
  const handleIntroPress = () => {
    setShowContactModal(true);
  };

  const handlePrimaryPress = () => {
    if (currentIndex < 2) {
      goToSlide(currentIndex + 1);
    } else {
      // Screen 3: "Get started" opens Access Conditions popup or proceeds to signup
      if (conditionsAgreed) {
        onGoToSignUp();
      } else {
        setShowConditionsModal(true);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Centered App Container for Mobile Viewport */}
      <View style={[styles.mainWrapper, { width: containerWidth }]}>
        {/* Top Brand Wordmark (Consistent Across All Screens) */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
          <Text style={styles.brandTitle}>ÖZARA</Text>
          <Text style={styles.brandSub}>PRIVATE CLUB</Text>
        </View>

        {/* Horizontal Paging Carousel (Events → Network → Invest) */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
          style={styles.pagerScrollView}
          contentContainerStyle={{ width: containerWidth * 3 }}>
          {ONBOARDING_SLIDES.map((slide, sIdx) => {
            return (
              <View key={slide.id} style={[styles.slidePage, { width: containerWidth }]}>
                {/* 1. VISUAL AREA (Consistently Positioned at exactly 348px) */}
                <View style={styles.visualContainer}>
                  {sIdx === 0 && (
                    <View style={styles.marqueeContainer}>
                      <View style={styles.edgeGradientLeft} pointerEvents="none" />
                      <View style={styles.edgeGradientRight} pointerEvents="none" />
                      <MarqueeRow
                        images={row1Images}
                        direction="left"
                        rowId="row1"
                        duration={24000}
                        isPaused={currentIndex !== 0}
                      />
                      <MarqueeRow
                        images={row2Images}
                        direction="right"
                        rowId="row2"
                        duration={28000}
                        isPaused={currentIndex !== 0}
                      />
                    </View>
                  )}

                  {sIdx === 1 && (
                    <View style={styles.heroCardContainer}>
                      <View style={styles.heroCard}>
                        <Image
                          source={NETWORK_HERO}
                          style={styles.heroImage}
                          resizeMode="cover"
                        />
                        {/* Subtle Cinematic Vignette */}
                        <View style={styles.heroVignette} pointerEvents="none" />
                      </View>
                    </View>
                  )}

                  {sIdx === 2 && (
                    <View style={styles.heroCardContainer}>
                      <View style={styles.heroCard}>
                        <Image
                          source={INVEST_HERO}
                          style={styles.heroImage}
                          resizeMode="cover"
                        />
                        {/* Subtle Cinematic Vignette */}
                        <View style={styles.heroVignette} pointerEvents="none" />
                      </View>
                    </View>
                  )}
                </View>

                {/* 2. THREE PROGRESS DOTS (Placed between visual and copy) */}
                <View style={styles.paginationRow}>
                  {[0, 1, 2].map((dotIdx) => {
                    const isActive = currentIndex === dotIdx;
                    return (
                      <TouchableOpacity
                        key={`dot-${slide.id}-${dotIdx}`}
                        onPress={() => goToSlide(dotIdx)}
                        activeOpacity={0.7}
                        style={styles.dotTouchTarget}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
                        <View
                          style={[
                            styles.dotBase,
                            isActive ? styles.dotActive : styles.dotInactive,
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 3. COPY SECTION (Consistently Positioned Across All Three Screens) */}
                <View style={styles.copyContainer}>
                  <Text style={styles.headline}>
                    {slide.headlineMain}
                    {slide.headlineHighlight && (
                      <Text style={styles.headlineHighlight}>
                        {slide.headlineHighlight}
                      </Text>
                    )}
                  </Text>
                  <Text style={styles.description}>
                    {slide.description}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* 4. FIXED BOTTOM ACTIONS (Consistently Positioned Across All Screens) */}
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) + 6 }]}>
          {/* Dual Action Buttons Row */}
          <View style={styles.buttonRow}>
            {/* Left Button: Intro (Returns to Screen 1) */}
            <TouchableOpacity
              style={styles.introBtn}
              onPress={handleIntroPress}
              activeOpacity={0.75}>
              <Text style={styles.introBtnText}>Intro</Text>
            </TouchableOpacity>

            {/* Right Button: Next (Screens 1 & 2) / Get started (Screen 3) */}
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handlePrimaryPress}
              activeOpacity={0.85}>
              <Text style={styles.primaryActionBtnText}>
                {currentIndex === 2 ? 'Get started' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Member Sign In Link */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onEnterClub}
            activeOpacity={0.75}>
            <Text style={styles.secondaryBtnText}>
              Already a member? <Text style={styles.secondaryBtnBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          {/* Access Conditions Link */}
          <TouchableOpacity
            style={styles.footerLink}
            onPress={() => openConditions('welcome')}
            activeOpacity={0.7}>
            <Text style={styles.footerLinkText}>Access Conditions</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Access Conditions Modal Popup */}
      <AccessConditionsModal
        visible={showConditionsModal}
        isChecked={conditionsAgreed}
        onToggleCheckbox={() => setConditionsAgreedState(!conditionsAgreed)}
        onClose={() => setShowConditionsModal(false)}
        onOpenConditions={() => openConditions('welcome')}
        onAgreeAndContinue={() => {
          setShowConditionsModal(false);
          setConditionsAgreedState(true);
          onGoToSignUp();
        }}
      />

      {/* Contact Panel Modal (Accessible via Intro button on all 3 onboarding screens) */}
      <ContactModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    maxWidth: 430,
    overflow: 'hidden',
  },
  topBar: {
    alignItems: 'center',
    paddingBottom: 6,
    zIndex: 10,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 2.5,
    marginTop: -1,
  },

  /* Pager Carousel */
  pagerScrollView: {
    flex: 1,
  },
  slidePage: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },

  /* Visual Container (Exactly 348px height across all 3 screens) */
  visualContainer: {
    height: VISUAL_CONTAINER_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },

  /* Screen 1: Marquee */
  marqueeContainer: {
    height: VISUAL_CONTAINER_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    gap: CARD_GAP,
  },
  marqueeRowWrapper: {
    overflow: 'hidden',
    flexDirection: 'row',
  },
  animatedStrip: {
    flexDirection: 'row',
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0b1020',
  },
  edgeGradientLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 5,
    backgroundColor: 'rgba(11, 16, 32, 0.75)',
  },
  edgeGradientRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 5,
    backgroundColor: 'rgba(11, 16, 32, 0.75)',
  },

  /* Screens 2 & 3: Hero Image Mockup Cards */
  heroCardContainer: {
    height: VISUAL_CONTAINER_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heroCard: {
    height: VISUAL_CONTAINER_HEIGHT - 6,
    width: Math.min(290, CARD_WIDTH * 2 + CARD_GAP),
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#090e1c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
      } as any,
    }),
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#090e1c',
  },
  heroVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },

  /* Progress Dots (Between Visual and Copy) */
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    gap: 7,
  },
  dotTouchTarget: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  dotBase: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: OzaraTheme.colors.accentViolet,
    ...Platform.select({
      ios: {
        shadowColor: OzaraTheme.colors.accentViolet,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.7,
        shadowRadius: 4,
      },
      web: {
        boxShadow: `0 0 8px ${OzaraTheme.colors.accentViolet}`,
      } as any,
    }),
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },

  /* Copy Section */
  copyContainer: {
    paddingHorizontal: 28,
    alignItems: 'center',
    minHeight: 94,
    justifyContent: 'flex-start',
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  headlineHighlight: {
    color: OzaraTheme.colors.accentElectricOrange,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: OzaraTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18.5,
    marginTop: 7,
    letterSpacing: 0.1,
    maxWidth: 340,
  },

  /* Fixed Bottom Actions */
  bottomContainer: {
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: OzaraTheme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  introBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryActionBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: OzaraTheme.radius.full,
    backgroundColor: OzaraTheme.colors.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
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
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 13,
  },
  secondaryBtnBold: {
    color: '#ffffff',
    fontWeight: '600',
  },
  footerLink: {
    paddingVertical: 4,
    alignItems: 'center',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  footerLinkText: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },
});
