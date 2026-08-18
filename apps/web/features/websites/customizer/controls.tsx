"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Image as ImageIcon, X } from "lucide-react";
import { useRef } from "react";
import { Input } from "../../../components/ui/form";
import { cn } from "../../../lib/utils";
import type { SelectOption } from "./types";

function normalizeOption(option: SelectOption) {
  return typeof option === "string" ? { value: option, label: option } : option;
}

/**
 * Small option sets (layout: split/overlay, alignment: left/center, ...) read
 * far faster as a segmented control than a dropdown — this is what Shopify's
 * own editor uses for the same kind of field.
 */
export function SegmentedField({ onChange, options, value }: { onChange: (value: string) => void; options: SelectOption[]; value: string }) {
  const normalized = options.map(normalizeOption);
  return (
    <div role="radiogroup" className="inline-flex w-full rounded-md border border-input bg-surface-secondary p-0.5 shadow-sm shadow-slate-950/5">
      {normalized.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 truncate rounded-[5px] px-2 py-1.5 text-[12px] font-medium transition-colors",
              active ? "bg-surface text-foreground shadow-sm shadow-slate-950/10" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Larger option sets stay a dropdown, styled to match the rest of the panel instead of the OS default. */
export function SelectField({ onChange, options, placeholder, value }: { onChange: (value: string) => void; options: SelectOption[]; placeholder?: string; value: string }) {
  const normalized = options.map(normalizeOption);
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-2.5 text-[12.5px] text-foreground shadow-sm shadow-slate-950/5 outline-none transition-colors hover:border-muted-foreground/35 focus:border-foreground/30 focus:ring-2 focus:ring-ring/15 data-[placeholder]:text-muted-foreground">
        <SelectPrimitive.Value placeholder={placeholder ?? "Select…"} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={4} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-surface shadow-xl shadow-slate-950/10">
          <SelectPrimitive.Viewport className="p-1">
            {normalized.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-[12.5px] text-foreground outline-none data-[highlighted]:bg-surface-secondary"
              >
                <span className="absolute left-2 flex size-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function ColorField({ onChange, placeholder, value }: { onChange: (value: string) => void; placeholder?: string; value: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-2 rounded-md border border-input bg-surface p-1 pr-2.5 shadow-sm shadow-slate-950/5 focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/15">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Pick color"
        className="relative size-6 shrink-0 overflow-hidden rounded border bg-[image:repeating-conic-gradient(#e5e5e5_0_25%,transparent_0_50%)] bg-[length:8px_8px]"
      >
        <span className="absolute inset-0" style={{ backgroundColor: hex }} />
        <input ref={inputRef} type="color" value={hex} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </button>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "#000000"}
        className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] uppercase text-foreground outline-none placeholder:normal-case placeholder:text-muted-foreground"
      />
    </div>
  );
}

export function RangeField({
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: {
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ backgroundImage: `linear-gradient(to right, hsl(var(--foreground)) ${percent}%, hsl(var(--muted)) ${percent}%)` }}
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none",
          "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:shadow-slate-950/20",
          "[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:shadow",
          "[&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
        )}
      />
      <span className="w-14 shrink-0 text-right text-[11.5px] tabular text-muted-foreground">
        {value}
        {unit ?? ""}
      </span>
    </div>
  );
}

export type ImageFieldValue = { src: string; alt: string };

/**
 * Stores `{ src, alt }`, not a bare URL string — themes read image settings
 * through a helper that only recognizes an object with `.src` (see the
 * platform's ThemeImage type), so a plain string here was silently invisible
 * to every theme regardless of what was picked. The alt field also gives
 * every image a real accessibility name instead of none at all.
 */
export function ImageField({ onChange, value }: { onChange: (value: ImageFieldValue) => void; value: ImageFieldValue }) {
  const hasValue = Boolean(value.src.trim());
  return (
    <div className="grid gap-2">
      {hasValue ? (
        <div className="group relative overflow-hidden rounded-md border bg-surface-secondary">
          <img
            src={value.src}
            alt={value.alt}
            className="h-24 w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
          <button
            type="button"
            onClick={() => onChange({ src: "", alt: "" })}
            aria-label="Remove image"
            className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md bg-surface/90 text-muted-foreground opacity-0 shadow-sm shadow-slate-950/10 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-surface-secondary/50 text-muted-foreground">
          <ImageIcon className="size-5" />
          <span className="text-[11.5px]">No image selected</span>
        </div>
      )}
      <Input placeholder="Paste an image URL" value={value.src} onChange={(event) => onChange({ ...value, src: event.target.value })} />
      <Input placeholder="Alt text (for accessibility)" value={value.alt} onChange={(event) => onChange({ ...value, alt: event.target.value })} />
    </div>
  );
}
