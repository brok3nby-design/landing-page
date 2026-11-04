# AUDIT — existing BROK3N BY DESIGN website (Phase 9, done before staging)

_Recorded 2026-11-04. Read-only audit: nothing in the production repository, GitHub Pages or DNS was changed._

**Source:** `brok3nby-design/brok3nby-design.github.io`, commit `b66fb99` ("Add files via upload").
- CNAME is `brok3nbydesign.com`. Size: 448 files, 137 MB (images 73 MB, teasers 30 MB, videos 21 MB, audio/sounds 14 MB).
- The live domain can't be reached from this build environment (network policy). The repository is what GitHub Pages serves, so it's the source of truth here. Differences on the live site (e.g. manual edits) would not show up. Worth a quick look from your own browser.
- Text below in "quotes" is copied from the site. Nothing is invented. Every quote's source file is named.

---

## 1. Site map (every page in the repository)

| URL | Title | What it is | Linked from |
|---|---|---|---|
| `/` (`index.html`) | Brok3n by Design — Independent Game Studio | Studio entrance: logo, **ENTER THE STUDIO**, "Go straight to the games next time", music toggle | start page |
| `/home.html` | same | **Main page**, see §2 | entrance, nav "Shelf" |
| `/about.html` | About — Brok3n by Design | Creator story, Flow Programming, name origin | nav "About" |
| `/built-by-design.html` | Built by Design, Not by Budget | Essay on AI-assisted solo development | home, about |
| `/follow-development.html` | Follow Development | Newsletter (Buttondown) + X | nav "Follow" |
| `/passport.html` | Studio Passport | 17 collectible discoveries (stored in the browser) + a command terminal | nav "Passport" |
| `/press-kit.html` | Press kit | Studio description, brand film, logos, artwork per project | footer |
| `/settings.html` | Effects & sound | Animations, cursor particles, cartridge sound, skip-entrance toggles | footer |
| `/subscribed.html` | You're Subscribed | Newsletter thank-you page | Buttondown redirect |
| `/glass-and-fortune.html` | Glass & Fortune | Project page | shelf |
| `/bid-and-buried.html` | Bid & Buried | Project page + YouTube trailer | shelf |
| `/speck.html` | Speck | Project page + MP4 trailer | shelf |
| `/under-the-radar.html` | Under the Radar | Teaser-style mystery project page | shelf |
| `/wrfm.html` | WRFM Radio — After Hours | Large page: station, embedded live player, clips, features, roadmap | shelf, home "Launched" |
| `/pocket-wilds.html` | Pocket Wilds | Project page + MP4 trailer (private development, not playable) | shelf |
| `/pocket-wilds-changelog.html` | Pocket Wilds — Update Log | ~50 build entries (July–Aug) | follow page |
| `/doqi.html` | DOQI | Project page (prototype, on hold) | shelf |
| `/macabre-dolls.html` | Macabre Dolls | Concept-art archive | shelf |
| `/labyrinth-fate.html` | The Maze | Project page (old id "labyrinth-fate") | shelf |
| `/juicebox.html` | Juicebox | Short-film experiment | shelf |
| `/graffiti.html` | Graffiti | Pixel guestbook project page | shelf |
| `/graffiti/` | Graffiti · Brok3n by Design | Full-page embed of the guestbook (Cloudflare worker) | graffiti page |
| `/lumina-dice.html` | — | Redirect: "Lumina Dice is now Glass & Fortune" | old links |
| `/cyoa.html` | CYOA | Interactive-fiction project page; **not in the shelf catalogue** | follow page only |
| `/videos/bid-and-buried.html` | Bid & Buried | **Stray copy** of an older, longer B&B page; its relative links are broken | not linked |
| `/teasers/{bid-and-buried,doqi,glass-and-fortune,speck}/` | "… website teaser" | Playable browser teasers, **not linked from any page** | — |
| `/teasers/pocket-wilds/` | — | "currently unavailable" stub | — |

**Shared elements on every page:**
- Header nav: Shelf · About · Follow · Passport · Follow on X.
- Footer: "Independently created by Brok3n by Design.", @brok3nbydesign on X, "© 2026 Brok3n by Design™. All rights reserved.", Studio Passport · Effects & sound · Press kit · Studio entrance.
- Site music player (`sounds/site_music_1.*`), cursor/hover effects (`site-effects.*`) and the studio intro (`intro.js`).

