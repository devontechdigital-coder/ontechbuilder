import { Callout, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function EditorIntegrationDoc() {
  return (
    <DocSection>
      <DocH1>Editor integration</DocH1>
      <DocLead>
        Click-to-select, the border and toolbar on a selected section, and live updates as a merchant edits —
        none of this requires anything special in your components. It works automatically, for free, as long as
        you follow the ordinary conventions covered elsewhere in these docs.
      </DocLead>

      <DocH2 id="click-to-select">Click-to-select</DocH2>
      <DocP>
        Every rendered section is transparently wrapped in a marker element the editor uses to attribute a
        canvas click back to the right section instance. This wrapping happens around whatever your component
        renders — it adds no visible box of its own and doesn&rsquo;t affect your layout. You don&rsquo;t write
        any code for this; it&rsquo;s a consequence of your section being rendered through the registry
        described in <strong>The section registry</strong>.
      </DocP>

      <DocH2 id="live-updates">Live updates while editing</DocH2>
      <DocP>
        When a merchant changes a setting, the same component tree re-renders with the new value — there&rsquo;s
        no special "editable" prop or edit-mode branch to write in your components. Write your section the same
        way whether it&rsquo;s being edited or viewed live; the difference is entirely handled by the host.
      </DocP>

      <DocH2 id="selection-border-and-toolbar">The selection border and toolbar</DocH2>
      <DocP>
        When a section is selected, the editor draws a border around it and anchors a small toolbar (move, add,
        duplicate, hide, delete, settings) to its edge. This is measured from your section&rsquo;s actual
        rendered bounding box — which is why the keying rule in <strong>Sandbox constraints</strong> matters: a
        section or block that doesn&rsquo;t render at least one real, visible element can&rsquo;t be measured, and
        the toolbar has nothing to anchor to.
      </DocP>

      <DocH2 id="what-you-dont-need-to-do">What you don't need to build</DocH2>
      <DocUl>
        <DocLi>No "edit" button, no inline editing UI — the settings panel is generated entirely from your schema.</DocLi>
        <DocLi>No drag handles for reordering sections or blocks — the editor's outline provides this.</DocLi>
        <DocLi>No save/undo logic — every edit is a host-side state change that re-renders your existing components.</DocLi>
      </DocUl>

      <Callout>
        In short: build sections the same way you&rsquo;d build any React component consuming props, following
        the conventions in <strong>Section components</strong> and <strong>Sandbox constraints</strong>, and the
        entire editing experience comes along automatically.
      </Callout>
    </DocSection>
  );
}
