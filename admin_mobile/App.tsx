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
import DoctorManagementScreen from './src/screens/DoctorManagementScreen';
import DoctorDetailScreen from './src/screens/DoctorDetailScreen';
import EditDoctorScreen from './src/screens/EditDoctorScreen';
import MetadataManagementScreen from './src/screens/MetadataManagementScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import ManageRolesScreen from './src/screens/ManageRolesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const DoctorsStack = createNativeStackNavigator();
const UsersStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home:        { active: 'home',                    inactive: 'home-outline'                  },
  Doctors:     { active: 'doctor',                  inactive: 'doctor'                        },
  Users:       { active: 'account-group',           inactive: 'account-group-outline'         },
  Profile:     { active: 'account-circle',          inactive: 'account-circle-outline'        },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"       component={HomeScreen}          />
    </HomeStack.Navigator>
  );
}

function DoctorsStackNavigator() {
  return (
    <DoctorsStack.Navigator screenOptions={{ headerShown: false }}>
      <DoctorsStack.Screen name="DoctorsMain"      component={DoctorManagementScreen} />
      <DoctorsStack.Screen name="DoctorDetail"     component={DoctorDetailScreen} />
      <DoctorsStack.Screen name="EditDoctor"       component={EditDoctorScreen} />
      <DoctorsStack.Screen name="ManageExpertise"  component={MetadataManagementScreen} />
      <DoctorsStack.Screen name="ManageLanguages"  component={MetadataManagementScreen} />
      <DoctorsStack.Screen name="ManageSpecialties" component={MetadataManagementScreen} />
    </DoctorsStack.Navigator>
  );
}

function UsersStackNavigator() {
  return (
    <UsersStack.Navigator screenOptions={{ headerShown: false }}>
      <UsersStack.Screen name="UsersMain" component={UserManagementScreen} />
      <UsersStack.Screen name="ManageRoles" component={MetadataManagementScreen} />
    </UsersStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"    component={ProfileScreen}        />
      <ProfileStack.Screen name="Settings"       component={SettingsScreen}       />
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
      <Tab.Screen name="Doctors"     component={DoctorsStackNavigator} />
      <Tab.Screen name="Users"       component={UsersStackNavigator} />
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
