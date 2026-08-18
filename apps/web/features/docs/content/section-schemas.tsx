import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocP, DocSection, FieldTable } from "../prose";

export default function SectionSchemasDoc() {
  return (
    <DocSection>
      <DocH1>Section schemas</DocH1>
      <DocLead>
        Each section&rsquo;s <code>schema.ts</code> declares the section&rsquo;s own settings, the block types it
        repeats, and starter content so a freshly added section isn&rsquo;t empty.
      </DocLead>

      <CodeBlock filename="sections/Footer/schema.ts">{`
const schema = {
  id: "footer",
  name: "Footer",
  category: "Footer",
  settings: [
    { type: "text", id: "logoText", label: "Wordmark text", default: "Copora" },
    {
      type: "select",
      id: "style",
      label: "Style",
      options: [
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
      ],
      default: "dark",
    },
  ],
  blocks: [
    {
      type: "nav_link",
      name: "Nav link",
      settings: [
        { type: "text", id: "label", label: "Label", default: "Menu item" },
        { type: "url", id: "href", label: "Link", default: "#" },
      ],
    },
  ],
  nestableBlockTypes: ["nav_link"],
  maxBlocks: 40,
  defaultBlocks: [
    { type: "nav_link", settings: { label: "Company", href: "/" } },
    { type: "nav_link", depth: 1, settings: { label: "About", href: "/about" } },
  ],
};

export default schema;
`}</CodeBlock>

      <DocH2 id="fields">Fields</DocH2>
      <FieldTable
        rows={[
          { name: "id", type: "string", description: "Must exactly match the section's key in theme.config.ts's sections map." },
          { name: "name", type: "string", description: "Label shown in the editor's section list and \"add section\" menu." },
          { name: "category", type: "string", description: "\"Header\" and \"Footer\" are special — they pin the section to that chrome group instead of the page body. Anything else is treated as an ordinary body section." },
          { name: "settings", type: "SettingField[]", description: "Same field shape as the global schema — see Global settings schema." },
          { name: "blocks", type: "BlockSchema[]", description: "The repeatable block type(s) this section supports (optional — many sections have none)." },
          { name: "nestableBlockTypes", type: "string[]", description: "Block types (by their type value) that form a drag-to-nest hierarchy instead of a flat list — see Blocks & nested menus." },
          { name: "maxBlocks", type: "number", description: "Upper bound the editor enforces on how many block instances a merchant can add." },
          { name: "defaultBlocks", type: "{ type, depth?, settings }[]", description: "Seed content used the first time this section is added, before anything is saved." },
        ]}
      />

      <DocH2 id="block-schema-shape">A block's own schema shape</DocH2>
      <CodeBlock>{`
interface BlockSchema {
  type: string;              // stable identifier for this block type
  name: string;               // shown in the editor
  settings: SettingField[];   // this block instance's own fields
}
`}</CodeBlock>
      <DocP>
        A section can declare more than one block type in its <code>blocks</code> array (a footer might offer
        both <code>nav_link</code> and <code>social_link</code> blocks, for instance) — the merchant picks which
        type to add each time.
      </DocP>

      <DocH2 id="what-your-component-actually-receives">What your component actually receives</DocH2>
      <DocP>
        The schema only shapes the editor UI. At render time your section component receives every top-level{" "}
        <code>settings</code> field as its own prop, plus one array prop for its blocks (flattened — no nested{" "}
        <code>settings</code> object). The exact prop name for that blocks array is inferred from your
        component&rsquo;s own TypeScript interface, not from the schema — see{" "}
        <strong>Section components</strong> for the full contract.
      </DocP>

      <Callout tone="warning">
        <code>id</code> values you choose here become part of saved content once a merchant customizes the
        section. Renaming a section or block <code>type</code> later orphans anything already saved under the
        old name — treat these ids as a stable public API of your theme.
      </Callout>
    </DocSection>
  );
}
