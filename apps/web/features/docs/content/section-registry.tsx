import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocP, DocSection } from "../prose";

export default function SectionRegistryDoc() {
  return (
    <DocSection>
      <DocH1>The section registry</DocH1>
      <DocLead>
        <code>components/sectionRegistry.tsx</code> is the single map from a section id to the component that
        renders it, plus the helper every template uses to render a list of section instances.
      </DocLead>

      <CodeBlock filename="components/sectionRegistry.tsx">{`
import * as React from "react";
import { Header } from "../sections/Header/Header";
import { Hero } from "../sections/Hero/Hero";
import { Footer } from "../sections/Footer/Footer";

export const sectionRegistry: Record<string, React.ComponentType<any>> = {
  header: Header,
  hero: Hero,
  footer: Footer,
};

export interface SectionInstance {
  type: keyof typeof sectionRegistry | string;
  props: Record<string, unknown>;
  id: string;
}

interface RenderSectionsProps {
  sections: SectionInstance[];
}

/** Renders an ordered list of section instances. Unknown types are skipped safely. */
export function RenderSections({ sections }: RenderSectionsProps) {
  return (
    <>
      {sections.map((section) => {
        const Component = sectionRegistry[section.type];
        if (!Component) return null;
        return <Component key={section.id} {...section.props} />;
      })}
    </>
  );
}
`}</CodeBlock>

      <DocH2 id="header-and-footer-belong-here-too">Header and footer belong here too</DocH2>
      <DocP>
        Include them in <code>sectionRegistry</code> exactly like a body section. Some hosts compose header and
        footer separately and pass pre-rendered markup into your layout; this platform renders every section —
        chrome included — generically through this one registry, so listing them here is what makes header/footer
        rendering (and their click-to-select editing) work at all.
      </DocP>

      <DocH2 id="unknown-types-degrade-safely">Unknown types degrade safely</DocH2>
      <DocP>
        <code>RenderSections</code> silently skips any <code>type</code> not present in the registry rather than
        throwing. This matters in practice: a section removed from a later version of your theme shouldn&rsquo;t
        crash a merchant&rsquo;s existing page that still references it by id — it just stops rendering,
        instead of taking the whole page down.
      </DocP>

      <Callout>
        The <code>id</code> passed as each rendered element&rsquo;s <code>key</code> is also what the visual
        editor uses to attribute a canvas click back to the right section instance — keep it stable per
        instance, and never reuse an id across two different section instances on the same page.
      </Callout>
    </DocSection>
  );
}
