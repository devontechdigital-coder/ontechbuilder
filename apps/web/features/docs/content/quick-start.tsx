import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function QuickStart() {
  return (
    <DocSection>
      <DocH1>Quick start</DocH1>
      <DocLead>The minimum set of files a theme needs to install and render a home page.</DocLead>

      <DocH2 id="required-files">The required files</DocH2>
      <DocP>Six files, all under your theme package&rsquo;s root:</DocP>
      <DocUl>
        <DocLi><code>theme.config.ts</code> — the manifest.</DocLi>
        <DocLi><code>layout/ThemeLayout.tsx</code> — the outer shell every page renders inside.</DocLi>
        <DocLi><code>components/sectionRegistry.tsx</code> — maps section ids to components.</DocLi>
        <DocLi><code>config/settings.schema.ts</code> and <code>config/settings.default.ts</code> — global theme settings.</DocLi>
        <DocLi><code>templates/index.tsx</code> — the home page template.</DocLi>
      </DocUl>
      <Callout>
        <code>theme.config.ts</code>, <code>layout/ThemeLayout.tsx</code>, and{" "}
        <code>components/sectionRegistry.tsx</code> are load-bearing: without all three present, the platform
        can&rsquo;t execute your theme at all and falls back to a plain content preview.
      </Callout>

      <DocH2 id="1-the-manifest">1. The manifest</DocH2>
      <CodeBlock filename="theme.config.ts">{`
const themeConfig = {
  id: "my-theme",
  name: "My Theme",
  version: "0.1.0",
  engineVersion: "^1.0.0",
  description: "A minimal starter theme.",
  author: "You",
  templates: {
    index: "templates/index.tsx",
  },
  sections: {
    hero: "sections/Hero/Hero.tsx",
  },
  capabilities: {
    settingsSchema: true,
    sectionSchemas: true,
    blocks: true,
    localization: false,
    imageFields: true,
    responsivePreview: true,
    megaMenu: false,
  },
};

export default themeConfig;
`}</CodeBlock>

      <DocH2 id="2-a-section">2. A section</DocH2>
      <CodeBlock filename="sections/Hero/schema.ts">{`
const schema = {
  id: "hero",
  name: "Hero",
  category: "Hero",
  settings: [
    { type: "text", id: "heading", label: "Heading", default: "Welcome" },
  ],
  blocks: [],
};

export default schema;
`}</CodeBlock>
      <CodeBlock filename="sections/Hero/Hero.tsx">{`
import * as React from "react";

export interface HeroProps {
  heading: string;
}

export function Hero({ heading }: HeroProps) {
  return (
    <section className="hero">
      <h1>{heading}</h1>
    </section>
  );
}
`}</CodeBlock>

      <DocH2 id="3-the-registry">3. The registry</DocH2>
      <CodeBlock filename="components/sectionRegistry.tsx">{`
import * as React from "react";
import { Hero } from "../sections/Hero/Hero";

export const sectionRegistry = {
  hero: Hero,
};

export interface SectionInstance {
  id: string;
  type: keyof typeof sectionRegistry | string;
  props: Record<string, unknown>;
}

export function RenderSections({ sections }: { sections: SectionInstance[] }) {
  return (
    <>
      {sections.map((section) => {
        const Component = sectionRegistry[section.type];
        return Component ? <Component key={section.id} {...section.props} /> : null;
      })}
    </>
  );
}
`}</CodeBlock>

      <DocH2 id="4-the-template">4. The template</DocH2>
      <CodeBlock filename="templates/index.tsx">{`
import * as React from "react";
import { RenderSections, type SectionInstance } from "../components/sectionRegistry";

export const defaultIndexSections: SectionInstance[] = [
  { id: "hero-1", type: "hero", props: { heading: "Hello, world" } },
];

export default function IndexTemplate({ sections = defaultIndexSections }: { sections?: SectionInstance[] }) {
  return <RenderSections sections={sections} />;
}
`}</CodeBlock>

      <DocH2 id="5-the-layout">5. The layout</DocH2>
      <CodeBlock filename="layout/ThemeLayout.tsx">{`
import * as React from "react";

export function ThemeLayout({ header, footer, children }: {
  settings: Record<string, unknown>;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      {header}
      <main>{children}</main>
      {footer}
    </div>
  );
}
`}</CodeBlock>

      <DocP>
        That&rsquo;s a complete, installable theme. Everything from here on is about expanding this shape:
        more sections, real global settings, multiple templates, and navigation menus.
      </DocP>
    </DocSection>
  );
}
