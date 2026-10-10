# Hive

A dark/light Obsidian theme with yellow and amber accents.

Hive is a fork of [Wasp](https://github.com/santiyounger/Wasp-Obsidian-Theme) by [Santi Younger](https://santiyounger.com/).

## Dark mode
![Hive dark mode](img/hive-dark.png)
Dark backgrounds with yellow accents.

## Light mode
![Hive light mode](img/hive-light.png)
Light cream backgrounds with amber accents.

## Install and Use

**Settings → Appearance → Themes → Manage** → search **Hive** → **Install** → select **Hive** as your theme.

## Fonts

Hive uses Obsidian's default fonts: the normal text font for notes (in both the editing and reading views) and the monospace font only for code.

To change them, go to **Settings → Appearance → Font**: pick a **Text font**, a **Monospace font**, or change the **Font size**.

## Helper classes

Hive supports some of [Minimal's helper classes](https://minimal.guide/features/helper-classes). To use one in a note, add it to the `cssclasses` property:

```yaml
---
cssclasses:
  - table-wide
---
```

### Block widths

These need **Settings → Editor → Readable line length** turned on. Without it, notes already use the full width of the pane.

| Class | Effect |
| --- | --- |
| `wide` | Makes the whole note wide (readable line length + 300px) |
| `max` | Makes the whole note use 88% of the pane |
| `table-wide`, `img-wide`, `iframe-wide` | Makes only tables (including Bases and Dataview tables), images or iframes wide |
| `table-max`, `img-max`, `iframe-max` | Makes only tables, images or iframes use 88% of the pane |
| `table-100`, `img-100`, `iframe-100` | Makes only tables, images or iframes use the full width of the pane |

## Development

`test-vault/` has sample notes for every surface the theme styles. Its theme files are symlinks to this repo. Open it with **Open folder as vault**.

To work on the theme live, start Obsidian with the debug port open and reload the CSS after each edit:

```sh
npm run devtools -- launch                         # restart Obsidian with --remote-debugging-port=9223
npm run devtools -- --vault test-vault reload      # re-read theme.css
npm run devtools -- --vault test-vault screenshot  # save screenshot.png
```

See `scripts/devtools.mjs` for the other commands (`windows`, `eval`, `console`).

## License

MIT — see [LICENSE](LICENSE).

**Hive** by Peter Kristensen, based on **[Wasp](https://github.com/santiyounger/Wasp-Obsidian-Theme)** by Santi Younger.
