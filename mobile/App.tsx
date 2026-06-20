import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// @ts-ignore
import authService from './src/services/authService';
// @ts-ignore
import { navigationRef } from './src/navigation/navigationRef';
// @ts-ignore
import { COLORS } from './src/constants/theme';
// @ts-ignore
import Toast from './src/components/Toast';
// @ts-ignore
import useToastStore from './src/utils/toast';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';

import HomeScreen from './src/screens/HomeScreen';
import ReliefScreen from './src/screens/ReliefScreen';
import WellnessScreen from './src/screens/WellnessScreen';
import ConsultScreen from './src/screens/ConsultScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TherapyHistoryScreen from './src/screens/TherapyHistoryScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubscriptionsScreen from './src/screens/SubscriptionsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SelectSymptomScreen from './src/screens/SelectSymptomScreen';
import FaceGlowScreen from './src/screens/FaceGlowScreen';
import YogaSessionScreen from './src/screens/YogaSessionScreen';
import ReliefSessionScreen from './src/screens/ReliefSessionScreen';
import ChatAssistantScreen from './src/screens/ChatAssistantScreen';
import VideoPlayerScreen from './src/screens/VideoPlayerScreen';
import DoctorProfileScreen from './src/screens/DoctorProfileScreen';
import BookAppointmentScreen from './src/screens/BookAppointmentScreen';
import BookingConfirmedScreen from './src/screens/BookingConfirmedScreen';
import AppointmentHistoryScreen from './src/screens/AppointmentHistoryScreen';
import AppointmentDetailScreen from './src/screens/AppointmentDetailScreen';
import PaymentScreen from './src/screens/PaymentScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const WellnessStack = createNativeStackNavigator();
const ReliefStack   = createNativeStackNavigator();
const ConsultStack  = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home:        { active: 'home',                    inactive: 'home-outline'                  },
  Relief:      { active: 'heart',                   inactive: 'heart-outline'                 },
  WellnessTab: { active: 'star-four-points',        inactive: 'star-four-points-outline'      },
  ConsultTab:  { active: 'calendar-month',          inactive: 'calendar-month-outline'        },
  Profile:     { active: 'account-circle',          inactive: 'account-circle-outline'        },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"       component={HomeScreen}          />
      <HomeStack.Screen name="SelectSymptom"  component={SelectSymptomScreen} />
      <HomeStack.Screen name="FaceGlow"       component={FaceGlowScreen}      />
      <HomeStack.Screen name="SessionScreen"  component={YogaSessionScreen}   />
      <HomeStack.Screen name="ReliefSession"  component={ReliefSessionScreen} />
      <HomeStack.Screen name="ChatAssistant"  component={ChatAssistantScreen} />
      <HomeStack.Screen name="VideoPlayer"    component={VideoPlayerScreen}   />
    </HomeStack.Navigator>
  );
}

function ReliefStackNavigator() {
  return (
    <ReliefStack.Navigator screenOptions={{ headerShown: false }}>
      <ReliefStack.Screen name="ReliefMain"    component={ReliefScreen}        />
      <ReliefStack.Screen name="ReliefSession" component={ReliefSessionScreen} />
      <ReliefStack.Screen name="ChatAssistant" component={ChatAssistantScreen} />
      <ReliefStack.Screen name="VideoPlayer"   component={VideoPlayerScreen}   />
    </ReliefStack.Navigator>
  );
}

function WellnessStackNavigator() {
  return (
    <WellnessStack.Navigator screenOptions={{ headerShown: false }}>
      <WellnessStack.Screen name="WellnessMain"  component={WellnessScreen}    />
      <WellnessStack.Screen name="SessionScreen" component={YogaSessionScreen} />
      <WellnessStack.Screen name="VideoPlayer"   component={VideoPlayerScreen} />
    </WellnessStack.Navigator>
  );
}

function ConsultStackNavigator() {
  return (
    <ConsultStack.Navigator screenOptions={{ headerShown: false }}>
      <ConsultStack.Screen name="ConsultMain"          component={ConsultScreen}          />
      <ConsultStack.Screen name="DoctorProfile"        component={DoctorProfileScreen}    />
      <ConsultStack.Screen name="BookAppointment"      component={BookAppointmentScreen}  />
      <ConsultStack.Screen name="BookingConfirmed"     component={BookingConfirmedScreen} />
      <ConsultStack.Screen name="AppointmentHistory"   component={AppointmentHistoryScreen} />
      <ConsultStack.Screen name="AppointmentDetail"    component={AppointmentDetailScreen} />
      <ConsultStack.Screen name="Payment"              component={PaymentScreen}          />
    </ConsultStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"        component={ProfileScreen}        />
      <ProfileStack.Screen name="AppointmentHistory"  component={AppointmentHistoryScreen} />
      <ProfileStack.Screen name="AppointmentDetail"   component={AppointmentDetailScreen} />
      <ProfileStack.Screen name="TherapyHistory"      component={TherapyHistoryScreen} />
      <ProfileStack.Screen name="VideoPlayer"         component={VideoPlayerScreen}    />
      <ProfileStack.Screen name="ReliefSession"       component={ReliefSessionScreen}  />
      <ProfileStack.Screen name="HelpSupport"         component={HelpSupportScreen}    />
      <ProfileStack.Screen name="Settings"            component={SettingsScreen}       />
      <ProfileStack.Screen name="Subscriptions"       component={SubscriptionsScreen}  />
      <ProfileStack.Screen name="Notifications"       component={NotificationsScreen}  />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Icon name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Home"        component={HomeStackNavigator}    />
      <Tab.Screen name="Relief"      component={ReliefStackNavigator}  />
      <Tab.Screen
        name="WellnessTab"
        component={WellnessStackNavigator}
        options={{ tabBarLabel: 'Wellness' }}
      />
      <Tab.Screen
        name="ConsultTab"
        component={ConsultStackNavigator}
        options={{ tabBarLabel: 'Consult' }}
      />
      <Tab.Screen name="Profile"     component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

export default function App() {
  // Restore persisted session and migrate legacy AsyncStorage tokens
  // into the device keystore (see src/utils/secureStorage.js).
  useEffect(() => {
    authService.bootstrap();
  }, []);

  const { message, type, visible, hide } = useToastStore();

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Login"    component={LoginScreen}    />
        <RootStack.Screen name="Register" component={RegisterScreen} />
        <RootStack.Screen name="Main"     component={MainTabs}       />
      </RootStack.Navigator>
      <Toast message={message} type={type} visible={visible} onHide={hide} />
    </NavigationContainer>
  );
}
