import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExifWriter.web.ts
// and on native platforms to ExifWriter.ts
import ExifWriterModule from './src/ExifWriterModule';
import { Double } from 'react-native/Libraries/Types/CodegenTypes';

/**
 * Writes location data to a photo's exif data.
 * 
 * @param {string} uri The uri of the photo to write the exif to
 * @param {Double} latitude The latitude location information
 * @param {Double} longitude The longitude location information
 * @param {Double} altitude The altitude location information
 * @returns 
 */
export function writeExif(uri: string, latitude : Double, longitude : Double, altitude : Double): boolean {
  return ExifWriterModule.writeExif(uri, latitude, longitude, altitude);
}