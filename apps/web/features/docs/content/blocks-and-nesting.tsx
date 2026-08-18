import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl, FieldTable } from "../prose";

export default function BlocksAndNestingDoc() {
  return (
    <DocSection>
      <DocH1>Blocks &amp; nested menus</DocH1>
      <DocLead>
        Blocks are how a section repeats structured content — nav links, testimonials, logos. A flat list is the
        default; navigation menus additionally support drag-to-nest hierarchy through one extra field.
      </DocLead>

      <DocH2 id="the-flat-case">The flat case</DocH2>
      <DocP>
        Most blocks are a flat list: a testimonial section&rsquo;s <code>testimonial</code> blocks, a logo
        cloud&rsquo;s <code>logo</code> blocks. Each saved block instance looks like this:
      </DocP>
      <CodeBlock>{`
interface SectionBlock {
  id: string;
  type: string;                     // matches a type in the section's blocks[] schema
  name: string;
  depth?: number;                   // only meaningful for nestable block types
  settings: Record<string, unknown>;
}
`}</CodeBlock>

      <DocH2 id="nested-menus">Nested menus: one block type, a depth field</DocH2>
      <DocP>
        Rather than separate "link" and "menu with submenu" block types, a navigation menu is built from a
        single repeatable block — typically named <code>nav_link</code> — where each instance carries a{" "}
        <code>depth</code> (0 = top level, 1 = one level nested, and so on). The merchant builds the hierarchy by
        dragging a block sideways in the editor to change its depth; your component rebuilds the tree from the
        flat, depth-tagged list at render time.
      </DocP>
      <DocP>
        Mark the block type as nestable in the section schema:
      </DocP>
      <CodeBlock filename="sections/Header/schema.ts">{`
{
  blocks: [
    {
      type: "nav_link",
      name: "Nav link",
      settings: [
        { type: "text", id: "label", label: "Label", default: "Menu item" },
        { type: "url", id: "href", label: "Link", default: "#" },
        {
          type: "select",
          id: "target",
          label: "Open in",
          options: [
            { value: "_self", label: "Same tab" },
            { value: "_blank", label: "New tab" },
          ],
          default: "_self",
        },
      ],
    },
  ],
  nestableBlockTypes: ["nav_link"],
  defaultBlocks: [
    { type: "nav_link", settings: { label: "Home", href: "/" } },
    { type: "nav_link", settings: { label: "About", href: "/about" } },
    { type: "nav_link", depth: 1, settings: { label: "Our Story", href: "/about#story" } },
  ],
}
`}</CodeBlock>

      <DocH2 id="rebuilding-the-tree">Rebuilding the tree in your component</DocH2>
      <DocP>
        Your section receives the flat array as a prop, exactly as saved — depth included. Rebuild it into a
        real tree once, near the top of your render:
      </DocP>
      <CodeBlock filename="components/blockHelpers.ts (excerpt)">{`
export interface NavNode {
  id: string;
  label: string;
  href: string;
  target: string;
  children: NavNode[];
}

/**
 * A depth jump of more than one level (only possible from hand-edited data)
 * attaches to the deepest available ancestor rather than being dropped, so a
 * malformed menu still renders every item.
 */
export function buildNavTree(blocks: RawBlock[], maxDepth = 2): NavNode[] {
  const roots: NavNode[] = [];
  const ancestors: NavNode[] = [];

  for (const block of blocks) {
    if (block.type !== "nav_link") continue;
    const depth = Math.max(0, Math.min(Number(block.depth) || 0, maxDepth));
    const node: NavNode = {
      id: block.id,
      label: asString(block.label),
      href: asString(block.href, "#"),
      target: asString(block.target) === "_blank" ? "_blank" : "_self",
      children: [],
    };

    while (ancestors.length > depth) ancestors.pop();
    const parent = ancestors[ancestors.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    ancestors.push(node);
  }

  return roots;
}
`}</CodeBlock>
      <CodeBlock filename="sections/Header/Header.tsx (excerpt)">{`
const navTree = React.useMemo(() => buildNavTree(navBlocks), [navBlocks]);

return (
  <nav>
    {navTree.map((node) =>
      node.children.length === 0 ? (
        <a key={node.id} href={node.href} target={node.target} rel={navRel(node.target)}>
          {node.label}
        </a>
      ) : (
        <Dropdown key={node.id} trigger={node.label} items={node.children} />
      ),
    )}
  </nav>
);
`}</CodeBlock>

      <DocH2 id="editor-behavior">What the editor guarantees</DocH2>
      <DocUl>
        <DocLi>Dragging a parent takes its entire subtree with it — children never get silently orphaned onto whatever ends up above them.</DocLi>
        <DocLi>
          An impossible depth (e.g. a level-2 item with no level-1 item directly above it) is clamped
          automatically — your <code>buildNavTree</code> will never be handed a structurally broken list from
          normal editor use.
        </DocLi>
        <DocLi>There's no separate "reorder" vs "nest" action for the merchant — one drag gesture does both.</DocLi>
      </DocUl>

      <DocH2 id="depth-limits">Choosing a max depth</DocH2>
      <FieldTable
        rows={[
          { name: "0", type: "flat", description: "No nesting — use this for blocks that were never meant to be a menu." },
          { name: "1", type: "2 levels", description: "Top-level item + one dropdown level. Matches most footer link columns." },
          { name: "2", type: "3 levels", description: "Top item → submenu → sub-submenu — a full mega-menu column shape." },
        ]}
      />
      <Callout>
        Deeper than 3 levels is rarely legible in an actual header or footer — treat <code>maxDepth</code> as a
        rendering decision your component owns, not something merchants configure.
      </Callout>

      <DocH2 id="target-blank-safety">target="_blank" needs rel</DocH2>
      <DocP>
        Any link your component renders with <code>target="_blank"</code> should also carry{" "}
        <code>rel="noopener noreferrer"</code>, so the opened page cannot reach back into your site via{" "}
        <code>window.opener</code>. Centralize this rather than repeating it at every link callsite:
      </DocP>
      <CodeBlock>{`
export function navRel(target: string): string | undefined {
  return target === "_blank" ? "noopener noreferrer" : undefined;
}
`}</CodeBlock>
    </DocSection>
  );
}
