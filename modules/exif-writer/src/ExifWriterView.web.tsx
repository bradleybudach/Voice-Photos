import * as React from 'react';

import { ExifWriterViewProps } from './ExifWriter.types';

export default function ExifWriterView(props: ExifWriterViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
