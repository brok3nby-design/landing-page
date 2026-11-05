# Your artwork — drop-in image slots

Put an image in **this folder**, named after a slot below, and run the build. The image replaces the placeholder art on that object. Delete the image and rebuild to get the placeholder back.

```bash
diorama/.venv/bin/python diorama/blender/build.py --render
```

- **Formats:** PNG, JPG, WEBP, TGA, BMP or TIFF. Transparent areas are flattened onto white.
- **Size:** any size works, but match the **shape** (aspect ratio) in the table, otherwise the image stretches. Images bigger than 2048 px are scaled down to keep the website fast.
- **Templates:** `templates/<slot>_template.png` shows each slot's shape.
  - Red border = the image edge.
  - **Mugs:** the white line marks the part that faces the viewer, the light box is the best-visible zone, and the red side strips are hidden behind the handle.
  - **Sketchbook:** the red centre line is the binding.
- **Game covers:** either drop `game_label_01.png` … `game_label_05.png` here, or set `"label_texture": "my_cover.png"` for that slot in `diorama/data/games.json` (the file still lives in this folder).
- **Rights:** only use images you made or have the rights to use on your website.
- Your files are never modified. The build reads them and writes its own copy into `diorama/assets/textures/`.
- **On the website later:** every object that shows a slot carries an `artwork_slot` tag, so images can also be swapped from data files without re-exporting the 3D model. Monitors could show project screenshots or short video loops.

## Slots

| Slot file name | Recommended size (px) | Where it appears | Tips |
|---|---|---|---|
| `screen_left.png` | 1920 × 1080 | Left monitor screen (glows like a real display) | Whole image visible, 16:9. |
| `screen_right.png` | 1920 × 1080 | Right monitor screen | Whole image visible, 16:9. |
| `mug_wrap.png` | 1800 × 620 | Coffee mug on the desk (wraps all the way round) | Centre of the image (75% across) faces the viewer; the handle sits at the left/right edges. |
| `mug_figure.png` | 900 × 310 | Tiny mug held by collectible figure B | Same layout as mug_wrap. Very small on screen: use big bold shapes/text. |
| `deskmat.png` | 2400 × 900 | Desk mat under keyboard and mouse | Whole image visible; keyboard covers the left-centre, mouse the centre-right. |
| `rug.png` | 1800 × 1100 | Rug on the platform floor | Whole image visible; the chair covers part of the left half. |
| `blanket.png` | 700 × 1500 | Blanket draped over the chair | Draped, so it folds: patterns read better than pictures. |
| `sketchbook.png` | 2000 × 1400 | Open sketchbook pages on the desk | Left half = left page, right half = right page; centre is the binding. |
| `crate_print.png` | 1380 × 600 | Front (and back) of the games crate | Whole image visible; keep important art away from the edges. |
| `book_spine_1.png` | 128 × 768 | Spine of book 1 on the upper shelf (left to right; 6 = leaning book) | Tall and thin. Covers use the colour at 45% height of the image. |
| `book_spine_2.png` | 128 × 768 | Spine of book 2 on the upper shelf (left to right; 6 = leaning book) | Tall and thin. Covers use the colour at 45% height of the image. |
| `book_spine_3.png` | 128 × 768 | Spine of book 3 on the upper shelf (left to right; 6 = leaning book) | Tall and thin. Covers use the colour at 45% height of the image. |
| `book_spine_4.png` | 128 × 768 | Spine of book 4 on the upper shelf (left to right; 6 = leaning book) | Tall and thin. Covers use the colour at 45% height of the image. |
| `book_spine_5.png` | 128 × 768 | Spine of book 5 on the upper shelf (left to right; 6 = leaning book) | Tall and thin. Covers use the colour at 45% height of the image. |
| `book_spine_6.png` | 128 × 768 | Spine of book 6 on the upper shelf (left to right; 6 = leaning book) | Tall and thin. Covers use the colour at 45% height of the image. |
| `game_label_01.png` | 1000 × 930 | Cover label of game case 1 in the games crate (GAME_Case_01) | Or set label_texture for that slot in data/games.json. |
| `game_label_02.png` | 1000 × 930 | Cover label of game case 2 in the games crate (GAME_Case_02) | Or set label_texture for that slot in data/games.json. |
| `game_label_03.png` | 1000 × 930 | Cover label of game case 3 in the games crate (GAME_Case_03) | Or set label_texture for that slot in data/games.json. |
| `game_label_04.png` | 1000 × 930 | Cover label of game case 4 in the games crate (GAME_Case_04) | Or set label_texture for that slot in data/games.json. |
| `game_label_05.png` | 1000 × 930 | Cover label of game case 5 in the games crate (GAME_Case_05) | Or set label_texture for that slot in data/games.json. |
