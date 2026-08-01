# AGENTS.md

- Do not preserve backward compatibility.
- Choose the simplest implementation that fully meets the current requirements.
- Prefer established, well-maintained libraries over custom implementations.

# Rules

<!-- UI -->

- Use shadcn-style spacing, typography, and component structure.
- Do not use uppercase section or metric titles.
- Prefer small, information-dense cards and straightforward monitor/detail layouts.
- Prefer adapting the local UI kit over one-off bespoke styling.
- Prefer compound/nested components, compose visible regions as children instead of passing JSX, labels, icons, or content through props. Prefer `<Component><Component.Header>...</Component.Header></Component>` style for presentational wrappers.
- Keep navigation at the call site. Do not pass `href`, `to`, or route params into app-owned presentational wrappers; compose TanStack `Link` with `asChild` when a card, row, or button should navigate.
- Do not create fake, decorative, or non-working controls unless asked.
- Avoid schema changes unless a route or settings feature genuinely requires persistence.
- Keep `src/components/ui/*` for shadcn primitives and primitive extensions only. Prefer `pnpm dlx shadcn@latest add <component>` before creating a local primitive. Import primitives directly from `src/components/ui/*` at call sites instead of re-exporting them through app helper files.
- Do not create catch-all helper buckets such as `src/components/app/*`, route-root `-components/ui.tsx`, or broad `primitives.tsx` modules. If a component is shared, give it a specific top-level home under `src/components`.
- Use `src/components/page.tsx` for app page shell composition such as `AppPage`, page headers, page labels, subtitles, and page actions.
- Use `src/components/loading.tsx` and `src/components/error.tsx` for common loading/error states. Use shadcn `src/components/ui/empty.tsx` primitives directly where empty states are rendered; do not wrap them in a project-level `EmptyBlock`.
- Keep route-local `-components` folders only when the components are genuinely scoped to that route subtree, such as monitor detail sections or status page editor pieces. If a route-local component is imported across multiple product areas, move it to a named shared component file instead.
- Compose links in place with `Button asChild` and TanStack `Link`; do not create a `LinkButton` wrapper.
- Use shadcn `Field` primitives from `src/components/ui/field.tsx` for form layout. Shared field conveniences may live there only when they extend the primitive directly.
- Put non-visual formatting/grouping helpers in `src/lib/*`, not component files.

<!-- DB -->

- When schema changes are required, create migrations with `pnpm run db:generate`.
- Apply local schema changes with `pnpm run db:migrate`.
- Do not hand-write migration SQL under `drizzle/migrations`.

<!-- i18n -->

- All app messages must go through Paraglide i18n (`messages/en.json` and `m.*`). Do not ship hard-coded user-facing strings in React components or frontend formatting helpers. Use Paraglide plural messages for counts; do not hand-roll English pluralization with suffix conditionals such as `{count === 1 ? "" : "s"}`.
