# Staging: brok3nbydesign.com/landing-page/ (Phase 8)

A **private test copy** of the new site, for trying it on your own phone and PC.
- Your live site (brok3nbydesign.com) and its DNS records are not changed.
- Search engines are told not to index staging (noindex + `robots.txt`).
- A yellow **STAGING** badge in the corner shows you're on the test copy. Tap it to see which build you're looking at.

## One-time setup (one switch on GitHub, no DNS)
Your domain already points at GitHub for the live site, so GitHub automatically serves this repository's
Pages at **https://brok3nbydesign.com/landing-page/**. No Namecheap or DNS change is needed. The live
site at brok3nbydesign.com stays exactly as it is.

1. github.com/brok3nby-design/landing-page → **Settings** → **Pages**.
2. **Source**: *Deploy from a branch*. **Branch**: `gh-pages`, folder `/ (root)`. Click **Save**.
3. Leave **Custom domain** empty.
4. After about a minute, open **https://brok3nbydesign.com/landing-page/** on your phone and PC.

*(Later, optional)* A separate test.brok3nbydesign.com address needs a DNS record. Your domain is on
Namecheap's hosting DNS without a hosting plan, so that would first mean moving DNS to Namecheap BasicDNS
(a production change, planned separately). `npm run deploy:staging` (without `--subpath`) builds for that address.

## What to try (phone and PC)

Tick what works and note what doesn't.

**Homepage (the desk)**
- [ ] The entrance screen shows. ENTER THE STUDIO works. "Go straight to the games next time" works on the next visit.
- [ ] Drag to rotate, pinch or scroll to zoom. The view never flips or jumps.
- [ ] **Look underneath**: you can look under the desk and under the platform.
- [ ] Tap the crate, headphones, monitors, business cards, sticky notes and the three game boxes on the shelf. Each opens the right panel, and its button goes to the right page.
- [ ] Find the hidden sticker under the desk.

**Games**
- [ ] Tap each case: it lifts, turns, shows your cover art, and VIEW GAME opens the right page. "Take me somewhere strange" works.
- [ ] **Bid & Buried**: the storage unit shows beside the text; tap the safe, TV, globe, records, boxes and paddle.
- [ ] **Pocket Wilds**: the treasure room shows. Brush the mouse over the gold (jingle). Press and hold the gold, carry it, let go: the coins fall, bounce and clink. On a phone: press, drag, release. "Toss a handful" and "Gold sounds: on/off" work.
- [ ] **Glass & Fortune**: tap a die or "Roll the dice": both roll and the result shows beside the buttons. Press and hold a die, move, let go to throw it. Sounds on/off works.
- [ ] **Speck**: drag the planet to spin it; tap it to leave something; reload the page and it's still there. Tap the speck (sup). Spin / Leave something / Clear mine work.
- [ ] **DOQI**: J.E.F.F.'s eyes follow your mouse; click him for a ruling. Click the stamp or the form: it stamps FILED and counts; reload and the marks are still there.
- [ ] **WRFM**: click the mic: ON AIR lights, Vera speaks, the needles move; click again to stop. Click the turntable: music + spinning record. (Secret: find the phone.)
- [ ] **The Maze**: click the die: it rolls and the pawn walks that many steps; reload and it's where you left it; roll to the heart (stamp); Start again. Click the crow.
- [ ] Every project page shows text, progress and gallery. The trailers play (Bid & Buried, Speck, Pocket Wilds).

**Elsewhere**
- [ ] About: the notebook opens and closes, and the full story is below it.
- [ ] WRFM: the clips play, transcripts open, and "Listen live" opens the station.
- [ ] Music on/off works (top right) and pauses when a trailer plays.
- [ ] Passport: stamps appear as you explore; backup and restore work.
- [ ] Settings: switching off animations or particles works.
- [ ] Old links still work, e.g. https://brok3nbydesign.com/landing-page/bid-and-buried.html

**Speed:** open https://brok3nbydesign.com/landing-page/?fps, drag the desk around, and send me the number shown in the top-left corner.

## Reporting a problem
Send a screenshot plus: the page, the device (e.g. "iPhone 13, Safari" or "Windows PC, Chrome") and what you did. A short message is fine.

## Updating staging (for me)
```bash
cd app && npm run deploy:staging
```
This builds the staging version and pushes it to the `gh-pages` branch of `brok3nby-design/landing-page`, nowhere else. Going live on brok3nbydesign.com is Phase 11 and needs your explicit approval.
