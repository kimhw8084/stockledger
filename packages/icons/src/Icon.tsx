import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  CircleX,
  Clock,
  Command,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Gift,
  Heart,
  Image,
  House,
  Info,
  Landmark,
  Lock,
  Mail,
  Menu,
  Minus,
  MoreHorizontal,
  Pencil,
  Phone,
  Plane,
  Plus,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Unlock,
  Upload,
  User,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useExpoBaseDirection } from '@expo-base/i18n';
import { iconSizes, type IconSize } from '@expo-base/tokens';

const registry = {
  archive: Archive,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUpDown: ArrowUpDown,
  bell: Bell,
  calendar: Calendar,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  circleDollar: CircleDollarSign,
  closeCircle: CircleX,
  clock: Clock,
  command: Command,
  copy: Copy,
  creditCard: CreditCard,
  download: Download,
  externalLink: ExternalLink,
  eye: Eye,
  eyeOff: EyeOff,
  gift: Gift,
  heart: Heart,
  image: Image,
  home: House,
  info: Info,
  bank: Landmark,
  lock: Lock,
  mail: Mail,
  menu: Menu,
  minus: Minus,
  more: MoreHorizontal,
  edit: Pencil,
  phone: Phone,
  plane: Plane,
  plus: Plus,
  receipt: ReceiptText,
  refresh: RefreshCw,
  scan: ScanLine,
  search: Search,
  settings: Settings,
  share: Share2,
  shieldCheck: ShieldCheck,
  shoppingBag: ShoppingBag,
  filter: SlidersHorizontal,
  sparkles: Sparkles,
  star: Star,
  trash: Trash2,
  warning: TriangleAlert,
  unlock: Unlock,
  upload: Upload,
  user: User,
  dining: Utensils,
  wallet: Wallet,
  close: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof registry;
export type IconTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'positive' | 'warning' | 'negative' | 'info' | 'onPrimary' | 'inverse';

export interface IconProps {
  name: IconName;
  size?: IconSize;
  tone?: IconTone;
  strokeWidth?: 'regular' | 'strong';
  accessibilityLabel?: string;
  /** Mirror semantic back/forward glyphs with the current writing direction. */
  directional?: boolean;
}

const directionalNames = new Set<IconName>(['arrowLeft', 'arrowRight', 'chevronLeft', 'chevronRight']);

export function Icon({ name, size = 'md', tone = 'primary', strokeWidth = 'regular', accessibilityLabel, directional = true }: IconProps) {
  const { theme } = useUnistyles();
  const direction = useExpoBaseDirection();
  const Component = registry[name];
  const color = tone === 'primary' ? theme.colors.text.primary
    : tone === 'secondary' ? theme.colors.text.secondary
    : tone === 'tertiary' ? theme.colors.text.tertiary
    : tone === 'accent' ? theme.colors.interactive.primary
    : tone === 'positive' ? theme.colors.feedback.positive
    : tone === 'warning' ? theme.colors.feedback.warning
    : tone === 'negative' ? theme.colors.feedback.negative
    : tone === 'info' ? theme.colors.feedback.info
    : tone === 'inverse' ? theme.colors.text.inverse
    : theme.colors.interactive.onPrimary;

  const glyph = (
    <Component
      size={iconSizes[size]}
      color={color}
      strokeWidth={strokeWidth === 'strong' ? 2.25 : 1.8}
    />
  );

  const mirrored = directional && direction === 'rtl' && directionalNames.has(name);
  const renderedGlyph = mirrored ? <View style={styles.mirrored}>{glyph}</View> : glyph;

  if (!accessibilityLabel) return renderedGlyph;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {renderedGlyph}
    </View>
  );
}

const styles = { mirrored: { transform: [{ scaleX: -1 }] } };
