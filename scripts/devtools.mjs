/**
 * Drives a running Obsidian over the Chrome DevTools Protocol for theme work.
 *
 * Usage: node scripts/devtools.mjs launch            # (re)start Obsidian with the debug port open
 *        node scripts/devtools.mjs windows           # list open vault windows and their themes
 *        node scripts/devtools.mjs reload            # reload the theme in every window using it
 *        node scripts/devtools.mjs screenshot [file] # save a PNG of the window (default: screenshot.png)
 *        node scripts/devtools.mjs screenshots       # regenerate img/hive-{dark,light}.png from test-vault
 *        node scripts/devtools.mjs eval <expr>       # evaluate JS in the window, print the result
 *        node scripts/devtools.mjs console           # stream console output until Ctrl-C
 *
 * Each open vault is its own window. Commands target the first window using
 * this theme; pass --vault <name> to pick one explicitly.
 *
 * The port defaults to 9223, since Chrome often holds 9222; override with
 * OBSIDIAN_DEBUG_PORT. Anything on this machine can control Obsidian while
 * the port is open, so only launch with it for development. Pair with
 * `npm run link-theme` so the vault's theme files point at this repo.
 */

import { execFileSync, spawnSync } from "child_process";
import fs from "fs";

const port = Number(process.env.OBSIDIAN_DEBUG_PORT ?? 9223);
const base = `http://127.0.0.1:${port}`;
const argv = process.argv.slice(2);
const vaultFlag = argv.indexOf("--vault");
const vault = vaultFlag >= 0 ? argv.splice(vaultFlag, 2)[1] : undefined;
const [command, ...args] = argv;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Obsidian windows are served from app://obsidian.md */
const isObsidianWindow = (t) => t.type === "page" && t.url.startsWith("app://");

async function portInUse() {
	try {
		await fetch(base);
		return true;
	} catch {
		return false;
	}
}

async function listTargets() {
	try {
		const res = await fetch(`${base}/json/list`);
		return await res.json();
	} catch {
		return null;
	}
}

async function launch() {
	if (process.platform !== "darwin") {
		console.error(`Quit Obsidian, then start it with --remote-debugging-port=${port}`);
		process.exit(1);
	}
	if ((await listTargets())?.some(isObsidianWindow)) {
		console.log(`Obsidian is already listening on ${base}`);
		return;
	}
	if (await portInUse()) {
		console.error(`Port ${port} is taken by another app; pick another with OBSIDIAN_DEBUG_PORT.`);
		process.exit(1);
	}
	// `open --args` is ignored when the app is already running, so quit it first
	spawnSync("osascript", ["-e", 'quit app "Obsidian"']);
	for (let i = 0; i < 50 && spawnSync("pgrep", ["-x", "Obsidian"]).status === 0; i++) {
		await sleep(200);
	}
	execFileSync("open", ["-a", "Obsidian", "--args", `--remote-debugging-port=${port}`]);
	for (let i = 0; i < 50; i++) {
		const targets = await listTargets();
		if (targets?.some(isObsidianWindow)) {
			console.log(`Obsidian is listening on ${base}`);
			return;
		}
		await sleep(200);
	}
	console.error(`Obsidian started, but nothing answered on port ${port}.`);
	process.exit(1);
}

/** Opens a minimal CDP client on one debug target */
async function connect(page) {
	const ws = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		ws.onopen = resolve;
		ws.onerror = reject;
	});

	let nextId = 1;
	const pending = new Map();
	const listeners = new Map();
	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data);
		if (msg.id && pending.has(msg.id)) {
			const { resolve, reject } = pending.get(msg.id);
			pending.delete(msg.id);
			msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
		} else if (msg.method) {
			listeners.get(msg.method)?.(msg.params);
		}
	};

	return {
		send(method, params = {}) {
			const id = nextId++;
			ws.send(JSON.stringify({ id, method, params }));
			return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
		},
		on(method, fn) {
			listeners.set(method, fn);
		},
		close() {
			ws.close();
		},
	};
}

async function evaluate(cdp, expression) {
	const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
		expression,
		awaitPromise: true,
		returnByValue: true,
	});
	if (exceptionDetails) {
		throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
	}
	return result.value;
}

const { name } = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

/** Connects to every Obsidian window and reads which vault and theme it shows */
async function openWindows() {
	const targets = await listTargets();
	if (targets === null) {
		console.error(`Nothing listening on port ${port}. Run: node scripts/devtools.mjs launch`);
		process.exit(1);
	}
	const windows = [];
	for (const target of targets.filter(isObsidianWindow)) {
		const cdp = await connect(target);
		const info = await evaluate(cdp, "({ vault: app.vault.getName(), theme: app.customCss.theme })");
		windows.push({ cdp, ...info });
	}
	return windows;
}

/** Picks the --vault window, or else the windows using this theme */
async function themeWindows() {
	const windows = await openWindows();
	const matches = windows.filter((w) => (vault ? w.vault === vault : w.theme === name));
	for (const w of windows) {
		if (!matches.includes(w)) w.cdp.close();
	}
	if (matches.length === 0) {
		const open = windows.map((w) => `${w.vault} (${w.theme || "default"})`).join(", ");
		console.error(
			vault
				? `No open window for vault "${vault}". Open: ${open}`
				: `No window uses ${name}. Open: ${open}. Select it in Settings → Appearance, or pass --vault.`,
		);
		process.exit(1);
	}
	return matches;
}

