import { Text, View, Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Audio } from "expo-av";
import { Camera } from 'expo-camera'
import * as Location from 'expo-location';
import { HomeScreen } from './HomeScreen';
import { FileDisplay } from './FileScreen';
import { theme, styles } from './stylesheet';


// globals:
const { Navigator, Screen } = createNativeStackNavigator();

// App Controls/UI:
export default function App() {
  const [cameraPermission, requestCameraPermission] = Camera.useCameraPermissions();
  const [audioPermission, requestAudioPermission] = Audio.usePermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  if (!cameraPermission || !audioPermission || !locationPermission) {
    // Camera/Audio permissions are still loading
    return <View />
  }

  if (!cameraPermission.granted || !audioPermission.granted || !locationPermission.granted) {
    // Camera/audio permissions are not granted yet

    return (
      <View style={styles.container}>
        <View style={{ padding: 40 }}>
          <Text style={{ textAlign: 'center', color: theme.white, marginBottom: 20, fontSize: 18 }}>
            To use this app, we need your permission to show the camera, record audio, and access your location.
          </Text>
          <Button onPress={() => {
            if (!cameraPermission.granted) {
              requestCameraPermission();
            }
            if (!audioPermission.granted) {
              requestAudioPermission();
            }
            if (!locationPermission.granted) {
              requestLocationPermission();
            }
          }} title='grant permission' />
        </View>
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Navigator screenOptions={{ headerShown: false }}>
        <Screen name="Home" component={HomeScreen} />
        <Screen name="Files" component={FileDisplay} />
      </Navigator>
    </NavigationContainer>
  )
}
