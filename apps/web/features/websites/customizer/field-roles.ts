import type { ThemeSetting } from "./types";

/**
 * Heuristic mapping from a section/block's arbitrary settings fields to the
 * roles a generic preview needs (heading, image, buttons, ...). This is what
 * lets ANY uploaded theme render a reasonable-looking preview without the
 * app knowing its section ids ahead of time — it reads field id/label/type
 * the same way a human skimming the schema would.
 */
export type ButtonRole = { linkField: ThemeSetting; labelField?: ThemeSetting };

export type FieldRoles = {
  eyebrow?: ThemeSetting;
  heading?: ThemeSetting;
  emphasis?: ThemeSetting;
  description?: ThemeSetting;
  image?: ThemeSetting;
  imagePosition?: ThemeSetting;
  layout?: ThemeSetting;
  alignment?: ThemeSetting;
  backgroundColor?: ThemeSetting;
  textColor?: ThemeSetting;
  icon?: ThemeSetting;
  badge?: ThemeSetting;
  name?: ThemeSetting;
  role?: ThemeSetting;
  rating?: ThemeSetting;
  /** How many cards/blocks this section wants visible at once (e.g. "Cards visible"). */
  visibleCount?: ThemeSetting;
  /** Explicit grid column count for this section's block cards. */
  columns?: ThemeSetting;
  buttons: ButtonRole[];
};

function matches(setting: ThemeSetting, pattern: RegExp) {
  return pattern.test(setting.id) || pattern.test(setting.label);
}

export function extractFieldRoles(settings: ThemeSetting[]): FieldRoles {
  const claimed = new Set<string>();
  const take = (predicate: (setting: ThemeSetting) => boolean) => {
    const found = settings.find((setting) => !claimed.has(setting.id) && predicate(setting));
    if (found) claimed.add(found.id);
    return found;
  };

  const eyebrow = take((s) => matches(s, /eyebrow|kicker|overline|superhead/i));
  const heading = take((s) => (s.type === "text" || s.type === "richtext") && matches(s, /heading|title(?!.*link)/i) && !matches(s, /emphasis/i));
  const emphasis = take((s) => matches(s, /emphasis|highlight(?!s)|accentline/i)) ?? take((s) => (s.type === "text" || s.type === "richtext") && matches(s, /heading|title/i));
  const description = take((s) => s.type === "textarea" || s.type === "richtext" || matches(s, /description|summary|subheading|body(?!Font)/i));
  const image = take((s) => s.type === "image" && !matches(s, /logo/i));
  const imagePosition = take((s) => s.type === "select" && matches(s, /image.?position/i));
  const layout = take((s) => s.type === "select" && /^layout$/i.test(s.id));
  const alignment = take((s) => s.type === "select" && matches(s, /alignment/i) && !matches(s, /mobile/i));
  const backgroundColor = take((s) => s.type === "color" && matches(s, /background/i));
  const textColor = take((s) => s.type === "color" && matches(s, /text.?color|color.?text/i));
  const icon = take((s) => s.type === "icon");
  const badge = take((s) => (s.type === "text" || s.type === "range") && matches(s, /^number$|^index$|^step$/i));
  const name = take((s) => s.type === "text" && matches(s, /^name$|^author$|^person$/i));
  const role = take((s) => s.type === "text" && matches(s, /role|position|company|location/i));
  const rating = take((s) => s.type === "range" && matches(s, /rating|stars?/i));
  const visibleCount = take((s) => (s.type === "select" || s.type === "range") && matches(s, /visible|itemcount|cardcount|cards.?shown|limit/i));
  const columns = take((s) => (s.type === "select" || s.type === "range") && matches(s, /^columns?$/i));

  const buttons: ButtonRole[] = [];
  const urlFields = settings.filter((setting) => setting.type === "url" && !claimed.has(setting.id));
  for (const linkField of urlFields) {
    claimed.add(linkField.id);
    const prefix = linkField.id.replace(/(Link|Href|Url)$/i, "");
    const labelField = settings.find(
      (setting) =>
        !claimed.has(setting.id) &&
        (setting.type === "text" || setting.type === "richtext") &&
        (setting.id === `${prefix}Label` || setting.id === `${prefix}Text` || setting.id.toLowerCase() === `${prefix.toLowerCase()}label`),
    );
    if (labelField) claimed.add(labelField.id);
    buttons.push({ linkField, ...(labelField ? { labelField } : {}) });
  }

  return {
    ...(eyebrow ? { eyebrow } : {}),
    ...(heading ? { heading } : {}),
    ...(emphasis && emphasis.id !== heading?.id ? { emphasis } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(imagePosition ? { imagePosition } : {}),
    ...(layout ? { layout } : {}),
    ...(alignment ? { alignment } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { textColor } : {}),
    ...(icon ? { icon } : {}),
    ...(badge ? { badge } : {}),
    ...(name ? { name } : {}),
    ...(role ? { role } : {}),
    ...(rating ? { rating } : {}),
    ...(visibleCount ? { visibleCount } : {}),
    ...(columns ? { columns } : {}),
    buttons,
  };
}

export function isAnnouncementLike(id: string, name: string) {
  const haystack = `${id} ${name}`.toLowerCase();
  return /(announce|promo|topbar|marquee|banner-bar)/.test(haystack);
}

export function isHeaderLike(id: string, name: string, settings: ThemeSetting[]) {
  const haystack = `${id} ${name}`.toLowerCase();
  if (/(header|nav)/.test(haystack)) return true;
  return settings.some((setting) => /logo/i.test(setting.id) || /logo/i.test(setting.label));
}