**Contacts and accounts used:** `mailto:brok3nbydesign@pm.me` · https://x.com/brok3nbydesign · YouTube https://www.youtube.com/@Brok3n-j8j · brand film https://youtu.be/zhIMgJ5sl7Q · newsletter `buttondown.com/…/brok3nbydesign` · WRFM live station https://brok3nby-design.github.io/wrfm/ · Graffiti worker (Cloudflare).

**SEO:**
- Every page has a description, Open Graph tags and a canonical URL; Twitter card on home.
- Favicon: `images/studio/studio-mark.svg`. Default share image: `images/studio/b3d.png`.
- There is no `404.html`, `sitemap.xml` or `robots.txt`.

---

## 2. Main page content (`home.html`) → new homepage

| Old section | Copy (verbatim) | New-site slot |
|---|---|---|
| Hero | "INDEPENDENT GAMES. UNEXPECTED WORLDS." / "Strange games. Dark humor. Worlds worth exploring." / "Designed, directed, and built by one independent creator." | `site.js` home eyebrow / intro (replaces PLACEHOLDER) |
| CTAs | "Explore the Games" · "See What's Launched" · "See What's Coming" | home CTAs |
| **Launched** | "A home for completed games, films, and other creations from the studio." Brand film ("A film from the studio behind the games…", YouTube + X) and **WRFM Radio** ("Smooth jazz for people who ship code…", Play WRFM / Explore WRFM) | Monitors → brand film? Headphones → WRFM (already mapped) |
| **Shelf** ("Insert a cartridge — Choose your next world.") | 10 project cards with filters (Everything / Play & listen / In development / Experiments & archive / Private alpha), progress reports, "Take me somewhere strange" random button | Games page (crate) |
| Studio Passport teaser | "Visit worlds. Find small secrets. Collect a stamp along the way." | Easter-egg system (§5) |
| **What's coming up** | Glass & Fortune "Preparing the Reading", Pocket Wilds "The wilds keep changing", Speck "A world built from almost nothing" | Games intro or a "Next up" block |
| About the Studio | "Brok3n by Design is an independent game studio where each project is designed, directed, and built by a single creator using modern creative tools. …" | homepage intro + About |
| Field Notes | "Get occasional updates on new builds, playable previews, and experiments still finding their shape." + Buttondown form | Follow / Contact |

## 3. About page (`about.html`) → the notebook

| Old heading | Copy (starts) | Suggested notebook slot |
|---|---|---|
| About the studio | "Strange games. Dark humor. Worlds worth exploring." | page intro |
| One creator. Plenty of strange ideas. | "I'm the creator behind Brok3n by Design: a lifelong gamer, single dad, and full-time tech…" | right page, "The studio" |
| Design. Build. Play. Refine. | "I call it Flow Programming: build an idea, play it, question it, and keep shaping it…" | left page, "Process" |
| Why "Brok3n by Design"? | "'Flawless by Design' felt like a lie, and the domain was probably taken anyway…" | bookmark, as a discovery |
| Come take a look. | links to games, follow, contact, brand film, press kit, X | CTAs |
| (essay) Built by Design, Not by Budget | 8 sections; "The tools changed. The vision did not." | keep as its own page, linked from the notebook |

## 4. Project catalogue (from `studio-data.js`, the site's own data file)

Order, status, hook and description come straight from `globalThis.B3DProjects`. Progress is the site's "content remaining" (not overall completion).

