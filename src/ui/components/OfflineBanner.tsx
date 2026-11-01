'use client';

import { useEffect, useRef, useState } from 'react';
import { useOnline } from '../useOnline';
import { Icon } from './Icon';

/**
 * Connection loss (state-copy §2.8, CLAUDE.md "Offline"): warn and keep drafts only. The banner
 * appears when the browser goes offline and confirms briefly when the connection returns.
 */
export function OfflineBanner({
  title,
  text,
  restored,
}: {
  title: string;
  text: string;
  restored: string;
}) {
  const online = useOnline();
  const wasOffline = useRef(false);
  const [justBack, setJustBack] = useState(false);
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    const show = setTimeout(() => setJustBack(true), 0);
    const hide = setTimeout(() => setJustBack(false), 5000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [online]);
  if (online && !justBack) return null;
  return online ? (
    <div className="alert alert--success alert--banner" role="status" data-testid="online-banner">
      <Icon name="circle-check" />
      <div className="alert__body">{restored}</div>
    </div>
  ) : (
    <div className="alert alert--warning alert--banner" role="alert" data-testid="offline-banner">
      <Icon name="wifi-off" />
      <div className="alert__body">
        <span className="alert__title">{title}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}
