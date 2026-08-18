export type DocTopic = {
  slug: string;
  title: string;
  description: string;
};

export type DocGroup = {
  title: string;
  topics: DocTopic[];
};

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Getting started",
    topics: [
      { slug: "introduction", title: "Introduction", description: "What a theme is on this platform and how the pieces fit together." },
      { slug: "quick-start", title: "Quick start", description: "The smallest theme that installs and renders." },
    ],
  },
  {
    title: "Theme package",
    topics: [
      { slug: "package-structure", title: "Package structure", description: "Every file a theme is expected to have, and what each one is for." },
      { slug: "theme-config", title: "theme.config.ts", description: "The manifest that tells the host what your theme contains." },
    ],
  },
  {
    title: "Content model",
    topics: [
      { slug: "settings-schema", title: "Global settings schema", description: "Declaring the site-wide controls that drive your theme's CSS variables." },
      { slug: "section-schemas", title: "Section schemas", description: "Declaring a section's own settings, its blocks, and sane defaults." },
      { slug: "blocks-and-nesting", title: "Blocks & nested menus", description: "The block model, and building a drag-to-nest navigation menu." },
    ],
  },
  {
    title: "Building sections",
    topics: [
      { slug: "section-components", title: "Section components", description: "The props contract every section component receives." },
      { slug: "block-helpers", title: "Block helpers", description: "Shared utilities for parsing raw block data safely." },
      { slug: "templates", title: "Templates", description: "Composing sections (and fixed markup) into a page type." },
      { slug: "section-registry", title: "The section registry", description: "Mapping schema ids to the components that render them." },
      { slug: "theme-layout", title: "ThemeLayout & theming", description: "Turning global settings into CSS custom properties." },
    ],
  },
  {
    title: "The theme engine",
    topics: [
      { slug: "how-rendering-works", title: "How rendering works", description: "The sandboxed iframe your theme actually runs in." },
      { slug: "sandbox-constraints", title: "Sandbox constraints", description: "Hard rules your code must follow to run in the engine." },
      { slug: "editor-integration", title: "Editor integration", description: "Click-to-select, live preview, and what makes a section editable." },
    ],
  },
  {
    title: "Reference",
    topics: [
      { slug: "checklist", title: "Pre-flight checklist", description: "Everything to verify before you ship a theme." },
    ],
  },
];

export const DOC_TOPICS: DocTopic[] = DOC_GROUPS.flatMap((group) => group.topics);

export function getAdjacentTopics(slug: string): { previous: DocTopic | null; next: DocTopic | null } {
  const index = DOC_TOPICS.findIndex((topic) => topic.slug === slug);
  if (index < 0) return { previous: null, next: null };
  return {
    previous: index > 0 ? DOC_TOPICS[index - 1]! : null,
    next: index < DOC_TOPICS.length - 1 ? DOC_TOPICS[index + 1]! : null,
  };
}
