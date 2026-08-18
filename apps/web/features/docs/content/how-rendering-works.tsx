import { Callout, DocH1, DocH2, DocLead, DocLi, DocP, DocSection, DocUl } from "../prose";

export default function HowRenderingWorksDoc() {
  return (
    <DocSection>
      <DocH1>How rendering works</DocH1>
      <DocLead>
        Your theme&rsquo;s files don&rsquo;t get compiled into the platform&rsquo;s own build. They&rsquo;re
        transpiled on the fly and executed inside a sandboxed iframe, isolated from the dashboard the merchant
        is logged into.
      </DocLead>

      <DocH2 id="why-a-sandbox">Why a sandbox</DocH2>
      <DocP>
        A theme is arbitrary code from an arbitrary author. The iframe your theme actually runs in is{" "}
        <code>sandbox=&quot;allow-scripts&quot;</code> with no <code>allow-same-origin</code> — which gives it an
        opaque origin: it can execute JavaScript, but it has no access to the dashboard&rsquo;s cookies, storage,
        or any other origin&rsquo;s data. Your theme genuinely cannot read the merchant&rsquo;s session, no
        matter what it does.
      </DocP>

      <DocH2 id="the-pipeline">The pipeline</DocH2>
      <DocUl>
        <DocLi>Every <code>.ts</code>/<code>.tsx</code> file in your package is transpiled to plain JavaScript.</DocLi>
        <DocLi>
          A minimal <code>require()</code> is provided inside the sandbox that resolves only relative imports
          (<code>./</code>, <code>../</code>) against your package&rsquo;s own files, plus the special cases{" "}
          <code>react</code> and <code>react/jsx-runtime</code>.
        </DocLi>
        <DocLi>
          Your <code>ThemeLayout</code>, header, footer, the active template, and its sections are required and
          composed into one tree, then rendered with the merchant&rsquo;s real, current settings and content —
          the same component tree, whether this is a live published page or a draft being edited.
        </DocLi>
      </DocUl>

      <DocH2 id="what-this-means-in-practice">What this means in practice</DocH2>
      <DocUl>
        <DocLi>There's no build step on your side beyond authoring valid TypeScript/TSX — no bundler config to write.</DocLi>
        <DocLi>Your theme cannot import any package other than React — see Sandbox constraints for the precise rule and why.</DocLi>
        <DocLi>What you see in the editor is a real, faithful render of your actual components — not an approximation.</DocLi>
      </DocUl>

      <Callout>
        Because rendering happens by literally executing your components, a runtime error in one section is
        caught per-section (an error boundary wraps every rendered section individually) so a bug in one part of
        a page shows an inline error message there instead of blanking the whole page.
      </Callout>
    </DocSection>
  );
}
