/**
 * Expands `[form id="..."]` tokens found anywhere in a theme's customizer settings (in practice,
 * a Custom Code/Custom HTML block's freeform content — see ontech-universal-zip's CustomCode
 * section) into a real, working `<form>` — generated server-side once per request, before the
 * theme ever sees the settings, since a theme's own section component just does
 * `dangerouslySetInnerHTML` on whatever string it's given and can't host a live React widget.
 *
 * The generated form posts natively (no JS — dangerouslySetInnerHTML never executes injected
 * <script> tags anyway) to the public submit endpoint; a CSS `:target` swap shows a thank-you
 * message after the API redirects back with a `#lead-form-thanks-{formId}` hash. See
 * forms.controller.ts's PublicFormsController.submitForm for the redirect side of this.
 */

interface PublicFormField {
  id: string;
  type: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  acceptedFileTypes?: string;
  rows?: number;
}

interface PublicForm {
  id: string;
  name: string;
  fields: PublicFormField[];
}

const FORM_SHORTCODE_PATTERN = /\[form\s+id=["']([0-9a-fA-F-]{36})["']\s*\]/g;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TEXT_LIKE_TYPES = new Set(["text", "email", "url", "tel", "password", "search", "date", "time", "datetime-local", "month", "week", "hidden"]);
const BUTTON_TYPES = new Set(["submit", "reset", "button"]);

function renderFieldHtml(field: PublicFormField): string {
  const commonAttrs = [
    field.required ? "required" : "",
    field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : "",
    field.pattern ? `pattern="${escapeHtml(field.pattern)}"` : "",
    field.minLength !== undefined ? `minlength="${field.minLength}"` : "",
    field.maxLength !== undefined ? `maxlength="${field.maxLength}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wrap = (control: string) => `
    <div class="lead-form__field">
      <label class="lead-form__label" for="lead-form-${escapeHtml(field.id)}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
      ${control}
      ${field.helpText ? `<p class="lead-form__hint">${escapeHtml(field.helpText)}</p>` : ""}
    </div>`;

  if (field.type === "hidden") {
    return `<input type="hidden" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" value="${escapeHtml(field.defaultValue)}" />`;
  }

  if (TEXT_LIKE_TYPES.has(field.type)) {
    return wrap(`<input class="lead-form__input" type="${escapeHtml(field.type)}" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" value="${escapeHtml(field.defaultValue)}" ${commonAttrs} />`);
  }

  if (field.type === "number" || field.type === "range") {
    const rangeAttrs = [field.min !== undefined ? `min="${field.min}"` : "", field.max !== undefined ? `max="${field.max}"` : "", field.step !== undefined ? `step="${field.step}"` : ""].filter(Boolean).join(" ");
    return wrap(`<input class="lead-form__input" type="${field.type}" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" value="${escapeHtml(field.defaultValue)}" ${rangeAttrs} ${commonAttrs} />`);
  }

  if (field.type === "textarea") {
    return wrap(`<textarea class="lead-form__input" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" rows="${field.rows ?? 4}" ${commonAttrs}>${escapeHtml(field.defaultValue)}</textarea>`);
  }

  if (field.type === "select") {
    const options = (field.options ?? []).map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === field.defaultValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
    return wrap(`<select class="lead-form__input" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" ${field.required ? "required" : ""}><option value="">Select...</option>${options}</select>`);
  }

  if (field.type === "radio") {
    const options = (field.options ?? [])
      .map(
        (option, index) => `
      <label class="lead-form__choice">
        <input type="radio" name="${escapeHtml(field.name)}" value="${escapeHtml(option.value)}" ${index === 0 && field.required ? "required" : ""} />
        ${escapeHtml(option.label)}
      </label>`,
      )
      .join("");
    return wrap(`<div class="lead-form__choices">${options}</div>`);
  }

  if (field.type === "checkbox") {
    const options = (field.options ?? []).map((option) => `
      <label class="lead-form__choice">
        <input type="checkbox" name="${escapeHtml(field.name)}[]" value="${escapeHtml(option.value)}" />
        ${escapeHtml(option.label)}
      </label>`).join("");
    return wrap(`<div class="lead-form__choices">${options}</div>`);
  }

  if (field.type === "acceptance") {
    return wrap(`
      <label class="lead-form__choice">
        <input type="checkbox" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" value="true" ${field.required ? "required" : ""} />
        ${escapeHtml(field.helpText || field.label)}
      </label>`);
  }

  if (field.type === "quiz") {
    return wrap(`<input class="lead-form__input" type="text" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" ${commonAttrs} />`);
  }

  if (field.type === "file") {
    // Native form posts here are urlencoded, not multipart (no public upload pipeline exists yet)
    // — the browser silently drops file inputs from an urlencoded submission, so every OTHER
    // field still submits fine; only the file itself is not received.
    return wrap(`<input class="lead-form__input" type="file" id="lead-form-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" ${field.acceptedFileTypes ? `accept="${escapeHtml(field.acceptedFileTypes)}"` : ""} />`);
  }

  if (BUTTON_TYPES.has(field.type)) {
    return `<button class="lead-form__button" type="${field.type === "button" ? "button" : field.type}">${escapeHtml(field.label)}</button>`;
  }

  return "";
}

function renderFormHtml(form: PublicForm, apiBaseUrl: string): string {
  const hasSubmitButton = form.fields.some((field) => field.type === "submit");
  const fieldsHtml = form.fields.map(renderFieldHtml).join("\n");
  const submitButton = hasSubmitButton ? "" : `<button class="lead-form__button" type="submit">Submit</button>`;

  return `
<div class="lead-form-shortcode" id="lead-form-shortcode-${form.id}">
  <div id="lead-form-thanks-${form.id}" class="lead-form-thanks">
    <p>Thanks — your message has been received.</p>
  </div>
  <form class="lead-form" action="${escapeHtml(apiBaseUrl)}/public/forms/${form.id}/submit" method="post">
    ${fieldsHtml}
    ${submitButton}
  </form>
  <style>
    #lead-form-thanks-${form.id} { display: none; padding: 16px; border-radius: 8px; background: #ecfdf5; color: #065f46; margin-bottom: 12px; }
    #lead-form-thanks-${form.id}:target { display: block; }
    #lead-form-thanks-${form.id}:target ~ .lead-form { display: none; }
    #lead-form-shortcode-${form.id} .lead-form__field { margin-bottom: 12px; }
    #lead-form-shortcode-${form.id} .lead-form__label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
    #lead-form-shortcode-${form.id} .lead-form__input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font: inherit; }
    #lead-form-shortcode-${form.id} .lead-form__hint { font-size: 12px; color: #6b7280; margin-top: 4px; }
    #lead-form-shortcode-${form.id} .lead-form__choices { display: grid; gap: 4px; }
    #lead-form-shortcode-${form.id} .lead-form__choice { font-size: 13px; display: flex; align-items: center; gap: 6px; }
    #lead-form-shortcode-${form.id} .lead-form__button { padding: 9px 18px; border-radius: 6px; border: none; background: #111827; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  </style>
</div>`;
}

async function fetchPublicForm(formId: string, internalApiBaseUrl: string): Promise<PublicForm | null> {
  try {
    const response = await fetch(`${internalApiBaseUrl}/public/forms/${formId}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as PublicForm;
  } catch {
    return null;
  }
}

async function replaceFormShortcodes(text: string, internalApiBaseUrl: string, publicApiBaseUrl: string, cache: Map<string, string>): Promise<string> {
  const matches = [...text.matchAll(FORM_SHORTCODE_PATTERN)];
  if (!matches.length) return text;

  let result = text;
  for (const match of matches) {
    const [token, formId] = match;
    if (!formId) continue;
    let html = cache.get(formId);
    if (html === undefined) {
      const form = await fetchPublicForm(formId, internalApiBaseUrl);
      html = form ? renderFormHtml(form, publicApiBaseUrl) : `<p class="lead-form-error">This form is no longer available.</p>`;
      cache.set(formId, html);
    }
    result = result.replace(token, html);
  }
  return result;
}

/** Recursively walks any settings shape (nested customizer.pages / customizer.global sections and blocks) and expands form shortcodes in every string it finds. */
export async function expandFormShortcodes(value: unknown, internalApiBaseUrl: string, publicApiBaseUrl: string, cache: Map<string, string> = new Map()): Promise<unknown> {
  if (typeof value === "string") {
    if (!value.includes("[form ")) return value;
    return replaceFormShortcodes(value, internalApiBaseUrl, publicApiBaseUrl, cache);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => expandFormShortcodes(item, internalApiBaseUrl, publicApiBaseUrl, cache)));
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, val]) => [key, await expandFormShortcodes(val, internalApiBaseUrl, publicApiBaseUrl, cache)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}
