# Vibe Design System (local mirror)

This app's design system is based on **[Vibe](https://vibe.monday.com)** — monday.com's
open-source React design system ([`mondaycom/vibe`](https://github.com/mondaycom/vibe)).

We do **not** depend on `@vibe/core` React components. Instead we mirror Vibe's
design **tokens** and apply them through Tailwind v4, keeping our existing
shadcn-style primitives. This gives the whole app Vibe's look (colors,
typography, spacing, radii, motion, shadows) with no runtime dependency.

## Files

| File | What it is |
| --- | --- |
| `vibe-tokens.css` | The complete Vibe token set (light + dark themes, spacing, radii, typography, motion, borders) as CSS custom properties. Mirrored from `@vibe/style@4.0.0`. |

This file is imported once from [`src/app/globals.css`](../../app/globals.css).

## How styling is wired

1. **`vibe-tokens.css`** defines all Vibe semantic variables, e.g.
   `--primary-color`, `--primary-text-color`, `--secondary-background-color`,
   `--ui-border-color`, `--positive-color`, `--negative-color`,
   `--border-radius-small`, `--space-16`, `--font-text2-normal`, etc.
2. **`globals.css`** then:
   - Remaps Tailwind's default color ramps (`gray`, `blue`, `red`, `green`,
     `yellow`/`amber`, `orange`, `purple`/`violet`, `indigo`, `teal`, and the
     `slate`/`zinc`/`neutral`/`stone`/`sky`/`rose`/`emerald` aliases) onto Vibe's
     palette — so existing utilities like `bg-blue-600` / `text-gray-500`
     automatically render in Vibe colors.
   - Maps Tailwind's radius scale onto Vibe radii.
   - Wires `--font-sans` to **Figtree** and `--font-display` to **Poppins**
     (loaded in [`src/app/layout.tsx`](../../app/layout.tsx)).
3. The UI primitives in [`src/components/ui`](../../components/ui)
   (`button`, `card`, `input`, `badge`, `label`) use the Vibe semantic variables
   directly via arbitrary values, e.g. `bg-[var(--primary-color)]`.

## Usage guidance for new code

- **Prefer semantic Vibe variables** for new components:
  `text-[var(--primary-text-color)]`, `bg-[var(--secondary-background-color)]`,
  `border-[var(--ui-border-color)]`, `rounded-[var(--border-radius-small)]`.
- Tailwind color utilities (`bg-blue-600`, …) are fine too — they resolve to
  Vibe colors via the palette remap.
- **Dark mode:** add the `dark-app-theme` class to a wrapper element to opt in.

## Updating / upgrading Vibe

Re-pull token sources from `@vibe/style` (do not hand-edit values):

```bash
# Inspect available files
curl -s "https://data.jsdelivr.com/v1/packages/npm/@vibe/style@<version>?structure=flat"
# Fetch a token source, e.g. the light theme
curl -s "https://cdn.jsdelivr.net/npm/@vibe/style@<version>/src/themes/light-theme.scss"
```

Then update `vibe-tokens.css` and the palette remap in `globals.css` to match.

## Vibe MCP server

The Vibe MCP server ([`@vibe/mcp`](https://www.npmjs.com/package/@vibe/mcp)) is
configured in the repo's [`.mcp.json`](../../../.mcp.json). It exposes tools to
look up component metadata, usage examples, accessibility guidelines, icons, and
design tokens. Tools (restart your AI tool to load them):

- `list-vibe-public-components`, `get-vibe-component-metadata`,
  `get-vibe-component-examples`, `get-vibe-component-accessibility`
- `list-vibe-icons`, `list-vibe-tokens`, `v3-migration`
