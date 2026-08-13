<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## Coding preferences (General)

- Keep things simple. Channel "yagni" energy unless told otherwise.
- Keep components modular and concerns clearly separated.
- Take advantage of type safety.
- Treat the prompt as the specification. Verify assumptions against the repository.
- Use established project dependencies before writing custom code or adding packages.
- Make durable architectural decisions. Do not add a temporary path that is intended to be replaced later.
- Comment intent, constraints, and non-obvious behavior. Keep comments up to date, when making changes it's improtant to keep things in sync.
- Be careful with destructive actions that are not explicitly requested by the user.
- Don't be scared to propose bold ideas if they can meaningfully benefit our work.
- Do not preserve backward compatibility unless the task requires it. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Do not create endless smoke tests and "regression tests" for feature deletions. Tests should be focused.

## Coding preferences (TypeScript focused)

- `any` is the enemy, Infered types are our friend. Our systems should adapt to changes, instead of requiring chnages everywhere.
- Avoid one-line functions that are just casting wrappers.
- If not already spcified in project, generally preferred stack is - pnpm, Vite, React, Tailwind CSS.
- When building more complex web apps, pull out TanStack Query, TanStack Start or Router (for SPA), zod.
- When schema changes are required, create migrations with `pnpm run db:generate`.
- Apply local schema changes with `pnpm run db:migrate`.
- Do not hand-write migration SQL.

## Coding preferences (Frontend focused)

- Follow shadcn principles. Prefer adapting the local UI kit over one-off bespoke styling.
- Keep `src/components/ui/*` for shadcn primitives and direct extensions. Use `shadcn add` before creating a primitive manually, import primitives directly, and do not re-export them through app helpers.
- Prefer compound components, compose visible content as children instead of passing JSX, labels, icons, or content through props. Prefer `<Component><ComponentHeader>...</ComponentHeader></Component>` style for presentational wrappers.
- Do not create useless wrappers around base primitives like `Card` - reuse base primitives unless it's required.
- Do not create catch-all helper buckets such as `src/components/app/*`, route-root `-components/ui.tsx`, or broad `primitives.tsx` modules. If a component is shared, give it a specific top-level home under `src/components`.
- Keep route-local `-components` folders only when the components are genuinely scoped to that route subtree. If a route-local component is imported across multiple areas, move it to a named shared component file instead.
- Keep the visual hierarchy restrained: use sentence case, avoid decorative gradients, and prefer layout, spacing, and separators over excessive or nested cards.
- Use shadcn `Field` primitives for form layout.
- Keep navigation at the call site. Compose TanStack `Link` with `asChild`; do not pass routes into presentational components or create `LinkButton`.
- Use the shared loading and error components, use shadcn empty-state primitives directly.
- Do not create fake, decorative, or non-working controls unless asked.
- Do not use uppercase section or metric titles.
- Put non-visual formatting and grouping helpers in `src/lib/*`.
- All app messages must go through Paraglide i18n (`messages/en.json` and `m.*`). Do not ship hard-coded user-facing strings in React components or frontend formatting helpers. Use Paraglide plural messages for counts; do not hand-roll English pluralization with suffix conditionals such as `{count === 1 ? "" : "s"}`.
