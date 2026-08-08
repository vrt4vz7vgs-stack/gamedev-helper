const { app, BrowserWindow, session, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

app.setName("ForgeAI");

/* ---------------- UE5 project pairing (IPC) ---------------- */

async function findModules(dir) {
  const modules = [];
  let sourceDir;
  try {
    sourceDir = await fsp.readdir(path.join(dir, "Source"), { withFileTypes: true });
  } catch (err) {
    return modules;
  }
  for (const entry of sourceDir) {
    if (!entry.isDirectory()) continue;
    try {
      const files = await fsp.readdir(path.join(dir, "Source", entry.name));
      const buildCs = files.find((f) => f.endsWith(".Build.cs"));
      if (buildCs) {
        modules.push({
          name: entry.name,
          dir: path.join(dir, "Source", entry.name),
          buildCs: path.join(dir, "Source", entry.name, buildCs),
          kind: "module",
        });
      }
    } catch (err) {
      /* skip unreadable dirs */
    }
  }
  return modules;
}

ipcMain.handle("forgeai:select-project", async () => {  const res = await dialog.showOpenDialog({
    title: "Pair ForgeAI to your UE5 project",
    properties: ["openFile"],
    filters: [{ name: "Unreal Engine project", extensions: ["uproject"] }],
  });
  if (res.canceled || !res.filePaths.length) return null;

  const manifestPath = res.filePaths[0];
  const dir = path.dirname(manifestPath);
  const name = path.basename(manifestPath, ".uproject");

  let modules = await findModules(dir);

  // also scan plugins inside the project (game plugins under Plugins/<Name>/)
  try {
    const pluginsRoot = path.join(dir, "Plugins");
    for (const entry of await fsp.readdir(pluginsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        const pluginFiles = await fsp.readdir(path.join(pluginsRoot, entry.name));
        if (!pluginFiles.some((f) => f.endsWith(".uplugin"))) continue;
        const pluginModules = await findModules(path.join(pluginsRoot, entry.name));
        for (const m of pluginModules) {
          m.kind = "plugin";
          m.plugin = entry.name;
        }
        modules = modules.concat(pluginModules);
      } catch (err) {
        /* skip */
      }
    }
  } catch (err) {
    /* no Plugins folder */
  }

  return { path: manifestPath, dir: dir, name: name, manifestPath: manifestPath, modules: modules };
});

ipcMain.handle("forgeai:write-project-files", async (event, payload) => {
  const pair = payload && payload.pair;
  const files = (payload && payload.files) || [];
  if (!pair || !pair.dir || !pair.module || !Array.isArray(files)) {
    return { written: [], manifest: null, warnings: ["Invalid write request."] };
  }

  const moduleDir = path.join(pair.dir, "Source", pair.module);
  const written = [];
  const warnings = [];
  let manifestNote = null;

  try {
    await fsp.mkdir(moduleDir, { recursive: true });
  } catch (err) {
    return { written: [], manifest: null, warnings: ["Could not create " + moduleDir + ": " + err.message] };
  }

  for (const file of files) {
    const target = path.join(moduleDir, file.filename);

    // Build.cs files are handled specially: never overwrite the project's
    // existing module file — just make sure ProceduralMeshComponent is listed.
    if (file.filename.endsWith(".Build.cs")) {
      let existed = true;
      let content;
      try {
        content = await fsp.readFile(target, "utf8");
      } catch (err) {
        existed = false;
        content = null;
      }
      if (!existed) {
        await fsp.writeFile(target, file.code, "utf8");
        written.push({ filename: file.filename, path: target, action: "created" });
      } else if (!/ProceduralMeshComponent/.test(content)) {
        const updated = ensureBuildCsDependency(content);
        await fsp.writeFile(target, updated, "utf8");
        written.push({ filename: file.filename, path: target, action: "dependency-added" });
      } else {
        written.push({ filename: file.filename, path: target, action: "dependency-ok" });
      }
      continue;
    }

    // all other generated files: overwrite freely (they are generated)
    let existed = true;
    try {
      await fsp.access(target);
    } catch (err) {
      existed = false;
    }
    await fsp.writeFile(target, file.code, "utf8");
    written.push({ filename: file.filename, path: target, action: existed ? "updated" : "created" });
  }

  // enable the ProceduralMeshComponent plugin in the .uproject (or .uplugin)
  try {
    manifestNote = enableProcMeshPlugin(pair.manifestPath || pair.path);
  } catch (err) {
    warnings.push("Could not update project manifest: " + err.message);
  }

  return { written: written, manifest: manifestNote, warnings: warnings };
});

/* add "ProceduralMeshComponent" to a string[] PublicDependencyModuleNames list */
function ensureBuildCsDependency(content) {
  if (/ProceduralMeshComponent/.test(content)) {
    return content;
  }
  const arrayRe = /(PublicDependencyModuleNames\.AddRange\(new string\[\] \{[^\n]*?)(\})/;
  if (arrayRe.test(content)) {
    return content.replace(arrayRe, (m, pre, end) => pre + '"ProceduralMeshComponent", ' + end);
  }
  const addLine = /\n[ \t]*PublicDependencyModuleNames\.Add\(/;
  if (addLine.test(content)) {
    const line = "\n\t\tPublicDependencyModuleNames.Add(\"ProceduralMeshComponent\");";
    return content.replace(addLine, line + "\n" + "$&");
  }
  return content.replace(/PublicDependencyModuleNames\.AddRange\(new string\[\] \{(.*?)\}\)/, (m, inner) =>
    "PublicDependencyModuleNames.AddRange(new string[] {" + inner + '"ProceduralMeshComponent" })'
  );
}

/* enable the ProceduralMeshComponent plugin in a .uproject / .uplugin (best-effort text edit) */
function enableProcMeshPlugin(manifestPath) {
  if (!manifestPath) return null;
  let text = fs.readFileSync(manifestPath, "utf8");
  if (/ProceduralMeshComponent/.test(text)) {
    return null;
  }
  const pluginEntry = '\t{ "Name": "ProceduralMeshComponent", "Enabled": true }';
  const pluginsRe = /"Plugins"\s*:\s*\[([\s\S]*?)\]/;
  if (pluginsRe.test(text)) {
    text = text.replace(pluginsRe, (m, inner) => {
      const cleaned = inner.replace(/^[ \t]*\r?\n?/, "");
      const body = cleaned.endsWith("\n") ? cleaned : cleaned + "\n";
      return '"Plugins": [\n' + body + pluginEntry + "\n\t]";
    });
  } else {
    const idx = text.lastIndexOf("}");
    if (idx <= 0) return null;
    text = text.slice(0, idx) + ',\n\t"Plugins": [\n' + pluginEntry + "\n\t]" + text.slice(idx);
  }
  fs.writeFileSync(manifestPath, text, "utf8");
  return "Enabled ProceduralMeshComponent plugin in " + path.basename(manifestPath);
}

/* ---------------- window ---------------- */

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(
      permission === "clipboard-read" ||
      permission === "clipboard-write" ||
      permission === "fullscreen"
    );
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    title: "ForgeAI - Game Dev Assistant",
    icon: path.join(__dirname, "build", "icon.ico"),
    backgroundColor: "#0b0c12",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "app", "index.html"));
});

/* ---------------- DeepSeek AI chat (IPC) ----------------
   Browser CORS blocks api.deepseek.com, so the desktop app
   calls it from the main process (no CORS restrictions). */

ipcMain.handle("forgeai:deepseek-chat", async (_event, payload) => {
  const apiKey = payload && payload.apiKey;
  const messages = (payload && payload.messages) || [];
  if (!apiKey) {
    return { ok: false, status: 400, data: { error: { message: "No API key" } } };
  }
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: (payload && payload.model) || "deepseek-v4-flash",
        messages: messages,
        stream: false,
      }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: { message: String(err && err.message || err) } } };
  }
});

app.on("window-all-closed", () => app.quit());
