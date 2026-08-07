/* ============================================================
   Build script — ForgeAI Studio plugin (.rbxmx)
   1) loads js/roblox.js and extracts the Lua template packs
   2) injects them into plugins/forgeai-plugin.source.lua
   3) wraps the result in an .rbxmx model + site zip
   Run: node tools/build-plugin.js
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const JS = (f) => path.join(ROOT, "js", f);
const read = (p) => fs.readFileSync(p, "utf8");

/* ---------------- load RobloxLib ---------------- */
const robloxSrc = read(JS("roblox.js"));
const RobloxLib = new Function(robloxSrc + "\n;return RobloxLib;")();

/* ---------------- pack metadata (mirrors js/app.js INTENTS) ---------------- */
const PACKS = [
  {
    id: "roblox-animations",
    title: "Roblox Animation System",
    keywords: ["animat", "walk", "run", "jump", "emote", "idle", "keyframe", "dance", "sprint", "fps", "rig"],
    lib: RobloxLib.animations,
  },
  {
    id: "roblox-gui",
    title: "Roblox GUI Pack",
    keywords: ["gui", "hud", "ui", "menu", "shop", "inventory", "health bar", "stamina", "damage number", "button", "screen", "interface"],
    lib: RobloxLib.gui,
  },
  {
    id: "roblox-scripts",
    title: "Roblox Game Script Kit",
    keywords: ["script", "tool", "combat", "sword", "npc", "ai", "admin", "data", "save", "checkpoint", "system", "kit", "server", "obby", "leaderstats"],
    lib: RobloxLib.scripts,
  },
];

/* filename -> [container, className, note?]  (matches the site's install steps) */
const PLACEMENT = {
  "AnimationKit.lua": ["ReplicatedStorage", "ModuleScript"],
  "AnimationPlayer.client.lua": ["StarterPlayerScripts", "LocalScript"],
  "BuildKeyframes.lua": ["ServerScriptService", "Script"],
  "hud.client.lua": ["StarterPlayerScripts", "LocalScript"],
  "shop.client.lua": ["StarterPlayerScripts", "LocalScript"],
  "mainmenu.client.lua": ["StarterPlayerScripts", "LocalScript"],
  "PlayerSetup.server.lua": ["ServerScriptService", "Script"],
  "CombatSystem.server.lua": ["ServerScriptService", "Script"],
  "SwordClient.client.lua": ["ServerStorage", "LocalScript", "drag this into your Sword Tool before testing"],
  "NPC_AI.server.lua": ["ServerScriptService", "Script"],
  "AdminCommands.server.lua": ["ServerScriptService", "Script"],
  "DataSave.server.lua": ["ServerScriptService", "Script"],
  "CheckpointSystem.server.lua": ["ServerScriptService", "Script"],
};

function placementFor(filename) {
  if (PLACEMENT[filename]) return PLACEMENT[filename];
  if (filename.endsWith(".client.lua")) return ["StarterPlayerScripts", "LocalScript"];
  if (filename.endsWith(".server.lua")) return ["ServerScriptService", "Script"];
  return ["ServerScriptService", "Script"];
}

/* ---------------- Lua string serialization ---------------- */
function luaString(s) {
  const runs = s.match(/\]+/g) || [];
  let maxRun = 0;
  for (const r of runs) maxRun = Math.max(maxRun, r.length);
  const level = Math.max(maxRun + 1, 1);
  const eq = "=".repeat(level);
  return "[" + eq + "[" + s + "]" + eq + "]";
}

function serializePacks() {
  const parts = [];
  for (const pack of PACKS) {
    const fileParts = [];
    for (const f of pack.lib.files) {
      const [location, className, note] = placementFor(f.filename);
      fileParts.push(
        "{\n" +
          '\t\t\tname = "' + f.filename + '",\n' +
          '\t\t\tlocation = "' + location + '",\n' +
          '\t\t\tclassName = "' + className + '",\n' +
          (note ? '\t\t\tnote = "' + note + '",\n' : "") +
          "\t\t\tcode = " + luaString(f.code) + ",\n" +
          "\t\t}"
      );
    }
    const kw = pack.keywords.map((k) => '"' + k + '"').join(", ");
    parts.push(
      "{\n" +
        '\tid = "' + pack.id + '",\n' +
        '\ttitle = "' + pack.title + '",\n' +
        "\tkeywords = { " + kw + " },\n" +
        "\tfiles = {\n\t\t" + fileParts.join(",\n\t\t") + ",\n\t},\n" +
        "}"
    );
  }
  return "{\n\t" + parts.join(",\n\t") + ",\n}";
}

