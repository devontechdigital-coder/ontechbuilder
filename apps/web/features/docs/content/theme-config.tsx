import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocP, DocSection, FieldTable } from "../prose";

export default function ThemeConfigDoc() {
  return (
    <DocSection>
      <DocH1>theme.config.ts</DocH1>
      <DocLead>
        A plain data manifest — no React imports, no side effects — so the host can read it without executing
        any of your code.
      </DocLead>

      <CodeBlock filename="theme.config.ts">{`
export interface ThemeConfig {
  id: string;
  name: string;
  version: string;
  engineVersion: string;
  description: string;
  author: string;
  templates: Record<string, string>;
  sections: Record<string, string>;
  capabilities: {
    settingsSchema: boolean;
    sectionSchemas: boolean;
    blocks: boolean;
    localization: boolean;
    imageFields: boolean;
    responsivePreview: boolean;
    megaMenu: boolean;
  };
}

const themeConfig: ThemeConfig = {
  id: "copora",
  name: "Copora",
  version: "1.2.0",
  engineVersion: "^1.0.0",
  description: "A bold, editorial theme for consulting agencies.",
  author: "Your Studio",
  templates: {
    index: "templates/index.tsx",
    page: "templates/page.tsx",
    about: "templates/about.tsx",
    contact: "templates/contact.tsx",
    search: "templates/search.tsx",
    "404": "templates/404.tsx",
  },
  sections: {
    header: "sections/Header/Header.tsx",
    hero: "sections/Hero/Hero.tsx",
    footer: "sections/Footer/Footer.tsx",
  },
  capabilities: { /* see below */ },
};

export default themeConfig;
`}</CodeBlock>

      <DocH2 id="fields">Fields</DocH2>
      <FieldTable
        rows={[
          { name: "id", type: "string", description: "Stable machine identifier for your theme. Lowercase, hyphenated." },
          { name: "name", type: "string", description: "Display name shown in the theme picker." },
          { name: "version", type: "string", description: "Your theme's own version, e.g. for your changelog." },
          { name: "engineVersion", type: "string", description: "Semver range of the platform engine this theme targets." },
          { name: "templates", type: "Record<string, string>", description: "Template id → path to the .tsx file exporting a default component." },
          { name: "sections", type: "Record<string, string>", description: "Section id → path to the .tsx file exporting a named component. Header and footer are ordinary entries here too." },
          { name: "capabilities", type: "object of booleans", description: "Feature flags the editor reads to decide which UI to offer (see below)." },
        ]}
      />

      <DocH2 id="templates-map">The templates map</DocH2>
      <DocP>
        Each key is a template id (matched against a page&rsquo;s type — <code>index</code> for the home page,
        <code> page</code> for a generic page, or a named type like <code>blog</code>). Each value is the path,
        relative to your package root, to a file whose <strong>default export</strong> is the template
        component.
      </DocP>

      <DocH2 id="sections-map">The sections map</DocH2>
      <DocP>
        Each key is a section id — the identifier used everywhere else (schemas, saved section instances, the
        registry) to refer to this section. Each value is the path to the file exporting the component, by{" "}
        <strong>named export</strong> matching the component&rsquo;s function name.
      </DocP>
      <Callout>
        Header and footer are just sections with <code>category: "Header"</code> / <code>"Footer"</code> in
        their schema — list them in <code>sections</code> like any other, and include them in your section
        registry the same way. See <strong>The section registry</strong>.
      </Callout>

      <DocH2 id="capabilities">Capabilities</DocH2>
      <FieldTable
        rows={[
          { name: "settingsSchema", type: "boolean", description: "Your theme ships config/settings.schema.ts for global settings." },
          { name: "sectionSchemas", type: "boolean", description: "Sections ship their own schema.ts files." },
          { name: "blocks", type: "boolean", description: "At least one section defines repeatable blocks." },
          { name: "localization", type: "boolean", description: "locales/*.json translation files are present." },
          { name: "imageFields", type: "boolean", description: "The theme uses image-type settings/blocks." },
          { name: "responsivePreview", type: "boolean", description: "The theme's CSS is written to look correct across the editor's mobile/tablet/desktop preview widths." },
          { name: "megaMenu", type: "boolean", description: "The header supports multi-column dropdown navigation." },
        ]}
      />
    </DocSection>
  );
}
