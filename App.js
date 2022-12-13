import React, { useEffect } from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';

import LoginScreen from './src/screens/LoginScreen';
// import CallScreen from './src/screens/CallScreen';
import CallScreenTwo from './src/screens/CallScreenTwo';

const Stack = createStackNavigator();

const App = () => {
  useEffect(() => {
    console.log('App called!')
  }, [])
  
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} /> */}
        {/* <Stack.Screen name="Call" component={CallScreen} /> */}
        <Stack.Screen name="Call" component={CallScreenTwo} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;