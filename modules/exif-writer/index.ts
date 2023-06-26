import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExifWriter.web.ts
// and on native platforms to ExifWriter.ts
import ExifWriterModule from './src/ExifWriterModule';
import ExifWriterView from './src/ExifWriterView';
import { ChangeEventPayload, ExifWriterViewProps } from './src/ExifWriter.types';

// Get the native constant value.
export const PI = ExifWriterModule.PI;

export function hello(): string {
  return ExifWriterModule.hello();
}

export async function setValueAsync(value: string) {
  return await ExifWriterModule.setValueAsync(value);
}

const emitter = new EventEmitter(ExifWriterModule ?? NativeModulesProxy.ExifWriter);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { ExifWriterView, ExifWriterViewProps, ChangeEventPayload };