| # | Project (old URL) | Status | Hook | Cover art (portrait 1024×1536 unless noted) | Media on site | Content remaining · demo ETA · release ETA |
|---|---|---|---|---|---|---|
| 1 | **Glass & Fortune** (`glass-and-fortune.html`; old `lumina-dice.html`) | Private alpha (Alpha 0.11.0) | "Bend the roll. Cheat fate." | `cover/glass-and-fortune.webp` | 7 dice images; teaser (unlinked) | 15% · Steam & itch demo within 2 months · Q1–Q2 2027 |
| 2 | **Bid & Buried** (`bid-and-buried.html`) | In development | "Buy blind. Dig deep. Get rich." | `cover/bid-and-buried.webp` | 5 screenshots, YouTube trailer `txFCiU7ykMw`; teaser (unlinked) | 50% · Q1–Q2 2027 · Q4 2027 |
| 3 | **Speck** (`speck.html`) | Private development | "Start small. Leave something behind." | `cover/speck.webp` | 10 images, `Speck_Trailer_01b.mp4` (9.5 MB); teaser (unlinked) | 65% · Q1–Q2 2027 · Q4 2027 |
| 4 | **Under the Radar** (`under-the-radar.html`) | In development, marked `secret` | "Your next favourite is one you've never heard of." | `radar/Under_Radar_logo.png` only | — | not reported |
| 5 | **WRFM Radio** (`wrfm.html`) | Completed · Live now | "Smooth jazz for people who ship code." | `cover/wrfm.webp` (941×1672) | 8 images, 16 audio clips, live embed | released |
| 6 | **Pocket Wilds** (`pocket-wilds.html`) | Private development · not playable | "Explore the wilds. Face the dice." | `cover/pocket-wilds.webp` | 25 images, `PW_Trailer.mp4` (11.9 MB), update log | 65% · Q1–Q2 2027 · Q3–Q4 2027 |
| 7 | **DOQI**, Department of Questionable Inventions (`doqi.html`) | Prototype · on hold | "Your answers have been filed." | `cover/doqi.webp` | 15 images; five-question teaser (unlinked) | 40% · 2028 · 2028 |
| 8 | **Macabre Dolls** (`macabre-dolls.html`) | Concept · not developed | "Every doll has a past." | `cover/macabre-dolls.webp` | 19 concept images | 25% · no ETA |
| 9 | **The Maze** (`labyrinth-fate.html`) | In development | "The world remembers the roll." | `cover/labyrinth-fate.webp` | — | not reported |
| 10 | **Juicebox** (`juicebox.html`) | Film experiment | "Small format. Strange possibilities." | `cover/juicebox.webp` | — | not reported |
| 11 | **Graffiti** (`graffiti.html`) | Live guestbook | "Draw something small. Leave it behind." | `cover/graffiti.webp` (1672×941, landscape) | live guestbook | live |
| — | CYOA (`cyoa.html`) | In development (orphan page) | "An interactive choose-your-own-adventure experience guided entirely by the reader." | `cover/cyoa.webp` (720×450) | — | — |

### Corrections this audit makes to the new site's placeholder data
- `games.json` slot 3 **"Locker Auction" is really "Bid & Buried"** (id `bid-and-buried`).
- Slot 2 is **DOQI** (id `doqi`). The site's short name is DOQI; the full name is used in its description.
- The new game routes should reuse the old ids: `/games/glass-and-fortune`, `/games/bid-and-buried`, `/games/doqi`, and so on.
- Real cover art exists for every project, so the pixel-art placeholders on the crate cases can be replaced. The covers are portrait 2:3; the case labels will be fitted to that (Phase 10).

## 5. Features of the old site, and their 3D equivalents

| Old feature | Keep? | Natural 3D home |
|---|---|---|
| Studio entrance (`index.html`, skip toggle) | decide | the intro camera move already plays this role |
| Site music + cartridge click sound | decide | headphones / a cassette on the desk; the cartridge "click" when a case lifts |
| Studio Passport (17 discoveries, local backup, terminal) | likely yes | **our Easter-egg plan** (`EASTER_EGGS.md`): stamps for the sticker under the desk, the maker's plate and so on. The terminal fits the monitors. |
| Progress reports per project | yes | game panels and game pages |
| Shelf filters + "Take me somewhere strange" | yes | Games page list / a random case |
| Newsletter, X, email | yes | business cards → Contact; Follow page |
| Press kit, Settings, Built by Design essay, Pocket Wilds update log, Subscribed | yes, as plain pages | same layout, no exhibit needed |
| Graffiti guestbook | yes | sticky notes / wall; links out |
| Teasers (playable) | decide (currently unlinked) | "Play teaser" button on game pages |

## 6. URLs that must keep working (preserve search results, links and shares)

GitHub Pages can't do server redirects. The proven pattern is the one the site already uses in `lumina-dice.html`: a small HTML page with `<meta http-equiv="refresh">` + `rel=canonical` + a visible link. Proposed mapping:

