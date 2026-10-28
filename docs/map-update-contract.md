# Map enrichment and review repair contract

User authorized adding supplied locations/domains from ../地图handoff. Preserve all current fields and the full 10-27 sample; merge only the supplied location/domain fields. Preserve `display=swap` (user explicitly confirmed); remove font CSS dependence on app.js. Prepare for Pages deployment and a future custom domain; do not purchase domains or change production DNS without an actual domain.

## DOM for grouped markers

Use supplied `groupMarkers(markers,minDist=24)` algorithm in lib/projection.mjs, build only. `issue.markerGroups` is array of normalized item arrays, with all 11 group counts matching new README. Representative coordinate is first member (no artificial geolocation).

One button `[data-marker][data-items="1 2"]` per group. Singleton also carries data-items and existing data-item. `data-item` is representative first member, `data-group-id="g01"` stable first member anchor. Marker inline left/top representative position. Every button contains prebuilt `[data-marker-label][data-item]` spans (first initially visible, rest hidden) and `.map-marker-count[data-marker-count]` badge whose text is UI count of additional matching entries (can update text, not news content). Each label has data-label string describing number/location/tier. Base marker style starts with first member's tier; all member metadata can be read from corresponding feed rows/popups. On filter, only matching group members are selectable; none => disabled .is-filtered; nonempty => show selected matching member or first matching. Badge hidden for one member, otherwise +N. aria-label includes all matching numbers; aria-haspopup for grouped menus. Group content itself pre-rendered in HTML.

`[data-feed-row][data-item]` keeps per-item theater/domain attrs and adds data-tier. `[data-popup][data-item]` remains one per located item, static HTML, with heading/URL; for a group add a pre-rendered chooser: `.map-group-choices` containing buttons `[data-group-choice][data-item][data-theater][data-domain]` for all members, accessible label includes headline. Group chooser also rendered in each mobile-detail member to allow mobile selection (popup hidden on mobile). Each chooser button is >=44px, first click group selects its first visible member; clicking group again cycles next matching member; clicking chooser selects precisely that member. List click chooses precise member. Filtering hides choices that don't match.

All records may map to one shared marker element, so JS must not toggle marker per-record in a way where later members overwrite selected/disabled state. Marker rendering must be a separate per-group loop. Native Tab order is group representative number order; all per-item list links remain available. Every group member reachable through chooser and feed. No JS feed has all per-item links and group button aria-label contains all numbers.

Zoom: base map canvas scales; counter-scale marker buttons around their center using `--map-zoom` so visual glyph & 44px hit target stay stable (translate(-50%,-50%) scale(1/zoom) with correct composition / use CSS calc(1 / var(--map-zoom))). Popup position computed from shared representative marker's true transformed center. Selection tier follows active member.

Popups: try right/left/below/above positions, clamp within stage and score overlaps against other visible marker hit boxes. Pick lowest overlap; if unavoidable make other marker centers stay visible/receive clicks using appropriate layering or panel fallback. Don't make popup's empty area capture marker clicks. Include nearest-center hit logic for overlapping marker hit boxes for real pointer only; preserve native keyboard activation.

Off-map/full story: every feed row remains an actual href. Selecting an off-map item needs a visible desktop full-text action as well as mobile. Use `.map-selection-detail[data-selection-detail]` below stage (reuse prebuilt mobile detail nodes, show on desktop for off-map only). Do not rely on double-click alone. Clicking an already-selected feed anchor follows its href normally; Ctrl/Cmd clicks follow links immediately. Keyboard Enter behaves same. Mapped items still read-full from popup; focus shortcut on selected marker (e.g. ArrowDown to its popup link, Escape back to trigger) may be added without hijacking page navigation keys globally.

Reserve map mobile detail slot using pre-rendered default selection (one data-mobile-item initially unhidden; all others hidden) and initial CSS visibility:hidden rather than display:none before enhancement. Reserve `.filter-bar` and `.archive-search` before enhancement via visibility:hidden, just as mode-toggle. No JS full content remains readable. Never hide the whole document to eliminate CLS.

## Ownership

Map/data agent: lib/projection.mjs group helper, lib/normalize.mjs markerGroups & decimal-safe headlines, templates/map.mjs, tools/make-map.mjs, content/*.json. JS agent: assets/app.js. Visual agent: assets/site.css. Root: templates/layout.mjs, build.mjs, tests/, tools/verify.mjs, deployment docs/README/qa reports.

Existing raw15KB app budget was a conservative target, actual requirement is compressed <=15KB. Group support may exceed15KB raw; keep gzip comfortably below15KB. No added packages.
