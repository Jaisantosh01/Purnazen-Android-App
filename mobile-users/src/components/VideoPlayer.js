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
  Modal,
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

// Tallest the (non-fullscreen) frame may get, as a share of the window height.
// Portrait clips used to be allowed 62%, which left the title and the rest of
// the playlist crowded off the first screen; fullscreen is there for anyone who
// wants the big frame.
const MAX_FRAME_SHARE = 0.45;

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
 *   sourceId                identity of the current item — see srcKey below
 *   nextTitle/nextSubtitle  what the card announces
 *   autoPlayNext            when on, the card counts 5s down then advances
 *   suspendUpNext           hides the card (e.g. while a dialog is open)
 *
 * Quality — the gear menu offers whatever the source can actually change:
 *   renditions  [{height, videoUrl}]  lower-quality MP4 copies from the catalog
 *               (highest first). The master is "Original". Auto starts on the
 *               master and steps down a rung after repeated stalls.
 *   HLS/DASH    the native player's own ladder (onVideoTracks); Auto is the
 *               player's adaptive mode, a pick pins one resolution.
 *   Plain MP4 with no siblings: the menu has no quality row at all.
 *
 * title  string — shown in the fullscreen top bar next to the exit control.
 *
 * onFullscreenChange fn(bool) — notified when fullscreen is entered/left. The
 * player hosts fullscreen in its own Modal window, so screens don't need to
 * hide their chrome; this is only for callers that care (analytics, pausing
 * other media, etc).
 */
