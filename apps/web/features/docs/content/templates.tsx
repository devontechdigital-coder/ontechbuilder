import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function TemplatesDoc() {
  return (
    <DocSection>
      <DocH1>Templates</DocH1>
      <DocLead>
        A template is a page type — home, a generic page, a blog post. Its component composes fixed markup (if
        any) with a merchant-editable list of sections.
      </DocLead>

      <DocH2 id="a-section-driven-template">A section-driven template</DocH2>
      <CodeBlock filename="templates/index.tsx">{`
import * as React from "react";
import { RenderSections, type SectionInstance } from "../components/sectionRegistry";

export const defaultIndexSections: SectionInstance[] = [
  { id: "hero-1", type: "hero", props: { heading: "Welcome" } },
  { id: "logo-cloud-1", type: "logo-cloud", props: { heading: "Trusted by" } },
];

export default function IndexTemplate({ sections = defaultIndexSections }: { sections?: SectionInstance[] }) {
  return <RenderSections sections={sections} />;
}
`}</CodeBlock>
      <DocP>
        <code>defaultIndexSections</code> is what a fresh install looks like before a merchant touches anything —
        real, sensible content, not empty placeholders. Every value in it should be editable through the
        matching section&rsquo;s own schema.
      </DocP>

      <DocH2 id="mixing-fixed-markup-with-sections">Mixing fixed markup with sections</DocH2>
      <DocP>A generic page template typically has some fixed structure (a title, a rich-text body) plus optional trailing sections for a closing CTA:</DocP>
      <CodeBlock filename="templates/page.tsx">{`
import * as React from "react";
import { Container } from "../components/Container";
import { RenderSections, type SectionInstance } from "../components/sectionRegistry";

export interface PageTemplateProps {
  title: string;
  bodyHtml?: string;
  sections?: SectionInstance[];
}

export default function PageTemplate({ title, bodyHtml, sections = [] }: PageTemplateProps) {
  return (
    <>
      <section className="page-header">
        <Container width="default"><h1>{title}</h1></Container>
      </section>

      {bodyHtml && (
        <section className="page-body">
          <Container width="narrow">
            {/* eslint-disable-next-line react/no-danger */}
            <div className="prose" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Container>
        </section>
      )}

      <RenderSections sections={sections} />
    </>
  );
}
`}</CodeBlock>

      <DocH2 id="templates-with-no-sections">Templates with no sections at all</DocH2>
      <DocP>
        <code>search.tsx</code> and <code>404.tsx</code> are typically fully hardcoded — no{" "}
        <code>RenderSections</code> call, no section list. That&rsquo;s a legitimate design choice: the host
        detects whether a template supports sections by checking whether its source calls{" "}
        <code>RenderSections</code>, so a template that doesn&rsquo;t simply won&rsquo;t offer an "add section"
        affordance for that page type.
      </DocP>

      <DocH2 id="registering-a-template">Registering it</DocH2>
      <DocUl>
        <DocLi>Add the file's path to theme.config.ts's templates map under a template id.</DocLi>
        <DocLi>Export the component as the file's default export.</DocLi>
      </DocUl>
      <Callout>
        A page's template id maps <code>index</code> to your home page and <code>page</code> to a generic
        interior page by convention; other ids (<code>blog</code>, <code>contact</code>) are matched against a
        page's own declared type.
      </Callout>
    </DocSection>
  );
}
