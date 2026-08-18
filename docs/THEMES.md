# Website Themes

Website themes define reusable visual tokens for a single website. They sit between the website record and builder documents:

```text
Website
-> Theme
-> Builder Document
-> Node Styles
```

## Data Model

`WebsiteTheme` belongs to `Website`.

Fields:

- `id`
- `websiteId`
- `name`
- `tokens` JSONB
- `isActive`
- `createdAt`
- `updatedAt`

A partial unique database index permits only one active theme per website while still leaving room for future inactive theme versions.

## Token Structure

The active theme stores controlled JSON tokens:

- `colors`: semantic colors such as `primary`, `primaryForeground`, `secondary`, `background`, `foreground`, `muted`, `mutedForeground`, `border`, `success`, `warning`, and `danger`
- `typography`: `body`, `heading`, `small`, and `label`
- `spacing`: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
- `radius`: `none`, `sm`, `md`, `lg`, `xl`, `full`
- `shadows`: `none`, `sm`, `md`, `lg`
- `layout.container`: `narrow`, `content`, `wide`

The backend validates all theme updates. Colors must be hex values. Typography, radius, and shadows use controlled enums. Spacing and layout values use the existing safe builder length units.

## Token References

Builder styles can store explicit values or token references:

```json
{
  "backgroundColor": { "type": "token", "value": "colors.primary" }
}
```

Explicit legacy styles such as `"#111827"` remain valid. Token references are resolved centrally by `features/builder/schema/theme-resolver.ts`.

## Resolution Rules

Runtime style resolution:

1. Resolve responsive style block for viewport.
2. Resolve token references against the active website theme.
3. Fall back to default theme tokens if a theme is missing.
4. Convert the safe style block to React inline styles.

Local explicit node overrides win because they are stored directly on the node and do not depend on theme token values.

## Runtime And Editor

The runtime renderer accepts a loaded `WebsiteTheme`. The builder loads the theme once for the editor session and passes it to the canvas preview. Theme edits update local theme state immediately, so token-based nodes update without changing each node.

Theme saving is explicit through `PATCH /tenants/:tenantId/websites/:websiteId/theme`. Reset uses `POST /tenants/:tenantId/websites/:websiteId/theme/reset`.

## Default Theme

New websites create a default active theme. Existing websites without a theme receive one lazily when the theme API is read.

## Security

Theme values are not arbitrary CSS. The system rejects script-like CSS, JavaScript URLs, CSS expressions, arbitrary font-family strings, arbitrary shadows, and unknown token formats. Generated website rendering uses controlled style resolution, not dynamic Tailwind class interpolation.

## Backward Compatibility

Existing builder documents that store explicit colors, spacing, radius, shadow, and typography values continue rendering. No document migration is required.

## Future Extensibility

The JSONB theme model can support future theme versions, font providers, presets, imports, and responsive tokens without changing the builder document schema.