export default function VideoPlayer({
  source,
  sourceId,
  poster = null,
  autoPlay = true,
  paused: externalPaused = false,
  onProgress,
  onEnd,
  onNext,
  hasNext = false,
  nextTitle,
  nextSubtitle,
  autoPlayNext = false,
  suspendUpNext = false,
  onFullscreenChange,
  allowFullscreen = true,
  renditions = null,
  title = null,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const videoRef = useRef(null);

  // Identity of the item being played. Everything that must restart on a
  // playlist switch keys off this rather than the URL: two entries can point at
  // the same blob (identical URL), and swapping the source in place also let a
  // trailing onEnd from the outgoing clip land on the new one — which left the
  // next video paused on the replay icon instead of autoplaying. Remounting
  // <Video/> on this key gives each item a clean native player.
  const srcKey = sourceId ?? source?.uri ?? '';

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
  // Real, laid-out size of the player frame (see overlayH / playerH).
  const [frameH, setFrameH] = useState(0);
  const [frameW, setFrameW] = useState(0);

  // "Up next" card: shown when a clip in a playlist ends. With autoplay on it
  // runs a 5s countdown and advances by itself; the user can play now, cancel
  // (dismiss for this clip) or replay. The autoplay switch itself lives on the
  // screen below the player, not on the card.
  const [nextDismissed, setNextDismissed] = useState(false);
  const [countdownMs, setCountdownMs] = useState(null);

  // Gear menu: null | 'root' | 'quality' | 'speed'.
  const [menu, setMenu] = useState(null);
  const [rate, setRate] = useState(1);
  // 'auto' or a pinned height (number).
  const [quality, setQuality] = useState('auto');
  // HLS/DASH ladder as reported by the native player.
  const [tracks, setTracks] = useState([]);
  // Auto mode over MP4 renditions: index into `ladder`, stepped down on stalls.
  const [autoRung, setAutoRung] = useState(0);
  const stallsRef = useRef([]);

  const [buffered, setBuffered] = useState(0);
  // Brief "+10s" / "−10s" flash after a skip.
  const [skipFlash, setSkipFlash] = useState(null);
  const skipFlashTimer = useRef(null);

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
    if (paused || seeking || ended || errored || buffering || menu) {
      clearTimeout(hideTimer.current);
      setVisible(true);
      fade(1);
    } else {
      armAutoHide();
    }
    return () => clearTimeout(hideTimer.current);
  }, [paused, seeking, ended, errored, buffering, menu, armAutoHide, fade]);

  // Entering/leaving fullscreen re-shows the controls (and restarts the
  // auto-hide timer) — otherwise a timer armed before the toggle fires moments
  // later and the freshly-expanded player looks like it has no controls at all.
  // Entering/leaving fullscreen reparents the frame into/out of the Modal,
  // which remounts <Video/> — remember where playback was so onLoad can seek
  // back to it instead of restarting the clip.
  const currentTimeRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  const resumeAtRef = useRef(0);

  const applyFullscreen = useCallback(
    next => {
      resumeAtRef.current = currentTimeRef.current;
      // Drop the measured height so the overlays fall back to the screen
      // estimate for the one frame before the new layout lands (see overlayH).
      setFrameH(0);
      setFullscreen(next);
      reveal();
    },
    [reveal],
  );

  // Separate toggle/exit: back and onRequestClose can both fire for one press,
  // and two toggles would cancel out. Exiting is idempotent.
  const toggleFullscreen = useCallback(
    () => applyFullscreen(!fullscreen),
    [applyFullscreen, fullscreen],
  );
  const exitFullscreen = useCallback(() => applyFullscreen(false), [applyFullscreen]);

  // Report fullscreen through a ref so a fresh handler identity can't re-fire
  // it, and from an effect so the parent is never updated mid-render.
  const onFsRef = useRef(onFullscreenChange);
  useEffect(() => { onFsRef.current = onFullscreenChange; }, [onFullscreenChange]);
  useEffect(() => { onFsRef.current?.(fullscreen); }, [fullscreen]);

  // Hardware back exits fullscreen instead of leaving the screen.
  useEffect(() => {
    if (!fullscreen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitFullscreen();
      return true;
    });
    return () => sub.remove();
  }, [fullscreen, exitFullscreen]);

  // Reset when the source changes (playlist switch).
  useEffect(() => {
    setPaused(!autoPlay);
    setEnded(false);
    setErrored(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setBuffering(true);
    setNextDismissed(false);
    setTracks([]);
    setAutoRung(0);
    stallsRef.current = [];
    resumeAtRef.current = 0;
    setMenu(null);
    reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey, retryKey]);

  // Quality ladder, highest first. MP4: the master plus its sibling renditions,
  // switched by swapping the URL (the frame remounts and resumes in onLoad).
  // HLS/DASH: the native tracks, switched through selectedVideoTrack.
  const mp4Ladder = useMemo(
    () => (renditions?.length && source?.uri
      ? [{ height: Infinity, label: 'Original', uri: source.uri },
         ...renditions.map(r => ({ height: r.height, label: `${r.height}p`, uri: r.videoUrl }))]
      : null),
    [renditions, source?.uri],
  );
  const hlsLadder = useMemo(() => {
    const seen = new Set();
    return tracks
      .filter(t => t.height > 0 && !seen.has(t.height) && seen.add(t.height))
      .sort((a, b) => b.height - a.height)
      .map(t => ({ height: t.height, label: `${t.height}p`, bitrate: t.bitrate }));
  }, [tracks]);
  // iOS never enumerates an HLS ladder (react-native-video only exposes
  // preferredPeakBitRate there), so an adaptive stream with no reported tracks
  // gets a cap ladder instead: picking "720p" caps the bitrate at what a 720p
  // variant typically needs, and AVPlayer settles on the best variant under it.
  // ponytail: the caps are rules of thumb; a real ladder needs the master
  // playlist parsed client-side.
  const isAdaptive = /\.(m3u8|mpd)(\?|$)/i.test(source?.uri || '');
  const ladder = mp4Ladder || (hlsLadder.length > 1 ? hlsLadder : isAdaptive ? CAP_LADDER : null);

  const activeRung = mp4Ladder
    ? (quality === 'auto' ? mp4Ladder[Math.min(autoRung, mp4Ladder.length - 1)] : mp4Ladder.find(r => r.height === quality) || mp4Ladder[0])
    : null;
  const playUri = activeRung ? activeRung.uri : source?.uri;
  const pinnedTrack = !mp4Ladder && quality !== 'auto' && ladder ? ladder.find(r => r.height === quality) : null;

  // Every quality change on MP4 remounts the native player: remember where we
  // were so onLoad seeks back instead of restarting the clip.
  const pickQuality = q => {
    if (mp4Ladder) resumeAtRef.current = currentTimeRef.current;
    setQuality(q);
    setMenu(null);
  };

  // ponytail: "dynamic" Auto for MP4 renditions is a stall counter — two
  // rebuffers inside 30s drops one rung. Real bandwidth estimation only exists
  // for HLS/DASH, where the native player already adapts on its own.
  const noteStall = () => {
    if (!mp4Ladder || quality !== 'auto' || paused || seekPending.current || currentTimeRef.current <= 0) return;
    const now = Date.now();
    stallsRef.current = [...stallsRef.current.filter(t => now - t < 30_000), now];
    if (stallsRef.current.length >= 2 && autoRung < mp4Ladder.length - 1) {
      stallsRef.current = [];
      resumeAtRef.current = currentTimeRef.current;
      setAutoRung(r => r + 1);
    }
  };

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
    if (!showUpNext || !autoPlayNext) {
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
  }, [showUpNext, autoPlayNext]);

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
    setSkipFlash(delta);
    clearTimeout(skipFlashTimer.current);
    skipFlashTimer.current = setTimeout(() => setSkipFlash(null), 600);
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
    if (data.playableDuration > 0) setBuffered(data.playableDuration);
    onProgress?.(data);
  };

  const onVideoSeek = () => { seekPending.current = false; };

  // Second tap on the same half within 300ms skips ±10s (first tap still
  // toggles the controls, like every mobile player).
  const lastTapRef = useRef(0);
  const onTap = e => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      skip(e.nativeEvent.locationX < (frameW || screenW) / 2 ? -10 : 10);
      return;
    }
    lastTapRef.current = now;
    if (visible) { setVisible(false); fade(0); } else reveal();
  };

  const onVideoLoad = data => {
    setDuration(data.duration);
    setBuffering(false);
    // Resume where the previous native player left off (fullscreen remount).
    if (resumeAtRef.current > 0) {
      const t = resumeAtRef.current;
      resumeAtRef.current = 0;
      seekPending.current = true;
      videoRef.current?.seek(t);
      setCurrentTime(t);
    }
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
  // (so landscape clips look right) and never taller than MAX_FRAME_SHARE of the
  // screen. Portrait clips fill that height. Measured width, not the window's,
  // so a player embedded in a narrower card doesn't get sized for the full
  // screen and letterbox itself.
  const baseW = frameW || screenW;
  const minH = (baseW * 9) / 16;
  const maxH = screenH * MAX_FRAME_SHARE;
  const playerH = Math.min(Math.max(baseW / aspect, minH), maxH);

  // Every overlay gets this explicit height: absolute boxes that rely on
  // top+bottom insets collapse to the top on this setup (see styles.controls).
  // In fullscreen the frame fills the modal window, so the height has to be
  // *measured* — deriving it from the window instead overshot the area the
  // frame actually got, which pushed the bottom bar (scrubber, times, mute,
  // exit-fullscreen) clean off the bottom of the screen. screenH is only the
  // estimate for the first frame after a toggle.
  const overlayH = fullscreen ? frameH || screenH : playerH;

  const frame = (
    <View
      onLayout={e => {
        setFrameH(e.nativeEvent.layout.height);
        setFrameW(e.nativeEvent.layout.width);
      }}
      style={[styles.wrap, fullscreen ? styles.wrapFullscreen : { height: playerH }]}
    >
      {/* Immersive fullscreen: drop the status bar while covering the window */}
      {fullscreen && <StatusBar hidden />}
      {source?.uri ? (
        <Video
          key={`${retryKey}:${srcKey}:${playUri}`}
          ref={videoRef}
          source={{ ...source, uri: playUri }}
          rate={rate}
          selectedVideoTrack={pinnedTrack ? { type: 'resolution', value: pinnedTrack.height } : { type: 'auto' }}
          maxBitRate={pinnedTrack?.bitrate || 0}
          onVideoTracks={e => setTracks(e?.videoTracks || [])}
          style={{ width: '100%', height: overlayH }}
          paused={paused || externalPaused}
          muted={muted}
          resizeMode="contain"
          repeat={false}
          onProgress={onVideoProgress}
          onSeek={onVideoSeek}
          onLoad={onVideoLoad}
          onLoadStart={() => setBuffering(true)}
          onReadyForDisplay={() => setBuffering(false)}
          onBuffer={({ isBuffering }) => { setBuffering(isBuffering); if (isBuffering) noteStall(); }}
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
      {!showUpNext && !menu && (
        <Pressable style={[styles.tapLayer, { height: overlayH }]} onPress={onTap} />
      )}

      {/* Buffering spinner */}
      {buffering && !errored && (
        <View style={[styles.centerOverlay, { height: overlayH }]} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      )}

      {skipFlash != null && (
        <View style={[styles.centerOverlay, { height: overlayH }]} pointerEvents="none">
          <View style={[styles.skipFlash, skipFlash < 0 ? styles.skipFlashLeft : styles.skipFlashRight]}>
            <MCIcon name={skipFlash < 0 ? 'rewind' : 'fast-forward'} size={22} color={colors.white} />
            <Text style={styles.skipFlashText}>{skipFlash < 0 ? '−' : '+'}{Math.abs(skipFlash)}s</Text>
          </View>
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

        {/* Fullscreen top bar: exit + title. Non-fullscreen screens draw their
            own back button over the frame. */}
        {fullscreen && (
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]} pointerEvents="box-none">
            <TouchableOpacity onPress={exitFullscreen} hitSlop={hit} style={styles.smallCtrl}>
              <MCIcon name="chevron-down" size={28} color={colors.white} />
            </TouchableOpacity>
            {title ? <Text style={styles.topTitle} numberOfLines={1}>{title}</Text> : null}
          </View>
        )}

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
          // 24dp floor, not the raw inset: this component reads insets from the
          // screen it sits in, and a screen inside the tab navigator can report
          // bottom: 0 (the tab bar consumed it) — which in the fullscreen modal
          // would drop the bar under the gesture pill.
          style={[styles.bottomBar, fullscreen && { paddingBottom: Math.max(insets.bottom, 24) + 4 }]}
          pointerEvents="box-none"
        >
          <Text style={styles.time}>{fmtTime(displayTime)}</Text>

          <View style={styles.trackTouch} {...seekResponder.panHandlers}>
            <View
              style={styles.track}
              onLayout={e => setTrackW(e.nativeEvent.layout.width)}
            >
              <View style={[styles.trackBuffered, { width: `${duration > 0 ? clamp(buffered / duration, 0, 1) * 100 : 0}%` }]} />
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
            </View>
          </View>

          <Text style={styles.time}>{fmtTime(duration)}</Text>

          {rate !== 1 && (
            <TouchableOpacity onPress={() => setMenu('speed')} hitSlop={hit} style={styles.rateChip}>
              <Text style={styles.rateChipText}>{rate}×</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => setMuted(m => !m)} hitSlop={hit} style={styles.smallCtrl}>
            <MCIcon name={muted ? 'volume-off' : 'volume-high'} size={20} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMenu('root')} hitSlop={hit} style={styles.smallCtrl}>
            <MCIcon name="cog-outline" size={21} color={colors.white} />
          </TouchableOpacity>

          {allowFullscreen && (
            <TouchableOpacity onPress={toggleFullscreen} hitSlop={hit} style={styles.smallCtrl}>
              <MCIcon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Gear menu — lives in the frame so it follows the player into
          fullscreen. Backdrop tap closes it. */}
      {menu && (
        <Pressable style={[styles.menuScrim, { height: overlayH }]} onPress={() => setMenu(null)}>
          <Pressable style={styles.menuCard} onPress={() => {}}>
            {menu === 'root' && (
              <>
                {ladder && (
                  <MenuRow
                    icon="high-definition"
                    label="Quality"
                    value={quality === 'auto' ? `Auto${activeRung ? ` · ${activeRung.label}` : ''}` : `${quality}p`}
                    onPress={() => setMenu('quality')}
                    styles={styles}
                  />
                )}
                <MenuRow icon="speedometer" label="Speed" value={rate === 1 ? 'Normal' : `${rate}×`} onPress={() => setMenu('speed')} styles={styles} />
              </>
            )}
            {menu !== 'root' && (
              <TouchableOpacity style={styles.menuHeader} onPress={() => setMenu('root')} activeOpacity={0.8}>
                <MCIcon name="chevron-left" size={22} color="#fff" />
                <Text style={styles.menuHeaderText}>{menu === 'quality' ? 'Quality' : 'Playback speed'}</Text>
              </TouchableOpacity>
            )}
            {menu === 'quality' && (
              <>
                <MenuOption label="Auto" selected={quality === 'auto'} onPress={() => pickQuality('auto')} styles={styles} />
                {ladder.map(r => (
                  <MenuOption key={r.label} label={r.label} selected={quality === r.height} onPress={() => pickQuality(r.height)} styles={styles} />
                ))}
              </>
            )}
            {menu === 'speed' && SPEEDS.map(x => (
              <MenuOption key={x} label={x === 1 ? 'Normal' : `${x}×`} selected={rate === x} onPress={() => { setRate(x); setMenu(null); }} styles={styles} />
            ))}
          </Pressable>
        </Pressable>
      )}

      {/* Up next — end-of-clip card for grouped videos. Part of the frame, so
          it follows the player into fullscreen, and sits above the control
          overlay with its own scrim. */}
      {showUpNext && (
        <View style={[styles.upNext, { height: overlayH }]}>
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

  if (!fullscreen) return frame;

  // Fullscreen has to be a Modal, not an absolutely-positioned box. This player
  // renders inside a screen of the bottom-tab navigator, so its parent starts
  // below the status bar and stops above the tab bar — no amount of positioning
  // inside that parent reaches the real screen edges, and sizing the frame from
  // the window instead just overflowed the parent and hid the bottom bar.
  // A Modal is its own window, so it covers the tab bar and status bar for real.
  // The placeholder keeps the screen's layout stable behind it.
  return (
    <>
      <View style={[styles.wrap, { height: playerH }]} />
      <Modal
        visible
        statusBarTranslucent
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={exitFullscreen}
      >
        {frame}
      </Modal>
    </>
  );
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const CAP_LADDER = [
  { height: 1080, label: '1080p', bitrate: 6_000_000 },
  { height: 720, label: '720p', bitrate: 3_000_000 },
  { height: 480, label: '480p', bitrate: 1_500_000 },
  { height: 360, label: '360p', bitrate: 800_000 },
];

const MenuRow = ({ icon, label, value, onPress, styles }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.8}>
    <MCIcon name={icon} size={20} color="#fff" />
    <Text style={styles.menuLabel}>{label}</Text>
    <Text style={styles.menuValue}>{value}</Text>
    <MCIcon name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
  </TouchableOpacity>
);

const MenuOption = ({ label, selected, onPress, styles }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.8}>
    <MCIcon name={selected ? 'check-circle' : 'circle-outline'} size={20} color={selected ? '#fff' : 'rgba(255,255,255,0.5)'} />
    <Text style={[styles.menuLabel, selected && styles.menuLabelOn]}>{label}</Text>
  </TouchableOpacity>
);

const makeStyles = colors => StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  // Fullscreen frame: fills the modal window that hosts it (see the Modal in
  // the render), so its measured height is the real screen height — which is
  // what every overlay's explicit height is derived from.
  wrapFullscreen: {
    aspectRatio: undefined,
    flex: 1,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
  },
  trackBuffered: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
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

  menuScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 6,
    elevation: 6,
  },
  menuCard: {
    minWidth: 240,
    maxWidth: '85%',
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(30,30,30,0.96)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuLabel: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '600' },
  menuLabelOn: { fontWeight: '800' },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  menuHeaderText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  topTitle: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '700' },
  rateChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  rateChipText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  skipFlash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  skipFlashLeft: { alignSelf: 'flex-start', marginLeft: '12%' },
  skipFlashRight: { alignSelf: 'flex-end', marginRight: '12%' },
  skipFlashText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  menuValue: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

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
