/**
 * ÖZARA Mobile: Particle Typography Intro Screen
 * 
 * Zero-Jump Architecture:
 * 1. Awaits 100% complete font loading (document.fonts.ready & document.fonts.load) before measuring.
 * 2. Pre-calculates exact immutable glyph positions with alphabetic baseline for rock-solid stability of 'Ö' and dots.
 * 3. Uses device-pixel-ratio (DPR) aligned offscreen sampling so particle targets match Retina vector rasterization to the exact subpixel.
 * 4. Particles settle into stationary position at 1800ms, then crossfade seamlessly with the static crisp logo without moving a single pixel.
 * 5. Remains completely still before screen smoothly dissolves into the Welcome Carousel.
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
  useWindowDimensions,
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

interface GlyphLayout {
  char: string;
  x: number;
  y: number;
}

export const LimeIntroScreen: React.FC<LimeIntroScreenProps> = ({ onComplete }) => {
  const canvasRef = useRef<any>(null);
  const { width: windowWidth } = useWindowDimensions();

  // Bounded stage width: fits both narrow mobile (375px) and wide desktop viewports
  const stageWidth = Math.min(Math.max(windowWidth - 24, 320), 380);
  const stageHeight = 160;
  const centerX = stageWidth / 2;

  // Fixed vertical baselines (alphabetic baseline for rock-solid Ö stability)
  const titleBaselineY = 76;
  const subBaselineY = 108;

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const isCompletedRef = useRef(false);

  const handleFinish = () => {
    if (!isCompletedRef.current) {
      isCompletedRef.current = true;
      onComplete();
    }
  };

  // Top-level failsafe timer: ensures screen always advances
  useEffect(() => {
    const failsafe = setTimeout(() => {
      handleFinish();
    }, 6000);
    return () => clearTimeout(failsafe);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let animId: number;

    const runEngine = async () => {
      if (Platform.OS !== 'web' || !canvasRef.current) {
        // Native runtime sequence fallback
        Animated.sequence([
          Animated.delay(2600),
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => handleFinish());
        return;
      }

      // 1. Ensure Google Font Inter is 100% downloaded and parsed before doing ANY measurement
      if (typeof document !== 'undefined') {
        let link = document.getElementById('ozara-google-fonts') as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.id = 'ozara-google-fonts';
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@800;900&display=swap';
          document.head.appendChild(link);
        }

        // Wait for stylesheet to be loaded and parsed
        if (link && !(link as any).sheet) {
          await new Promise<void>((resolve) => {
            const onFinish = () => resolve();
            link.addEventListener('load', onFinish, { once: true });
            link.addEventListener('error', onFinish, { once: true });
            setTimeout(resolve, 1500); // Failsafe timeout
          });
        }

        if (document.fonts) {
          try {
            await Promise.all([
              document.fonts.load('900 48px Inter'),
              document.fonts.load('800 11px Inter'),
            ]);
            await document.fonts.ready;
          } catch (err) {
            console.warn('[LimeIntroScreen] Font loading fallback:', err);
          }
        }
      }

      if (isCancelled || !canvasRef.current) return;

      const canvas = canvasRef.current as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio)
        ? Math.min(window.devicePixelRatio, 3)
        : 1;

      // Set physical canvas pixel dimensions
      canvas.width = Math.round(stageWidth * dpr);
      canvas.height = Math.round(stageHeight * dpr);
      ctx.scale(dpr, dpr);

      // 2. Offscreen sampling canvas configured with the EXACT SAME physical DPR
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.round(stageWidth * dpr);
      offscreen.height = Math.round(stageHeight * dpr);
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;
      offCtx.scale(dpr, dpr);

      const TITLE_FONT = '900 48px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const SUB_FONT = '800 10.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      // 3. Pre-calculate layout ONCE from actual loaded font metrics
      offCtx.font = TITLE_FONT;
      offCtx.textBaseline = 'alphabetic';
      offCtx.textAlign = 'center';

      const titleChars = ['Ö', 'Z', 'A', 'R', 'A'];
      const titleSpacing = 8;
      const titleWidths = titleChars.map(ch => offCtx.measureText(ch).width);
      const titleTotalWidth = titleWidths.reduce((sum, w) => sum + w, 0) + titleSpacing * (titleChars.length - 1);

      let titlePenX = centerX - titleTotalWidth / 2;
      const titleGlyphs: GlyphLayout[] = titleChars.map((char, idx) => {
        const glyphX = titlePenX + titleWidths[idx] / 2;
        titlePenX += titleWidths[idx] + titleSpacing;
        return { char, x: glyphX, y: titleBaselineY };
      });

      // Subtitle
      offCtx.font = SUB_FONT;
      offCtx.textBaseline = 'alphabetic';
      offCtx.textAlign = 'center';

      const subChars = 'PRIVATE CLUB'.split('');
      const subSpacing = 4.5;
      const subWidths = subChars.map(ch => offCtx.measureText(ch).width);
      const subTotalWidth = subWidths.reduce((sum, w) => sum + w, 0) + subSpacing * (subChars.length - 1);

      let subPenX = centerX - subTotalWidth / 2;
      const subGlyphs: GlyphLayout[] = subChars.map((char, idx) => {
        const glyphX = subPenX + subWidths[idx] / 2;
        subPenX += subWidths[idx] + subSpacing;
        return { char, x: glyphX, y: subBaselineY };
      });

      // 4. Draw reference logo onto offscreen canvas for particle sampling
      offCtx.fillStyle = '#000000';
      offCtx.font = TITLE_FONT;
      offCtx.textBaseline = 'alphabetic';
      offCtx.textAlign = 'center';
      titleGlyphs.forEach(g => {
        offCtx.fillText(g.char, g.x, g.y);
      });

      const fullW = Math.round(stageWidth * dpr);
      const fullH = Math.round(stageHeight * dpr);
      const imgData = offCtx.getImageData(0, 0, fullW, fullH);
      const data = imgData.data;

      const targets: { x: number; y: number }[] = [];
      const sampleStep = Math.max(2, Math.round(1.6 * dpr));

      for (let py = 0; py < fullH; py += sampleStep) {
        for (let px = 0; px < fullW; px += sampleStep) {
          const idx = (py * fullW + px) * 4;
          if (data[idx + 3] > 120) {
            // Convert physical DPR pixel back to logical stage coordinates
            targets.push({
              x: px / dpr,
              y: py / dpr,
            });
          }
        }
      }

      // 5. Generate radial particles targeting the exact glyph coordinates
      const particles: Particle[] = targets.map(t => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 45 + Math.random() * 135;
        return {
          targetX: t.x,
          targetY: t.y,
          originX: t.x + Math.cos(angle) * dist,
          originY: t.y + Math.sin(angle) * dist,
          size: 0.8 + Math.random() * 0.9,
          stagger: Math.random() * 0.22,
          curveOffset: (Math.random() - 0.5) * 28,
          angle,
        };
      });

      // 6. Shared static render helpers (drawn from the exact immutable glyph layout)
      const drawStaticTitle = (c: CanvasRenderingContext2D, alpha: number) => {
        if (alpha <= 0.001) return;
        c.save();
        c.globalAlpha = Math.min(1, Math.max(0, alpha));
        c.fillStyle = '#000000';
        c.font = TITLE_FONT;
        c.textBaseline = 'alphabetic';
        c.textAlign = 'center';
        for (let i = 0; i < titleGlyphs.length; i++) {
          const g = titleGlyphs[i];
          c.fillText(g.char, g.x, g.y);
        }
        c.restore();
      };

      const drawStaticSubtitle = (c: CanvasRenderingContext2D, alpha: number) => {
        if (alpha <= 0.001) return;
        c.save();
        c.globalAlpha = Math.min(1, Math.max(0, alpha));
        c.fillStyle = '#000000';
        c.font = SUB_FONT;
        c.textBaseline = 'alphabetic';
        c.textAlign = 'center';
        for (let i = 0; i < subGlyphs.length; i++) {
          const g = subGlyphs[i];
          c.fillText(g.char, g.x, g.y);
        }
        c.restore();
      };

      // 7. Animation timeline:
      // - 0ms - 1800ms: Assembly (particles converge, subtitle fades in from 1000ms to 1800ms)
      // - 1800ms - 2400ms: Perfectly stationary crossfade (particles 100% still, crossfade into solid logo)
      // - 2400ms - 4200ms: Crisp static hold (completely still, zero particles, zero recalculations)
      // - 4200ms - 4750ms: Smooth screen dissolve into Welcome Carousel
      let startTime: number | null = null;
      const assemblyDuration = 1800;
      const crossFadeDuration = 600;
      const holdDuration = 1800;
      let transitionScheduled = false;

      const renderLoop = (time: number) => {
        if (isCancelled) return;
        if (!startTime) startTime = time;
        const elapsed = time - startTime;

        ctx.clearRect(0, 0, stageWidth, stageHeight);

        if (elapsed < assemblyDuration) {
          // Phase 1: Particles actively converging
          const progress = Math.min(1, elapsed / assemblyDuration);

          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const pProgress = Math.max(0, Math.min(1, (progress - p.stagger) / (1 - p.stagger)));
            // Quartic ease-out: velocity reaches precisely zero at target
            const ease = 1 - Math.pow(1 - pProgress, 4);
            const curve = Math.sin(pProgress * Math.PI) * p.curveOffset * (1 - pProgress);

            const currentX = p.originX + (p.targetX - p.originX) * ease + Math.cos(p.angle + Math.PI / 2) * curve;
            const currentY = p.originY + (p.targetY - p.originY) * ease + Math.sin(p.angle + Math.PI / 2) * curve;
            const currentAlpha = 0.15 + 0.85 * ease;

            ctx.fillStyle = `rgba(0, 0, 0, ${currentAlpha})`;
            ctx.beginPath();
            ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
            ctx.fill();
          }

          // Subtitle fades in smoothly from 1000ms to 1800ms
          if (elapsed > 1000) {
            const subAlpha = Math.min(1, (elapsed - 1000) / 800);
            drawStaticSubtitle(ctx, subAlpha);
          }

          animId = requestAnimationFrame(renderLoop);
        } else if (elapsed < assemblyDuration + crossFadeDuration) {
          // Phase 2: Particles are 100% stationary at target coordinates!
          // Seamless crossfade into the solid crisp logo with ZERO movement.
          const fadeLinear = (elapsed - assemblyDuration) / crossFadeDuration;
          const fadeEase = 0.5 - 0.5 * Math.cos(fadeLinear * Math.PI);
          const particleAlpha = 1 - fadeEase;
          const staticAlpha = fadeEase;

          // Render stationary particles fading out
          if (particleAlpha > 0.02) {
            ctx.fillStyle = `rgba(0, 0, 0, ${particleAlpha})`;
            for (let i = 0; i < particles.length; i++) {
              const p = particles[i];
              ctx.beginPath();
              ctx.arc(p.targetX, p.targetY, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Render solid crisp title fading in at the exact same coordinates
          drawStaticTitle(ctx, staticAlpha);

          // Subtitle remains fully opaque
          drawStaticSubtitle(ctx, 1.0);

          animId = requestAnimationFrame(renderLoop);
        } else if (elapsed < assemblyDuration + crossFadeDuration + holdDuration) {
          // Phase 3: Final pristine state.
          // Zero particles, completely still.
          drawStaticTitle(ctx, 1.0);
          drawStaticSubtitle(ctx, 1.0);

          animId = requestAnimationFrame(renderLoop);
        } else {
          // Phase 4: Dissolve intro screen into Welcome Screen
          drawStaticTitle(ctx, 1.0);
          drawStaticSubtitle(ctx, 1.0);

          if (!transitionScheduled) {
            transitionScheduled = true;
            Animated.timing(screenOpacity, {
              toValue: 0,
              duration: 550,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }).start(() => handleFinish());
          }
        }
      };

      animId = requestAnimationFrame(renderLoop);
    };

    runEngine();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [stageWidth, stageHeight, centerX]);

  return (
    <TouchableWithoutFeedback onPress={handleFinish}>
      <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
        <StatusBar barStyle="dark-content" backgroundColor={OzaraTheme.colors.accentViolet} />

        {/* Strictly anchored fixed-size composition stage */}
        <View style={[styles.fixedStage, { width: stageWidth, height: stageHeight }]}>
          {Platform.OS === 'web' ? (
            <canvas
              ref={canvasRef}
              style={{
                width: stageWidth,
                height: stageHeight,
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
  fixedStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
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
