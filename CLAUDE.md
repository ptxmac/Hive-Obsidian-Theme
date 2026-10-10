# Hive Obsidian theme

The whole theme is `theme.css`; `manifest.json` names it. Releases ship only those two files (see `.github/workflows/release-version.yml`).

## Testing a change

Check every CSS change in a running Obsidian, in `test-vault/`. Don't guess at Obsidian's DOM. Read it with `eval`.

1. **Check Obsidian is reachable**: `node scripts/devtools.mjs windows` lists open vault windows and their themes. If nothing answers on port 9223, ask the user before running `node scripts/devtools.mjs launch`, because it quits and restarts their Obsidian.
2. **Make sure `test-vault` is open.** If it's missing from `windows`, open it from any window:
   ```sh
   node scripts/devtools.mjs --vault <any-open-vault> eval 'String(window.electron.ipcRenderer.sendSync("vault-open", "'"$PWD"'/test-vault", false))'
   ```
3. **Edit `theme.css`, then reload**: `node scripts/devtools.mjs --vault test-vault reload`. Obsidian does not notice edits on its own, because its file watcher misses changes made through the symlink.
4. **Open the note that covers the feature** and look at it:
   ```sh
   node scripts/devtools.mjs --vault test-vault eval 'app.workspace.getLeaf().openFile(app.vault.getAbstractFileByPath("Tables.md"), {state: {mode: "preview"}}).then(() => "ok")'
   node scripts/devtools.mjs --vault test-vault screenshot <scratchpad>/shot.png
   ```
   Then view the PNG with Read. Save screenshots to your scratchpad, not the repo.
5. **Check both color schemes and both views.** Most rules differ between `.theme-dark` and `.theme-light`, and between reading view (`mode: "preview"`) and editing view (`mode: "source"`):
   ```sh
   node scripts/devtools.mjs --vault test-vault eval 'app.changeTheme("moonstone")'  # light
   node scripts/devtools.mjs --vault test-vault eval 'app.changeTheme("obsidian")'   # dark
   node scripts/devtools.mjs --vault test-vault eval 'app.changeTheme("system")'     # restore before finishing
   ```
   `changeTheme` writes to `test-vault/.obsidian/appearance.json`, which is tracked in git, so always restore `"system"`.
6. **Check exact values with `eval`** when a screenshot can't show them, e.g. `getComputedStyle(document.querySelector(".markdown-preview-view table")).width`. Return strings or plain JSON; DOM nodes don't serialize.
7. **After changing colors**, run `node scripts/check-contrast.mjs`. It checks the palettes against the community theme contrast rules.

Only drive the `test-vault` window. The user's other vaults are personal; don't screenshot them or run `eval` in them unless asked.

## Where to test what

| Feature | Note in `test-vault/` |
| --- | --- |
| Headings, inline formatting, links, tags, blockquotes, `hr`, footnotes, properties | `Typography.md` |
| Lists, tasks, custom task statuses | `Lists and tasks.md` |
| Callouts (folded, nested) | `Callouts.md` |
| Syntax highlighting, math, Mermaid | `Code and math.md` |
| Markdown tables | `Tables.md` |
| Image, note and base embeds | `Embeds.md` |
| Bases (table and cards views) | `Books.base` |
| Width helper classes (`cssclasses`) | `Widths/<class>.md` |

Width helpers only apply with **Readable line length** on (`app.vault.getConfig("readableLineLength")`). Each `Widths/` note also has a table inside a callout, which should stay at the callout's width.

When adding a feature with no matching note, add an example to the vault in the same change. Obsidian already shows the note's title above the content, so don't start notes with a `# Title` that repeats the file name. Dataview isn't installed, so Dataview table rules can't be tested here.

## README screenshots

`npm run screenshots` regenerates `img/hive-dark.png` and `img/hive-light.png` from `test-vault`. It sets a fixed 1600×900 @2x viewport, arranges `Showcase.md` (editing view) next to `Callouts.md` (reading view), and restores the window size and color scheme afterwards. Re-run it after visible changes to the theme and view both PNGs before committing. To change what's in the screenshots, edit `Showcase.md`, which exists only for the screenshots, and keep it short enough to fit without scrolling.

## devtools.mjs notes

- The port is 9223 because Chrome often holds 9222. Override it with `OBSIDIAN_DEBUG_PORT`.
- Without `--vault`, commands target the first window whose theme is Hive. That may be one of the user's own vaults, so pass `--vault test-vault`.
- `eval` runs every snippet in the same page, so top-level `const` and `let` names from earlier calls still exist and redeclaring them fails. Wrap multi-statement snippets in `(() => { ... })()`.
- `eval` runs in Obsidian's window, where the global `app` is Obsidian's internal (undocumented) API. Read a function's source with `app.foo.toString()` before relying on it.
