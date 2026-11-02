import type { SVGProps } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CircleAlert,
  CircleHelp,
  Code2,
  Copy,
  ExternalLink,
  Ellipsis,
  Home,
  KeyRound,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  PanelLeft,
  PencilLine,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type IconName =
  | "sparkles"
  | "chat"
  | "voice"
  | "code"
  | "plus"
  | "search"
  | "settings"
  | "panel"
  | "more"
  | "paperclip"
  | "send"
  | "copy"
  | "like"
  | "dislike"
  | "mic"
  | "micOff"
  | "volume"
  | "key"
  | "external"
  | "help"
  | "check"
  | "arrow"
  | "arrowRight"
  | "calendar"
  | "brain"
  | "bookOpen"
  | "pencil"
  | "home"
  | "alert"
  | "trash"
  | "close";

const lucideIcons: Record<IconName, LucideIcon> = {
  sparkles: Sparkles,
  chat: MessageCircle,
  voice: AudioLines,
  code: Code2,
  plus: Plus,
  search: Search,
  settings: Settings2,
  panel: PanelLeft,
  more: Ellipsis,
  paperclip: Paperclip,
  send: Send,
  copy: Copy,
  like: ThumbsUp,
  dislike: ThumbsDown,
  mic: Mic,
  micOff: MicOff,
  volume: Volume2,
  key: KeyRound,
  external: ExternalLink,
  help: CircleHelp,
  check: Check,
  arrow: ArrowUpRight,
  arrowRight: ArrowRight,
  calendar: CalendarDays,
  brain: Brain,
  bookOpen: BookOpen,
  pencil: PencilLine,
  home: Home,
  alert: CircleAlert,
  trash: Trash2,
  close: X,
};

/** Renders one consistently sized Lucide icon used across the app. */
export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number; strokeWidth?: number }) {
  const LucideIcon = lucideIcons[name];
  return <LucideIcon size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
}
