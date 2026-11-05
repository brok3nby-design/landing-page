# Staging: test.brok3nbydesign.com (Phase 8)

A **private test copy** of the new site, for trying it on your own phone and PC.
- Your live site (brok3nbydesign.com) and its DNS records are not changed.
- Search engines are told not to index staging (noindex + `robots.txt`).
- A yellow **STAGING** badge in the corner shows you're on the test copy. Tap it to see which build you're looking at.

## One-time setup (about 5 minutes, you only do this once)

**1. Namecheap: add one DNS record.** It doesn't change any existing record.
1. namecheap.com → **Domain List** → **brok3nbydesign.com** → **Manage** → **Advanced DNS**.
2. **Add New Record**:
   - Type: **CNAME Record**
   - Host: **test**
   - Value: **brok3nby-design.github.io.** (with the dot at the end)
   - TTL: Automatic
3. Click the green tick to save. Leave every other record exactly as it is.

**2. GitHub: turn on Pages for the new site's repository.**
1. github.com/brok3nby-design/landing-page → **Settings** → **Pages**.
2. **Source**: *Deploy from a branch*, then **Branch**: `gh-pages`, folder `/ (root)`, then **Save**.
3. **Custom domain**: `test.brok3nbydesign.com`, then **Save**. GitHub checks the DNS; this can take a few minutes up to an hour.
4. When it offers it, tick **Enforce HTTPS**.

*(Recommended)* github.com → your profile → **Settings** → **Pages** → **Add a domain** → `brok3nbydesign.com`. This verifies you own the domain, so no one else can attach its subdomains.

Then open **https://test.brok3nbydesign.com** on your phone and PC and tell me it loads. I can't open your domain from my cloud environment.

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
- [ ] Every project page shows text, progress and gallery. The trailers play (Bid & Buried, Speck, Pocket Wilds).

**Elsewhere**
- [ ] About: the notebook opens and closes, and the full story is below it.
- [ ] WRFM: the clips play, transcripts open, and "Listen live" opens the station.
- [ ] Music on/off works (top right) and pauses when a trailer plays.
- [ ] Passport: stamps appear as you explore; backup and restore work.
- [ ] Settings: switching off animations or particles works.
- [ ] Old links still work, e.g. https://test.brok3nbydesign.com/bid-and-buried.html

**Speed:** open https://test.brok3nbydesign.com/?fps, drag the desk around, and send me the number shown in the top-left corner.

## Reporting a problem
Send a screenshot plus: the page, the device (e.g. "iPhone 13, Safari" or "Windows PC, Chrome") and what you did. A short message is fine.

## Updating staging (for me)
```bash
cd app && npm run deploy:staging
```
This builds the staging version and pushes it to the `gh-pages` branch of `brok3nby-design/landing-page`, nowhere else. Going live on brok3nbydesign.com is Phase 11 and needs your explicit approval.
