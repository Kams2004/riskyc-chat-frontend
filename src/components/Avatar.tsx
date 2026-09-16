import { useMediaUrl } from '../features/media/useMediaUrl';
import { useTheme } from '../lib/ThemeContext';

type AvatarProps = {
  objectKey?: string | null;
  label: string;
  size?: number;
};

/** Ported from mobile/src/components/Avatar.tsx. */
export function Avatar({ objectKey, label, size = 44 }: AvatarProps) {
  const { colors } = useTheme();
  const resolvedUrl = useMediaUrl(objectKey);
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (resolvedUrl) {
    return <img src={resolvedUrl} alt={label} style={dimension} />;
  }

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
      <span style={{ color: colors.brand700, fontSize: size * 0.32, fontWeight: 700 }}>
        {label.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}
