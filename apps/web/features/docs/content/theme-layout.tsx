import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocP, DocSection } from "../prose";

export default function ThemeLayoutDoc() {
  return (
    <DocSection>
      <DocH1>ThemeLayout &amp; theming</DocH1>
      <DocLead>
        <code>layout/ThemeLayout.tsx</code> is the outer shell every page renders inside, and the one place
        global settings usually get turned into CSS custom properties the rest of your stylesheet reads.
      </DocLead>

      <CodeBlock filename="layout/ThemeLayout.tsx">{`
import * as React from "react";
import type { ThemeSettings } from "../config/settings.default";

export interface ThemeLayoutProps {
  settings: ThemeSettings;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ThemeLayout({ settings, header, footer, children }: ThemeLayoutProps) {
  const styleVars: React.CSSProperties = {
    ["--color-primary" as string]: settings.colorPrimary,
    ["--color-background" as string]: settings.colorBackground,
    ["--font-heading" as string]: settings.headingFont,
    ["--section-spacing" as string]: \`\${settings.sectionSpacing}px\`,
  } as React.CSSProperties;

  return (
    <div className="theme-root" style={styleVars} data-button-style={settings.buttonStyle}>
      {header}
      <main>{children}</main>
      {footer}
    </div>
  );
}
`}</CodeBlock>

      <DocH2 id="why-css-variables">Why CSS custom properties, not inline styles per component</DocH2>
      <DocP>
        Setting variables once at the root and reading them everywhere in your stylesheet means a merchant
        changing a global color updates every section at once, with zero prop-drilling — no section component
        needs to know or care that <code>colorPrimary</code> exists. Your <code>assets/styles/theme.css</code>{" "}
        then reads:
      </DocP>
      <CodeBlock filename="assets/styles/theme.css">{`
.button--primary {
  background: var(--color-primary);
}
.section {
  padding-block: var(--section-spacing);
}
`}</CodeBlock>

      <DocH2 id="data-attributes-for-variant-css">Data attributes for variant CSS</DocH2>
      <DocP>
        Settings that change which CSS rule applies rather than a value (button style solid vs. outline, card
        shadow strength) are a natural fit for a <code>data-*</code> attribute on the root, matched with an
        attribute selector:
      </DocP>
      <CodeBlock>{`
[data-button-style="outline"] .button--primary {
  background: transparent;
  border: 1px solid var(--color-primary);
}
`}</CodeBlock>

      <Callout>
        <code>ThemeLayout</code> receives already-merged settings — every default from{" "}
        <code>settings.default.ts</code> with the merchant&rsquo;s saved overrides layered on top. You never need
        to merge or fall back to defaults yourself inside this component.
      </Callout>

      <DocH2 id="header-and-footer-are-props-not-imports">Header and footer arrive as props, not imports</DocH2>
      <DocP>
        <code>ThemeLayout</code> doesn&rsquo;t import or render <code>Header</code>/<code>Footer</code> directly
        — it receives them pre-rendered as the <code>header</code> and <code>footer</code> props and places them.
        This keeps the layout itself simple positioning logic, with the actual chrome sections following the
        same schema-driven, editable path as everything else.
      </DocP>
    </DocSection>
  );
}
