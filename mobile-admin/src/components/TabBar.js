import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * Bottom tab bar (byte-identical across the three apps; copy changes over). The active tab gets a tinted pill
 * behind its icon; the rest stay quiet. Hooks into react-navigation's
 * `tabBar` prop, so the per-tab `tabPress` listeners (re-tap resets the
 * stack) keep working — this emits the same events the default bar does.
 *
 * `icons` maps route name → { active, inactive } MaterialCommunityIcons names.
 */
export default function TabBar({ state, descriptors, navigation, icons }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const focused = state.index === index;
        const icon = icons[route.name] || { active: 'circle', inactive: 'circle-outline' };
        const tint = focused ? colors.primary : colors.textMuted;

        const onPress = () => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? `${label}, tab, ${index + 1} of ${state.routes.length}`}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.tab}
          >
            <View style={[styles.pill, focused && { backgroundColor: colors.primaryLight }]}>
              <MCIcon name={focused ? icon.active : icon.inactive} size={22} color={tint} />
            </View>
            <Text style={[styles.label, { color: tint }, focused && styles.labelOn]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  pill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10.5, fontWeight: '600' },
  labelOn: { fontWeight: '800' },
});
