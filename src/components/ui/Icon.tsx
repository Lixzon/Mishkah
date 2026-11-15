import type { CSSProperties, ReactElement } from 'react';

export type IconName =
  | 'play'
  | 'pause'
  | 'next'
  | 'prev'
  | 'shuffle'
  | 'repeat'
  | 'repeatOne'
  | 'volume'
  | 'mute'
  | 'timer'
  | 'download'
  | 'clipboard'
  | 'trash'
  | 'check'
  | 'close'
  | 'plus'
  | 'book'
  | 'list'
  | 'quote'
  | 'sparkle'
  | 'progress'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'back'
  | 'forward'
  | 'grip'
  | 'edit'
  | 'search'
  | 'mic'
  | 'share'
  | 'headphones'
  | 'stop'
  | 'home'
  | 'music'
  | 'refresh'
  | 'clock'
  | 'warning'
  | 'info'
  | 'stack'
  | 'heart'
  | 'pin'
  | 'eye'
  | 'eyeOff'
  | 'more'
  | 'wifi'
  | 'chevronDown'
  | 'moreVertical'
  | 'chevronRight'
  | 'cloud'
  | 'snowflake'
  | 'lock'
  | 'unlock'
  | 'user';

const S = (props: { children: ReactElement[] | ReactElement; fill?: boolean }) => (
  <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    {props.children}
  </g>
);

const ICONS: Record<IconName, ReactElement> = {
  play: (
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
  ),
  pause: (
    <>
      <path d="M8.5 5.5v13" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M15.5 5.5v13" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),
  next: (
    <>
      <path d="M6 5.5v13l9.5-6.5z" fill="currentColor" stroke="none" />
      <path d="M18.5 5.5v13" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),
  prev: (
    <>
      <path d="M18 5.5v13L8.5 12z" fill="currentColor" stroke="none" />
      <path d="M5.5 5.5v13" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),
  shuffle: (
    <S>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="M4 4l5 5" />
    </S>
  ),
  repeat: (
    <S>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </S>
  ),
  repeatOne: (
    <S>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      <path d="M11 9.5 12.5 9v6" />
    </S>
  ),
  volume: (
    <S>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </S>
  ),
  mute: (
    <S>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="m16 9 5 5" />
      <path d="m21 9-5 5" />
    </S>
  ),
  timer: (
    <S>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 2h6" />
    </S>
  ),
  download: (
    <S>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </S>
  ),
  clipboard: (
    <S>
      <rect x="8" y="4" width="12" height="16" rx="2" />
      <path d="M16 4V3a1 1 0 0 0-1-1H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h1" />
      <path d="M11 9h6M11 13h6" />
    </S>
  ),
  trash: (
    <S>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-.8 13a2 2 0 0 1-2 1.9H7.8a2 2 0 0 1-2-1.9L5 6" />
      <path d="M10 11v6M14 11v6" />
    </S>
  ),
  check: (
    <path d="M4 12.5 9 17.5 20 6.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  ),
  close: (
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  ),
  plus: (
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
  ),
  book: (
    <S>
      <path d="M12 6.5C10 4.8 6.8 4.2 3.5 5v15c3.3-.8 6.5-.2 8.5 1.5 2-1.7 5.2-2.3 8.5-1.5V5c-3.3-.8-6.5-.2-8.5 1.5z" />
      <path d="M12 6.5v15" />
    </S>
  ),
  list: (
    <S>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </S>
  ),
  quote: (
    <path
      d="M10 7c-3 1-4.5 3.2-4.5 6.5V17H9v-4H6.8c.2-2 1.2-3.3 3.2-4V7zm8 0c-3 1-4.5 3.2-4.5 6.5V17H17v-4h-2.2c.2-2 1.2-3.3 3.2-4V7z"
      fill="currentColor"
      stroke="none"
    />
  ),
  sparkle: (
    <S>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </S>
  ),
  progress: (
    <S>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 9 9h-9z" />
      <path d="M12 12 6.5 6.5" />
    </S>
  ),
  settings: (
    <S>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </S>
  ),
  sun: (
    <S>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </S>
  ),
  moon: (
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" />
  ),
  back: (
    <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  ),
  forward: (
    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  ),
  grip: (
    <S>
      <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
    </S>
  ),
  edit: (
    <S>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </S>
  ),
  search: (
    <S>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </S>
  ),
  mic: (
    <S>
      <rect x="9" y="2.75" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
    </S>
  ),
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />,
  share: (
    <S>
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </S>
  ),
  headphones: (
    <S>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="2.5" y="13.5" width="4.5" height="7" rx="2" />
      <rect x="17" y="13.5" width="4.5" height="7" rx="2" />
    </S>
  ),
  home: (
    <S>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </S>
  ),
  music: (
    <S>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </S>
  ),
  refresh: (
    <S>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </S>
  ),
  clock: (
    <S>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </S>
  ),
  warning: (
    <S>
      <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </S>
  ),
  info: (
    <S>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </S>
  ),
  stack: (
    <S>
      <path d="m12 2 9 5-9 5-9-5 9-5z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </S>
  ),
  heart: (
    <path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.4 5.4 5.4 0 0 1 21.3 12C19 16.4 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" />
  ),
  pin: (
    <S>
      <path d="M12 17v5M5 7h14M6 7c0-2.8 2.7-5 6-5s6 2.2 6 5c0 5-2 6-2 10h-8c0-4-2-5-2-10z" />
    </S>
  ),
  eye: (
    <S>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </S>
  ),
  eyeOff: (
    <S>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-3 3.8M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5-1.4" />
    </S>
  ),
  more: (
    <path d="M5 12h.01M12 12h.01M19 12h.01" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
  ),
  wifi: (
    <S>
      <path d="M5 12.5a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M2 8.8a15 15 0 0 1 20 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </S>
  ),
  chevronDown: (
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  ),
  moreVertical: (
    <path d="M12 5h.01M12 12h.01M12 19h.01" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
  ),
  chevronRight: (
    <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  ),
  cloud: (
    <S>
      <path d="M6.5 18.5h11a3.5 3.5 0 0 0 0-7 5.5 5.5 0 0 0-10.6-1.6A3.9 3.9 0 0 0 6.5 18.5z" />
    </S>
  ),
  snowflake: (
    <S>
      <path d="M12 3.8v16.4" />
      <path d="M4.9 7.9l14.2 8.2" />
      <path d="M19.1 7.9L4.9 16.1" />
      <path d="M9.8 6l2.2 2.2L14.2 6" />
      <path d="M9.8 18l2.2-2.2L14.2 18" />
    </S>
  ),
  lock: (
    <S>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </S>
  ),
  unlock: (
    <S>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 7.6-1.6" />
    </S>
  ),
  user: (
    <S>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </S>
  ),
};

export function Icon({
  name,
  size = 22,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
