import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function PackageStructure() {
  return (
    <DocSection>
      <DocH1>Package structure</DocH1>
      <DocLead>A real, shipping theme (Copora, ~20 sections) is laid out like this. Yours can be smaller.</DocLead>

      <CodeBlock>{`
theme.config.ts
README.md

config/
  settings.schema.ts       Global settings the editor generates controls for
  settings.default.ts      Default values for those settings

layout/
  ThemeLayout.tsx           Outer shell: header + main + footer, sets CSS variables
  defaultChrome.ts          Default header/footer section instances for a fresh install

components/
  sectionRegistry.tsx       Maps every section id to its component
  blockHelpers.ts           Shared helpers for reading raw block data
  types.ts                  Shared prop types (LinkValue, ThemeImage, IconValue…)
  Button.tsx, Container.tsx, Icon.tsx, ThemeImg.tsx, ...

sections/
  Header/
    Header.tsx
    schema.ts
  Hero/
    Hero.tsx
    schema.ts
  ... one folder per section

templates/
  index.tsx                 Home page
  page.tsx                  Generic interior page
  blog.tsx, contact.tsx, ...
  404.tsx, search.tsx        No section system — fully hardcoded

assets/
  styles/theme.css           Your theme's own CSS

locales/
  en.json
`}</CodeBlock>

      <DocH2 id="the-three-load-bearing-files">The three load-bearing files</DocH2>
      <DocP>
        The platform checks for exactly these three paths to decide whether it can execute your theme as real
        components at all:
      </DocP>
      <DocUl>
        <DocLi><code>theme.config.ts</code></DocLi>
        <DocLi><code>layout/ThemeLayout.tsx</code></DocLi>
        <DocLi><code>components/sectionRegistry.tsx</code></DocLi>
      </DocUl>
      <Callout tone="warning">
        Miss one of these three and your theme silently falls back to a generic, schema-only preview — no crash,
        but none of your actual component code runs. If a theme "looks wrong" in the editor with no error, this
        is the first thing to check.
      </Callout>

      <DocH2 id="one-folder-per-section">One folder per section</DocH2>
      <DocP>
        Convention, not enforced by the platform: each section gets its own folder under <code>sections/</code>{" "}
        containing exactly two files — the component and its <code>schema.ts</code>. Component and schema file
        names don&rsquo;t need to match the section id; <code>theme.config.ts</code> is what actually wires an id
        to a path.
      </DocP>

      <DocH2 id="templates-without-sections">Templates without sections</DocH2>
      <DocP>
        Not every template needs to support the section system. <code>search.tsx</code> and <code>404.tsx</code>{" "}
        are typically fully hardcoded markup with no editable sections at all — that&rsquo;s a legitimate,
        common choice, not a limitation you need to work around.
      </DocP>
    </DocSection>
  );
}
