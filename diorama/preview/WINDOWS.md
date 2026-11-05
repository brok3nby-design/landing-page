# Running the 3D preview on Windows

The preview is a small local web page that loads the exported 3D models. It runs on your own computer. Nothing is published, and the live website is not touched.

## One-time setup
1. **Install Git for Windows:** https://git-scm.com/download/win. Keep the default options; they include the GitHub sign-in helper.
2. **Install Node.js LTS (version 22 or newer):** https://nodejs.org. Keep the default options.
3. **Close every Command Prompt window and open a new one**, so it picks up the new programs.

## Download the project (first time only)
Type these one at a time in Command Prompt:
```bat
cd %USERPROFILE%
git clone https://github.com/brok3nby-design/landing-page.git
cd landing-page
git checkout claude/new-session-zkgerx
```
If a GitHub sign-in window appears, sign in with the account that has access to the repository.

## Start the preview
```bat
cd %USERPROFILE%\landing-page\diorama\preview
npm install
npm run dev
```
`npm install` is only needed the first time, or after an update changes the preview's packages.

After a few seconds you'll see a line like:
```
  ➜  Local:   http://127.0.0.1:5173/
```
Open that address in Chrome or Edge.

- Keep the Command Prompt window open while you use the preview.
- Press **Ctrl + C** in that window to stop it.

## Get the latest version later
```bat
cd %USERPROFILE%\landing-page
git pull
cd diorama\preview
npm install
npm run dev
```

## Using the preview
- **Rotate:** drag. **Zoom:** scroll wheel. **Move sideways:** right-drag.
- **Click an object** to see its interaction id. Dragging to rotate never counts as a click.
- **The panel at the top left:**
  - pick the model (desk, games crate, notebook) and the version (optimised KTX2 or WebP);
  - toggles for baked shadows/glow, live lights, shadows and bloom;
  - "under-view" to look beneath the desk;
  - reset view, and "test artwork swap".
- **The stats block** shows frames per second, draw calls and memory. These are the real performance numbers for your machine.

## If something goes wrong
| Message | Fix |
|---|---|
| `'git' is not recognized…` | Close and reopen Command Prompt. If it persists, reinstall Git for Windows. |
| `'npm' is not recognized…` | Close and reopen Command Prompt. If it persists, reinstall Node.js LTS. |
| `The system cannot find the path specified` | The project isn't downloaded yet, or you're in the wrong folder. Do "Download the project" first, then use the full path `cd %USERPROFILE%\landing-page\diorama\preview`. |
| `Port 5173 is in use` | Another preview is still running. Close its window, or use the new address Vite prints (e.g. `:5174`). |
| Sign-in fails during `git clone` | Make sure your GitHub account can access `brok3nby-design/landing-page`. |
| "raw export (not downloaded)" is greyed out | Expected. The unoptimised files are too large for git; they can be rebuilt with Blender (see `diorama/EXPORTS.md`). |
| The page stays on "loading…" | Refresh once. If it persists, press F12 → Console and send me the red error text. |
