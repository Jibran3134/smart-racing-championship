# Charcoal, silver and racing red

Updated 18 November 2026 using the user's Main Menu, Track Explorer, Algorithm Lab and Championship Dashboard references.

The visual direction uses dark game panels with silver outer/inset frames, condensed uppercase headings, slanted controls, red selected tabs, red/white circuit kerbs, alternating table rows and player-row highlights. The Main Menu has sweeping decorative track ribbons and a stacked mode selector. The dashboard presents existing cumulative-points data as grouped bars. Experiment charts retain line plots and actual measured values.

## Theme files

- `src/ui/styles/theme.css`: named page/surface/text/border/accent/status/chart tokens.
- `src/ui/styles/index.css`: existing component layout and neutral base styling.
- `src/ui/styles/racing-theme.css`: reference-inspired visual treatments, loaded after the base styles.
- `src/ui/styles/palette.ts`: literal red/silver/amber/blue racer and chart identity colors; Canvas paint requires actual colors rather than CSS variables.

| Token | Value |
| --- | --- |
| Page | `#111113` |
| Surface | `#1c1c20` |
| Raised surface | `#28282d` |
| Text | `#f2f2f4` |
| Secondary text | `#c0c0c8` |
| Border / silver frame | `#49494f` / `#72727b` |
| Primary red | `#d91f2b` |
| Red text accent | `#ff8991` |
| Warning | `#e8b65a` |
| Success | `#88b99b` |

Small red text uses a lighter accent than filled controls. Primary controls use white text on darker red gradients; focus indicators remain visible inside clipped controls. Cars and plotted series retain four distinct identity colors. Frontier, service and blocked-road states retain their symbols/labels as well as distinct treatments. Active/blocked routes remain distinguishable through road fill, center markings and the blockage symbol.

The setup, race, sound, algorithm and data-provider flows are retained. Example standings remain opt-in and are still labelled. Main Menu copy identifies the incomplete championship integration. Optional `ChampionshipProvider.humanRacerId` identifies the row to highlight; supplied results use their existing human flag. No developer names or fabricated values were introduced.

The ribbons and track kerbs are native SVG/CSS. No new image asset, external font, UI package or core algorithm change is required. Condensed headings use locally available fonts with system fallbacks. Racing grounds use a subdued charcoal treatment with the existing moving cars and trackside scenery.

Verification includes all existing checks plus browser review of the five screens, responsive widths, graph selection/closures, Lab playback, chart/table rendering, player highlights, race controls, keyboard focus and readable red-control contrast.

All 115 tests, typecheck, lint and build passed. Browser review covered 320/390/768/1440px with no page errors. White text on the primary button gradient measured 4.89:1 or better at both color stops. Local review captures are in `.npm-cache/red-theme-{main,explorer,lab,dashboard,race}.png`; they are generated previews, not versioned application assets.
