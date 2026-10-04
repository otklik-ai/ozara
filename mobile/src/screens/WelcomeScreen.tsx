/**
 * ÖZARA Mobile: Dark Welcome Page
 * Features a two-row infinite image marquee scrolling in opposite directions,
 * smoothly and continuously with a seamless loop (no swiping required),
 * fixed headline and description, and luxury onboarding actions.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OzaraTheme } from '../constants/ozara-theme';
import { ApiService, resolveImageUrl } from '../services/api';
import { useClub } from '../context/ClubContext';
import { AccessConditionsModal } from '../components/AccessConditionsModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_WIDTH = 124;
const CARD_HEIGHT = 186; // Exact 2:3 portrait aspect ratio matching 1024x1536
const CARD_GAP = 12;

interface WelcomeScreenProps {
  onGoToSignUp: () => void;
  onEnterClub: () => void;
}

// Subcomponent: Single Marquee Row scrolling continuously in a loop
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

  // Single set width based on unique images in this row
  const setWidth = images.length * (CARD_WIDTH + CARD_GAP);
  // Repeat the sequence across 4 sets so it loops seamlessly without any adjacent repetition
  const renderImages = [...images, ...images, ...images, ...images];

  const animatedValue = useRef(
    new Animated.Value(direction === 'left' ? 0 : -setWidth)
  ).current;

  useEffect(() => {
    if (Platform.OS === 'web') return; // Web uses hardware-accelerated CSS keyframes

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
        // @ts-ignore: className works in React Native for Web
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

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGoToSignUp,
  onEnterClub,
}) => {
  const insets = useSafeAreaInsets();
  const { openConditions, conditionsAgreed, setConditionsAgreedState } = useClub();
  const [images, setImages] = useState<string[]>([]);
  // Only show conditions modal if user has not yet agreed
  const [showConditionsModal, setShowConditionsModal] = useState<boolean>(!conditionsAgreed);

  // Fetch images from tools/DesignGuidlines/intro_pics via backend endpoint
  const fetchIntroPics = async () => {
    try {
      const serverPics = await ApiService.getIntroPics();
      if (serverPics && serverPics.length > 0) {
        // Guarantee unique URLs
        const uniqueUrls = Array.from(
          new Set(serverPics.map(pic => resolveImageUrl(pic)))
        );
        setImages(uniqueUrls);
      }
    } catch (err) {
      console.warn('[WelcomeScreen] Error fetching intro pics:', err);
    }
  };

  useEffect(() => {
    fetchIntroPics();
    const interval = setInterval(fetchIntroPics, 5000);
    return () => clearInterval(interval);
  }, []);

  // Top row and second row BOTH contain ALL pictures from the folder, scrolling in opposite directions
  const row1Images = images;
  const row2Images = images.length > 2
    ? [...images.slice(2), ...images.slice(0, 2)]
    : [...images].reverse();

  return (
    <View style={styles.container}>
      {/* Top Brand Wordmark */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.brandTitle}>ÖZARA</Text>
        <Text style={styles.brandSub}>PRIVATE CLUB</Text>
      </View>

      {/* Main Center Content */}
      <View style={styles.content}>
        {/* Two-Row Infinite Image Marquee */}
        <View style={styles.marqueeContainer}>
          {/* Subtle Left & Right Edge Vignette Mask */}
          <View style={styles.edgeGradientLeft} pointerEvents="none" />
          <View style={styles.edgeGradientRight} pointerEvents="none" />

          {row1Images.length > 0 && (
            <MarqueeRow
              images={row1Images}
              direction="left"
              rowId="row1"
              duration={24000}
              isPaused={false}
            />
          )}

          {row2Images.length > 0 && (
            <MarqueeRow
              images={row2Images}
              direction="right"
              rowId="row2"
              duration={28000}
              isPaused={false}
            />
          )}
        </View>

        {/* Fixed Headline & Description */}
        <View style={styles.copyContainer}>
          <Text style={styles.fixedHeadline}>
            Get connected.{' '}
            <Text style={styles.headlineOrange}>Go further.</Text>
          </Text>
          <Text style={styles.fixedDescription} numberOfLines={1}>
            <Text style={styles.descriptionText}>Find your people</Text>
            <Text style={styles.pipeOrange}> | </Text>
            <Text style={styles.descriptionText}>Join the conversation</Text>
            <Text style={styles.pipeOrange}> | </Text>
            <Text style={styles.descriptionOrange}>Put your capital to work</Text>
          </Text>
        </View>

        {/* Onboarding Actions */}
        <View style={[styles.actionsContainer, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              if (conditionsAgreed) {
                onGoToSignUp();
              } else {
                setShowConditionsModal(true);
              }
            }}
            activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onEnterClub}
            activeOpacity={0.75}>
            <Text style={styles.secondaryBtnText}>
              Already a member? <Text style={styles.secondaryBtnBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          {/* Welcome Page Footer Link */}
          <TouchableOpacity
            style={styles.footerLink}
            onPress={() => openConditions('welcome')}
            activeOpacity={0.7}>
            <Text style={styles.footerLinkText}>Access Conditions</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Access Conditions Bottom-Sheet Modal */}
      <AccessConditionsModal
        visible={showConditionsModal}
        isChecked={conditionsAgreed}
        onToggleCheckbox={() => setConditionsAgreedState(!conditionsAgreed)}
        onClose={() => setShowConditionsModal(false)}
        onOpenConditions={() => openConditions('welcome')}
        onAgreeAndContinue={() => {
          setShowConditionsModal(false);
          setConditionsAgreedState(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
    justifyContent: 'space-between',
  },
  topBar: {
    alignItems: 'center',
    paddingBottom: 8,
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
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  marqueeContainer: {
    marginTop: 6,
    overflow: 'hidden',
    position: 'relative',
    gap: 12,
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
  copyContainer: {
    paddingHorizontal: 28,
    alignItems: 'center',
    marginVertical: 14,
  },
  fixedHeadline: {
    fontSize: 27,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  fixedDescription: {
    fontSize: 12.5,
    fontWeight: '500',
    color: OzaraTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    maxWidth: '100%',
    letterSpacing: 0.1,
    ...Platform.select({
      web: {
        whiteSpace: 'nowrap' as any,
      },
    }),
  },
  headlineOrange: {
    color: OzaraTheme.colors.accentElectricOrange,
  },
  descriptionText: {
    color: OzaraTheme.colors.textSecondary,
  },
  pipeOrange: {
    color: OzaraTheme.colors.accentElectricOrange,
    fontWeight: '800',
    opacity: 0.9,
  },
  descriptionOrange: {
    color: OzaraTheme.colors.accentElectricOrangeLight,
    fontWeight: '700',
  },
  actionsContainer: {
    paddingHorizontal: 28,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 16,
    borderRadius: OzaraTheme.radius.full,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: OzaraTheme.colors.accentViolet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
    }),
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: OzaraTheme.colors.textSecondary,
    fontSize: 13.5,
  },
  secondaryBtnBold: {
    color: '#ffffff',
    fontWeight: '600',
  },
  footerLink: {
    paddingVertical: 6,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: -4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  footerLinkText: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
});
