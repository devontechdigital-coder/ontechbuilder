import { Callout, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function Introduction() {
  return (
    <DocSection>
      <DocH1>Introduction</DocH1>
      <DocLead>
        A theme is a plain folder of TypeScript/TSX files — real React components, no proprietary template
        language. You upload it as a theme package; the platform reads a few declarative files to learn what
        your theme contains, then executes your actual components to render every page.
      </DocLead>

      <DocH2 id="what-a-theme-is">What a theme is</DocH2>
      <DocP>A theme package is three things layered together:</DocP>
      <DocUl>
        <DocLi>
          <strong>Components</strong> — real React function components: a header, a footer, one component per
          section (Hero, StatsRow, CtaBanner…), and a component per page template.
        </DocLi>
        <DocLi>
          <strong>Schemas</strong> — plain data files describing which settings each section and the theme as a
          whole exposes to the merchant, so the visual editor can generate the right controls without knowing
          anything about your specific theme.
        </DocLi>
        <DocLi>
          <strong>A manifest</strong> (<code>theme.config.ts</code>) tying the two together: which file renders
          which template, which file renders which section id.
        </DocLi>
      </DocUl>

      <DocH2 id="how-a-page-gets-rendered">How a page gets rendered</DocH2>
      <DocP>At a high level, for any page the platform:</DocP>
      <DocUl>
        <DocLi>Resolves which template applies (home, a generic page, a blog post, …).</DocLi>
        <DocLi>Loads that page's list of section instances — each one a schema id plus the merchant&rsquo;s saved settings and blocks.</DocLi>
        <DocLi>
          Executes your theme&rsquo;s own <code>ThemeLayout</code>, header, footer, template, and section
          components with that data as props — the same components, whether the merchant is looking at a live
          published page or editing a draft in the visual customizer.
        </DocLi>
      </DocUl>
      <Callout>
        There is no separate rendering path for "preview" vs "published." The exact component tree your theme
        defines is what runs in both places — see <strong>How rendering works</strong> for the mechanism.
      </Callout>

      <DocH2 id="what-you-write">What you write vs. what the host does</DocH2>
      <DocUl>
        <DocLi><strong>You write:</strong> components, schemas, and the CSS that styles them.</DocLi>
        <DocLi>
          <strong>The host does:</strong> generates the settings editor UI from your schemas, persists what
          merchants change, and feeds your components the resulting props on every render. You never write editor
          UI code.
        </DocLi>
      </DocUl>

      <DocH2 id="where-to-go-next">Where to go next</DocH2>
      <DocP>
        If you want to see the shape of a working theme before reading the reference material, start with{" "}
        <strong>Quick start</strong>. If you&rsquo;d rather understand the full picture first, continue to{" "}
        <strong>Package structure</strong>.
      </DocP>
    </DocSection>
  );
}
