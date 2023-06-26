import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { ExifWriterViewProps } from './ExifWriter.types';

const NativeView: React.ComponentType<ExifWriterViewProps> =
  requireNativeViewManager('ExifWriter');

export default function ExifWriterView(props: ExifWriterViewProps) {
  return <NativeView {...props} />;
}