| Old | New |
|---|---|
| `/`, `/home.html`, `/index.html?intro=1` | `/` |
| `/about.html`, `/built-by-design.html` | `/about`, `/about/built-by-design` |
| `/follow-development.html`, `/subscribed.html` | `/follow`, `/follow/subscribed` (Buttondown redirect setting must be updated **at launch only**) |
| `/passport.html`, `/press-kit.html`, `/settings.html` | `/passport`, `/press`, `/settings` |
| `/<project>.html` (all 12 + `lumina-dice.html`) | `/games/<id>` (WRFM → `/wrfm`, Graffiti → `/graffiti`) |
| `/pocket-wilds-changelog.html` | `/games/pocket-wilds/updates` |
| `/graffiti/`, `/teasers/*`, `/images/*`, `/videos/*`, `/sounds/*`, `/audio/*` | **unchanged paths**: these are embedded or shared directly |

## 7. Problems found on the current site (worth fixing whatever happens to the new one)
1. **Social-share images missing:**
   - 9 project pages point `og:image` at `images/studio/share/<id>.jpg`, but only `graffiti.jpg` exists in that folder. Links shared on X/Discord show no picture for Glass & Fortune, Bid & Buried, Speck, WRFM, Pocket Wilds, DOQI, Macabre Dolls, The Maze and Juicebox.
   - `graffiti.html` and `press-kit.html` also reference `images/graffiti/graffiti_logo.png`, which doesn't exist (only `.jpg`/`.webp`).
2. **Private files are publicly served:**
   - `POCKET-WILDS-REMOVAL.txt` is public at brok3nbydesign.com and contains a local Windows path including your PC user name.
   - `TEASER-BRIEFS.md` (internal build briefs) is public too.
   - So are many small `*.md` note files in image folders.
3. **Stray page:** `/videos/bid-and-buried.html` is an older copy whose links are broken.
4. **Unlinked content:** 4 playable teasers (30 MB) and `cyoa.html` exist but nothing links to them. Intentional?
5. **Duplicated audio:** `audio/wrfm/` and `sounds/wrfm/` hold the same clips.
6. **No 404 page:** mistyped URLs show GitHub's default page.

None of these were changed. Fixing them means editing the production repo, which needs your explicit go-ahead.

## 8. Open questions for you (needed before Phase 10)
1. **The crate holds 5 cases, but there are 11 projects.** Options:
   - the 5 most active go in the crate (e.g. Glass & Fortune, Bid & Buried, Speck, Pocket Wilds, DOQI), with the rest elsewhere: Macabre Dolls and The Maze as books on the shelf, WRFM on the headphones, Graffiti on the sticky notes;
   - or a larger crate with more cases;
   - or a second crate for "experiments & archive".
2. **Under the Radar** is marked secret. Should it be a hidden discovery rather than a visible case?
3. Keep the **studio entrance**, **site music**, **cursor effects** and **Passport** in the new site?
4. Should the **teasers** be playable from the new game pages?
5. May I copy your existing images, trailers and audio into the new site? They're your own files; only what's used would be copied, and only in Phase 10.
6. Is the copy on the live site newer than the repository anywhere?

## 9. Decisions (2026-11-04)
- **Live site:**
  - fix the share images; delete `POCKET-WILDS-REMOVAL.txt`;
  - remove the playable teasers, `TEASER-BRIEFS.md` and the stray `videos/bid-and-buried.html`;
  - delivered as a pull request you merge (branch `claude/site-fixes`, waiting for the Claude GitHub App on that repo).
- **Crate:** the five most active games (Glass & Fortune, Bid & Buried, Speck, Pocket Wilds, DOQI).
- **Other projects:**
  - WRFM → the headphones;
  - The Maze, Macabre Dolls and Juicebox → the pile of game boxes on the shelf;
  - Graffiti → the sticky notes;
  - Under the Radar stays a secret (found under the desk).
- **Features kept:** entrance screen, background music, Studio Passport, cursor & hover effects, cartridge click.
- **Teasers:** not playable on the new site. Trailer videos for active games are used.
- **Media:** copy what's active and used (done in Phase 10, `app/media/`).
