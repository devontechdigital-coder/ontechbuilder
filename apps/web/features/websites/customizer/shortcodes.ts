import { apiRequest } from "../../../lib/api";
import { renderFormHtml, type PublicForm } from "../form-field-html";

/**
 * Client-side counterpart to apps/renderer/lib/theme-engine/shortcodes.ts — expands
 * `[form id="..."]` tokens (typed into a Custom Code/Custom HTML block's freeform content) into a
 * real `<form>` for the CUSTOMIZER'S own live iframe preview, so what a merchant sees while
 * editing matches what the public site will actually render, rather than showing the literal
 * shortcode text. Deliberately duplicated rather than imported across apps — same tradeoff as
 * every other vendored theme-engine file in this codebase (see render.tsx's own note on this).
 * The actual field-to-HTML rendering lives in ../form-field-html.ts, shared with the form
 * builder's own CSS-tab preview (both need the exact same markup/class names).
 */

const FORM_SHORTCODE_PATTERN = /\[form\s+id=["']([0-9a-fA-F-]{36})["']\s*\]/g;

async function fetchPublicForm(formId: string): Promise<PublicForm | null> {
  try {
    return await apiRequest<PublicForm>(`/public/forms/${formId}`);
  } catch {
    return null;
  }
}

async function replaceFormShortcodes(text: string, apiBaseUrl: string, cache: Map<string, string>): Promise<string> {
  const matches = [...text.matchAll(FORM_SHORTCODE_PATTERN)];
  if (!matches.length) return text;

  let result = text;
  for (const match of matches) {
    const [token, formId] = match;
    if (!formId) continue;
    let html = cache.get(formId);
    if (html === undefined) {
      const form = await fetchPublicForm(formId);
      html = form ? renderFormHtml(form, apiBaseUrl) : `<p class="lead-form-error">This form is no longer available.</p>`;
      cache.set(formId, html);
    }
    result = result.replace(token, html);
  }
  return result;
}

/** Recursively walks any settings/groups shape and expands form shortcodes in every string it finds. */
export async function expandFormShortcodes(value: unknown, apiBaseUrl: string, cache: Map<string, string>): Promise<unknown> {
  if (typeof value === "string") {
    if (!value.includes("[form ")) return value;
    return replaceFormShortcodes(value, apiBaseUrl, cache);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => expandFormShortcodes(item, apiBaseUrl, cache)));
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, val]) => [key, await expandFormShortcodes(val, apiBaseUrl, cache)] as const));
    return Object.fromEntries(entries);
  }
  return value;
}
