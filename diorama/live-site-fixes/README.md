# Fixes for the current live site (brok3nby-design/brok3nby-design.github.io)

A ready-made commit for the **existing** website, now opened as pull request brok3nby-design/brok3nby-design.github.io#1 (branch `claude/site-fixes`). It was first kept here because this session couldn't push
to that repository: the Claude GitHub App isn't installed on it yet. Nothing here touches the live site.

What it does (audit §7):
- adds the 9 missing social-share images `images/studio/share/<id>.jpg`, made with the site's own
  recipe from `tools/build-studio.cjs`;
- points the broken `graffiti_logo.png` / `graffiti_teaser.svg` references at existing artwork;
- deletes `POCKET-WILDS-REMOVAL.txt` (it contained a local PC path) and `TEASER-BRIEFS.md`;
- deletes the unlinked playable teasers (bid-and-buried, doqi, glass-and-fortune, speck) and the stray
  `videos/bid-and-buried.html`.

Apply it (from a clone of the live-site repo, on a new branch), then open a pull request:
```bash
git switch -c claude/site-fixes
git am /path/to/landing-page/diorama/live-site-fixes/0001-*.patch
```
Note: the deleted files stay in that repository's public git history. Removing them from history
is a separate, destructive step that hasn't been done.
