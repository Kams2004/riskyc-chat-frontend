import { faUser } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { useMediaUrl } from '../features/media/useMediaUrl';
import { useTheme } from '../lib/ThemeContext';
import { Icon } from './Icon';

type AvatarProps = {
  objectKey?: string | null;
  label: string;
  size?: number;
};

/** Same heuristic as mobile's Avatar.tsx — true when the label is a raw phone number (digits/+/spaces/dashes) rather than a real saved name. */
function looksLikePhoneNumber(label: string): boolean {
  return /^[+\d][\d\s\-().]{3,}$/.test(label.trim());
}

/**
 * Ported from mobile/src/components/Avatar.tsx. A presigned avatar URL
 * that fails to actually load (blocked, expired, 404, ...) falls back to
 * the initials circle below rather than a browser broken-image icon with
 * its alt text bleeding out past the circular frame — onError flips a flag
 * the initial render can't know about up front, reset per objectKey so a
 * later successful resolve (e.g. after re-upload) isn't stuck failed.
 */
export function Avatar({ objectKey, label, size = 44 }: AvatarProps) {
  const { colors } = useTheme();
  const resolvedUrl = useMediaUrl(objectKey);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    setLoadFailed(false);
  }, [resolvedUrl]);
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (resolvedUrl && !loadFailed) {
    return <img src={resolvedUrl} alt={label} style={{ ...dimension, objectFit: 'cover' }} onError={() => setLoadFailed(true)} />;
  }

  const showIcon = !label || looksLikePhoneNumber(label);

  return (
    <div
      style={{
        ...dimension,
        backgroundColor: colors.tint2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {showIcon ? (
        <Icon icon={faUser} style={{ color: colors.brand700, fontSize: size * 0.42 }} />
      ) : (
        <span style={{ color: colors.brand700, fontSize: size * 0.32, fontWeight: 700 }}>
          {label.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
