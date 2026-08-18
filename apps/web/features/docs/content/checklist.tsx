import { DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function ChecklistDoc() {
  return (
    <DocSection>
      <DocH1>Pre-flight checklist</DocH1>
      <DocLead>Run through this before packaging a theme for install.</DocLead>

      <DocH2 id="structure">Structure</DocH2>
      <DocUl>
        <DocLi><code>theme.config.ts</code>, <code>layout/ThemeLayout.tsx</code>, and <code>components/sectionRegistry.tsx</code> all present — missing any one silently disables real rendering.</DocLi>
        <DocLi>Every path in <code>theme.config.ts</code>'s <code>templates</code> and <code>sections</code> maps actually exists in the package.</DocLi>
        <DocLi>Every section listed in <code>sectionRegistry.tsx</code> has a matching entry in <code>theme.config.ts</code>'s <code>sections</code> map, and vice versa.</DocLi>
      </DocUl>

      <DocH2 id="schemas">Schemas</DocH2>
      <DocUl>
        <DocLi>Every section's schema <code>id</code> matches its key in <code>theme.config.ts</code> exactly.</DocLi>
        <DocLi><code>config/settings.default.ts</code> provides a value for every <code>id</code> declared in <code>config/settings.schema.ts</code>.</DocLi>
        <DocLi>Nestable menus declare <code>nestableBlockTypes</code> and give <code>defaultBlocks</code> a sensible starting hierarchy.</DocLi>
        <DocLi><code>maxBlocks</code> set on any section where unlimited blocks wouldn't make sense.</DocLi>
      </DocUl>

      <DocH2 id="components">Components</DocH2>
      <DocUl>
        <DocLi>Every section's exported <code>{"{ComponentName}Props"}</code> interface names its blocks field with type exactly <code>RawBlock[]</code>.</DocLi>
        <DocLi>No imports beyond relative paths and <code>react</code> / <code>react/jsx-runtime</code>, anywhere in the package.</DocLi>
        <DocLi>Every mapped list (blocks, nav items) keys on the item's own <code>id</code>, never an array index.</DocLi>
        <DocLi>Every field read defensively — a merchant leaving a setting blank shouldn't throw.</DocLi>
        <DocLi><code>target="_blank"</code> links also carry <code>rel="noopener noreferrer"</code>.</DocLi>
      </DocUl>

      <DocH2 id="styling">Styling</DocH2>
      <DocUl>
        <DocLi>Global settings that should affect the whole site are wired into CSS custom properties in <code>ThemeLayout</code>, not read piecemeal inside individual sections.</DocLi>
        <DocLi>CSS classes are prefixed to avoid colliding with the dashboard's own styles inside the sandbox.</DocLi>
        <DocLi>Layout checked at mobile, tablet, and desktop widths.</DocLi>
      </DocUl>

      <DocH2 id="content">Content</DocH2>
      <DocUl>
        <DocLi>Every template with <code>RenderSections</code> ships a <code>defaultXSections</code> array so a fresh install looks complete, not empty.</DocLi>
        <DocLi>Templates that intentionally have no sections (<code>search</code>, <code>404</code>) render sensible fixed content on their own.</DocLi>
      </DocUl>

      <DocP>
        If a theme fails any of these and you're not sure why, start with <strong>How rendering works</strong>{" "}
        and <strong>Sandbox constraints</strong> — most rendering failures trace back to one of the rules there.
      </DocP>
    </DocSection>
  );
}
