import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Clapperboard,
  ClipboardList,
  Code2,
  GalleryHorizontal,
  HelpCircle,
  History,
  Layout,
  LayoutGrid,
  LayoutTemplate,
  ListChecks,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  MousePointerClick,
  PanelTop,
  PanelsTopLeft,
  Phone,
  Rows3,
  Sparkles,
  Table,
  Tag,
  Type,
  UserRound,
  Users,
  Video,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Every id here is a common, theme-agnostic section concept (the same ids
 * an uploaded theme's own sections/*\/schema.ts `id` field tends to use —
 * see ontech-universal-zip for an example). Unmatched ids fall through to
 * a keyword scan against the id/name/category, then a generic icon, so a
 * theme with its own vocabulary still gets a reasonable picture instead of
 * a blank tile.
 */
const SECTION_ICONS_BY_ID: Record<string, LucideIcon> = {
  header: PanelTop,
  "announcement-bar": Megaphone,
  hero: LayoutTemplate,
  "text-block": Type,
  cards: LayoutGrid,
  gallery: GalleryHorizontal,
  slider: GalleryHorizontal,
  video: Video,
  "video-slider": Clapperboard,
  form: ClipboardList,
  testimonials: MessageSquareQuote,
  faq: HelpCircle,
  timeline: History,
  services: Wrench,
  "about-us": Users,
  features: Sparkles,
  team: UserRound,
  pricing: Tag,
  stats: BarChart3,
  "logo-cloud": Building2,
  cta: MousePointerClick,
  portfolio: Briefcase,
  process: Workflow,
  tabs: PanelsTopLeft,
  accordion: Rows3,
  tables: Table,
  "image-text": LayoutGrid,
  "bento-grid": LayoutGrid,
  marquee: GalleryHorizontal,
  map: MapPin,
  "contact-info": Phone,
  footer: PanelTop,
  popup: Bell,
  "floating-actions": MousePointerClick,
  "custom-code": Code2,
};

const KEYWORD_ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/hero|banner/, LayoutTemplate],
  [/announce/, Megaphone],
  [/card/, LayoutGrid],
  [/gallery|photo|image/, GalleryHorizontal],
  [/slider|carousel|marquee/, GalleryHorizontal],
  [/video/, Video],
  [/form|contact|lead/, ClipboardList],
  [/testimonial|review|quote/, MessageSquareQuote],
  [/faq|question/, HelpCircle],
  [/timeline|history/, History],
  [/service/, Wrench],
  [/team|staff|people/, UserRound],
  [/about/, Users],
  [/feature/, Sparkles],
  [/price|plan/, Tag],
  [/stat|counter|number/, BarChart3],
  [/logo|brand|partner|client/, Building2],
  [/cta|call.?to.?action|button/, MousePointerClick],
  [/portfolio|project|case.?stud/, Briefcase],
  [/process|step|how.?it.?works/, Workflow],
  [/tab/, PanelsTopLeft],
  [/accordion|faq|expand/, Rows3],
  [/table|comparison|pricing.?table/, Table],
  [/map|location|address/, MapPin],
  [/phone|call/, Phone],
  [/chat|message/, MessageCircle],
  [/code|embed|script/, Code2],
  [/header|nav/, PanelTop],
  [/footer/, PanelTop],
  [/popup|modal|announce/, Bell],
  [/text|content|paragraph/, Type],
  [/list|checklist/, ListChecks],
];

export function sectionIcon(section: { id: string; name?: string; category?: string }): LucideIcon {
  const byId = SECTION_ICONS_BY_ID[section.id];
  if (byId) return byId;
  const haystack = `${section.id} ${section.name ?? ""} ${section.category ?? ""}`.toLowerCase();
  for (const [pattern, icon] of KEYWORD_ICON_RULES) {
    if (pattern.test(haystack)) return icon;
  }
  return Layout;
}
