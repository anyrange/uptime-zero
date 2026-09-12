# Upstream

- Source: `https://github.com/dmmulroy/anti-slop`
- Skill: `install-anti-slop`
- Source commit: unknown. The installer supplied a copied skill bundle without
  a recoverable upstream revision.
- Installed plugin entry point: `tools/oxlint/anti-slop/index.ts`
- Compatible dependency pair: `oxlint@1.78.0` and `@oxlint/plugins@1.78.0`

The repository enables the generic anti-slop rules and the native
`oxc/no-accumulating-spread` rule. The vendored plugin and agent assets are
excluded from application lint and formatting. No upstream rules were removed
or locally disabled.
