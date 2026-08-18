# Visual Builder Foundation

> **Status: retired on the web app.** The `features/builder/**` node-tree
> editor and its `app/builder/pages/[pageId]` shell described below have been
> removed. That route now resolves the page's website + current theme
> installation and hands off to the theme customizer
> (`features/websites/customizer`, `app/websites/[id]/themes/[themeId]/customize`)
> with the page preselected — pages no longer carry their own separate
> document. The `apps/api/src/content/builder` persistence endpoints this
> doc describes still exist untouched; this file is kept for that API
> reference and as a historical record of the retired schema.

The builder foundation is a structured document editor for page versions. It is intentionally small and does not implement a complete production builder.

## Architecture

Builder code is separated by concern:

- `features/builder/schema`: document types, default document, validation helpers
- `features/builder/registry`: node registry and allowed children
- `features/builder/renderer`: runtime-safe React renderer
- `features/builder/state`: document mutations, undo, redo
- `app/builder/pages/[pageId]`: editor shell
- `apps/api/src/content/builder`: authenticated save/load APIs and server validation

The CMS remains separate. CMS manages structured content. Builder manages visual page composition.

## Document Schema

Builder documents are JSON data stored inside the existing `PageVersion.content` JSONB field.

Example:

```json
{
  "kind": "builderDocument",
  "revision": 1,
  "document": {
    "schemaVersion": 1,
    "rootNodeId": "root",
    "nodes": {
      "root": {
        "id": "root",
        "type": "root",
        "children": ["section-1"]
      },
      "section-1": {
        "id": "section-1",
        "type": "section",
        "children": ["container-1"],
        "styles": {
          "base": {
            "padding": {
              "top": "48px",
              "right": "24px",
              "bottom": "48px",
              "left": "24px"
            },
            "backgroundColor": "#ffffff"
          },
          "tablet": {
            "padding": {
              "top": "40px",
              "right": "20px",
              "bottom": "40px",
              "left": "20px"
            }
          },
          "mobile": {
            "padding": {
              "top": "32px",
              "right": "16px",
              "bottom": "32px",
              "left": "16px"
            }
          }
        }
      }
    },
    "metadata": {
      "viewportDefaults": ["desktop", "tablet", "mobile"]
    }
  }
}
```

Rendered HTML is not the source of truth. User-provided React code and JavaScript are not supported.

## Node Types

Initial supported nodes:

- `section`
- `container`
- `heading`
- `text`
- `image`
- `button`

`root` is a system node.

Allowed children:

- `root` -> `section`
- `section` -> `container`
- `container` -> `heading`, `text`, `image`, `button`
- content nodes -> no children

## Node Registry

The node registry defines:

- display name
- category
- allowed children
- default props
- default styles
- editable property definitions

The editor reads this registry for add controls and the property panel. The renderer only renders registered node types.

## Editor State

The editor state tracks:

- current document
- selected node
- hovered node
- active viewport
- dirty state
- undo stack
- redo stack

Only document mutations create undo history. Selection and hover do not.

History is capped to avoid unnecessary memory growth on the 512 MB target.

## Renderer

The runtime renderer converts a validated builder document into React UI. It does not execute document code, render arbitrary HTML, or load editor controls unless `editorMode` is enabled.

Unknown or missing nodes render a safe fallback instead of crashing the whole page.

## Styling System

Builder node styling is controlled structured data, not custom CSS. Styles are stored on each node as responsive style blocks:

```json
{
  "base": {
    "backgroundColor": "#ffffff",
    "color": "#111827",
    "padding": { "top": "24px", "right": "24px", "bottom": "24px", "left": "24px" }
  },
  "tablet": {
    "padding": { "top": "20px", "right": "20px", "bottom": "20px", "left": "20px" }
  },
  "mobile": {
    "padding": { "top": "16px", "right": "16px", "bottom": "16px", "left": "16px" }
  }
}
```

