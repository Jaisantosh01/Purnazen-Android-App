import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const NAV_TABS = [
  { label: 'Home',     icon: '🏠', screen: 'Home'    },
  { label: 'Relief',   icon: '❤️', screen: 'Relief'  },
  { label: 'Wellness', icon: '✦',  screen: 'Wellness'},
  { label: 'Consult',  icon: '📅', screen: 'Consult' },
  { label: 'Profile',  icon: '👤', screen: 'Profile' },
];

const BottomNav = ({ activeTab = 'Home', navigation = null }) => {
  return (
    <View style={styles.bottomNav}>
      {NAV_TABS.map((tab) => {
        const isActive = activeTab === tab.label;
        return (
          <TouchableOpacity
            key={tab.label}
            style={styles.navItem}
            onPress={() => navigation.navigate(tab.screen)}
          >
            <Text style={styles.navIcon}>{tab.icon}</Text>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomNav;

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 3,
  },
  navLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
  navLabelActive: {
    color: '#1FA77A',
    fontWeight: '600',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1FA77A',
    marginTop: 3,
  },
});