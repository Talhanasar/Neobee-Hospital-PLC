'use client';

import * as React from 'react';

export function PrintOnMessage() {
  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data === 'neobee:print') window.print();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return null;
}
