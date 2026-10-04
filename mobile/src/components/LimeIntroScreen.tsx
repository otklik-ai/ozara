/**
 * ÖZARA Mobile: Particle Typography Intro Screen
 * Features a single, fixed-coordinate typography canvas engine where particles
 * assemble directly in place into the exact final text, eliminating all position
 * recalculations, layout reflows, and jumping.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { OzaraTheme } from '../constants/ozara-theme';

interface LimeIntroScreenProps {
  onComplete: () => void;
}

interface Particle {
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  size: number;
  stagger: number;
  curveOffset: number;
  angle: number;
}

// 1. One strictly fixed bounding box and center point for the entire animation lifecycle
const CANVAS_WIDTH = 460;
const CANVAS_HEIGHT = 150;
const CENTER_X = CANVAS_WIDTH / 2; // 230
const CENTER_Y = CANVAS_HEIGHT / 2; // 75

// Fixed baseline centers for both lines of the composition
const TITLE_Y = CENTER_Y - 11;
const SUB_Y = CENTER_Y + 22;

export const LimeIntroScreen: React.FC<LimeIntroScreenProps> = ({ onComplete }) => {
  const canvasRef = useRef<any>(null);

  // Animated screen opacity for entrance/exit
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const isCompletedRef = useRef(false);

  const handleFinish = () => {
    if (!isCompletedRef.current) {
      isCompletedRef.current = true;
      onComplete();
    }
  };

  // Top-level failsafe timer: guarantees screen ALWAYS advances to Welcome
  useEffect(() => {
    const failsafe = setTimeout(() => {
      handleFinish();
    }, 5500);
    return () => clearTimeout(failsafe);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) {
      // Native runtime fallback
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => handleFinish());
      return;
    }

    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    // Shared deterministic text drawing function: used for both offscreen sampling AND onscreen final render
    const drawComposition = (c: CanvasRenderingContext2D, alpha: number, includeSub = true) => {
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = '#000000';
      c.textAlign = 'center';
      c.textBaseline = 'middle';

      // 1. Brand Wordmark: ÖZARA (fixed at TITLE_Y)
      c.font = '900 48px Inter, -apple-system, sans-serif';
      const titleChars = ['Ö', 'Z', 'A', 'R', 'A'];
      const titleSpacing = 8;
      const titleWidths = titleChars.map(ch => c.measureText(ch).width);
      const titleTotalWidth = titleWidths.reduce((sum, w) => sum + w, 0) + titleSpacing * (titleChars.length - 1);
      
      let titlePenX = CENTER_X - titleTotalWidth / 2;
      titleChars.forEach((ch, idx) => {
        c.fillText(ch, titlePenX + titleWidths[idx] / 2, TITLE_Y);
        titlePenX += titleWidths[idx] + titleSpacing;
      });

      // 2. Subtitle: PRIVATE CLUB (fixed at SUB_Y)
      if (includeSub) {
        c.font = '800 10.5px Inter, -apple-system, sans-serif';
        const subChars = 'PRIVATE CLUB'.split('');
        const subSpacing = 4.5;
        const subWidths = subChars.map(ch => c.measureText(ch).width);
        const subTotalWidth = subWidths.reduce((sum, w) => sum + w, 0) + subSpacing * (subChars.length - 1);

        let subPenX = CENTER_X - subTotalWidth / 2;
        subChars.forEach((ch, idx) => {
          c.fillText(ch, subPenX + subWidths[idx] / 2, SUB_Y);
          subPenX += subWidths[idx] + subSpacing;
        });
      }

      c.restore();
    };

    // 2. Offscreen canvas to sample the exact target coordinates of the letters
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Draw reference glyphs at the exact fixed coordinates
    drawComposition(offCtx, 1.0, false);

    const imgData = offCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imgData.data;
    const targets: { x: number; y: number }[] = [];

    // Dense grid sampling: step of 3px yields ~550 clean micro-particles
    const step = 3;
    for (let y = 0; y < CANVAS_HEIGHT; y += step) {
      for (let x = 0; x < CANVAS_WIDTH; x += step) {
        const index = (Math.floor(y) * CANVAS_WIDTH + Math.floor(x)) * 4;
        if (data[index + 3] > 120) {
          targets.push({ x, y });
        }
      }
    }

    // 3. Dispersed micro-particles centered radially around (CENTER_X, TITLE_Y)
    const particles: Particle[] = targets.map(t => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 200;
      return {
        targetX: t.x,
        targetY: t.y,
        originX: t.x + Math.cos(angle) * dist,
        originY: t.y + Math.sin(angle) * dist,
        size: 0.9 + Math.random() * 1.2,
        stagger: Math.random() * 0.2,
        curveOffset: (Math.random() - 0.5) * 35,
        angle,
      };
    });

    // 4. Animation loop: Particles assemble strictly IN PLACE to their exact targets
    let animId: number;
    let startTime: number | null = null;
    const assemblyDuration = 1800; // 1.8s smooth assembly
    const crossFadeDuration = 350;  // 350ms seamless melt into solid text
    let transitionScheduled = false;

    const renderLoop = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (elapsed < assemblyDuration) {
        // Phase 1: Particles actively converging towards stationary targets
        const progress = Math.min(1, elapsed / assemblyDuration);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const pProgress = Math.max(0, Math.min(1, (progress - p.stagger) / (1 - p.stagger)));
          
          // Cubic deceleration: velocity smoothly approaches 0 at target
          const ease = 1 - Math.pow(1 - pProgress, 3);
          const curve = Math.sin(pProgress * Math.PI) * p.curveOffset * (1 - pProgress);

          const currentX = p.originX + (p.targetX - p.originX) * ease + Math.cos(p.angle + Math.PI / 2) * curve;
          const currentY = p.originY + (p.targetY - p.originY) * ease + Math.sin(p.angle + Math.PI / 2) * curve;
          const currentAlpha = 0.12 + 0.88 * ease;

          ctx.fillStyle = `rgba(0, 0, 0, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Subtitle starts gently materializing beneath as letters form
        if (progress > 0.7) {
          const subAlpha = Math.min(1, (progress - 0.7) / 0.3) * 0.7;
          ctx.save();
          ctx.globalAlpha = subAlpha;
          ctx.fillStyle = '#000000';
          ctx.font = '800 10.5px Inter, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const subChars = 'PRIVATE CLUB'.split('');
          const subSpacing = 4.5;
          const subWidths = subChars.map(ch => ctx.measureText(ch).width);
          const subTotalWidth = subWidths.reduce((sum, w) => sum + w, 0) + subSpacing * (subChars.length - 1);
          let subPenX = CENTER_X - subTotalWidth / 2;
          subChars.forEach((ch, idx) => {
            ctx.fillText(ch, subPenX + subWidths[idx] / 2, SUB_Y);
            subPenX += subWidths[idx] + subSpacing;
          });
          ctx.restore();
        }

        animId = requestAnimationFrame(renderLoop);
      } else if (elapsed < assemblyDuration + crossFadeDuration) {
        // Phase 2: Particles are now 100% stationary at their targets.
        // Melt seamlessly into the crisp solid text with 0px shift.
        const fadeProgress = (elapsed - assemblyDuration) / crossFadeDuration;
        const particleAlpha = 1 - fadeProgress;
        const textAlpha = fadeProgress;

        // Render stationary dots fading out
        if (particleAlpha > 0.02) {
          ctx.fillStyle = `rgba(0, 0, 0, ${particleAlpha})`;
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.beginPath();
            ctx.arc(p.targetX, p.targetY, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Render solid brand text fading in at the EXACT SAME target coordinates
        drawComposition(ctx, textAlpha, true);

        animId = requestAnimationFrame(renderLoop);
      } else {
        // Phase 3: Final pristine state.
        // ONLY the solid normal logo is drawn at (CENTER_X, CENTER_Y).
        // Zero dots, zero shade, zero jump.
        drawComposition(ctx, 1.0, true);

        if (!transitionScheduled) {
          transitionScheduled = true;
          // Hold for 2.2 seconds before transitioning into Welcome Screen
          setTimeout(() => {
            Animated.timing(screenOpacity, {
              toValue: 0,
              duration: 450,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }).start(() => handleFinish());
          }, 2200);
        }
      }
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <TouchableWithoutFeedback onPress={handleFinish}>
      <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
        <StatusBar barStyle="dark-content" backgroundColor={OzaraTheme.colors.accentViolet} />

        {/* Strictly anchored fixed-size composition stage */}
        <View style={styles.fixedStage}>
          {Platform.OS === 'web' ? (
            <canvas
              ref={canvasRef}
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                display: 'block',
              }}
            />
          ) : (
            /* Native runtime fallback */
            <View style={styles.nativeFallback}>
              <Text style={styles.brandTitle}>ÖZARA</Text>
              <Text style={styles.brandSub}>PRIVATE CLUB</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: OzaraTheme.colors.accentViolet, // Electric purple #7C3AED
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  // Fixed bounding box centered on screen throughout the entire animation
  fixedStage: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nativeFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 8,
    textAlign: 'center',
  },
  brandSub: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 4.5,
    marginTop: 4,
    textAlign: 'center',
  },
});
