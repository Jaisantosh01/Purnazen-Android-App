import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Appearance } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import errorReportingService from '../services/errorReportingService';
import { getColors } from '../constants/theme';

/**
 * React error boundary — catches unhandled render/lifecycle errors,
 * reports them to the backend, and shows a recovery UI.
 *
 * Usage:
 *   <ErrorBoundary screen="HomeScreen">
 *     <HomeScreen />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    errorReportingService.captureException(error, {
      screen:         this.props.screen || 'unknown',
      componentStack: errorInfo?.componentStack?.slice(0, 2000),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;
    const message   = error?.message || 'Something went wrong';
    // Class components can't use the useTheme hook; resolving the palette from
    // the OS scheme at render keeps this rarely-shown screen close enough.
    const styles = makeStyles(getColors(Appearance.getColorScheme() || 'light'));

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconBox}>
            <MCIcon name="alert-decagram-outline" size={64} color="#f87171" />
          </View>

          <Text style={styles.title}>Oops, something broke</Text>
          <Text style={styles.subtitle}>
            We've been notified and are looking into it.
          </Text>

          {__DEV__ && (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>Developer info</Text>
              <Text style={styles.devText}>{message}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.retryBtn} onPress={this.handleReset} activeOpacity={0.85}>
            <MCIcon name="refresh" size={18} color="#fff" />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

export default ErrorBoundary;

const makeStyles = colors => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 16,
  },
  iconBox: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.danger + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  devBox: {
    alignSelf: 'stretch',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  devText: {
    fontSize: 12,
    color: '#f87171',
    fontFamily: 'monospace',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C850C0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    gap: 8,
    marginTop: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
