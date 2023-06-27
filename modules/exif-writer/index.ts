import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExifWriter.web.ts
// and on native platforms to ExifWriter.ts
import ExifWriterModule from './src/ExifWriterModule';
import { Double } from 'react-native/Libraries/Types/CodegenTypes';

export function writeExif(uri: string, latitude : Double, longitude : Double, altitude : Double): string {
  return ExifWriterModule.writeExif(uri, latitude, longitude, altitude);
}