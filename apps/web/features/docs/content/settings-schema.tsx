import { Callout, CodeBlock, DocH1, DocH2, DocLead, DocP, DocSection, FieldTable } from "../prose";

export default function SettingsSchemaDoc() {
  return (
    <DocSection>
      <DocH1>Global settings schema</DocH1>
      <DocLead>
        <code>config/settings.schema.ts</code> declares every site-wide control the editor should render —
        colors, typography, spacing. No UI code: the host reads this data and generates the actual pickers,
        sliders, and toggles.
      </DocLead>

      <CodeBlock filename="config/settings.schema.ts">{`
export interface SettingField {
  type: "text" | "textarea" | "richtext" | "url" | "image" | "color"
      | "select" | "checkbox" | "range" | "font" | "icon";
  id: string;
  label: string;
  default?: string | number | boolean;
  info?: string;
  placeholder?: string;
  options?: { value: string; label: string }[]; // select only
  min?: number; max?: number; step?: number;     // range only
  unit?: string;                                  // range only, e.g. "px"
}

export interface SettingGroup {
  header: string;
  settings: SettingField[];
}

const settingsSchema = {
  groups: [
    {
      header: "Color palette",
      settings: [
        { type: "color", id: "colorPrimary", label: "Primary color", default: "#3A1B63" },
        { type: "color", id: "colorBackground", label: "Page background", default: "#FFFFFF" },
      ],
    },
    {
      header: "Typography",
      settings: [
        {
          type: "select",
          id: "headingFont",
          label: "Heading font",
          options: [{ value: "'Sora', sans-serif", label: "Sora" }],
          default: "'Sora', sans-serif",
        },
        { type: "range", id: "baseFontSize", label: "Base font size", min: 14, max: 20, step: 1, unit: "px", default: 16 },
      ],
    },
  ],
};

export default settingsSchema;
`}</CodeBlock>

      <DocH2 id="setting-types">Setting types</DocH2>
      <FieldTable
        rows={[
          { name: "text / textarea", type: "string", description: "Plain single/multi-line text input." },
          { name: "richtext", type: "string (HTML)", description: "Formatted text — read the value as trusted HTML your component renders directly." },
          { name: "url", type: "string", description: "Text input validated as a URL." },
          { name: "image", type: "{ src, alt, width?, height? }", description: "Renders as an image picker; your component receives a resolved image object." },
          { name: "color", type: "string (hex)", description: "Color picker." },
          { name: "select", type: "string", description: "One of options — renders as a segmented control (few options) or dropdown (many)." },
          { name: "checkbox", type: "boolean", description: "Toggle." },
          { name: "range", type: "number", description: "Slider between min and max, stepping by step." },
          { name: "font", type: "string", description: "Font-stack picker, typically paired with a select of curated options in practice." },
          { name: "icon", type: "string", description: "Icon-name picker, matched against your component's icon set." },
        ]}
      />

      <DocH2 id="pairing-with-defaults">Pairing with settings.default.ts</DocH2>
      <DocP>
        <code>config/settings.default.ts</code> exports the actual default value object your components see when
        nothing has been customized yet — its shape should mirror every <code>id</code> declared in the schema.
        Keeping these in one file each (schema describes the control, defaults describe the starting value) keeps
        the two independently editable without one silently drifting from the other.
      </DocP>
      <CodeBlock filename="config/settings.default.ts">{`
export interface ThemeSettings {
  colorPrimary: string;
  colorBackground: string;
  headingFont: string;
  baseFontSize: number;
}

const settings: ThemeSettings = {
  colorPrimary: "#3A1B63",
  colorBackground: "#FFFFFF",
  headingFont: "'Sora', sans-serif",
  baseFontSize: 16,
};

export default settings;
`}</CodeBlock>

      <Callout>
        Group headers are freeform strings — the editor renders one collapsible section per unique header, in
        the order they first appear. There's no separate "categories" concept to register.
      </Callout>

      <DocH2 id="consuming-settings">Consuming these values</DocH2>
      <DocP>
        Your <code>ThemeLayout</code> component receives the resolved settings object as a prop and is the usual
        place to turn them into CSS custom properties consumed by the rest of your stylesheet — see{" "}
        <strong>ThemeLayout &amp; theming</strong>.
      </DocP>

      <DocH2 id="settings-that-arent-visual">Settings your component tree can't render</DocH2>
      <DocP>
        Not every global setting has a place in your React tree — a favicon is <code>&lt;head&gt;</code> content,
        not something <code>ThemeLayout</code> can render as JSX. Declare it as an ordinary <code>image</code>{" "}
        setting like any other:
      </DocP>
      <CodeBlock>{`
{ type: "image", id: "favicon", label: "Favicon", info: "32×32px or larger works best." }
`}</CodeBlock>
      <Callout>
        A setting like this is read and applied outside your component tree entirely — the platform's rendering
        engine updates the page's own <code>&lt;link rel="icon"&gt;</code> directly from the resolved value.
        Nothing to wire up in <code>ThemeLayout</code>; declaring the field in your schema is enough.
      </Callout>
    </DocSection>
  );
}