/** The single window that screenshot, eval and console act on */
async function themeWindow() {
	const [first, ...rest] = await themeWindows();
	for (const w of rest) w.cdp.close();
	return first;
}

const commands = {
	launch,

	async windows() {
		for (const w of await openWindows()) {
			console.log(`${w.vault}\t${w.theme || "default"}`);
			w.cdp.close();
		}
	},

	async reload() {
		for (const { cdp, vault, theme } of await themeWindows()) {
			if (theme !== name) {
				console.warn(`Skipping ${vault}: its theme is "${theme || "default"}", not ${name}.`);
			} else {
				// Obsidian caches theme.css and its file watcher misses edits made
				// through the symlink, so drop the cache entry and load it again
				await evaluate(
					cdp,
					`(async () => {
						const css = app.customCss;
						css.csscache.delete(css.getThemePath(css.theme));
						await css.loadTheme();
					})()`,
				);
				console.log(`Reloaded ${name} in ${vault}.`);
			}
			cdp.close();
		}
	},

	async screenshot() {
		const file = args[0] ?? "screenshot.png";
		const { cdp, vault } = await themeWindow();
		const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
		fs.writeFileSync(file, Buffer.from(data, "base64"));
		console.log(`Saved ${vault} window to ${file}`);
		cdp.close();
	},

	/** Regenerates img/hive-dark.png and img/hive-light.png from test-vault */
	async screenshots() {
		const windows = await openWindows();
		const target = vault ?? "test-vault";
		const win = windows.find((w) => w.vault === target);
		for (const w of windows) if (w !== win) w.cdp.close();
		if (!win) {
			console.error(`Open ${target} in Obsidian first.`);
			process.exit(1);
		}
		const { cdp } = win;

		// Fixed viewport so every run produces the same framing
		await cdp.send("Emulation.setDeviceMetricsOverride", {
			width: 1600,
			height: 900,
			deviceScaleFactor: 2,
			mobile: false,
		});
		const scheme = await evaluate(cdp, `app.vault.getConfig("theme")`);
		try {
			await evaluate(
				cdp,
				`(async () => {
					const ws = app.workspace;
					const file = (p) => app.vault.getAbstractFileByPath(p);
					ws.rightSplit.collapse();
					ws.leftSplit.expand();
					const explorer = ws.getLeavesOfType("file-explorer")[0]?.view;
					for (const item of Object.values(explorer?.fileItems ?? {})) item.setCollapsed?.(true);
					// Keep one pane so the root split still has a tab group to open into
					const left = ws.getLeaf(false);
					for (const leaf of ws.getLeavesOfType("markdown")) if (leaf !== left) leaf.detach();
					await left.openFile(file("Showcase.md"), { state: { mode: "source" } });
					const right = ws.getLeaf("split", "vertical");
					await right.openFile(file("Callouts.md"), { state: { mode: "preview" } });
					ws.setActiveLeaf(left, { focus: false });
					document.activeElement?.blur();
					ws.trigger("resize");
				})()`,
			);
			// Light mode uses a darker amber so accent text keeps 4.5:1 on the cream background.
			// setAccentColor only changes the window; the vault's accentColor setting is untouched.
			for (const [mode, file, accent] of [
				["obsidian", "img/hive-dark.png"],
				["moonstone", "img/hive-light.png", "#9a6700"],
			]) {
				await evaluate(cdp, `app.changeTheme(${JSON.stringify(mode)})`);
				await evaluate(cdp, accent ? `app.setAccentColor(${JSON.stringify(accent)})` : `app.updateAccentColor()`);
				await sleep(500);
				const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
				fs.writeFileSync(new URL(`../${file}`, import.meta.url), Buffer.from(data, "base64"));
				console.log(`Saved ${file}`);
			}
		} finally {
			await evaluate(cdp, `app.changeTheme(${JSON.stringify(scheme)})`);
			await evaluate(cdp, `app.updateAccentColor()`);
			await cdp.send("Emulation.clearDeviceMetricsOverride");
			cdp.close();
		}
	},

	async eval() {
		const { cdp } = await themeWindow();
		const value = await evaluate(cdp, args.join(" "));
		console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
		cdp.close();
	},

	async console() {
		const { cdp, vault } = await themeWindow();
		cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
			const text = args.map((a) => a.value ?? a.description ?? a.type).join(" ");
			console.log(`[${type}] ${text}`);
		});
		cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
			console.log(`[exception] ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
		});
		await cdp.send("Runtime.enable");
		console.log(`Streaming console output from ${vault} (Ctrl-C to stop)…`);
	},
};

if (!commands[command]) {
	console.error("Usage: node scripts/devtools.mjs [--vault <name>] <launch|windows|reload|screenshot [file]|screenshots|eval <expr>|console>");
	process.exit(1);
}
await commands[command]();
