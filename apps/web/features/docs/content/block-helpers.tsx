import { CodeBlock, DocH1, DocH2, DocLead, DocP, DocSection, FieldTable } from "../prose";

export default function BlockHelpersDoc() {
  return (
    <DocSection>
      <DocH1>Block helpers</DocH1>
      <DocLead>
        <code>components/blockHelpers.ts</code> is a good place to centralize the small, repetitive work of
        turning loosely-typed <code>RawBlock</code> data into the shapes your components actually want —
        written once, reused by every section.
      </DocLead>

      <DocH2 id="reading-primitives-safely">Reading primitives safely</DocH2>
      <CodeBlock>{`
export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

export function asImage(value: unknown): ThemeImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const src = (value as Record<string, unknown>).src;
  return typeof src === "string" && src ? (value as ThemeImage) : undefined;
}
`}</CodeBlock>
      <DocP>
        A field the merchant hasn&rsquo;t filled in yet is empty string or missing entirely, never{" "}
        <code>null</code> or <code>undefined</code> in a way you can rely on — reading through a helper like this
        means one place handles that, not every section independently.
      </DocP>

      <DocH2 id="filtering-mixed-block-arrays">Filtering a mixed block array</DocH2>
      <CodeBlock>{`
export function blocksOfType(blocks: RawBlock[], type: string): RawBlock[] {
  return blocks.filter((block) => block.type === type);
}
`}</CodeBlock>
      <DocP>
        Useful when one section supports more than one block type — a footer with both{" "}
        <code>nav_link</code> and <code>social_link</code> blocks in the same array, for instance.
      </DocP>

      <DocH2 id="composing-a-button">Composing a button from two flat fields</DocH2>
      <CodeBlock>{`
export function optionalLink(label: unknown, href: unknown): LinkValue | undefined {
  const l = typeof label === "string" ? label.trim() : "";
  const h = typeof href === "string" ? href.trim() : "";
  return l && h ? { label: l, href: h } : undefined;
}
`}</CodeBlock>
      <DocP>
        Schemas commonly split a button into two settings (<code>buttonLabel</code> + <code>buttonHref</code>)
        because that&rsquo;s two simple editor fields instead of one compound one. A component wants the composed
        shape — and wants it to render nothing at all if the merchant only filled in one half.
      </DocP>

      <DocH2 id="reference-table">A starter set</DocH2>
      <FieldTable
        rows={[
          { name: "asString(value, fallback?)", type: "string", description: "Never returns null/undefined; falls back to \"\" or your default." },
          { name: "asImage(value)", type: "ThemeImage | undefined", description: "Only returns a value when a usable src is present." },
          { name: "blocksOfType(blocks, type)", type: "RawBlock[]", description: "Filters a mixed block array down to one type, preserving order." },
          { name: "optionalLink(label, href)", type: "LinkValue | undefined", description: "Composes a button/link from two flat fields; undefined when either is missing." },
          { name: "buildNavTree(blocks, maxDepth?)", type: "NavNode[]", description: "Rebuilds a nested menu from depth-tagged nav_link blocks — see Blocks & nested menus." },
          { name: "navRel(target)", type: "string | undefined", description: "\"noopener noreferrer\" for target=\"_blank\", otherwise undefined." },
        ]}
      />
    </DocSection>
  );
}
