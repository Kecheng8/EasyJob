import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import SavedJobsScreen from '../screens/SavedJobsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors, fontSize } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    </Stack.Navigator>
  );
}

function SavedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Saved" component={SavedJobsScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  Search: { active: '🔍', inactive: '🔍' },
  SavedTab: { active: '❤️', inactive: '🤍' },
  Profile: { active: '👤', inactive: '👤' },
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: 6,
            paddingTop: 6,
            height: 62,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: fontSize.xs,
            fontWeight: '600',
          },
          tabBarIcon: ({ focused }) => {
            const icons = TAB_ICONS[route.name];
            return (
              <Text style={{ fontSize: 22 }}>
                {focused ? icons.active : icons.inactive}
              </Text>
            );
          },
        })}
      >
        <Tab.Screen name="Search" component={HomeStack} options={{ tabBarLabel: 'Search' }} />
        <Tab.Screen name="SavedTab" component={SavedStack} options={{ tabBarLabel: 'Saved' }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
