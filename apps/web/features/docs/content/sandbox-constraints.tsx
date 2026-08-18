import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function SandboxConstraintsDoc() {
  return (
    <DocSection>
      <DocH1>Sandbox constraints</DocH1>
      <DocLead>Hard rules your theme's code must follow to run in the engine. Violating any of these is the most common reason a theme "just doesn't render."</DocLead>

      <DocH2 id="no-external-packages">No imports beyond React and your own files</DocH2>
      <DocP>The sandbox's module resolver only understands two things:</DocP>
      <DocUl>
        <DocLi>Relative imports (<code>./sections/Hero/Hero</code>, <code>../components/Icon</code>) — resolved against your own package files.</DocLi>
        <DocLi><code>react</code> and <code>react/jsx-runtime</code> — provided by the host.</DocLi>
      </DocUl>
      <DocP>
        Anything else — a date library, an icon package, a CSS-in-JS library — fails to resolve and throws at
        render time. If you need icons, write your own small inline-SVG component inside the package (see how
        Copora's own <code>components/Icon.tsx</code> does this); if you need utilities, write them as plain
        functions in your own <code>components/</code> folder.
      </DocP>
      <Callout tone="warning">
        This applies transitively: your <code>sectionRegistry.tsx</code> imports every section component up
        front, so one section with a stray external import breaks the entire page, not just that section.
      </Callout>

      <DocH2 id="no-dom-globals-beyond-react">No assumptions about a "normal" page environment</DocH2>
      <DocUl>
        <DocLi>No network requests — nothing your theme needs should come from <code>fetch</code> at render time; everything should arrive as props.</DocLi>
        <DocLi>No reading or writing cookies/localStorage — the sandbox has no access to them regardless.</DocLi>
        <DocLi>Avoid code that assumes it's the top-level window (checking <code>window.top === window</code>, deep-linking via <code>window.parent</code>, etc.) — it isn't.</DocLi>
      </DocUl>

      <DocH2 id="style-only-through-your-stylesheet">Style only through your own stylesheet</DocH2>
      <DocP>
        <code>assets/styles/theme.css</code> is injected verbatim into the sandboxed document. Write real CSS
        there (scoped by your own class-name convention, e.g. a <code>cop-</code> prefix) rather than inline
        styles for anything beyond values that genuinely come from settings.
      </DocP>

      <DocH2 id="keep-block-arrays-typed-correctly">Type your blocks prop precisely</DocH2>
      <DocP>
        The host infers which prop receives your blocks array by scanning your exported{" "}
        <code>{"{ComponentName}Props"}</code> interface for a field typed exactly <code>RawBlock[]</code>. Get
        the interface name or the type slightly wrong and the array silently never arrives — see{" "}
        <strong>Section components</strong>.
      </DocP>

      <DocH2 id="section-keys">Every list item needs a real key</DocH2>
      <DocP>
        Anywhere your component maps over blocks, use the block&rsquo;s own <code>id</code> as the React{" "}
        <code>key</code> — never an array index:
      </DocP>
      <CodeBlock>{`
{navBlocks.map((block) => (
  <a key={block.id} href={block.href}>{block.label}</a>
))}
`}</CodeBlock>
      <DocP>
        The editor's click-to-select mechanism identifies rendered blocks in the DOM by these keys — an index
        key breaks click-to-select for that block (see <strong>Editor integration</strong>), and separately
        causes the classic React reconciliation bugs when blocks are reordered.
      </DocP>

      <DocH2 id="errors-are-caught-per-section">A thrown error is contained, not fatal</DocH2>
      <DocP>
        If a section component throws while rendering, only that section shows an inline error message — the
        rest of the page keeps rendering normally. Useful for debugging, but don&rsquo;t rely on it: a section
        that throws for real merchants is a broken section, not a caught one.
      </DocP>
    </DocSection>
  );
}
