import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function SectionComponentsDoc() {
  return (
    <DocSection>
      <DocH1>Section components</DocH1>
      <DocLead>
        The prop contract every section receives, and the one inference rule that matters: how the host decides
        which prop name your blocks array arrives under.
      </DocLead>

      <DocH2 id="flat-settings-props">Settings arrive flat</DocH2>
      <DocP>
        Every field declared in your section&rsquo;s <code>settings</code> schema arrives as its own top-level
        prop, by <code>id</code> — never nested under a <code>settings</code> object:
      </DocP>
      <CodeBlock filename="sections/Hero/Hero.tsx">{`
export interface HeroProps {
  heading: string;
  description?: string;
  primaryButtonLabel?: string;
  primaryButtonHref?: string;
  image?: ThemeImage;
  trustLogoBlocks: RawBlock[];
}

export function Hero({ heading, description, primaryButtonLabel, primaryButtonHref, image, trustLogoBlocks }: HeroProps) {
  return (
    <section className="hero">
      <h1>{heading}</h1>
      {description && <p>{description}</p>}
      {primaryButtonLabel && <a href={primaryButtonHref}>{primaryButtonLabel}</a>}
    </section>
  );
}
`}</CodeBlock>

      <DocH2 id="the-blocks-prop-name">The blocks prop name is inferred from your interface</DocH2>
      <DocP>
        There is no fixed name like <code>blocks</code> — a section&rsquo;s blocks array is passed under whatever
        prop name <em>you</em> chose, so it can read naturally (<code>navBlocks</code>,{" "}
        <code>trustLogoBlocks</code>, <code>testimonialBlocks</code>). The host finds that name by reading the
        exported <code>{"{ComponentName}Props"}</code> interface and looking for the field typed{" "}
        <code>RawBlock[]</code>:
      </DocP>
      <CodeBlock>{`
export interface HeaderProps {
  logoText: string;
  navBlocks: RawBlock[];   // <- this field, wherever it's named, receives the section's blocks
}
`}</CodeBlock>
      <Callout tone="warning">
        This means the interface must be named exactly <code>{"{ComponentName}Props"}</code> and exported, and
        exactly one field should be typed <code>RawBlock[]</code>. If neither condition holds, the host has no
        reliable way to find your blocks array and it won&rsquo;t be passed at all.
      </Callout>

      <DocH2 id="raw-block-shape">RawBlock: the shape each block arrives in</DocH2>
      <CodeBlock>{`
export interface RawBlock {
  id: string;
  type: string;
  [field: string]: unknown;   // every setting from that block's own schema, spread flat
}
`}</CodeBlock>
      <DocP>
        Same flattening rule as section settings: a block&rsquo;s own <code>settings</code> fields spread
        directly onto the block object rather than nesting. Read them defensively — see{" "}
        <strong>Block helpers</strong> for the small utilities (<code>asString</code>, <code>asImage</code>,{" "}
        <code>blocksOfType</code>) that make this ergonomic instead of a wall of type guards.
      </DocP>

      <DocH2 id="sections-should-be-pure">Sections should be pure renders of their props</DocH2>
      <DocUl>
        <DocLi>No data fetching — everything a section needs arrives as props.</DocLi>
        <DocLi>
          Local component state is fine (a mega-menu&rsquo;s open/closed state, a mobile nav toggle) — it just
          shouldn&rsquo;t be where content data lives.
        </DocLi>
        <DocLi>
          Every prop is optional in practice: a merchant can leave any setting blank. Default sensibly rather
          than assuming presence.
        </DocLi>
      </DocUl>

      <DocH2 id="header-and-footer">Header and footer are ordinary sections</DocH2>
      <DocP>
        They follow this exact same contract — a <code>schema.ts</code>, a component receiving flat props, an
        entry in <code>theme.config.ts</code>&rsquo;s <code>sections</code> map. The only thing that makes them
        "header" and "footer" is <code>category: "Header"</code> / <code>"Footer"</code> in their schema, which
        pins them to that chrome slot instead of the page body.
      </DocP>
    </DocSection>
  );
}