/* ---------------- build the plugin source ---------------- */
const sourceTemplate = read(path.join(ROOT, "plugins", "forgeai-plugin.source.lua"));
if (!sourceTemplate.includes("--[[__PACKS_INJECT__]]")) {
  console.error("ERROR: marker --[[__PACKS_INJECT__]] not found in source template");
  process.exit(1);
}
const pluginLua = sourceTemplate.replace("--[[__PACKS_INJECT__]]", serializePacks());

/* sanity checks */
for (const bad of ["]]>"]) {
  if (pluginLua.includes(bad)) {
    console.error("ERROR: plugin source contains unsafe sequence " + bad);
    process.exit(1);
  }
}
let open = 0;
for (const ch of pluginLua) {
  if (ch === "{") open++;
  else if (ch === "}") open--;
}
if (open !== 0) {
  console.error("ERROR: unbalanced braces in generated plugin (" + open + ")");
  process.exit(1);
}
console.log("plugin source: " + pluginLua.length + " chars, braces balanced");

/* ---------------- write .rbxmx model ---------------- */
const outDir = path.join(ROOT, "downloads");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const cdata = pluginLua.replace(/\]\]>/g, "]]]]><![CDATA[>");
const rbxmx =
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n' +
  "\t<External>null</External>\n" +
  "\t<External>nil</External>\n" +
  '\t<Item class="Script" referent="RBX0">\n' +
  "\t\t<Properties>\n" +
  '\t\t\t<string name="Name">ForgeAI</string>\n' +
  '\t\t\t<ProtectedString name="Source"><![CDATA[' + cdata + "]]></ProtectedString>\n" +
  "\t\t</Properties>\n" +
  "\t</Item>\n" +
  '\t<Metadata signature="roblox" filetype="rbxmx" />\n' +
  "</roblox>";

fs.writeFileSync(path.join(outDir, "ForgeAIPlugin.rbxmx"), rbxmx);
console.log("wrote downloads/ForgeAIPlugin.rbxmx (" + rbxmx.length + " bytes)");

/* ---------------- also validate with LuaFixer ---------------- */
const fixerSrc = read(JS("fixer.js"));
const LuaFixer = new Function(fixerSrc + "\n;return LuaFixer;")();
const res = LuaFixer.analyze(pluginLua);
const errs = res.issues.filter((i) => i.severity === "error");
if (errs.length) {
  console.log("LuaFixer: " + errs.length + " error(s) in plugin source:");
  for (const e of errs.slice(0, 10)) console.log("   L" + e.line + ": " + e.message);
  process.exit(1);
}
console.log("LuaFixer: plugin source clean (0 errors)");

/* ---------------- site zip (keeps the existing card working) ---------------- */
const zipper = require("child_process").execFileSync;
const args = [
  "a", "-tzip", "-y", "-b", process.env.TEMP,
  path.join(ROOT, "ForgeAI-site.zip"),
  "index.html", "css", "js", "plugins", "downloads",
];
try {
  zipper("7z", args, { cwd: ROOT, stdio: "ignore" });
  console.log("wrote ForgeAI-site.zip (7z)");
} catch {
  const { execSync } = require("child_process");
  try {
    execSync('powershell -NoProfile -Command "Compress-Archive -Force -Path index.html,css,js,plugins,downloads -DestinationPath ForgeAI-site.zip"', { cwd: ROOT, stdio: "ignore" });
    console.log("wrote ForgeAI-site.zip (Compress-Archive)");
  } catch {
    console.warn("could not create ForgeAI-site.zip - install 7-Zip or run the PowerShell fallback");
  }
}
