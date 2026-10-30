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
import { OzaraStorage, OZARA_STORAGE_KEYS } from '../services/storage';

// Local high-resolution hero mockups (Axevil aesthetic)
const NETWORK_HERO = require('../../assets/images/onboarding_network.jpg');
const INVEST_HERO = require('../../assets/images/onboarding_invest.jpg');

interface WelcomeScreenProps {
  onGoToSignUp: () => void;
  onEnterClub: () => void;
  onGoToPhoneAuth?: () => void;
  onGoToInvitation?: (fromSlideIndex: number, options?: { clearCode?: boolean }) => void;
  onGoToSignIn?: () => void;
  initialSlideIndex?: number;
}

// -------------------------------------------------------------
// Screen 1: Marquee Dimensions & Infinite Scroll Component
// -------------------------------------------------------------
const CARD_WIDTH = 188;
const CARD_HEIGHT = 282; // Exact 2:3 aspect ratio matching 1024x1536 images, uncropped
const CARD_GAP = 10;
const VISUAL_CONTAINER_HEIGHT = 574; // Exactly fits 2 rows: 282 + 10 + 282 = 574px

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
  duration = 42000,
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
  '/intro_pics/5249097949164727689.jpg',
  '/intro_pics/5249290939225206031.jpg',
  '/intro_pics/5249318448490738649.jpg',
  '/intro_pics/5249464000637430966.jpg',
  '/intro_pics/5249464000637430967.jpg',
  '/intro_pics/5249464000637430968.jpg',
  '/intro_pics/5249464000637430969.jpg',
  '/intro_pics/5402138302623719279.jpg',
  '/intro_pics/5402138302623719281.jpg',
  '/intro_pics/5402138302623719282.jpg',
  '/intro_pics/5402138302623719283.jpg',
  '/intro_pics/5402138302623719284.jpg',
  '/intro_pics/5402138302623719285.jpg',
  '/intro_pics/5402138302623719286.jpg',
  '/intro_pics/5402138302623719287.jpg',
  '/intro_pics/5402138302623719288.jpg',
  '/intro_pics/5402138302623719289.jpg',
  '/intro_pics/img_8318.jpg',
  '/intro_pics/img_9797.jpg',
  '/intro_pics/img_9896.jpg',
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
    headlineMain: 'A place among ',
    headlineHighlight: 'exceptional minds.',
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
    headlineMain: 'Put your capital ',
    headlineHighlight: 'to work.',
    description: 'Explore real estate investment opportunities. Get to know the project, review the details, and decide what fits your goals.',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGoToSignUp,
  onEnterClub,
  onGoToPhoneAuth,
  onGoToInvitation,
  onGoToSignIn,
  initialSlideIndex = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { width: rnWindowWidth } = useWindowDimensions();
  const { openConditions, conditionsAgreed, setConditionsAgreedState, setInvitationCode, setInvitationEmail, setInvitationFullName } = useClub();

  // Dynamic resilient viewport width (prevents 0px width during SSR/web hydration)
  const [liveWidth, setLiveWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth && window.innerWidth > 0) {
      return window.innerWidth;
    }
    return 390;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => setLiveWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      setLiveWidth(window.innerWidth);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const effectiveWidth = (rnWindowWidth && rnWindowWidth > 0) ? rnWindowWidth : (liveWidth || 390);
  const containerWidth = Math.min(Math.max(effectiveWidth, 320), 430);

  const [currentIndex, setCurrentIndex] = useState<number>(initialSlideIndex || 0);
  const [images, setImages] = useState<string[]>(() =>
    DEFAULT_INTRO_PICS.map((pic) => resolveImageUrl(pic))
  );
  const [showConditionsModal, setShowConditionsModal] = useState<boolean>(false);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);

  const scrollRef = useRef<ScrollView>(null);

  // Sync initial slide index if passed (e.g. returning to Invest screen from Phone Auth)
  useEffect(() => {
    if (initialSlideIndex && initialSlideIndex > 0) {
      setCurrentIndex(initialSlideIndex);
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: initialSlideIndex * containerWidth, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [initialSlideIndex, containerWidth]);

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

  const row1Images = images.length > 1 ? images.filter((_, idx) => idx % 2 === 0) : images;
  const row2Images = images.length > 1 ? images.filter((_, idx) => idx % 2 !== 0) : images;

  // Programmatic slide transition
  const goToSlide = (index: number) => {
    const target = Math.max(0, Math.min(2, index));
    setCurrentIndex(target);
    scrollRef.current?.scrollTo({ x: target * containerWidth, animated: true });
  };

  // Real-time & End-of-drag Scroll Handler
  // Guarantees dots update immediately on swipe across all platforms (web, mobile Safari, iOS, Android)
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const layoutWidth = e.nativeEvent.layoutMeasurement?.width || containerWidth;
    if (layoutWidth > 10) {
      const newIndex = Math.round(offsetX / layoutWidth);
      if (newIndex >= 0 && newIndex <= 2 && newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    }
  };

  // Button Action Handlers: Intro opens Contact Panel from all 3 screens
  const handleIntroPress = () => {
    setShowContactModal(true);
  };

  const handleJoinCircle = () => {
    // Always clear invitation code and cached tokens when 'Join the circle' is clicked
    setInvitationCode('');
    setInvitationEmail('');
    setInvitationFullName('');
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_CODE);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_EMAIL);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.INVITATION_FULL_NAME);
    OzaraStorage.removeItem(OZARA_STORAGE_KEYS.PENDING_TOKEN);
    if (typeof window !== 'undefined' && window.history && window.location) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('code') || url.searchParams.has('token') || url.searchParams.has('invite')) {
          url.searchParams.delete('code');
          url.searchParams.delete('token');
          url.searchParams.delete('invite');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch (_) {}
    }
    onGoToInvitation?.(currentIndex, { clearCode: true });
  };

  const handlePrimaryPress = () => {
    if (currentIndex < 2) {
      goToSlide(currentIndex + 1);
    } else {
      // Screen 3: "Get started" opens Invitation Screen
      if (onGoToInvitation) {
        onGoToInvitation(2);
      } else if (onGoToPhoneAuth) {
        onGoToPhoneAuth();
      } else if (conditionsAgreed) {
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
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Text style={styles.brandTitle}>ÖZARA</Text>
          <Text style={styles.brandSub}>PRIVATE CLUB</Text>
        </View>

        {/* Horizontal Paging Carousel (Visuals Only: Events → Network → Invest) */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScroll}
          onScrollEndDrag={handleScroll}
          scrollEventThrottle={16}
          style={styles.pagerScrollView}
          contentContainerStyle={{ width: containerWidth * 3 }}>
          {/* Slide 1: Events Marquee */}
          <View style={[styles.slidePage, { width: containerWidth }]}>
            <View style={styles.visualContainer}>
              <View style={styles.marqueeContainer}>
                <MarqueeRow
                  images={row1Images}
                  direction="left"
                  rowId="row1"
                  duration={42000}
                  isPaused={currentIndex !== 0}
                />
                <MarqueeRow
                  images={row2Images}
                  direction="right"
                  rowId="row2"
                  duration={48000}
                  isPaused={currentIndex !== 0}
                />
              </View>
            </View>
          </View>

          {/* Slide 2: Network Hero */}
          <View style={[styles.slidePage, { width: containerWidth }]}>
            <View style={styles.visualContainer}>
              <View style={styles.heroCardContainer}>
                <View style={styles.heroCard}>
                  <Image
                    source={NETWORK_HERO}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                  <View style={styles.heroVignette} pointerEvents="none" />
                </View>
              </View>
            </View>
          </View>

          {/* Slide 3: Invest Hero */}
          <View style={[styles.slidePage, { width: containerWidth }]}>
            <View style={styles.visualContainer}>
              <View style={styles.heroCardContainer}>
                <View style={styles.heroCard}>
                  <Image
                    source={INVEST_HERO}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                  <View style={styles.heroVignette} pointerEvents="none" />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Unified Compact Lower Section (Dots + Copy + Buttons + Links with NO empty space) */}
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
          {/* Progress Dots */}
          <View style={styles.paginationRow}>
            {[0, 1, 2].map((dotIdx) => {
              const isActive = currentIndex === dotIdx;
              return (
                <TouchableOpacity
                  key={`dot-${dotIdx}`}
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

          {/* Copy Section (Tightly bound to current slide) */}
          <View style={styles.copyContainer}>
            <Text style={styles.headline}>
              {ONBOARDING_SLIDES[currentIndex].headlineMain}
              {ONBOARDING_SLIDES[currentIndex].headlineHighlight && (
                <Text style={styles.headlineHighlight}>
                  {ONBOARDING_SLIDES[currentIndex].headlineHighlight}
                </Text>
              )}
            </Text>
            <Text style={styles.description}>
              {ONBOARDING_SLIDES[currentIndex].description}
            </Text>
          </View>

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

          {/* Join the circle Link */}
          <TouchableOpacity
            style={styles.haveInviteBtn}
            onPress={handleJoinCircle}
            activeOpacity={0.75}>
            <Text style={styles.haveInviteBtnText}>Join the circle</Text>
          </TouchableOpacity>

          {/* Member Sign In Link (Separate route for existing members) */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onGoToSignIn || onGoToPhoneAuth || onEnterClub}
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
    height: '100%',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 430,
    overflow: 'hidden',
  },
  topBar: {
    alignItems: 'center',
    paddingBottom: 2,
    zIndex: 10,
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3.5,
  },
  brandSub: {
    fontSize: 7.5,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    letterSpacing: 2,
    marginTop: -1,
  },

  /* Pager Carousel (Visuals Only) */
  pagerScrollView: {
    flexGrow: 0,
    height: VISUAL_CONTAINER_HEIGHT,
    ...Platform.select({
      web: {
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
      } as any,
    }),
  },
  slidePage: {
    width: '100%',
    height: VISUAL_CONTAINER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
      } as any,
    }),
  },

  /* Visual Container */
  visualContainer: {
    height: VISUAL_CONTAINER_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 18,
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

  /* Screens 2 & 3: Hero Image Mockup Cards */
  heroCardContainer: {
    height: VISUAL_CONTAINER_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  heroCard: {
    height: VISUAL_CONTAINER_HEIGHT - 6,
    width: Math.round((VISUAL_CONTAINER_HEIGHT - 6) * (682 / 1024)),
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

  /* Progress Dots */
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 2,
    gap: 6,
  },
  dotTouchTarget: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  dotBase: {
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 20,
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
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },

  /* Copy Section */
  copyContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  headlineHighlight: {
    color: '#FF6B00',
    fontWeight: '800',
  },
  description: {
    fontSize: 12,
    fontWeight: '400',
    color: OzaraTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 2,
    letterSpacing: 0.1,
    maxWidth: 340,
  },

  /* Unified Compact Bottom Actions */
  bottomContainer: {
    paddingHorizontal: 24,
    gap: 6,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    alignSelf: 'stretch',
  },
  introBtn: {
    flex: 1,
    paddingVertical: 12,
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
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryActionBtn: {
    flex: 2,
    paddingVertical: 12,
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
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  haveInviteBtn: {
    paddingVertical: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  haveInviteBtnText: {
    color: '#a78bfa',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
  },
  secondaryBtn: {
    paddingVertical: 2,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 12,
  },
  secondaryBtnBold: {
    color: '#ffffff',
    fontWeight: '600',
  },
  footerLink: {
    paddingVertical: 2,
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
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },
});
