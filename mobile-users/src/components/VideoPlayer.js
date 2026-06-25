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
} from 'react-native';
import Video from 'react-native-video';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

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
 */
export default function VideoPlayer({
  source,
  poster = null,
  autoPlay = true,
  onProgress,
  onEnd,
  onNext,
  hasNext = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const videoRef = useRef(null);

  const [paused, setPaused] = useState(!autoPlay);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [ended, setEnded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [trackW, setTrackW] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const seekPreview = useRef(0);

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

  // Reset when the source changes (playlist switch).
  useEffect(() => {
    setPaused(!autoPlay);
    setEnded(false);
    setErrored(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(true);
    reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.uri, retryKey]);

  const togglePlay = () => {
    if (errored) { setErrored(false); setRetryKey(k => k + 1); return; }
    if (ended) {
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
    videoRef.current?.seek(t);
    setCurrentTime(t);
    if (ended && delta < 0) setEnded(false);
    reveal();
  };

  const onVideoProgress = data => {
    if (!seeking) setCurrentTime(data.currentTime);
    onProgress?.(data);
  };

  const onVideoLoad = data => {
    setDuration(data.duration);
    setBuffering(false);
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
          videoRef.current?.seek(seekPreview.current);
          setCurrentTime(seekPreview.current);
          setSeeking(false);
          reveal();
        },
        onPanResponderTerminate: () => setSeeking(false),
      }),
    [trackW, duration, reveal],
  );

  return (
    <View style={[styles.wrap, fullscreen && styles.wrapFullscreen]}>
      {source?.uri ? (
        <Video
          key={retryKey}
          ref={videoRef}
          source={source}
          style={StyleSheet.absoluteFill}
          paused={paused}
          muted={muted}
          resizeMode="contain"
          repeat={false}
          fullscreen={fullscreen}
          onProgress={onVideoProgress}
          onLoad={onVideoLoad}
          onLoadStart={() => setBuffering(true)}
          onReadyForDisplay={() => setBuffering(false)}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          onEnd={onVideoEnd}
          onError={() => { setErrored(true); setBuffering(false); }}
          onFullscreenPlayerWillDismiss={() => setFullscreen(false)}
          progressUpdateInterval={500}
        />
      ) : (
        <View style={styles.posterWrap}>{poster}</View>
      )}

      {/* Tap layer toggles the control overlay */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => (visible ? (setVisible(false), fade(0)) : reveal())}
      />

      {/* Buffering spinner */}
      {buffering && !errored && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      )}

      {/* Load error */}
      {errored && (
        <View style={styles.centerOverlay}>
          <MCIcon name="alert-circle-outline" size={40} color={colors.white} />
          <Text style={styles.errorText}>Couldn't play this video</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={togglePlay} activeOpacity={0.85}>
            <MCIcon name="refresh" size={16} color={colors.white} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Control overlay */}
      <Animated.View
        style={[styles.controls, { opacity }]}
        pointerEvents={visible && !errored ? 'box-none' : 'none'}
      >
        {/* Scrim for legibility */}
        <View style={styles.scrim} pointerEvents="none" />

        {/* Center transport */}
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

        {/* Bottom bar: time · scrubber · mute · fullscreen */}
        <View style={styles.bottomBar} pointerEvents="box-none">
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

          <TouchableOpacity onPress={() => setFullscreen(f => !f)} hitSlop={hit} style={styles.smallCtrl}>
            <MCIcon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const makeStyles = colors => StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  wrapFullscreen: { aspectRatio: undefined, flex: 1 },
  posterWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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

  controls: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },

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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
});
