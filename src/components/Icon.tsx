import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';

/** Thin wrapper so every icon in the app goes through one consistent size/style default instead of each call site repeating it. */
export function Icon(props: FontAwesomeIconProps) {
  return <FontAwesomeIcon fixedWidth {...props} />;
}
