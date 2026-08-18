"use client";

import { Copy, Power, Settings2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Checkbox, Field, Input, Textarea } from "../../../components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { ColorField, ImageField, RangeField, SegmentedField, SelectField } from "./controls";
import { SECTION_DESIGN_FIELDS } from "./design-fields";
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
            <SettingGroups control={SECTION_DESIGN_FIELDS} values={section.settings} onChange={(id, value) => onChangeSectionSetting(section.id, id, value)} />
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
    <div className="grid gap-4 p-3">
      <InspectorHeader
        title={block.name}
        menu={<RowActionMenu onDelete={() => onDeleteBlock(section.id, block.id)} onDuplicate={() => onDuplicateBlock(section.id, block.id)} />}
      />
      {blockSchema?.settings.length ? (
        <SettingGroups control={blockSchema.settings} values={block.settings} onChange={(id, value) => onChangeBlockSetting(section.id, block.id, id, value)} />
      ) : (
        <p className="text-[12.5px] text-muted-foreground">This block has no settings.</p>
      )}
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

function SettingGroups({ control, onChange, values }: { control: ThemeSetting[]; onChange: (id: string, value: unknown) => void; values: Record<string, unknown> }) {
  return (
    <>
      {groupSettings(control).map(([group, controls]) => (
        <section key={group} className="grid gap-3.5 rounded-lg border bg-surface-secondary/40 p-3">
          <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{group}</h3>
          {controls.map((setting) => (
            <ThemeSettingControl key={setting.id} control={setting} value={values[setting.id] ?? setting.default} onChange={(value) => onChange(setting.id, value)} />
          ))}
        </section>
      ))}
    </>
  );
}

function ThemeSettingControl({ control, onChange, value }: { control: ThemeSetting; onChange: (value: unknown) => void; value: unknown }) {
  if (control.type === "boolean" || control.type === "checkbox") {
    return <Checkbox label={control.label} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />;
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
    return (
      <Field label={control.label} {...(control.info ? { hint: control.info } : {})}>
        {options.length <= SEGMENTED_OPTION_LIMIT ? (
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
