/**
 * Installs the theme into every vault Obsidian currently has open.
 *
 * Usage: node scripts/install.mjs          # copy theme files
 *        node scripts/install.mjs --link   # symlink, so edits show up live
 *
 * Open vaults are read from Obsidian's vault registry (obsidian.json). The
 * "open" flag survives quitting, so with Obsidian closed this targets the
 * vaults that were open last.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = ["manifest.json", "theme.css"];
const link = process.argv.includes("--link");

function configDir() {
	const home = os.homedir();
	switch (process.platform) {
		case "darwin":
			return path.join(home, "Library", "Application Support", "obsidian");
		case "win32":
			return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "obsidian");
		default:
			return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "obsidian");
	}
}

const registry = path.join(configDir(), "obsidian.json");
if (!fs.existsSync(registry)) {
	console.error(`Obsidian vault registry not found: ${registry}`);
	process.exit(1);
}

const { vaults = {} } = JSON.parse(fs.readFileSync(registry, "utf8"));
const open = Object.values(vaults).filter((v) => v.open);
if (open.length === 0) {
	console.error("No open vaults found.");
	process.exit(1);
}

// Obsidian requires the theme folder name to match the manifest name
const { name } = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

for (const vault of open) {
	const dest = path.join(vault.path, ".obsidian", "themes", name);
	fs.mkdirSync(dest, { recursive: true });
	for (const file of files) {
		const target = path.join(dest, file);
		fs.rmSync(target, { force: true });
		if (link) {
			fs.symlinkSync(path.join(root, file), target);
		} else {
			fs.copyFileSync(path.join(root, file), target);
		}
	}
	console.log(`${link ? "Linked" : "Installed"} ${name} → ${dest}`);
}
