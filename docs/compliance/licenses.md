# Dependency License Audit

**Generated:** 2026-04-14 (updated 2026-04-15 after react-leaflet removal)
**Tool:** `npx license-checker --production --summary` (both `/` and `/client`)

## Summary

| Workspace | Total pkgs | Permissive (MIT/ISC/Apache/BSD/0BSD/Unlicense/BlueOak/MIT-0) | Copyleft                 | Non-OSI | Unknown                             |
| --------- | ---------- | ------------------------------------------------------------ | ------------------------ | ------- | ----------------------------------- |
| Backend   | ~224       | 223                                                          | MPL-2.0 × 1 (file-level) | 0       | 0                                   |
| Frontend  | ~217       | 215                                                          | 0                        | 0       | UNLICENSED × 1 (own pkg), BSD\* × 1 |

✅ **No GPL / AGPL / LGPL anywhere.** SaaS distribution is safe.
✅ **No Hippocratic-2.1** — `react-leaflet` removed 2026-04-15, all 3 call sites (`LocationMap.tsx`, `NotebookMap.tsx`, `PlacesImportTab.tsx`) rewritten against plain `leaflet` (BSD-2-Clause).

## Findings that need action

### 2. `tween-functions` — "BSD\*"

Listed as `BSD*` because the `license` field isn't standardized. The actual file is BSD 2-Clause. Harmless, but cosmetic. Consider replacing with a 10-line easing util or pinning to a fork with a clean `license` field.

### 3. MPL-2.0 (backend)

File-level copyleft only — does not infect the rest of the codebase as long as you don't modify the MPL-licensed files and redistribute them. Common for Mozilla-origin deps. Safe for SaaS.

### 4. `client@0.1.0` UNLICENSED

This is **our own** package.json — harmless flag, but a buyer's lawyer will see it. Add `"license": "UNLICENSED"` explicitly (already implicit), or if you're open-sourcing any part, pick MIT/Apache here.

## Recommendation before listing

- Replace `react-leaflet` OR explicitly disclose Hippocratic-2.1 usage in the acquisition packet.
- Rerun this audit after every `npm install` to catch drift.
