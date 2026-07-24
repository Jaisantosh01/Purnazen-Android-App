import React from 'react';
import { StyleSheet } from 'react-native';
import Video from 'react-native-video';

/**
 * Off-screen probe that reads a local video's duration via react-native-video's
 * onLoad — without ever showing or playing it. Mount ONE at a time for the file
 * whose duration you need; it fires `onDone(seconds)` once loaded (or
 * `onDone(null)` on error) so the caller can pre-fill the duration field.
 *
 * expo-document-picker doesn't expose duration and there's no expo-av/ffmpeg
 * here, so a hidden player is the only on-device way to get it.
 */
const VideoDurationProbe = ({ uri, onDone }) => {
  if (!uri) return null;
  return (
    <Video
      source={{ uri }}
      paused
      muted
      controls={false}
      resizeMode="contain"
      // Kept out of layout and fully transparent — metadata only.
      style={styles.hidden}
      onLoad={(data) => onDone?.(Math.round(data?.duration || 0))}
      onError={() => onDone?.(null)}
    />
  );
};

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, top: -1000, left: -1000 },
});

export default VideoDurationProbe;
