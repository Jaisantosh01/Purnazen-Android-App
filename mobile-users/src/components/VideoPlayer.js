import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  PanResponder,
  Animated,
  useWindowDimensions,
  StatusBar,
  BackHandler,
} from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// How long the "up next" card counts down before advancing on its own.
const AUTO_NEXT_MS = 5000;

const fmtTime = s => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  const total = Math.floor(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

/**
 * VideoPlayer — modern, self-contained player with a custom control overlay.
 *
 * Features: play/pause, ±10s skip, draggable scrubber with live time preview,
 * buffering spinner, load-error + retry, mute, native fullscreen, replay, and
 * auto-hiding controls (tap to toggle). Pure-JS scrubber (PanResponder) so it
 * needs no extra native dependency.
 *
 * Props:
 *   source     { uri }   video source (required)
 *   poster     node      rendered behind the video before first frame (optional)
 *   autoPlay   bool       start playing on mount / source change (default true)
 *   onProgress fn(data)   react-native-video progress event
 *   onEnd      fn()       fired when playback reaches the end
 *   onNext     fn()       if provided, shows a "next" button / auto-advances
 *   hasNext    bool       enables the next control
 *
 * Playlists (hasNext + onNext) also get an "up next" card when a clip ends:
 *   nextTitle/nextSubtitle  what the card announces
 *   autoPlayNext            when on, the card counts 5s down then advances
 *   onAutoPlayNextChange    fn(bool) — the card's autoplay toggle
 *   suspendUpNext           hides the card (e.g. while a dialog is open)
 */
export default function VideoPlayer({
  source,
  poster = null,
  autoPlay = true,
  onProgress,
  onEnd,
  onNext,
  hasNext = false,
  nextTitle,
  nextSubtitle,
  autoPlayNext = false,
  onAutoPlayNextChange,
  suspendUpNext = false,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const videoRef = useRef(null);

  // Aspect ratio of the loaded video. Defaults to 16:9 until the real natural
  // size arrives in onLoad, then adapts so portrait clips get a tall frame
  // instead of being squashed into a short letterboxed strip.
  const [aspect, setAspect] = useState(16 / 9);

  const [paused, setPaused] = useState(!autoPlay);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [ended, setEnded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // "Up next" card: shown when a clip in a playlist ends. With autoplay on it
  // runs a 5s countdown and advances by itself; the user can play now, cancel
  // (dismiss for this clip), replay, or flip the toggle right on the card.
  // `autoNext` mirrors the prop so the toggle works even without a handler.
  const [autoNext, setAutoNext] = useState(autoPlayNext);
  const [nextDismissed, setNextDismissed] = useState(false);
  const [countdownMs, setCountdownMs] = useState(null);

  const [trackW, setTrackW] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const seekPreview = useRef(0);
  // True between issuing a seek() and the native onSeek confirming it. While
  // pending we ignore progress events, which briefly report the *old* time and
  // otherwise snap the scrubber back when tracing/seeking.
  const seekPending = useRef(false);

  // Controls visibility (animated fade) + auto-hide timer.
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const fade = useCallback(
    to => Animated.timing(opacity, { toValue: to, duration: 200, useNativeDriver: true }).start(),
    [opacity],
  );

  const armAutoHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      fade(0);
    }, 3200);
  }, [fade]);

  const reveal = useCallback(() => {
    setVisible(true);
    fade(1);
    armAutoHide();
  }, [fade, armAutoHide]);

  // Keep controls up while paused / seeking / ended; auto-hide while playing.
  useEffect(() => {
    if (paused || seeking || ended || errored || buffering) {
      clearTimeout(hideTimer.current);
      setVisible(true);
      fade(1);
    } else {
      armAutoHide();
    }
    return () => clearTimeout(hideTimer.current);
  }, [paused, seeking, ended, errored, buffering, armAutoHide, fade]);

  // Entering/leaving fullscreen re-shows the controls (and restarts the
  // auto-hide timer) — otherwise a timer armed before the toggle fires moments
  // later and the freshly-expanded player looks like it has no controls at all.
  const toggleFullscreen = useCallback(() => {
    setFullscreen(f => !f);
    reveal();
  }, [reveal]);

  // Hardware back exits fullscreen instead of leaving the screen.
  useEffect(() => {
    if (!fullscreen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      reveal();
      return true;
    });
    return () => sub.remove();
  }, [fullscreen, reveal]);

  // Reset when the source changes (playlist switch).
  useEffect(() => {
    setPaused(!autoPlay);
    setEnded(false);
    setErrored(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(true);
    setNextDismissed(false);
    reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.uri, retryKey]);

  useEffect(() => setAutoNext(autoPlayNext), [autoPlayNext]);

  // Replaying or scrubbing back off the end offers the card again next time.
  useEffect(() => {
    if (!ended) setNextDismissed(false);
  }, [ended]);

  const showUpNext = ended && hasNext && !!onNext && !nextDismissed && !suspendUpNext && !errored;

  // Kept in a ref so a new onNext identity doesn't restart the countdown.
  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);

  // Countdown ticks off wall-clock time (not accumulated intervals) so a
  // backgrounded / throttled timer can't stretch the 5s into something longer.
  useEffect(() => {
    if (!showUpNext || !autoNext) {
      setCountdownMs(null);
      return undefined;
    }
    const endsAt = Date.now() + AUTO_NEXT_MS;
    setCountdownMs(AUTO_NEXT_MS);
    const id = setInterval(() => {
      const left = endsAt - Date.now();
      if (left <= 0) {
        clearInterval(id);
        setCountdownMs(null);
        onNextRef.current?.();
      } else {
        setCountdownMs(left);
      }
    }, 50);
    return () => clearInterval(id);
  }, [showUpNext, autoNext]);

  const toggleAutoNext = () => {
    setAutoNext(v => {
      onAutoPlayNextChange?.(!v);
      return !v;
    });
  };

  const playNextNow = () => {
    setCountdownMs(null);
    onNext?.();
  };

  const dismissUpNext = () => {
    setCountdownMs(null);
    setNextDismissed(true);
    reveal();
  };

  const togglePlay = () => {
    if (errored) { setErrored(false); setRetryKey(k => k + 1); return; }
    if (ended) {
      seekPending.current = true;
      videoRef.current?.seek(0);
      setEnded(false);
      setCurrentTime(0);
      setPaused(false);
      reveal();
      return;
    }
    setPaused(p => !p);
    reveal();
  };

  const skip = delta => {
    const t = clamp(currentTime + delta, 0, duration || 0);
    seekPending.current = true;
    videoRef.current?.seek(t);
    setCurrentTime(t);
    // Seeking anywhere before the end resumes normal playback controls.
    if (ended && t < (duration || 0)) setEnded(false);
    reveal();
  };

  const onVideoProgress = data => {
    // Skip stale progress ticks that arrive before a pending seek lands.
    if (!seeking && !seekPending.current) setCurrentTime(data.currentTime);
    onProgress?.(data);
  };

  const onVideoSeek = () => { seekPending.current = false; };

  const onVideoLoad = data => {
    setDuration(data.duration);
    setBuffering(false);
    const ns = data?.naturalSize;
    if (ns && ns.width > 0 && ns.height > 0) {
      // Some decoders report rotated portrait media with width/height swapped.
      let w = ns.width;
      let h = ns.height;
      if (ns.orientation === 'portrait' && w > h) [w, h] = [h, w];
      setAspect(w / h);
    }
  };

  const onVideoEnd = () => {
    setEnded(true);
    setPaused(true);
    setVisible(true);
    fade(1);
    onEnd?.();
  };

  const progress = duration > 0 ? clamp((seeking ? seekPreview.current : currentTime) / duration, 0, 1) : 0;
  const displayTime = seeking ? seekPreview.current : currentTime;

  // Scrubber — locationX is relative to the track view it's attached to.
  const seekResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: e => {
          setSeeking(true);
          seekPreview.current = clamp(e.nativeEvent.locationX / (trackW || 1), 0, 1) * (duration || 0);
          setCurrentTime(seekPreview.current);
        },
        onPanResponderMove: e => {
          seekPreview.current = clamp(e.nativeEvent.locationX / (trackW || 1), 0, 1) * (duration || 0);
          setCurrentTime(seekPreview.current);
        },
        onPanResponderRelease: () => {
          seekPending.current = true;
          videoRef.current?.seek(seekPreview.current);
          setCurrentTime(seekPreview.current);
          // Tracing back after the clip finished must restore the play button
          // and resume from the scrubbed position instead of forcing a replay.
          if (seekPreview.current < (duration || 0)) setEnded(false);
          setSeeking(false);
          reveal();
        },
        onPanResponderTerminate: () => setSeeking(false),
      }),
    [trackW, duration, reveal],
  );

  // Frame height from the video's aspect ratio: never shorter than a 16:9 strip
  // (so landscape clips look right) and never taller than ~62% of the screen
  // (so the playlist below stays reachable). Portrait clips fill that height.
  const minH = (screenW * 9) / 16;
  const maxH = screenH * 0.62;
  const playerH = Math.min(Math.max(screenW / aspect, minH), maxH);

  // Every overlay gets this explicit height: absolute boxes that rely on
  // top+bottom insets collapse to the top on this setup (see styles.controls),
  // and deriving it (instead of measuring via onLayout) keeps the overlays in
  // sync with the frame on the very frame fullscreen/orientation changes.
  const overlayH = fullscreen ? screenH : playerH;

  return (
    <View
      style={[
        styles.wrap,
        fullscreen
          ? [styles.wrapFullscreen, { width: screenW, height: screenH }]
          : { height: playerH },
      ]}
    >
      {/* Immersive fullscreen: drop the status bar while covering the window */}
      {fullscreen && <StatusBar hidden />}
      {source?.uri ? (
        <Video
          key={retryKey}
          ref={videoRef}
          source={source}
          style={{ width: '100%', height: overlayH }}
          paused={paused}
          muted={muted}
          resizeMode="contain"
          repeat={false}
          onProgress={onVideoProgress}
          onSeek={onVideoSeek}
          onLoad={onVideoLoad}
          onLoadStart={() => setBuffering(true)}
          onReadyForDisplay={() => setBuffering(false)}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          onEnd={onVideoEnd}
          onError={() => { setErrored(true); setBuffering(false); }}
          progressUpdateInterval={500}
        />
      ) : (
        <View style={[styles.posterWrap, { height: overlayH }]}>{poster}</View>
      )}

      {/* Tap layer toggles the control overlay (explicit height, like the
          other overlays, so the whole frame stays tappable). Suppressed while
          the up-next card is up so taps can't hide the controls under it. */}
      {!showUpNext && (
        <Pressable
          style={[styles.tapLayer, { height: overlayH }]}
          onPress={() => (visible ? (setVisible(false), fade(0)) : reveal())}
        />
      )}

      {/* Buffering spinner */}
      {buffering && !errored && (
        <View style={[styles.centerOverlay, { height: overlayH }]} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      )}

      {/* Load error */}
      {errored && (
        <View style={[styles.centerOverlay, { height: overlayH }]}>
          <MCIcon name="alert-circle-outline" size={40} color={colors.white} />
          <Text style={styles.errorText}>Couldn't play this video</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={togglePlay} activeOpacity={0.85}>
            <MCIcon name="refresh" size={16} color={colors.white} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Control overlay — explicit height (not absoluteFill) so the flex column
          reliably fills the player; absolute top/bottom wasn't resolving to the
          player height on this setup, collapsing the controls to the top. */}
      <Animated.View
        style={[styles.controls, { height: overlayH, opacity }]}
        pointerEvents={visible && !errored && !showUpNext ? 'box-none' : 'none'}
      >
        {/* Scrim for legibility */}
        <View style={styles.scrim} pointerEvents="none" />

        {/* Center transport — the flex:1 area fills the player so the play
            controls stay vertically centered and the bottom bar sits at the
            bottom, regardless of the (portrait/landscape) player height. */}
        <View style={styles.centerArea} pointerEvents="box-none">
          {!buffering && (
            <View style={styles.centerRow} pointerEvents="box-none">
              <TouchableOpacity onPress={() => skip(-10)} hitSlop={hit} style={styles.sideCtrl}>
                <MCIcon name="rewind-10" size={32} color={colors.white} />
              </TouchableOpacity>

              <TouchableOpacity onPress={togglePlay} style={styles.playCtrl} activeOpacity={0.85}>
                <MCIcon
                  name={ended ? 'replay' : paused ? 'play' : 'pause'}
                  size={34}
                  color={colors.white}
                />
              </TouchableOpacity>

              {hasNext && ended ? (
                <TouchableOpacity onPress={onNext} hitSlop={hit} style={styles.sideCtrl}>
                  <MCIcon name="skip-next" size={32} color={colors.white} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => skip(10)} hitSlop={hit} style={styles.sideCtrl}>
                  <MCIcon name="fast-forward-10" size={32} color={colors.white} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Bottom bar: time · scrubber · mute · fullscreen */}
        <View
          style={[styles.bottomBar, fullscreen && { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}
          pointerEvents="box-none"
        >
          <Text style={styles.time}>{fmtTime(displayTime)}</Text>

          <View style={styles.trackTouch} {...seekResponder.panHandlers}>
            <View
              style={styles.track}
              onLayout={e => setTrackW(e.nativeEvent.layout.width)}
            >
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
            </View>
          </View>

          <Text style={styles.time}>{fmtTime(duration)}</Text>

          <TouchableOpacity onPress={() => setMuted(m => !m)} hitSlop={hit} style={styles.smallCtrl}>
            <MCIcon name={muted ? 'volume-off' : 'volume-high'} size={20} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleFullscreen} hitSlop={hit} style={styles.smallCtrl}>
            <MCIcon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Up next — end-of-clip card for grouped videos. Lives inside the player
          wrapper (not a Modal) so it shows in fullscreen too, and sits above
          the control overlay with its own scrim. */}
      {showUpNext && (
        <View style={[styles.upNext, { height: overlayH }]}>
          <TouchableOpacity
            style={styles.autoToggle}
            onPress={toggleAutoNext}
            activeOpacity={0.8}
            hitSlop={hit}
          >
            <Text style={styles.autoToggleLabel}>Autoplay</Text>
            <View style={[styles.switchTrack, autoNext && styles.switchTrackOn]}>
              <View style={[styles.switchKnob, autoNext && styles.switchKnobOn]} />
            </View>
          </TouchableOpacity>

          <Text style={styles.upNextLabel}>UP NEXT</Text>
          {nextTitle ? (
            <Text style={styles.upNextTitle} numberOfLines={2}>{nextTitle}</Text>
          ) : null}
          {nextSubtitle ? <Text style={styles.upNextSub}>{nextSubtitle}</Text> : null}

          <TouchableOpacity style={styles.upNextPlayBtn} onPress={playNextNow} activeOpacity={0.85}>
            <MCIcon name="play" size={18} color={colors.white} />
            <Text style={styles.upNextPlayText}>
              {countdownMs != null
                ? `Play next in ${Math.ceil(countdownMs / 1000)}s`
                : 'Play next'}
            </Text>
          </TouchableOpacity>

          {countdownMs != null && (
            <View style={styles.countdownTrack}>
              <View
                style={[
                  styles.countdownFill,
                  { width: `${clamp(1 - countdownMs / AUTO_NEXT_MS, 0, 1) * 100}%` },
                ]}
              />
            </View>
          )}

          <View style={styles.upNextGhostRow}>
            <TouchableOpacity style={styles.upNextGhostBtn} onPress={togglePlay} activeOpacity={0.85}>
              <MCIcon name="replay" size={16} color={colors.white} />
              <Text style={styles.upNextGhostText}>Replay</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.upNextGhostBtn} onPress={dismissUpNext} activeOpacity={0.85}>
              <Text style={styles.upNextGhostText}>
                {countdownMs != null ? 'Cancel' : 'Not now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const makeStyles = colors => StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  // Pure-JS fullscreen: the same Video instance expands to cover the window
  // (no native fullscreen player, so controls never desync / jump). Sized with
  // explicit width/height passed inline — right/bottom insets don't resolve on
  // this setup (see styles.controls) and left the player far from fullscreen.
  // Highest zIndex so it sits over the rest of the screen.
  wrapFullscreen: {
    aspectRatio: undefined,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  // Poster / spinner / error overlays: explicit height passed inline for the
  // same reason — with absoluteFill they collapsed and hugged the top edge.
  // Everything stacked over the video carries an explicit zIndex *and*
  // elevation. Document order alone isn't enough on Android: in fullscreen the
  // wrapper is elevated (see wrapFullscreen) and the video's SurfaceView then
  // composites above any sibling left at Z 0, swallowing the whole overlay.
  posterWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 1,
  },
  tapLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    elevation: 2,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 4,
    elevation: 4,
  },
  errorText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 13 },

  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    zIndex: 3,
    elevation: 3,
  },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },

  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  sideCtrl: { padding: 4 },
  playCtrl: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    gap: 10,
  },
  time: { color: colors.white, fontSize: 12, fontWeight: '600', minWidth: 38, textAlign: 'center' },
  trackTouch: { flex: 1, justifyContent: 'center', paddingVertical: 10 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    marginLeft: -7,
    top: -5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  smallCtrl: { padding: 2 },

  // Up-next card — above the controls (zIndex 3) and the spinner/error
  // overlay (4); explicit height inline for the same reason as the others.
  upNext: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.74)',
    zIndex: 5,
    elevation: 5,
  },
  autoToggle: {
    position: 'absolute',
    top: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoToggleLabel: { color: colors.white, fontSize: 12, fontWeight: '700' },
  switchTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 3,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  switchTrackOn: { backgroundColor: colors.primary },
  switchKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  switchKnobOn: { alignSelf: 'flex-end' },

  upNextLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  upNextTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  upNextSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  upNextPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 200,
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  upNextPlayText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  countdownTrack: {
    width: 200,
    height: 3,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countdownFill: { height: 3, borderRadius: 2, backgroundColor: colors.white },
  upNextGhostRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  upNextGhostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  upNextGhostText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