`base` is the desktop/default style. Tablet styles inherit from `base`. Mobile styles inherit from `base` and then `tablet`, so small-screen overrides can stay minimal.

Supported style groups:

- layout: `display`, `flexDirection`, `alignItems`, `justifyContent`, `gap`, `maxWidth`
- spacing: `margin`, `padding`
- size: `width`, `height`, `minHeight`
- typography: `fontSize`, `fontWeight`, `lineHeight`, `textAlign`
- colors: `color`, `backgroundColor`
- border and shadow: `borderWidth`, `borderColor`, `borderRadius`, `boxShadow`
- image: `objectFit`

The property panel exposes these as grouped controls with reset actions. Styles can be copied from one node and pasted onto another compatible node. Style changes use the same document mutation and undo/redo history as content changes.

The editor provides desktop, tablet, and mobile viewport preview modes. Changing preview viewport does not create history because it is editor UI state, not document content.

The renderer resolves the active viewport styles into safe React inline styles. This keeps user-controlled styling explicit and avoids generating arbitrary Tailwind classes, custom CSS, HTML, or JavaScript from saved documents.

## Persistence And Versioning

Builder editing operates against the existing page draft version:

- `GET /pages/:pageId/builder/draft`
- `PUT /pages/:pageId/builder/draft`

If no draft exists, the API returns a default document at revision `0`.

On first save, the API creates a draft `PageVersion`. On later saves, it updates the existing draft version content and increments the builder `revision`.

Publishing uses the existing page version publish endpoint:

- `POST /pages/:pageId/versions/:versionId/publish`

There is no second publishing system.

## Concurrency

The save API requires `expectedRevision`. If the stored draft revision does not match, the API returns a conflict instead of silently overwriting newer work.

This is not real-time collaboration. It is stale-write protection.

## Validation And Security

Server validation checks:

- schema version
- root node
- node IDs
- registered node types
- child rules
- missing nodes
- cycles
- orphan nodes
- multiple parents
- basic property types
- unsafe script-like text
- allowed responsive style blocks
- allowed style keys and value formats
- document size

The builder never trusts tenant IDs from the client. Tenant and website ownership are derived from the authenticated session and existing page ownership checks.

Style validation is duplicated in the web builder and API boundary. The API is authoritative and rejects unsupported style groups, unsupported units, unsafe CSS-like values such as `url(...)`, script-like values, and arbitrary keys. This allows future published rendering paths to trust stored builder documents after validation.

## Media Integration

Image nodes store a `mediaId` reference. They do not store GCS credentials, storage keys, file binaries, or arbitrary upload paths. A fuller media picker can be added later using the existing Media module.

## CMS Boundary

CMS entries are not dynamically bound into builder nodes in this milestone. The property model is static today and can later evolve toward value wrappers such as:

```json
{
  "valueType": "static",
  "value": "Hello"
}
```

Future CMS bindings should be added explicitly and safely, not by allowing arbitrary expressions.

## Website Theme Relationship

The builder now supports website-level design tokens:

```text
Website
-> Theme
-> Builder Document
-> Node Styles
```

Node styles may store explicit values or theme token references. Explicit legacy values such as `#111827` and `24px` continue working. Token references use the shape:

```json
{
  "type": "token",
  "value": "colors.primary"
}
```

The runtime renderer resolves the active viewport style block, resolves token references against the loaded website theme, and then converts the safe style block to React inline styles. Token resolution lives in `features/builder/schema/theme-resolver.ts` so individual components do not parse JSON paths manually.

The builder editor loads the website theme once for the page session. Changing a theme token updates the preview immediately for nodes that reference that token. Local explicit node overrides remain unchanged.

## Current Limitations

- no freeform drag/drop canvas
- no animations
- no custom CSS editor
- no custom JavaScript
- no reusable symbols
- no collaboration
- no CMS binding engine
- image nodes display media references but do not yet resolve signed image previews in the builder canvas

## Recommended Next Milestone

Add a proper media picker for image nodes, then add tree-based drag/drop using the existing allowed-child validation.
