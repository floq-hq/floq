import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { TFLiteSpike } from './components/dev/TFLiteSpike';

// W1 TFLite spike (M1.3) harness. Temporary — replace with the real app shell
// (Expo Router) once the spike is verified on device.
export default function App() {
  return (
    <View style={styles.container}>
      <TFLiteSpike />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
