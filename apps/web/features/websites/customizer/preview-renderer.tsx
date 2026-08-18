"use client";

import { ArrowDown, ArrowUp, Copy, Image as ImageIcon, Pencil, PlusCircle, Power, Star, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/form";
import type { FieldRoles } from "./field-roles";
import { extractFieldRoles, isAnnouncementLike, isHeaderLike } from "./field-roles";
import { createBlocks, getNestedValue, sectionGroupKey } from "./state";
import type { CustomizerPageOption, SectionBlock, SectionGroups, SectionInstance, SectionSchema, SelectedItem } from "./types";

export function ThemeLivePreview({
  groups,
  sectionSchemas,
  page,
  settings,
  selected,
  templateSupportsSections,
  websiteName,
  onSelectSection,
  onSelectBlock,
  onToggleSection,
  onDuplicateSection,
  onDeleteSection,
  onAddSection,
  onMoveSection,
}: {
  groups: SectionGroups;
  sectionSchemas: SectionSchema[];
  page: CustomizerPageOption | null;
  settings: Record<string, unknown>;
  selected: SelectedItem;
  templateSupportsSections: boolean;
  websiteName: string;
  onSelectSection: (sectionId: string) => void;
  onSelectBlock: (sectionId: string, blockId: string) => void;
  onToggleSection: (sectionId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onAddSection: (group: "header" | "template" | "footer", schemaId?: string, afterSectionId?: string) => void;
}) {
  const colors = getPreviewColors(settings);
  const buttonStyle = getButtonStyle(settings);
  const pageLabel = page?.label ?? "Home page";
  const ordered: Array<{ section: SectionInstance; group: "header" | "template" | "footer" }> = [
    ...groups.header.map((section) => ({ section, group: "header" as const })),
    ...groups.template.map((section) => ({ section, group: "template" as const })),
    ...groups.footer.map((section) => ({ section, group: "footer" as const })),
  ];
  const canAddToGroup = (group: "header" | "template" | "footer") => group !== "template" || templateSupportsSections;

  return (
    <div className="min-h-full" style={{ backgroundColor: colors.background, color: colors.text }}>
      {ordered.map(({ section, group }, index) => {
        const schema = sectionSchemas.find((item) => item.id === section.schemaId);
        const previousGroup = ordered[index - 1]?.group;
        return (
          <div key={section.id}>
            {canAddToGroup(group) ? (
              <InlineAddSection group={group} afterSectionId={index === 0 || group !== previousGroup ? "__start" : ordered[index - 1]?.section.id} onAdd={onAddSection} sectionSchemas={sectionSchemas} />
            ) : null}
            <EditablePreviewSection
              colors={colors}
              buttonStyle={buttonStyle}
              onDelete={() => onDeleteSection(section.id)}
              onDuplicate={() => onDuplicateSection(section.id)}
              onAdd={() => onAddSection(group, undefined, section.id)}
              onMove={(direction) => onMoveSection(section.id, direction)}
              onSelect={() => onSelectSection(section.id)}
              onSelectBlock={(blockId) => onSelectBlock(section.id, blockId)}
              onToggle={() => onToggleSection(section.id)}
              canMoveDown={index < ordered.length - 1 && ordered[index + 1]?.group === group}
              canMoveUp={index > 0 && ordered[index - 1]?.group === group}
              pageLabel={pageLabel}
              schema={schema}
              section={section}
              selected={selected.kind === "section" && selected.sectionId === section.id}
              selectedBlockId={selected.kind === "block" && selected.sectionId === section.id ? selected.blockId : null}
              websiteName={websiteName}
            />
          </div>
        );
      })}
      {ordered.length ? (
        <InlineAddSection group="footer" afterSectionId={ordered[ordered.length - 1]?.section.id} onAdd={onAddSection} sectionSchemas={sectionSchemas} />
      ) : null}
    </div>
  );
}

/**
 * Read-only counterpart to ThemeLivePreview — no edit chrome, no hidden
 * sections, no add-section affordances. This is what visitors would
 * actually see, rendered from the same schema-driven dispatch so a real
 * preview page never drifts from what the editor shows.
 */
export function StaticSitePreview({
  groups,
  page,
  sectionSchemas,
  settings,
  websiteName,
}: {
  groups: SectionGroups;
  page: CustomizerPageOption | null;
  sectionSchemas: SectionSchema[];
  settings: Record<string, unknown>;
  websiteName: string;
}) {
  const colors = getPreviewColors(settings);
  const buttonStyle = getButtonStyle(settings);
  const pageLabel = page?.label ?? "Home page";
  const visibleSections = [...groups.header, ...groups.template, ...groups.footer].filter((section) => section.enabled);

  return (
    <div className="min-h-full" style={{ backgroundColor: colors.background, color: colors.text }}>
      {visibleSections.map((section) => (
        <PreviewSection
          key={section.id}
          buttonStyle={buttonStyle}
          colors={colors}
          onSelectBlock={noop}
          pageLabel={pageLabel}
          schema={sectionSchemas.find((item) => item.id === section.schemaId)}
          section={section}
          selected={false}
          selectedBlockId={null}
          websiteName={websiteName}
        />
      ))}
    </div>
  );
}

function noop() {}

function EditablePreviewSection({
  buttonStyle,
  colors,
  canMoveDown,
  canMoveUp,
  onAdd,
  onDelete,
  onDuplicate,
  onMove,
  onSelect,
  onSelectBlock,
  onToggle,
  pageLabel,
  schema,
  section,
  selected,
  selectedBlockId,
  websiteName,
}: {
  buttonStyle: ButtonStyle;
  colors: PreviewColors;
  canMoveDown: boolean;
  canMoveUp: boolean;
  onAdd: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: "up" | "down") => void;
  onSelect: () => void;
  onSelectBlock: (blockId: string) => void;
  onToggle: () => void;
  pageLabel: string;
  schema: SectionSchema | undefined;
  section: SectionInstance;
  selected: boolean;
  selectedBlockId: string | null;
  websiteName: string;
}) {
  return (
    <div
      className={`group relative ${section.enabled ? "" : "opacity-50"}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      <PreviewSection
        buttonStyle={buttonStyle}
        colors={colors}
        onSelectBlock={onSelectBlock}
        pageLabel={pageLabel}
        schema={schema}
        section={section}
        selected={selected}
        selectedBlockId={selectedBlockId}
        websiteName={websiteName}
      />
      {selected ? (
        <SectionActionBar
          canMoveDown={canMoveDown}
          canMoveUp={canMoveUp}
          enabled={section.enabled}
          name={section.name}
          onAdd={onAdd}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onEdit={onSelect}
          onMove={onMove}
          onToggle={onToggle}
        />
      ) : null}
      {!section.enabled ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/50">
          <span className="rounded-full border bg-surface px-3 py-1 text-[11px] font-semibold text-muted-foreground">Hidden section</span>
        </div>
      ) : null}
    </div>
  );
}

function SectionActionBar({
  canMoveDown,
  canMoveUp,
  enabled,
  name,
  onAdd,
  onDelete,
  onDuplicate,
  onEdit,
  onMove,
  onToggle,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  enabled: boolean;
  name: string;
  onAdd: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onMove: (direction: "up" | "down") => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="fixed inset-x-3 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100vw-24px)] flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/95 p-2 text-white shadow-2xl shadow-slate-950/30 backdrop-blur"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="max-w-44 truncate px-2 text-[12px] font-bold">{name}</span>
      <IconAction label="Edit section" onClick={onEdit} tone="dark">
        <Pencil className="size-3.5" />
      </IconAction>
      <IconAction disabled={!canMoveUp} label="Move section up" onClick={() => onMove("up")} tone="dark">
        <ArrowUp className="size-3.5" />
      </IconAction>
      <IconAction disabled={!canMoveDown} label="Move section down" onClick={() => onMove("down")} tone="dark">
        <ArrowDown className="size-3.5" />
      </IconAction>
      <IconAction label="Add section after" onClick={onAdd} tone="dark">
        <PlusCircle className="size-3.5" />
      </IconAction>
      <IconAction label="Duplicate section" onClick={onDuplicate} tone="dark">
        <Copy className="size-3.5" />
      </IconAction>
      <IconAction label={enabled ? "Hide section" : "Show section"} onClick={onToggle} tone="dark">
        <Power className="size-3.5" />
      </IconAction>
      <IconAction label="Delete section" onClick={onDelete} tone="danger">
        <Trash2 className="size-3.5" />
      </IconAction>
    </div>
  );
}

export function IconAction({ children, disabled, label, onClick, tone = "default" }: { children: ReactNode; disabled?: boolean; label: string; onClick: () => void; tone?: "default" | "dark" | "danger" }) {
  return (
    <button
      aria-label={label}
      title={label}
      type="button"
      disabled={disabled}
      className={`grid size-7 place-items-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        tone === "danger"
          ? "bg-red-500/90 text-white hover:bg-red-500"
          : tone === "dark"
            ? "text-white/80 hover:bg-white/10 hover:text-white"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function InlineAddSection({
  afterSectionId,
  group,
  onAdd,
  sectionSchemas,
}: {
  afterSectionId?: string | undefined;
  group: "header" | "template" | "footer";
  onAdd: (group: "header" | "template" | "footer", schemaId?: string, afterSectionId?: string) => void;
  sectionSchemas: SectionSchema[];
}) {
  const options = sectionSchemas.filter((schema) => sectionGroupKey(schema) === group);
  if (!options.length) return null;
  return (
    <div className="group/add relative z-20 flex h-0 items-center justify-center">
      <div className="flex translate-y-0 items-center gap-1.5 rounded-full border bg-surface/95 p-1 opacity-0 shadow-lg shadow-slate-950/10 transition-opacity group-hover/add:opacity-100 focus-within:opacity-100">
        <Select className="h-8 min-h-8 w-40 rounded-full py-1 text-[11px]" aria-label="Add section in preview" value="" onChange={(event) => onAdd(group, event.target.value, afterSectionId)}>
          <option value="" disabled>
            Add section
          </option>
          {options.map((schema) => (
            <option key={schema.id} value={schema.id}>
              {schema.name}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={() => onAdd(group, undefined, afterSectionId)}>
          <PlusCircle className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

type PreviewColors = ReturnType<typeof getPreviewColors>;
type ButtonStyle = ReturnType<typeof getButtonStyle>;

export function PreviewSection({
  buttonStyle,
  colors,
  onSelectBlock,
  pageLabel,
  schema,
  section,
  selected,
  selectedBlockId,
  websiteName,
}: {
  buttonStyle: ButtonStyle;
  colors: PreviewColors;
  onSelectBlock: (blockId: string) => void;
  pageLabel: string;
  schema: SectionSchema | undefined;
  section: SectionInstance;
  selected: boolean;
  selectedBlockId: string | null;
  websiteName: string;
}) {
  const ring = selected ? "outline outline-2 outline-info outline-offset-[-2px]" : "outline outline-1 outline-transparent";
  if (!schema) {
    return (
      <section className={`px-8 py-14 ${ring}`}>
        <h2 className="text-2xl font-bold">{section.name}</h2>
      </section>
    );
  }

  const group = sectionGroupKey(schema);
  if (group === "header") {
    if (isAnnouncementLike(schema.id, schema.name)) {
      return <AnnouncementBar colors={colors} ring={ring} schema={schema} section={section} />;
    }
    if (isHeaderLike(schema.id, schema.name, schema.settings)) {
      return <HeaderNav colors={colors} onSelectBlock={onSelectBlock} ring={ring} schema={schema} section={section} selectedBlockId={selectedBlockId} websiteName={websiteName} />;
    }
    return <AnnouncementBar colors={colors} ring={ring} schema={schema} section={section} />;
  }
  if (group === "footer") {
    return <FooterSection colors={colors} onSelectBlock={onSelectBlock} ring={ring} schema={schema} section={section} selectedBlockId={selectedBlockId} websiteName={websiteName} />;
  }

  const variant = classifyContentSection(schema);
  const commonProps = { colors, onSelectBlock, ring, schema, section, selectedBlockId };
  if (variant === "stats") return <StatsRowSection {...commonProps} />;
  if (variant === "logoCloud") return <LogoCloudSection {...commonProps} />;
  if (variant === "processDark") return <ProcessDarkSection {...commonProps} />;
  if (variant === "featuredCard") return <FeaturedCardSection {...commonProps} buttonStyle={buttonStyle} />;
  if (variant === "cardList") return <CardListSection {...commonProps} />;
  if (variant === "cardGrid") return <CardGridSection {...commonProps} />;
  if (variant === "testimonialShowcase") return <TestimonialShowcaseSection {...commonProps} />;
  if (variant === "missionSplit") return <MissionSplitSection {...commonProps} />;
  if (variant === "ctaBanner") return <CtaBannerSection {...commonProps} buttonStyle={buttonStyle} />;
  if (variant === "locationCard") return <LocationCardSection {...commonProps} />;
  if (variant === "contactForm") return <ContactFormSection {...commonProps} buttonStyle={buttonStyle} />;
  return <GenericContentSection buttonStyle={buttonStyle} colors={colors} onSelectBlock={onSelectBlock} pageLabel={pageLabel} ring={ring} schema={schema} section={section} selectedBlockId={selectedBlockId} />;
}

type ContentVariant =
  | "stats"
  | "logoCloud"
  | "processDark"
  | "featuredCard"
  | "cardList"
  | "cardGrid"
  | "testimonialShowcase"
  | "missionSplit"
  | "ctaBanner"
  | "locationCard"
  | "contactForm"
  | "generic";

/**
 * Layout shapes that recur across agency/consulting themes, matched by
 * section id/name so any theme using similarly-purposed sections (not just
 * Copora) gets the right bespoke treatment instead of the generic fallback.
 */
function classifyContentSection(schema: SectionSchema): ContentVariant {
  const hay = `${schema.id} ${schema.name}`.toLowerCase();
  if (/stat/.test(hay)) return "stats";
  if (/logo.?(cloud|wall|strip)/.test(hay)) return "logoCloud";
  if (/process.*dark|dark.*process|process.*step/.test(hay)) return "processDark";
  if (/featured.*(case|story|project|work)/.test(hay)) return "featuredCard";
  if (/contact.?form/.test(hay)) return "contactForm";
  if (/location.?card|address.?card/.test(hay)) return "locationCard";
  if (/cta.?banner|call.?to.?action.?banner/.test(hay)) return "ctaBanner";
  if (/mission.*vision|vision.*mission/.test(hay)) return "missionSplit";
  if (/testimonial.*(showcase|carousel|wall)/.test(hay)) return "testimonialShowcase";
  if (/(case.?stud|project|portfolio).*list/.test(hay)) return "cardList";
  if (/(case.?stud|project|portfolio|blog|post|article).*grid/.test(hay)) return "cardGrid";
  return "generic";
}

type ContentSectionProps = { colors: PreviewColors; onSelectBlock: (blockId: string) => void; ring: string; schema: SectionSchema; section: SectionInstance; selectedBlockId: string | null };

function SectionHeading({ colors, description, eyebrow, heading }: { colors: PreviewColors; description?: string; eyebrow?: string; heading: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: colors.primary }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{heading}</h2>
      {description ? <p className="mt-3 text-[14px] leading-6 opacity-70">{description}</p> : null}
    </div>
  );
}

function StatsRowSection({ colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps) {
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  return (
    <section className={`px-6 py-10 md:px-10 ${ring}`}>
      <div className={`mx-auto grid max-w-5xl gap-4 ${blocks.length >= 3 ? "md:grid-cols-3" : blocks.length === 2 ? "md:grid-cols-2" : ""}`}>
        {blocks.slice(0, 4).map((block) => {
          const isCta = block.type === "cta";
          const dark = block.settings.tone === "dark";
          return (
            <button
              key={block.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectBlock(block.id);
              }}
              className={`grid gap-2 rounded-2xl border p-6 text-left transition-shadow hover:shadow-md ${selectedBlockId === block.id ? "outline outline-2 outline-info outline-offset-[-2px]" : ""}`}
              style={{ backgroundColor: dark ? colors.dark : colors.surface, color: dark ? "#fff" : colors.text }}
            >
              {isCta ? (
                <>
                  <h3 className="text-[15px] font-bold leading-5">{text(block.settings.heading, "24/7 support")}</h3>
                  <span className="mt-2 inline-flex w-max items-center rounded-full px-4 py-2 text-[12px] font-semibold text-white" style={{ backgroundColor: colors.primary }}>
                    {text(block.settings.buttonLabel, "Get in touch")}
                  </span>
                </>
              ) : (
                <>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide opacity-60">{text(block.settings.eyebrow, "Stat")}</p>
                  <strong className="text-4xl font-black leading-none tabular">{text(block.settings.value, "0")}</strong>
                  <p className="text-[12.5px] leading-5 opacity-70">{text(block.settings.description, "")}</p>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LogoCloudSection({ colors: _colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  return (
    <section className={`px-6 py-10 md:px-10 ${ring}`}>
      {roles.heading ? <p className="text-center text-[13px] font-semibold opacity-60">{text(s[roles.heading.id], "")}</p> : null}
      <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {(blocks.length ? blocks : Array.from({ length: 5 }).map((_, index) => ({ id: `logo-${index}`, type: "logo", name: "Logo", settings: {} }))).slice(0, 8).map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectBlock(block.id);
            }}
            className={`flex h-8 w-24 items-center justify-center rounded bg-surface-secondary text-[10px] font-semibold uppercase text-muted-foreground ${selectedBlockId === block.id ? "outline outline-2 outline-info" : ""}`}
          >
            Logo
          </button>
        ))}
      </div>
    </section>
  );
}

function ProcessDarkSection({ colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  return (
    <section className={`px-6 py-14 md:px-10 md:py-20 ${ring}`} style={{ backgroundColor: colors.dark, color: "#fff" }}>
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          {roles.eyebrow ? (
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: colors.primary }}>
              {text(s[roles.eyebrow.id], "")}
            </p>
          ) : null}
          <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{text(roles.heading ? s[roles.heading.id] : undefined, schema.name)}</h2>
          {roles.description ? <p className="mt-4 text-[14px] leading-6 opacity-70">{text(s[roles.description.id], "")}</p> : null}
          <div className="mt-8 flex items-center justify-between gap-3 rounded-full border border-white/15 px-5 py-3">
            <span className="text-[12.5px] opacity-80">{text(s.teaserText, "Want to know what's possible?")}</span>
            <span className="shrink-0 rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold" style={{ color: colors.dark }}>
              {text(s.teaserLinkLabel, "Get in touch")}
            </span>
          </div>
        </div>
        <div className="grid gap-0">
          {blocks.slice(0, 6).map((block, index) => (
            <button
              key={block.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectBlock(block.id);
              }}
              className={`grid grid-cols-[auto_1fr] gap-4 border-t border-white/10 py-5 text-left first:border-t-0 ${selectedBlockId === block.id ? "outline outline-1 outline-info" : ""}`}
            >
              <span className="text-[13px] font-bold opacity-40 tabular">{text(block.settings.number, String(index + 1).padStart(2, "0"))}</span>
              <span>
                <h3 className="text-[15px] font-bold">{text(block.settings.title, "Step")}</h3>
                <p className="mt-1 text-[12.5px] leading-5 opacity-60">{text(block.settings.description, "")}</p>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCardSection({ colors, onSelectBlock: _onSelectBlock, ring, schema, section }: ContentSectionProps & { buttonStyle: ButtonStyle }) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  return (
    <section className={`px-6 py-14 md:px-10 md:py-20 ${ring}`}>
      {roles.eyebrow ? (
        <p className="mx-auto max-w-5xl text-[12px] font-bold uppercase tracking-wide" style={{ color: colors.primary }}>
          {text(s[roles.eyebrow.id], "")}
        </p>
      ) : null}
      {roles.heading ? <h2 className="mx-auto mt-2 max-w-5xl text-3xl font-bold md:text-4xl">{text(s[roles.heading.id], "")}</h2> : null}
      <div className="relative mx-auto mt-6 max-w-5xl overflow-hidden rounded-2xl">
        <ImagePlaceholder aspect="16 / 8" />
        <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-3 rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur sm:inset-x-8 sm:bottom-8 sm:max-w-md">
          {s.tag ? (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${colors.primary}1a`, color: colors.primary }}>
              {text(s.tag, "")}
            </span>
          ) : null}
          <h3 className="w-full text-[15px] font-bold leading-5">{text(s.title, schema.name)}</h3>
        </div>
      </div>
    </section>
  );
}

function CardListSection({ colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  return (
    <section className={`px-6 py-14 md:px-10 md:py-20 ${ring}`}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3">
        {roles.eyebrow ? (
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: colors.primary }}>
            {text(s[roles.eyebrow.id], "")}
          </p>
        ) : (
          <span />
        )}
        <span className="rounded-full px-4 py-2 text-[12px] font-semibold text-white" style={{ backgroundColor: colors.primary }}>
          {text(s.footerLinkLabel, "Let's work together")}
        </span>
      </div>
      <div className="mx-auto mt-6 max-w-5xl divide-y rounded-xl border">
        {blocks.slice(0, 8).map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectBlock(block.id);
            }}
            className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-secondary ${block.settings.highlighted ? "bg-surface-secondary/60" : ""} ${selectedBlockId === block.id ? "outline outline-2 outline-info outline-offset-[-2px]" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${colors.primary}1a`, color: colors.primary }}>
                {text(block.settings.tag, "")}
              </span>
              <span className="truncate text-[14px] font-semibold">{text(block.settings.title, "Case study")}</span>
            </span>
            <span aria-hidden="true" className="shrink-0 opacity-40">→</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CardGridSection({ colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  const columns = roles.columns ? toPositiveInt(s[roles.columns.id]) : undefined;
  return (
    <section className={`px-6 py-14 md:px-10 md:py-20 ${ring}`}>
      <div className="mx-auto max-w-5xl">
        {roles.eyebrow ? (
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: colors.primary }}>
            {text(s[roles.eyebrow.id], "")}
          </p>
        ) : null}
        {roles.heading ? <h2 className="mt-2 text-3xl font-bold md:text-4xl">{text(s[roles.heading.id], "")}</h2> : null}
      </div>
      <div className={`mx-auto mt-8 grid max-w-5xl gap-5 ${(columns ?? blocks.length) >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
        {blocks.slice(0, 9).map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectBlock(block.id);
            }}
            className={`grid overflow-hidden rounded-xl border bg-white text-left shadow-sm shadow-slate-950/5 transition-shadow hover:shadow-md ${selectedBlockId === block.id ? "outline outline-2 outline-info outline-offset-[-2px]" : ""}`}
          >
            <ImagePlaceholder aspect="16 / 10" />
            <div className="grid gap-1.5 p-4">
              <span className="flex items-center gap-2 text-[11px] font-medium opacity-60">
                <span className="rounded-full px-2 py-0.5 font-semibold" style={{ backgroundColor: `${colors.primary}1a`, color: colors.primary }}>
                  {text(block.settings.tag, "")}
                </span>
                {block.settings.date ? <span>{text(block.settings.date, "")}</span> : null}
              </span>
              <h3 className="text-[14px] font-bold leading-5">{text(block.settings.title, "Card title")}</h3>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TestimonialShowcaseSection({ colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  const testimonial = blocks.find((block) => block.type === "testimonial") ?? blocks[0];
  const rating = Number(s.ratingValue ?? 0);
  return (
    <section className={`px-6 py-14 md:px-10 md:py-20 ${ring}`}>
      <SectionHeading
        colors={colors}
        heading={text(roles.heading ? s[roles.heading.id] : undefined, schema.name)}
        {...(roles.eyebrow ? { eyebrow: text(s[roles.eyebrow.id], "") } : {})}
        {...(roles.description ? { description: text(s[roles.description.id], "") } : {})}
      />
      {rating ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-[12.5px] font-medium opacity-70">
          <span className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="size-3.5" style={{ color: colors.primary, fill: index < Math.round(rating) ? colors.primary : "transparent" }} />
            ))}
          </span>
          {text(s.ratingValue, "")} · {text(s.reviewCount, "")} reviews
        </p>
      ) : null}
      {testimonial ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectBlock(testimonial.id);
          }}
          className={`mx-auto mt-8 grid max-w-xl gap-4 rounded-2xl p-8 text-left ${selectedBlockId === testimonial.id ? "outline outline-2 outline-info outline-offset-[-2px]" : ""}`}
          style={{ backgroundColor: colors.dark, color: "#fff" }}
        >
          <p className="text-[17px] font-medium leading-7">&ldquo;{text(testimonial.settings.quote, "A great experience working with this team.")}&rdquo;</p>
          <span className="flex items-center gap-3">
            <span className="size-9 shrink-0 rounded-full bg-white/15" />
            <span>
              <span className="block text-[13px] font-semibold">{text(testimonial.settings.name, "Client name")}</span>
              <span className="block text-[11.5px] opacity-60">{text(testimonial.settings.role, "")}</span>
            </span>
          </span>
        </button>
      ) : null}
      {blocks.filter((block) => block.type !== "testimonial").length ? (
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-3">
          {blocks
            .filter((block) => block.type !== "testimonial")
            .slice(0, 4)
            .map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBlock(block.id);
                }}
                className={`size-16 shrink-0 overflow-hidden rounded-lg ${selectedBlockId === block.id ? "outline outline-2 outline-info" : ""}`}
              >
                <ImagePlaceholder aspect="1 / 1" />
              </button>
            ))}
        </div>
      ) : null}
    </section>
  );
}

function MissionSplitSection({ colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps) {
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  return (
    <section className={`px-6 py-14 md:px-10 md:py-20 ${ring}`}>
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">{text(s.missionTitle, "Our Mission")}</h2>
          <p className="mt-3 text-[14px] leading-6 opacity-70">{text(s.missionDescription, "")}</p>
        </div>
        <div className="grid gap-4">
          <ImagePlaceholder aspect="4 / 3" rounded="rounded-xl" />
          <h3 className="text-lg font-bold">{text(s.visionTitle, "Our Vision")}</h3>
          <ul className="grid gap-2">
            {blocks.slice(0, 6).map((block) => (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBlock(block.id);
                  }}
                  className={`flex items-center gap-2 rounded px-1 text-left text-[13px] font-medium ${selectedBlockId === block.id ? "outline outline-1 outline-info" : ""}`}
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: colors.primary }} />
                  {text(block.settings.text, "Bullet point")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CtaBannerSection({ buttonStyle, colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps & { buttonStyle: ButtonStyle }) {
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  return (
    <section className={`px-6 py-16 text-center md:px-10 md:py-24 ${ring}`}>
      <div className="mx-auto max-w-2xl">
        {blocks.length ? (
          <div className="mx-auto mb-5 flex w-max -space-x-2">
            {blocks.slice(0, 4).map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBlock(block.id);
                }}
                className={`size-9 shrink-0 rounded-full border-2 border-white bg-surface-secondary ${selectedBlockId === block.id ? "outline outline-2 outline-info" : ""}`}
              />
            ))}
          </div>
        ) : null}
        {s.avatarLabel ? <p className="text-[12.5px] font-medium opacity-60">{text(s.avatarLabel, "")}</p> : null}
        <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{text(s.heading, schema.name)}</h2>
        {s.description ? <p className="mt-3 text-[14px] leading-6 opacity-70">{text(s.description, "")}</p> : null}
        <ButtonPreview buttonStyle={buttonStyle} colors={colors} className="mt-6">
          {text(s.buttonLabel, "Get started")}
        </ButtonPreview>
      </div>
    </section>
  );
}

function LocationCardSection({ colors: _colors, onSelectBlock: _onSelectBlock, ring, schema: _schema, section }: ContentSectionProps) {
  const s = section.settings;
  return (
    <section className={`px-6 py-14 md:px-10 ${ring}`}>
      <div className="mx-auto grid max-w-3xl gap-0 overflow-hidden rounded-2xl border sm:grid-cols-2">
        <ImagePlaceholder aspect="4 / 3" />
        <div className="grid content-center gap-2 p-6">
          <h3 className="text-lg font-bold leading-6">{text(s.title, "Our office")}</h3>
          <p className="whitespace-pre-line text-[13px] leading-6 opacity-70">{text(s.address, "")}</p>
          {s.email ? <p className="text-[13px] font-medium">{text(s.email, "")}</p> : null}
        </div>
      </div>
    </section>
  );
}

function ContactFormSection({ buttonStyle, colors, onSelectBlock, ring, schema, section, selectedBlockId }: ContentSectionProps & { buttonStyle: ButtonStyle }) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  const hasImage = Boolean(roles.image);
  return (
    <section className={`px-6 py-14 md:px-10 md:py-20 ${ring}`}>
      <div className={`mx-auto grid max-w-5xl gap-10 ${hasImage ? "lg:grid-cols-2" : ""}`}>
        <div>
          <h2 className="text-3xl font-bold leading-tight md:text-4xl">{text(roles.heading ? s[roles.heading.id] : undefined, schema.name)}</h2>
          {roles.description ? <p className="mt-3 text-[14px] leading-6 opacity-70">{text(s[roles.description.id], "")}</p> : null}
          {blocks.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {blocks.slice(0, 8).map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBlock(block.id);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium ${selectedBlockId === block.id ? "outline outline-2 outline-info" : ""}`}
                >
                  {text(block.settings.label, "Option")}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-6 grid max-w-sm gap-3">
            <span className="h-11 rounded-lg border bg-white" />
            <span className="h-11 rounded-lg border bg-white" />
            <span className="h-24 rounded-lg border bg-white" />
            <ButtonPreview buttonStyle={buttonStyle} colors={colors} className="w-max">
              {text(s.submitLabel, "Submit")}
            </ButtonPreview>
          </div>
        </div>
        {hasImage ? <ImagePlaceholder aspect="4 / 5" rounded="rounded-2xl" /> : null}
      </div>
    </section>
  );
}

function AnnouncementBar({ colors, ring, schema, section }: { colors: PreviewColors; ring: string; schema: SectionSchema; section: SectionInstance }) {
  const roles = extractFieldRoles(schema.settings);
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  const firstBlockText = blocks[0] ? Object.values(blocks[0].settings).find((value) => typeof value === "string" && value) : undefined;
  const message = firstBlockText ?? (roles.heading ? section.settings[roles.heading.id] : undefined) ?? (roles.description ? section.settings[roles.description.id] : undefined);
  return (
    <section className={`px-6 py-2.5 text-center text-[13px] font-semibold text-white ${ring}`} style={{ backgroundColor: colors.dark }}>
      {text(message, "Welcome to our store")}
    </section>
  );
}

function HeaderNav({
  colors,
  onSelectBlock,
  ring,
  schema,
  section,
  selectedBlockId,
  websiteName,
}: {
  colors: PreviewColors;
  onSelectBlock: (blockId: string) => void;
  ring: string;
  schema: SectionSchema;
  section: SectionInstance;
  selectedBlockId: string | null;
  websiteName: string;
}) {
  const roles = extractFieldRoles(schema.settings);
  const logoField = schema.settings.find((setting) => /logo/i.test(setting.id) || /logo/i.test(setting.label));
  const logoText = logoField ? section.settings[logoField.id] : undefined;
  const phoneField = schema.settings.find((setting) => setting.type === "text" && /phone/i.test(setting.id));
  const phone = phoneField ? text(section.settings[phoneField.id], "") : "";
  const cta = roles.buttons[0];
  const ctaLabel = cta?.labelField ? text(section.settings[cta.labelField.id], "") : "";
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  return (
    <header className={`sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white/95 px-6 py-4 backdrop-blur ${ring}`}>
      <strong className="shrink-0 text-[15px]">{text(logoText, websiteName)}</strong>
      {blocks.length ? (
        <nav className="hidden flex-wrap items-center justify-center gap-4 text-[13px] md:flex">
          {blocks.slice(0, 8).map((block) => {
            const blockRoles = extractFieldRoles(schema.blocks?.[0]?.settings ?? []);
            const labelValue = blockRoles.heading ? block.settings[blockRoles.heading.id] : Object.values(block.settings).find((value) => typeof value === "string");
            return (
              <button
                key={block.id}
                type="button"
                className={`rounded px-1.5 py-0.5 transition-colors hover:bg-muted ${selectedBlockId === block.id ? "outline outline-1 outline-info" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBlock(block.id);
                }}
              >
                {text(labelValue, "Menu")}
              </button>
            );
          })}
        </nav>
      ) : null}
      <div className="flex shrink-0 items-center gap-3">
        {phone ? <span className="hidden text-[12.5px] font-medium opacity-70 lg:inline">{phone}</span> : null}
        {ctaLabel ? (
          <span className="hidden sm:inline-flex items-center rounded-full px-4 py-2 text-[12.5px] font-semibold text-white" style={{ backgroundColor: colors.primary }}>
            {ctaLabel}
          </span>
        ) : (
          <span className="hidden shrink-0 size-8 place-items-center rounded-full sm:grid" style={{ backgroundColor: `${colors.primary}1a`, color: colors.primary }} aria-hidden="true">
            •
          </span>
        )}
      </div>
    </header>
  );
}

function FooterSection({
  colors,
  onSelectBlock,
  ring,
  schema,
  section,
  selectedBlockId,
  websiteName,
}: {
  colors: PreviewColors;
  onSelectBlock: (blockId: string) => void;
  ring: string;
  schema: SectionSchema;
  section: SectionInstance;
  selectedBlockId: string | null;
  websiteName: string;
}) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const styleField = schema.settings.find((setting) => setting.type === "select" && /style/i.test(setting.id));
  const isLight = styleField ? s[styleField.id] === "light" : false;
  const showNewsletterField = schema.settings.find((setting) => setting.type === "boolean" && /newsletter/i.test(setting.id));
  const showNewsletter = showNewsletterField ? Boolean(s[showNewsletterField.id] ?? showNewsletterField.default) : Boolean(roles.description);
  const placeholderField = schema.settings.find((setting) => setting.type === "text" && /placeholder/i.test(setting.id));
  const emailField = schema.settings.find((setting) => setting.type === "text" && /^email$/i.test(setting.id));
  const phoneField = schema.settings.find((setting) => setting.type === "text" && /phone/i.test(setting.id));
  const creditField = schema.settings.find((setting) => setting.type === "text" && /credit/i.test(setting.id));
  const contactLine = [emailField ? text(s[emailField.id], "") : "", phoneField ? text(s[phoneField.id], "") : ""].filter(Boolean);
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  const linkColumns = blocks.filter((block) => /link.?column|column/i.test(block.type));
  const socialLinks = blocks.filter((block) => /social/i.test(block.type));
  const background = isLight ? colors.surface : colors.dark;
  const foreground = isLight ? colors.text : "#ffffff";

  return (
    <footer className={`px-6 py-12 ${ring}`} style={{ backgroundColor: background, color: foreground }}>
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.1fr_repeat(auto-fit,minmax(120px,1fr))]">
        <div>
          <h2 className="text-2xl font-bold leading-tight">{text(roles.heading ? s[roles.heading.id] : undefined, websiteName)}</h2>
          {roles.description ? <p className="mt-2 max-w-sm text-[13px] opacity-75">{text(s[roles.description.id], "")}</p> : null}
          {showNewsletter ? (
            <div className="mt-4 flex max-w-xs items-center justify-between gap-2 rounded-full border px-4 py-2.5 opacity-90">
              <span className="text-[12.5px] opacity-70">{text(placeholderField ? s[placeholderField.id] : undefined, "Email address")}</span>
              <span aria-hidden="true">→</span>
            </div>
          ) : null}
          {contactLine.length ? <p className="mt-4 text-[12.5px] opacity-70">{contactLine.join(" · ")}</p> : null}
        </div>
        {linkColumns.slice(0, 4).map((block) => {
          const blockRoles = extractFieldRoles(schema.blocks?.find((item) => item.type === block.type)?.settings ?? []);
          const headingValue = blockRoles.heading ? block.settings[blockRoles.heading.id] : undefined;
          const linksField = schema.blocks?.find((item) => item.type === block.type)?.settings.find((setting) => setting.type === "textarea");
          const links = linksField ? parseLabelUrlLines(text(block.settings[linksField.id], "")) : [];
          return (
            <button
              key={block.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectBlock(block.id);
              }}
              className={`grid content-start gap-2.5 rounded p-1 text-left text-[12.5px] opacity-90 hover:bg-white/5 ${selectedBlockId === block.id ? "outline outline-1 outline-info" : ""}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{text(headingValue, "Links")}</span>
              {links.slice(0, 5).map((link, index) => (
                <span key={index} className="opacity-85">{link.label}</span>
              ))}
            </button>
          );
        })}
      </div>
      <div className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t pt-5 text-[11px] opacity-60" style={{ borderColor: isLight ? undefined : "rgba(255,255,255,0.15)" }}>
        <span>{text(creditField ? s[creditField.id] : undefined, `© ${websiteName}`)}</span>
        {socialLinks.length ? (
          <span className="flex items-center gap-3">
            {socialLinks.slice(0, 6).map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBlock(block.id);
                }}
                className={`rounded px-1 uppercase tracking-wide hover:opacity-100 ${selectedBlockId === block.id ? "outline outline-1 outline-info" : ""}`}
              >
                {text(block.settings.icon, block.type)}
              </button>
            ))}
          </span>
        ) : null}
      </div>
    </footer>
  );
}

function parseLabelUrlLines(value: string): Array<{ label: string; href: string }> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("##"))
    .map((line) => {
      const [label, href] = line.split("|");
      return { label: (label ?? line).trim(), href: (href ?? "#").trim() };
    });
}

function GenericContentSection({
  buttonStyle,
  colors,
  onSelectBlock,
  pageLabel,
  ring,
  schema,
  section,
  selectedBlockId,
}: {
  buttonStyle: ButtonStyle;
  colors: PreviewColors;
  onSelectBlock: (blockId: string) => void;
  pageLabel: string;
  ring: string;
  schema: SectionSchema;
  section: SectionInstance;
  selectedBlockId: string | null;
}) {
  const roles = extractFieldRoles(schema.settings);
  const s = section.settings;
  const eyebrow = roles.eyebrow ? text(s[roles.eyebrow.id], "") : "";
  const heading = roles.heading ? text(s[roles.heading.id], schema.name) : schema.name;
  const emphasis = roles.emphasis ? text(s[roles.emphasis.id], "") : "";
  const description = roles.description ? text(s[roles.description.id], "") : "";
  const hasImage = Boolean(roles.image);
  const isOverlay = roles.layout ? s[roles.layout.id] === "overlay" : false;
  const isCentered = roles.alignment ? s[roles.alignment.id] === "center" : !hasImage;
  const imageOnLeft = roles.imagePosition ? s[roles.imagePosition.id] === "left" : false;
  const backgroundColor = roles.backgroundColor ? text(s[roles.backgroundColor.id], "") : "";
  const blocks = section.blocks.length ? section.blocks : createBlocks(schema);
  const blockSchema = schema.blocks?.[0];
  const visibleLimit = roles.visibleCount ? toPositiveInt(s[roles.visibleCount.id] ?? roles.visibleCount.default) : undefined;
  const columnsOverride = roles.columns ? toPositiveInt(s[roles.columns.id] ?? roles.columns.default) : undefined;

  const textBlock = (
    <div className={isCentered ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      {eyebrow ? (
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: colors.primary }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
        {heading === schema.name && !emphasis ? pageLabel : heading}
        {emphasis ? (
          <>
            {" "}
            <span style={{ color: colors.primary }}>{emphasis}</span>
          </>
        ) : null}
      </h2>
      {description ? <p className="mt-4 text-[14px] leading-6 opacity-70">{description}</p> : null}
      <ButtonRow buttonStyle={buttonStyle} colors={colors} roles={roles} values={s} justify={isCentered ? "center" : "start"} />
    </div>
  );

  const imageBlock = hasImage ? (
    <div className="flex min-h-64 flex-1 items-center justify-center rounded-xl border bg-surface-secondary text-muted-foreground">
      <ImageIcon className="size-8 opacity-40" />
    </div>
  ) : null;

  return (
    <section
      className={`px-6 py-14 md:px-10 md:py-20 ${ring}`}
      style={backgroundColor ? { backgroundColor } : isOverlay ? { backgroundColor: colors.dark, color: "#fff" } : undefined}
    >
      {hasImage && !isOverlay ? (
        <div className={`mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row ${imageOnLeft ? "lg:flex-row-reverse" : ""}`}>
          <div className="flex-1">{textBlock}</div>
          {imageBlock}
        </div>
      ) : (
        <div className="mx-auto max-w-5xl">{textBlock}</div>
      )}

      {blocks.length && blockSchema ? (
        <BlockGrid
          blockSchema={blockSchema}
          blocks={blocks}
          colors={colors}
          columnsOverride={columnsOverride}
          onSelectBlock={onSelectBlock}
          selectedBlockId={selectedBlockId}
          visibleLimit={visibleLimit}
        />
      ) : null}
    </section>
  );
}

function ButtonRow({
  buttonStyle,
  colors,
  justify,
  roles,
  values,
}: {
  buttonStyle: ButtonStyle;
  colors: PreviewColors;
  justify: "center" | "start";
  roles: FieldRoles;
  values: Record<string, unknown>;
}) {
  if (!roles.buttons.length) return null;
  return (
    <div className={`mt-6 flex flex-wrap gap-3 ${justify === "center" ? "justify-center" : ""}`}>
      {roles.buttons.slice(0, 2).map((button, index) => {
        const label = button.labelField ? text(values[button.labelField.id], "") : "";
        if (!label && !values[button.linkField.id]) return null;
        return (
          <ButtonPreview key={button.linkField.id} buttonStyle={buttonStyle} colors={colors} outline={index > 0}>
            {text(label, index === 0 ? "Learn more" : "View more")}
          </ButtonPreview>
        );
      })}
    </div>
  );
}

function ButtonPreview({ buttonStyle, children, className, colors, outline }: { buttonStyle: ButtonStyle; children?: ReactNode; className?: string; colors: PreviewColors; outline?: boolean }) {
  const solid = buttonStyle.variant === "solid" && !outline;
  return (
    <span
      className={`inline-flex items-center px-5 py-2.5 text-[13px] font-semibold ${className ?? ""}`}
      style={{
        borderRadius: buttonStyle.radius,
        backgroundColor: solid ? colors.primary : "transparent",
        color: solid ? "#fff" : colors.primary,
        border: solid ? "none" : `1.5px solid ${colors.primary}`,
      }}
    >
      {children}
    </span>
  );
}

function BlockGrid({
  blockSchema,
  blocks,
  colors,
  columnsOverride,
  onSelectBlock,
  selectedBlockId,
  visibleLimit,
}: {
  blockSchema: NonNullable<SectionSchema["blocks"]>[number];
  blocks: SectionBlock[];
  colors: PreviewColors;
  columnsOverride: number | undefined;
  onSelectBlock: (blockId: string) => void;
  selectedBlockId: string | null;
  visibleLimit: number | undefined;
}) {
  const roles = extractFieldRoles(blockSchema.settings);
  const visible = blocks.slice(0, Math.min(visibleLimit ?? 8, 8));
  const columnCount = columnsOverride ?? visible.length;
  const columns = columnCount >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columnCount === 3 ? "sm:grid-cols-3" : columnCount === 2 ? "sm:grid-cols-2" : "";
  return (
    <div className={`mx-auto mt-10 grid max-w-5xl gap-4 ${columns}`}>
      {visible.map((block, index) => {
        const title = roles.heading ? text(block.settings[roles.heading.id], "") : roles.name ? text(block.settings[roles.name.id], "") : "";
        const body = roles.description ? text(block.settings[roles.description.id], "") : "";
        const badge = roles.badge ? text(block.settings[roles.badge.id], "") : "";
        const roleLine = roles.role ? text(block.settings[roles.role.id], "") : "";
        const rating = roles.rating ? Number(block.settings[roles.rating.id] ?? 0) : 0;
        return (
          <button
            key={block.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectBlock(block.id);
            }}
            className={`grid gap-2 overflow-hidden rounded-xl border bg-white text-left shadow-sm shadow-slate-950/5 transition-shadow hover:shadow-md ${selectedBlockId === block.id ? "outline outline-2 outline-info outline-offset-[-2px]" : ""}`}
          >
            {roles.image ? <ImagePlaceholder aspect="4 / 3" /> : null}
            <div className="grid gap-2 p-4">
              {badge ? (
                <span className="text-[12px] font-bold" style={{ color: colors.primary }}>
                  {badge}
                </span>
              ) : roles.icon ? (
                <span className="grid size-8 place-items-center rounded-lg text-[13px] font-bold" style={{ backgroundColor: `${colors.primary}1a`, color: colors.primary }}>
                  {index + 1}
                </span>
              ) : null}
              {title ? <h3 className="text-[14px] font-bold leading-5">{title}</h3> : null}
              {roleLine ? <p className="text-[11px] font-medium opacity-60">{roleLine}</p> : null}
              {rating ? (
                <span className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star key={starIndex} className="size-3" style={{ color: colors.primary, fill: starIndex < rating ? colors.primary : "transparent" }} />
                  ))}
                </span>
              ) : null}
              {body ? <p className="text-[12.5px] leading-5 opacity-65">{body}</p> : !title && !roleLine ? <p className="text-[12.5px] leading-5 opacity-65">{blockSchema.name}</p> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ImagePlaceholder({ aspect, rounded }: { aspect: string; rounded?: string }) {
  return (
    <div className={`flex w-full items-center justify-center bg-surface-secondary text-muted-foreground ${rounded ?? ""}`} style={{ aspectRatio: aspect }}>
      <ImageIcon className="size-6 opacity-40" />
    </div>
  );
}

function text(value: unknown, fallback: string) {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function toPositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

export function getPreviewColors(settings: Record<string, unknown>) {
  return {
    primary: String(getNestedValue(settings, "colorPrimary") ?? getNestedValue(settings, "global.primaryColor") ?? "#111827"),
    background: String(getNestedValue(settings, "colorBackground") ?? getNestedValue(settings, "global.background") ?? "#ffffff"),
    surface: String(getNestedValue(settings, "colorSurface") ?? "#ffffff"),
    dark: String(getNestedValue(settings, "colorDark") ?? "#111827"),
    text: String(getNestedValue(settings, "colorText") ?? getNestedValue(settings, "global.text") ?? "#111827"),
  };
}

export function getButtonStyle(settings: Record<string, unknown>) {
  const radiusValue = getNestedValue(settings, "buttonRadius");
  const variant = String(getNestedValue(settings, "buttonStyle") ?? "solid") === "outline" ? "outline" : "solid";
  return {
    radius: typeof radiusValue === "number" ? `${radiusValue}px` : "8px",
    variant: variant as "solid" | "outline",
  };
}
