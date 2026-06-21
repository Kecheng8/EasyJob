import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { JobsProvider } from './src/context/JobsContext';
import AppNavigator from './src/navigation';

export default function App() {
  return (
    <JobsProvider>
      <AppNavigator />
      <StatusBar style="dark" />
    </JobsProvider>
  );
}
