"use client";

import { Copy, Link2, Power, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Checkbox, Field, Input, Textarea } from "../../../components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { cn } from "../../../lib/utils";
import { ColorField, ImageField, RangeField, SegmentedField, SelectField } from "./controls";
import { DESIGN_FIELDS } from "./design-fields";
import { isNestedLinksField, NestedLinksEditor } from "./nested-links-editor";
import { groupSettings } from "./state";
import type { SectionGroups, SectionSchema, SelectedItem, ThemeSetting } from "./types";

/** ≤4 options read faster as a segmented control; more than that stays a dropdown. */
const SEGMENTED_OPTION_LIMIT = 4;

export function CustomizerInspector({
  globalSchema,
  groups,
  onChangeBlockSetting,
  onChangeSectionSetting,
  onChangeThemeSetting,
  onDeleteBlock,
  onDeleteSection,
  onDuplicateBlock,
  onDuplicateSection,
  onToggleSection,
  sectionSchemas,
  selected,
  themeSettings,
}: {
  globalSchema: ThemeSetting[];
  groups: SectionGroups;
  onChangeBlockSetting: (sectionId: string, blockId: string, controlId: string, value: unknown) => void;
  onChangeSectionSetting: (sectionId: string, controlId: string, value: unknown) => void;
  onChangeThemeSetting: (controlId: string, value: unknown) => void;
  onDeleteBlock: (sectionId: string, blockId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDuplicateBlock: (sectionId: string, blockId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onToggleSection: (sectionId: string) => void;
  sectionSchemas: SectionSchema[];
  selected: SelectedItem;
  themeSettings: Record<string, unknown>;
}) {
  const allSections = [...groups.header, ...groups.template, ...groups.footer];

  // design-fields.ts is theme-agnostic and can't know a theme's own curated font list, so its
  // three "Font family" fields start with empty options — filled in here from whichever global
  // setting already resolved one (see schema-parser.ts's cross-file options resolution), same
  // list Theme settings' own Heading/Body font pickers show, instead of a bare free-text input.
  // Shared as-is by both the section and block Design tabs below.
  const designFields = useMemo(() => {
    const fontOptions = globalSchema.find((setting) => /font$/i.test(setting.id) && (setting.options?.length ?? 0) > 0)?.options ?? [];
    if (!fontOptions.length) return DESIGN_FIELDS;
    return DESIGN_FIELDS.map((field) => (field.id.endsWith("FontFamily") ? { ...field, options: fontOptions } : field));
  }, [globalSchema]);

  if (selected.kind === "theme") {
    return (
      <div className="grid gap-4 p-3">
        <InspectorHeader icon={<Settings2 className="size-4" />} title="Theme settings" />
        <SettingGroups control={globalSchema} values={themeSettings} onChange={onChangeThemeSetting} />
      </div>
    );
  }

  const section = allSections.find((item) => item.id === selected.sectionId);
  if (!section) {
    return <p className="p-4 text-[12.5px] text-muted-foreground">This item no longer exists.</p>;
  }
  const schema = sectionSchemas.find((item) => item.id === section.schemaId);

  if (selected.kind === "section") {
    return (
      <div className="grid gap-3 p-3">
        <InspectorHeader
          title={section.name}
          menu={
            <RowActionMenu
              onDelete={() => onDeleteSection(section.id)}
              onDuplicate={() => onDuplicateSection(section.id)}
              onToggle={() => onToggleSection(section.id)}
              visible={section.enabled}
            />
          }
        />
        <Tabs key={section.id} defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
          </TabsList>
          <TabsContent value="content">
            {schema?.settings.length ? (
              <SettingGroups control={schema.settings} values={section.settings} onChange={(id, value) => onChangeSectionSetting(section.id, id, value)} />
            ) : (
              <p className="text-[12.5px] text-muted-foreground">This section has no settings.</p>
            )}
          </TabsContent>
          <TabsContent value="design">
            <SettingGroups
              control={designFields}
              values={section.settings}
              onChange={(id, value) => onChangeSectionSetting(section.id, id, value)}
              onReset={(id) => onChangeSectionSetting(section.id, id, undefined)}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const block = section.blocks.find((item) => item.id === selected.blockId);
  const blockSchema = schema?.blocks?.find((item) => item.type === block?.type) ?? schema?.blocks?.[0];
  if (!block) {
    return <p className="p-4 text-[12.5px] text-muted-foreground">This item no longer exists.</p>;
  }

  return (
    // Keyed by block.id: NestedLinksEditor below keeps its own drag/edit state internally rather
    // than re-deriving it from `value` on every keystroke, so without this key switching to a
    // different block would leave the previous block's rows on screen instead of the new one's.
    <div key={block.id} className="grid gap-3 p-3">
      <InspectorHeader
        title={block.name}
        menu={<RowActionMenu onDelete={() => onDeleteBlock(section.id, block.id)} onDuplicate={() => onDuplicateBlock(section.id, block.id)} />}
      />
      <Tabs key={block.id} defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          {blockSchema?.settings.length ? (
            <SettingGroups control={blockSchema.settings} values={block.settings} onChange={(id, value) => onChangeBlockSetting(section.id, block.id, id, value)} />
          ) : (
            <p className="text-[12.5px] text-muted-foreground">This block has no settings.</p>
          )}
        </TabsContent>
        <TabsContent value="design">
          <SettingGroups
            control={designFields}
            values={block.settings}
            onChange={(id, value) => onChangeBlockSetting(section.id, block.id, id, value)}
            onReset={(id) => onChangeBlockSetting(section.id, block.id, id, undefined)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InspectorHeader({ icon, menu, title }: { icon?: ReactNode; menu?: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b pb-3">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <h2 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground">{title}</h2>
      {menu}
    </div>
  );
}

function RowActionMenu({ onDelete, onDuplicate, onToggle, visible }: { onDelete: () => void; onDuplicate: () => void; onToggle?: () => void; visible?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="More actions">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="10" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="16" cy="10" r="1.6" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onToggle ? (
          <DropdownMenuItem onSelect={onToggle}>
            <Power className="size-3.5" />
            {visible ? "Hide section" : "Show section"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy className="size-3.5" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          <Trash2 className="size-3.5" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SettingGroups({
  control,
  onChange,
  onReset,
  values,
}: {
  control: ThemeSetting[];
  onChange: (id: string, value: unknown) => void;
  /** Only passed for Design-tab fields — lets each field clear its override back to the theme's own default instead of just showing one. */
  onReset?: (id: string) => void;
  values: Record<string, unknown>;
}) {
  return (
    <>
      {groupSettings(control).map(([group, controls]) => (
        <section key={group} className="grid gap-3.5 rounded-lg border bg-surface-secondary/40 p-3">
          <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{group}</h3>
          {group === "Spacing" ? (
            <SpacingFields controls={controls} values={values} onChange={onChange} {...(onReset ? { onReset } : {})} />
          ) : (
            controls.map((setting) => (
              <SettingRow key={setting.id} setting={setting} values={values} onChange={onChange} {...(onReset ? { onReset } : {})} />
            ))
          )}
        </section>
      ))}
    </>
  );
}

/**
 * A theme can declare a JSON-string field whose id ends "Json" (schema-parser.ts's own convention
 * for "this textarea holds a serialized tree" — see isNestedLinksField) while its own default
 * content and a block's actual saved value live one key shorter, already a real array rather than
 * a JSON string (e.g. field id "linksJson", real data at settings.links) — a real theme found
 * this session (ontech-theme-zip's Footer: schema.ts declares "linksJson", but defaultBlocks and
 * every live block instance store "links"). Reading and writing through whichever key actually
 * holds the data keeps existing content visible and routes edits to where the theme's own
 * rendering code looks for them, instead of silently showing the schema's placeholder default and
 * saving edits nobody ever reads back.
 */
function nestedLinksStorageId(setting: ThemeSetting, values: Record<string, unknown>): string {
  if (!isNestedLinksField(setting.id) || values[setting.id] !== undefined) return setting.id;
  const fallbackId = setting.id.replace(/Json$/i, "");
  return fallbackId !== setting.id && values[fallbackId] !== undefined ? fallbackId : setting.id;
}

function SettingRow({
  onChange,
  onReset,
  setting,
  values,
}: {
  onChange: (id: string, value: unknown) => void;
  onReset?: (id: string) => void;
  setting: ThemeSetting;
  values: Record<string, unknown>;
}) {
  const storageId = nestedLinksStorageId(setting, values);
  const isOverridden = values[storageId] !== undefined;
  return (
    <div className="relative">
      <ThemeSettingControl control={setting} value={values[storageId] ?? setting.default} onChange={(value) => onChange(storageId, value)} />
      {onReset && isOverridden ? (
        <button
          type="button"
          onClick={() => onReset(storageId)}
          title={`Reset ${setting.label}`}
          aria-label={`Reset ${setting.label}`}
          className="absolute right-0 top-0 grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Padding and margin each get their own link toggle: on, editing any one of the four sides
 * applies that same value to the other three — off, each side stays independent as usual.
 * Purely a local editing convenience (which cluster is linked isn't persisted anywhere), scoped
 * to design-fields.ts's Spacing group specifically since that's the one hardcoded set of paired
 * directional fields the platform defines. Margin renders first to match the box-model mental
 * model (margin is the outer edge) even though design-fields.ts declares padding first.
 */
function SpacingFields({
  controls,
  onChange,
  onReset,
  values,
}: {
  controls: ThemeSetting[];
  onChange: (id: string, value: unknown) => void;
  onReset?: (id: string) => void;
  values: Record<string, unknown>;
}) {
  const paddingFields = controls.filter((setting) => setting.id.startsWith("designPadding"));
  const marginFields = controls.filter((setting) => setting.id.startsWith("designMargin"));
  const rest = controls.filter((setting) => !setting.id.startsWith("designPadding") && !setting.id.startsWith("designMargin"));

  return (
    <>
      {marginFields.length ? (
        <LinkableSideGroup label="Margin" fields={marginFields} values={values} onChange={onChange} {...(onReset ? { onReset } : {})} />
      ) : null}
      {paddingFields.length && marginFields.length ? <div className="border-t" /> : null}
      {paddingFields.length ? (
        <LinkableSideGroup label="Padding" fields={paddingFields} values={values} onChange={onChange} {...(onReset ? { onReset } : {})} />
      ) : null}
      {rest.map((setting) => (
        <SettingRow key={setting.id} setting={setting} values={values} onChange={onChange} {...(onReset ? { onReset } : {})} />
      ))}
    </>
  );
}

/** Top/Right/Bottom/Left, in the 2x2 reading order the reference UI uses — independent of whatever order design-fields.ts happens to declare the four ids in. */
function bySide(fields: ThemeSetting[], side: "top" | "right" | "bottom" | "left") {
  return fields.find((field) => field.id.toLowerCase().endsWith(side));
}

function LinkableSideGroup({
  fields,
  label,
  onChange,
  onReset,
  values,
}: {
  fields: ThemeSetting[];
  label: string;
  onChange: (id: string, value: unknown) => void;
  onReset?: (id: string) => void;
  values: Record<string, unknown>;
}) {
  const [linked, setLinked] = useState(false);
  const ordered = (["top", "right", "bottom", "left"] as const)
    .map((side) => bySide(fields, side))
    .filter((field): field is ThemeSetting => Boolean(field));

  function handleChange(id: string, value: number) {
    onChange(id, value);
    if (linked) {
      for (const sibling of fields) {
        if (sibling.id !== id) onChange(sibling.id, value);
      }
    }
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-foreground">{label}</p>
        <button
          type="button"
          onClick={() => setLinked((current) => !current)}
          title={linked ? "Editing one side now sets all four — click to edit sides independently" : "Click to edit one side and apply it to all four"}
          aria-pressed={linked}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
            linked ? "border-info/50 bg-info/10 text-info" : "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Link2 className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
        {ordered.map((field) => {
          const isOverridden = values[field.id] !== undefined;
          const shortLabel = field.label.replace(new RegExp(`^${label}\\s+`, "i"), "") || field.label;
          return (
            <div key={field.id} className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-medium capitalize text-foreground">{shortLabel}</label>
                {onReset && isOverridden ? (
                  <button
                    type="button"
                    onClick={() => onReset(field.id)}
                    title={`Reset ${field.label}`}
                    aria-label={`Reset ${field.label}`}
                    className="grid size-4 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="size-2.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center rounded-md border border-input bg-surface pl-2.5 pr-2 shadow-sm shadow-slate-950/5 focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/15">
                <input
                  type="number"
                  min={field.min ?? -1000}
                  max={field.max ?? 1000}
                  value={Number(values[field.id] ?? field.default ?? 0)}
                  onChange={(event) => handleChange(field.id, Number(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-[12.5px] text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="shrink-0 text-[10.5px] font-medium uppercase text-muted-foreground">{field.unit ?? "px"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThemeSettingControl({ control, onChange, value }: { control: ThemeSetting; onChange: (value: unknown) => void; value: unknown }) {
  if (control.type === "boolean" || control.type === "checkbox") {
    return <Checkbox label={control.label} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />;
  }
  if (control.type === "textarea" && isNestedLinksField(control.id)) {
    // The resolved value can be a real array/object rather than a JSON string — see
    // nestedLinksStorageId's comment above — in which case String() would render
    // "[object Object]" instead of the tree it actually holds.
    const resolvedLinks = value ?? control.default ?? "[]";
    const linksValue = typeof resolvedLinks === "string" ? resolvedLinks : JSON.stringify(resolvedLinks);
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        <NestedLinksEditor value={linksValue} onChange={onChange} />
      </Field>
    );
  }
  if (control.type === "textarea" || control.type === "richtext") {
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        <Textarea placeholder={control.placeholder} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }
  if (control.type === "select") {
    const options = control.options ?? [];
    // A segmented control only reads well when its labels are short enough to stay legible once
    // they all share one narrow sidebar row. Four moderate labels (e.g. "Narrow (960px)" / "Default
    // (1240px)" / "Wide (1400px)" / "Full width" — ~14 chars average) still don't fit even though no
    // single one looks unreasonably long on its own, so this checks the combined width in play (every
    // label individually, and all of them together) rather than just the longest one. A dropdown
    // shows each option on its own full-width row instead, so there's no width budget to blow.
    const labels = options.map((option) => (typeof option === "string" ? option : option.label));
    const totalLength = labels.reduce((sum, label) => sum + label.length, 0);
    const fitsSegmented = options.length <= SEGMENTED_OPTION_LIMIT && labels.every((label) => label.length <= 16) && totalLength <= 30;
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        {fitsSegmented ? (
          <SegmentedField options={options} value={String(value ?? control.default ?? "")} onChange={onChange} />
        ) : (
          <SelectField options={options} value={String(value ?? control.default ?? "")} onChange={onChange} />
        )}
      </Field>
    );
  }
  if (control.type === "range") {
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        <RangeField
          min={control.min ?? 0}
          max={control.max ?? 100}
          step={control.step ?? 1}
          {...(control.unit ? { unit: control.unit } : {})}
          value={Number(value ?? control.default ?? 0)}
          onChange={onChange}
        />
      </Field>
    );
  }
  if (control.type === "color") {
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        <ColorField value={String(value ?? "")} {...(control.placeholder ? { placeholder: control.placeholder } : {})} onChange={onChange} />
      </Field>
    );
  }
  if (control.type === "image") {
    // Normalizes a bare-string value (from before image settings stored
    // { src, alt }) into the object shape ImageField and the theme's own
    // asImage() helper both expect, so an old saved value still displays
    // instead of appearing blank.
    const current = value && typeof value === "object" ? (value as { src?: unknown; alt?: unknown }) : { src: value, alt: "" };
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        <ImageField
          value={{ src: typeof current.src === "string" ? current.src : "", alt: typeof current.alt === "string" ? current.alt : "" }}
          onChange={onChange}
        />
      </Field>
    );
  }
  if (control.type === "icon") {
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        <Input type="text" placeholder="Icon name" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }
  return (
    <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
      <Input type={control.type === "url" ? "url" : "text"} placeholder={control.placeholder} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
