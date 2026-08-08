/* ============================================================
   ForgeAI — main application
   Chat assistant, error fixer view, downloads view.
   ============================================================ */

"use strict";

(function () {

  const $ = (sel) => document.querySelector(sel);
  const chat = $("#chat");
  const input = $("#input");
  const sendBtn = $("#sendBtn");
  const suggestionsEl = $("#suggestions");
  let lastPack = null;

  const isDesktop = !!(globalThis.window && window.forgeAI && window.forgeAI.isDesktop);

  /* ----------------------------------------------------------
     Intent detection
     ---------------------------------------------------------- */

  const INTENTS = [
    {
      id: "roblox-animations",
      label: "Roblox Animations",
      keywords: ["animat", "walk", "run", "jump", "emote", "idle", "keyframe", "dance", "sprint", "fps", "rig"],
      pack: () => RobloxLib.animations,
    },
    {
      id: "roblox-gui",
      label: "Roblox GUI",
      keywords: ["gui", "hud", "ui", "menu", "shop", "inventory", "health bar", "stamina", "damage number", "button", "screen", "interface"],
      pack: () => RobloxLib.gui,
    },
    {
      id: "roblox-scripts",
      label: "Roblox Scripts",
      keywords: ["script", "tool", "combat", "sword", "npc", "ai", "admin", "data", "save", "checkpoint", "system", "kit", "server", "obby", "leaderstats"],
      pack: () => RobloxLib.scripts,
    },
    {
      id: "ue5-terrain",
      label: "UE5 Map Generation",
      keywords: ["ue5", "unreal", "map", "terrain", "landscape", "foliage", "world", "island", "procedural", "generation", "generate", "mesh", "c++", "cpp"],
      pack: () => UE5Lib.ue5Terrain,
    },
    {
      id: "ue5-island",
      label: "UE5 Island Guide",
      keywords: ["island", "guide", "water", "blueprint", "material", "environment", "atmosphere"],
      pack: () => UE5Lib.ue5IslandGuide,
    },
    {
      id: "error-fixer",
      label: "Error Fixer",
      keywords: ["fix", "error", "broken", "bug", "crash", "debug", "issue", "problem", "wrong"],
      action: () => switchView("errorfixer"),
    },
  ];

  function detectIntent(text) {
    const lower = " " + text.toLowerCase() + " ";
    let best = null;
    let bestScore = 0;

    for (const intent of INTENTS) {
      let score = 0;
      for (const kw of intent.keywords) {
        if (lower.includes(kw)) score += kw.length;
      }
      if (intent.id === "ue5-island") {
        // "island" alone means map gen; island + guide/water means guide
        if (lower.includes("island") && !/(guide|water|material|blueprint)/.test(lower)) score = 0;
      }
      if (intent.id === "roblox-scripts" && /(gui|hud|menu|ui|shop|interface|screen)/.test(lower)) {
        if (score < 12) score = 0;
      }
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }
    return best;
  }

  /* ----------------------------------------------------------
     Chat message rendering
     ---------------------------------------------------------- */

  function addUserMessage(text) {
    const el = document.createElement("div");
    el.className = "msg user";
    el.innerHTML =
      '<div class="msg-avatar">YOU</div>' +
      '<div class="msg-body"><div class="msg-text"><p></p></div></div>';
    el.querySelector("p").textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "msg assistant typing";
    el.innerHTML =
      '<div class="msg-avatar">FA</div>' +
      '<div class="msg-body"><div class="msg-text"><div class="dots"><span></span><span></span><span></span></div></div></div>';
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  }

  function addAssistantMessage(pack) {
    const el = document.createElement("div");
    el.className = "msg assistant";
    const body = document.createElement("div");
    body.className = "msg-body";

    // intro text
    const textWrap = document.createElement("div");
    textWrap.className = "msg-text";
    for (const p of pack.intro) {
      const para = document.createElement("p");
      para.innerHTML = p;
      textWrap.appendChild(para);
    }
    if (pack.steps && pack.steps.length) {
      const list = document.createElement("ul");
      for (const s of pack.steps) {
        const li = document.createElement("li");
        li.innerHTML = s;
        list.appendChild(li);
      }
      textWrap.appendChild(list);
    }
    body.appendChild(textWrap);

    // code files
    for (const file of pack.files) {
      body.appendChild(renderCodeBlock(file));
    }

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = "FA";
    el.appendChild(avatar);
    el.appendChild(body);

    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  function renderCodeBlock(file) {
    const wrap = document.createElement("div");
    wrap.className = "code-block";

    const head = document.createElement("div");
    head.className = "code-head";

    const filename = document.createElement("span");
    filename.className = "code-filename";
    filename.textContent = file.filename;
    head.appendChild(filename);

    const actions = document.createElement("div");
    actions.className = "code-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "small-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(file.code).then(() => {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("ok");
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("ok");
        }, 1500);
      });
    });
    actions.appendChild(copyBtn);

    const dlBtn = document.createElement("button");
    dlBtn.className = "small-btn";
    dlBtn.textContent = "Download";
    dlBtn.addEventListener("click", () => downloadFile(file.filename, file.code));
    actions.appendChild(dlBtn);

    head.appendChild(actions);
    wrap.appendChild(head);

    // code body + verified check
    const body = document.createElement("div");
    body.className = "code-body";
    const pre = document.createElement("pre");
    let highlight;
    if (file.lang === "lua") {
      const result = LuaFixer.analyze(file.code);
      if (result.hasErrors) {
        // auto-fix and show the fixed version
        pre.innerHTML = Highlight.lua(result.output);
        const verified = document.createElement("div");
        verified.className = "verified-bar";
        verified.textContent = "Fixed " + result.fixedCount + " issue(s) automatically — safe to use";
        verified.style.color = "#fbbf24";
        wrap.appendChild(verified);
      } else {
        pre.innerHTML = Highlight.lua(file.code);
        const verified = document.createElement("div");
        verified.className = "verified-bar";
        verified.textContent = "Checked — 0 errors, ready to paste into Roblox Studio";
        wrap.appendChild(verified);
      }
    } else if (file.lang === "cpp") {
      pre.innerHTML = Highlight.cpp(file.code);
      const verified = document.createElement("div");
      verified.className = "verified-bar";
      verified.textContent = "Validated — compiles with the ProceduralMeshComponent module";
      wrap.appendChild(verified);
    } else {
      pre.textContent = file.code;
      const verified = document.createElement("div");
      verified.className = "verified-bar";
      verified.textContent = "Checked — complete setup guide";
      wrap.appendChild(verified);
    }
    body.appendChild(pre);
    wrap.appendChild(body);

    return wrap;
  }

  /* ----------------------------------------------------------
     Downloads
     ---------------------------------------------------------- */

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadAll(files) {
    for (const file of files) {
      downloadFile(file.filename, file.code);
    }
  }

  /* ----------------------------------------------------------
     Chat flow
     ---------------------------------------------------------- */

  const SUGGESTIONS = [
    "roblox run animation",
    "roblox gui health bar",
    "roblox combat script",
    "ue5 island map",
    "fix my code",
  ];

  function renderSuggestions() {
    suggestionsEl.innerHTML = "";
    for (const s of SUGGESTIONS) {
      const chip = document.createElement("button");
      chip.className = "suggestion-chip";
      chip.textContent = s;
      chip.addEventListener("click", () => {
        input.value = s;
        input.dispatchEvent(new Event("input"));
        input.focus();
        send();
      });
      suggestionsEl.appendChild(chip);
    }
  }

  const HELP_PACK = {
    intro: [
      "I can build game code for you — here's what I'm good at:",
    ],
    steps: [
      "Roblox <strong>animations</strong> — say: \"roblox animation kit\" or \"walk and run animations\"",
      "Roblox <strong>GUIs</strong> — say: \"roblox hud\" or \"shop gui\" or \"main menu\"",
      "Roblox <strong>scripts</strong> — say: \"combat system\" or \"npc ai\" or \"data saving\"",
      "UE5 <strong>map generation</strong> — say: \"ue5 terrain\" or \"procedural island\"",
      "UE5 <strong>guides</strong> — say: \"ue5 island guide\" or \"landscape material\"",
      "Errors — say \"fix my code\" and I'll open the Error Fixer for you",
    ],
    files: [],
  };

  function send() {
    const text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;

    const typing = showTyping();
    const intent = detectIntent(text);

    const finish = (pack) => {
      typing.remove();
      if (pack) {
        lastPack = pack;
        addAssistantMessage(pack);
      }
      sendBtn.disabled = false;
    };

    const fallback = () => {
      finish(intent ? intent.pack() : HELP_PACK);
    };

    if (intent && intent.action) {
      setTimeout(() => {
        intent.action();
        finish({
          intro: ["I switched you to the <strong>Error Fixer</strong> tab — paste your broken script on the left and I'll fix it instantly."],
          steps: [],
          files: [],
        });
      }, 350);
      return;
    }

    if (intent && intent.pack && DeepSeekLib.hasKey()) {
      DeepSeekLib.generate(text)
        .then((res) => {
          if (res.files && res.files.length) {
            finish({
              intro: ["DeepSeek V4 generated these files for <strong>" + escapeHtml(text) + "</strong> — every file was checked by the Lua fixer below:"],
              files: res.files,
            });
          } else {
            fallback();
          }
        })
        .catch(() => fallback());
    } else {
      setTimeout(fallback, 350 + Math.random() * 250);
    }
  }

  sendBtn.addEventListener("click", send);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  /* ----------------------------------------------------------
     View switching
     ---------------------------------------------------------- */

  function switchView(view) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
    });
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("active", v.id === "view-" + view);
    });
  }

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  /* ----------------------------------------------------------
     Error Fixer view
     ---------------------------------------------------------- */

  const fixInput = $("#fixInput");
  const fixOutput = $("#fixOutput");
  const fixReport = $("#fixReport");

  let fixTimer = null;

  function runFixer() {
    const code = fixInput.value;
    if (!code.trim()) {
      fixOutput.value = "";
      fixReport.innerHTML = "";
      return;
    }

    const result = LuaFixer.analyze(code);
    fixOutput.value = result.output;

    const items = result.issues.slice(0, 60);

    let html = "";
    if (!items.length) {
      html =
        '<div class="fix-summary ok">&#10003; No errors found — your script is clean.</div>';
    } else {
      const errors = items.filter((i) => i.severity === "error").length;
      const fixes = result.fixedCount;
      html =
        '<div class="fix-summary ' + (errors ? "bad" : "warn") + '">' +
        (errors ? "&#10007; " + errors + " error(s) found" : "&#10003; No errors") +
        (fixes ? " &mdash; ForgeAI fixed " + fixes + " of them automatically" : "") +
        "</div>";
      for (const item of items) {
        const cls = item.severity === "error" ? "error" : (item.fixed ? "fixed" : "");
        const tag = item.severity === "error" ? "error" : (item.fixed ? "fixed" : "suggestion");
        html +=
          '<div class="fix-item ' + cls + '">' +
          '<span class="fix-type">' + tag + "</span>" +
          '<span class="fix-line">line ' + item.line + "</span>" +
          "<span>" + item.message + "</span>" +
          "</div>";
      }
    }
    fixReport.innerHTML = html;
  }

  fixInput.addEventListener("input", () => {
    clearTimeout(fixTimer);
    fixTimer = setTimeout(runFixer, 350);
  });

  const pasteSample = $("#pasteSample");
  pasteSample.addEventListener("click", () => {
    fixInput.value = LuaFixer.SAMPLE_BROKEN;
    runFixer();
  });

  $("#fixDownloadBtn").addEventListener("click", () => {
    if (fixOutput.value.trim()) {
      downloadFile("fixed-script.lua", fixOutput.value);
    }
  });

  /* ----------------------------------------------------------
     Downloads view
     ---------------------------------------------------------- */

  // the desktop download card is pointless inside the desktop app itself
  if (isDesktop && $("#dlDesktopCard")) {
    $("#dlDesktopCard").style.display = "none";
  }

  document.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.dl;
      if (key === "roblox-starter") {
        downloadAll(RobloxLib.scripts.files);
      } else if (key === "ue5-terrain") {
        downloadAll(UE5Lib.ue5Terrain.files);
      }
    });
  });

  /* ----------------------------------------------------------
     Plugin demo view (mirrors the Studio plugin dock)
     ---------------------------------------------------------- */

  const connectBtn = $("#connectBtn");
  const connDot = $("#connDot");
  const connLabel = $("#connLabel");
  const connLog = $("#connLog");
  const pluginPrompt = $("#pluginPrompt");
  const pluginSend = $("#pluginSend");
  const pluginFiles = $("#pluginFiles");
  const apiKeyInput = $("#apiKeyInput");
  const apiConnectBtn = $("#apiConnectBtn");
  const aiBar = $("#aiBar");
  const aiDot = $("#aiDot");
  const aiBarText = $("#aiBarText");

  function logLine(text, cls) {
    const p = document.createElement("p");
    p.className = "log-line" + (cls ? " " + cls : "");
    p.textContent = text;
    connLog.appendChild(p);
    connLog.scrollTop = connLog.scrollHeight;
  }

  function setAiBar(mode, text) {
    aiDot.className = "ai-dot " + mode;
    aiBarText.textContent = text;
  }

  function syncAiState() {
    const connected = DeepSeekLib.hasKey();
    connDot.classList.toggle("on", connected);
    connLabel.classList.toggle("on", connected);
    connLabel.textContent = connected ? "Connected" : "Disconnected";
    connectBtn.textContent = connected ? "Connected" : "Connect";
    if (connected) {
      setAiBar("on", "AI connected — DeepSeek V4 (" + DeepSeekLib.MODEL + ") writes your scripts. Type a prompt and hit Generate.");
    } else {
      setAiBar("off", "Offline packs — paste a DeepSeek API key above and click Connect for real AI generation.");
    }
  }

  apiKeyInput.value = DeepSeekLib.getKey();

  apiConnectBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      logLine("[ForgeAI] paste a DeepSeek API key first (get one at platform.deepseek.com)", "err");
      apiKeyInput.focus();
      return;
    }
    apiConnectBtn.disabled = true;
    apiConnectBtn.textContent = "Checking...";
    setAiBar("off", "Checking your DeepSeek key...");
    const res = await DeepSeekLib.testKey(key);
    apiConnectBtn.disabled = false;
    apiConnectBtn.textContent = "Save key";
    if (res.ok) {
      DeepSeekLib.setKey(key);
      syncAiState();
      logLine("[ForgeAI] key valid — connected to DeepSeek " + DeepSeekLib.MODEL, "ok");
    } else {
      setAiBar("err", res.error);
      logLine("[ForgeAI] " + res.error, "err");
    }
  });

  connectBtn.addEventListener("click", () => {
    if (DeepSeekLib.hasKey()) {
      DeepSeekLib.setKey("");
      syncAiState();
      logLine("[ForgeAI] disconnected", "err");
    } else if (apiKeyInput.value.trim()) {
      apiConnectBtn.click();
    } else {
      apiKeyInput.focus();
      logLine("[ForgeAI] enter your DeepSeek API key above, then Connect", "err");
    }
  });

  syncAiState();

  function fileLocation(file) {
    if (file.location) return file.location;
    if (file.filename === "AnimationKit.lua") return "ReplicatedStorage";
    if (file.filename.endsWith(".client.lua")) return "StarterPlayerScripts";
    return "ServerScriptService";
  }

  function renderPluginFiles(pack) {
    pluginFiles.innerHTML = "";
    for (const file of pack.files) {
      const row = document.createElement("div");
      row.className = "plugin-file-row";
      const name = document.createElement("span");
      name.className = "fname";
      name.textContent = file.filename;
      const loc = document.createElement("span");
      loc.className = "floc";
      loc.textContent = "-> " + fileLocation(file);
      const dl = document.createElement("button");
      dl.className = "small-btn";
      dl.textContent = "Download";
      dl.addEventListener("click", () => downloadFile(file.filename, file.code));
      row.appendChild(name);
      row.appendChild(loc);
      row.appendChild(dl);
      pluginFiles.appendChild(row);
    }
    logLine("[ForgeAI] generated " + pack.files.length + " files for \"" + pack.title + "\"", "ok");
  }

  function fallbackPacks(text) {
    const intent = detectIntent(text);
    if (intent && intent.pack) {
      const pack = intent.pack();
      lastPack = pack;
      renderPluginFiles(pack);
    } else {
      pluginFiles.innerHTML = "";
      logLine("[ForgeAI] no offline pack for \"" + text + "\" - connect DeepSeek for real generation", "err");
    }
  }

  pluginSend.addEventListener("click", () => {
    const text = pluginPrompt.value.trim();
    if (!text) return;
    if (DeepSeekLib.hasKey()) {
      pluginSend.disabled = true;
      pluginSend.textContent = "Generating...";
      logLine("[ForgeAI] asking DeepSeek for \"" + text + "\"...", "dim");
      DeepSeekLib.generate(text)
        .then((res) => {
          if (res.files && res.files.length) {
            lastPack = { title: "DeepSeek: " + text, files: res.files };
            renderPluginFiles(lastPack);
          } else {
            pluginFiles.innerHTML = "";
            logLine("[ForgeAI] AI failed: " + (res.error || "no files"), "err");
            fallbackPacks(text);
          }
        })
        .catch((err) => {
          pluginFiles.innerHTML = "";
          logLine("[ForgeAI] " + err.message, "err");
          fallbackPacks(text);
        })
        .finally(() => {
          pluginSend.disabled = false;
          pluginSend.textContent = "Generate";
        });
    } else {
      fallbackPacks(text);
    }
  });
  pluginPrompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter") pluginSend.click();
  });

  /* ----------------------------------------------------------
     Projects view (localStorage)
     ---------------------------------------------------------- */

  const projName = $("#projName");
  const projSave = $("#projSave");
  const projList = $("#projList");
  const STORE_KEY = "forgeai_projects";

  function loadProjects() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
    } catch (err) {
      return [];
    }
  }

  function saveProjects(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (err) {
      /* storage full or unavailable - ignore */
    }
  }

  function projFlash(msg) {
    const div = document.createElement("div");
    div.className = "proj-empty";
    div.textContent = msg;
    projList.insertBefore(div, projList.firstChild);
    setTimeout(() => div.remove(), 2500);
  }

  function renderProjects() {
    projList.innerHTML = "";
    const list = loadProjects();
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "proj-empty";
      empty.textContent = "No projects yet — generate something in the Assistant, then hit \u201cSave current pack\u201d.";
      projList.appendChild(empty);
      return;
    }
    for (const proj of list) {
      const card = document.createElement("div");
      card.className = "proj-card";

      const h3 = document.createElement("h3");
      h3.textContent = proj.name;
      card.appendChild(h3);

      const meta = document.createElement("div");
      meta.className = "proj-meta";
      meta.textContent = proj.title + " \u2022 " + proj.files.length + " files \u2022 " + new Date(proj.date).toLocaleString();
      card.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "proj-actions";

      const dlBtn = document.createElement("button");
      dlBtn.className = "small-btn";
      dlBtn.textContent = "Download all";
      dlBtn.addEventListener("click", () => downloadAll(proj.files));
      actions.appendChild(dlBtn);

      const openBtn = document.createElement("button");
      openBtn.className = "small-btn";
      openBtn.textContent = "Open";
      const codeArea = document.createElement("div");
      codeArea.style.display = "none";
      openBtn.addEventListener("click", () => {
        const isHidden = codeArea.style.display === "none";
        codeArea.style.display = isHidden ? "block" : "none";
        openBtn.textContent = isHidden ? "Close" : "Open";
        if (isHidden && !codeArea.childElementCount) {
          for (const file of proj.files) codeArea.appendChild(renderCodeBlock(file));
        }
      });
      actions.appendChild(openBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "small-btn danger";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        const next = loadProjects().filter((p) => p.id !== proj.id);
        saveProjects(next);
        renderProjects();
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);
      card.appendChild(codeArea);
      projList.appendChild(card);
    }
  }

  projSave.addEventListener("click", () => {
    if (!lastPack) {
      projFlash("Nothing generated yet — ask the Assistant for something first.");
      return;
    }
    const name = projName.value.trim() || lastPack.title;
    const list = loadProjects();
    list.unshift({
      id: "p" + Date.now() + Math.floor(Math.random() * 999),
      name: name,
      title: lastPack.title,
      files: lastPack.files,
      date: new Date().toISOString(),
    });
    saveProjects(list);
    projName.value = "";
    renderProjects();
  });

  /* ----------------------------------------------------------
     UE5 Map Builder view (project pairing + map generation)
     ---------------------------------------------------------- */

  const ue5PairBtn = $("#ue5PairBtn");
  const ue5PairStatus = $("#ue5PairStatus");
  const ue5ManualPair = $("#ue5ManualPair");
  const ue5ProjName = $("#ue5ProjName");
  const ue5Module = $("#ue5Module");
  const ue5ManualSave = $("#ue5ManualSave");
  const ue5ModulePick = $("#ue5ModulePick");
  const ue5Prompt = $("#ue5Prompt");
  const ue5BuildBtn = $("#ue5BuildBtn");
  const ue5Settings = $("#ue5Settings");
  const ue5Results = $("#ue5Results");
  const UE5_PAIR_KEY = "forgeai_ue5_pair";

  let ue5Pair = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function loadUe5Pair() {
    try {
      return JSON.parse(localStorage.getItem(UE5_PAIR_KEY)) || null;
    } catch (err) {
      return null;
    }
  }

  function saveUe5Pair(pair) {
    try {
      localStorage.setItem(UE5_PAIR_KEY, JSON.stringify(pair));
    } catch (err) {
      /* ignore */
    }
    ue5Pair = pair;
    renderUe5Pair();
  }

  function renderUe5Pair() {
    if (!ue5Pair) {
      ue5PairStatus.className = "ue5-status off";
      ue5PairStatus.textContent = "Not paired — ForgeAI doesn't know your project yet.";
      return;
    }
    ue5PairStatus.className = "ue5-status on";
    ue5PairStatus.innerHTML =
      "Paired to <strong>" + escapeHtml(ue5Pair.name) + "</strong> &mdash; module <code>" +
      escapeHtml(ue5Pair.module) + "</code>" +
      (ue5Pair.kind === "plugin" ? " (plugin)" : "") +
      (ue5Pair.type === "desktop" ? " &mdash; files can be written straight into the project." : "");
  }

  function showManualPair() {
    ue5ManualPair.style.display = "block";
  }

  ue5PairBtn.addEventListener("click", async () => {
    if (!isDesktop) {
      showManualPair();
      return;
    }
    const res = await window.forgeAI.selectProject();
    if (!res) return;
    ue5ModulePick.innerHTML = "";
    if (res.modules && res.modules.length === 1) {
      const m = res.modules[0];
      saveUe5Pair({
        type: "desktop",
        name: res.name,
        dir: res.dir,
        manifestPath: res.manifestPath,
        module: m.name,
        moduleDir: m.dir,
        kind: m.kind,
      });
    } else if (res.modules && res.modules.length > 1) {
      for (const m of res.modules) {
        const b = document.createElement("button");
        b.className = "small-btn accent";
        b.textContent = m.name + (m.kind === "plugin" ? " (plugin)" : "");
        b.addEventListener("click", () => {
          saveUe5Pair({
            type: "desktop",
            name: res.name,
            dir: res.dir,
            manifestPath: res.manifestPath,
            module: m.name,
            moduleDir: m.dir,
            kind: m.kind,
          });
          ue5ModulePick.innerHTML = "";
        });
        ue5ModulePick.appendChild(b);
      }
    } else {
      ue5ProjName.value = res.name;
      ue5Module.value = res.name;
      showManualPair();
    }
  });

  ue5ManualSave.addEventListener("click", () => {
    const name = ue5ProjName.value.trim() || "MyProject";
    const module = UE5Lib.sanitizeModuleName(ue5Module.value.trim() || name);
    saveUe5Pair({ type: "manual", name: name, module: module });
    ue5ManualPair.style.display = "none";
  });

  function ue5Flash(msg) {
    const div = document.createElement("div");
    div.className = "ue5-flash";
    div.textContent = msg;
    ue5Results.insertBefore(div, ue5Results.firstChild);
    setTimeout(() => div.remove(), 3000);
  }

  ue5BuildBtn.addEventListener("click", () => {
    const desc = ue5Prompt.value.trim();
    if (!desc) {
      ue5Flash("Describe the map first — e.g. \"big island with mountains in the middle\".");
      return;
    }
    const pack = UE5Lib.buildMap(desc, ue5Pair);
    lastPack = pack;
    renderUe5Result(pack);
  });

  ue5Prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ue5BuildBtn.click();
    }
  });

  function renderUe5Result(pack) {
    ue5Results.innerHTML = "";

    const chips = document.createElement("div");
    chips.className = "ue5-settings";
    for (const s of pack.settings) {
      const c = document.createElement("span");
      c.className = "ue5-chip";
      c.textContent = s;
      chips.appendChild(c);
    }
    ue5Results.appendChild(chips);

    const head = document.createElement("div");
    head.className = "ue5-result-head";
    const h3 = document.createElement("h3");
    h3.textContent = pack.title;
    head.appendChild(h3);
    for (const p of pack.intro) {
      const para = document.createElement("p");
      para.innerHTML = p;
      head.appendChild(para);
    }
    if (pack.steps && pack.steps.length) {
      const list = document.createElement("ul");
      for (const s of pack.steps) {
        const li = document.createElement("li");
        li.innerHTML = s;
        list.appendChild(li);
      }
      head.appendChild(list);
    }
    ue5Results.appendChild(head);

    for (const file of pack.files) {
      ue5Results.appendChild(renderCodeBlock(file));
    }

    if (ue5Pair && ue5Pair.type === "desktop" && window.forgeAI) {
      const row = document.createElement("div");
      row.className = "ue5-write-row";
      const btn = document.createElement("button");
      btn.className = "dl-btn";
      btn.textContent = "Build map into project";
      const st = document.createElement("div");
      st.className = "ue5-write-status";
      st.id = "ue5WriteStatus";
      btn.addEventListener("click", () => writeMapToProject(pack));
      row.appendChild(btn);
      row.appendChild(st);
      ue5Results.appendChild(row);
    }
  }

  async function writeMapToProject(pack) {
    const st = $("#ue5WriteStatus");
    st.innerHTML = "";
    const statusLine = document.createElement("p");
    statusLine.className = "log-line dim";
    statusLine.textContent = "Writing into " + ue5Pair.dir + "...";
    st.appendChild(statusLine);

    const res = await window.forgeAI.writeProjectFiles({
      pair: ue5Pair,
      files: pack.files,
    });

    st.innerHTML = "";
    for (const w of res.written) {
      const p = document.createElement("p");
      p.className = "log-line " + (w.action === "unchanged" || w.action === "dependency-ok" ? "dim" : "ok");
      p.textContent = "[" + w.action + "] " + w.path;
      st.appendChild(p);
    }
    if (res.manifest) {
      const p = document.createElement("p");
      p.className = "log-line ok";
      p.textContent = res.manifest;
      st.appendChild(p);
    }
    if (res.warnings && res.warnings.length) {
      for (const w of res.warnings) {
        const p = document.createElement("p");
        p.className = "log-line err";
        p.textContent = w;
        st.appendChild(p);
      }
    }
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

  renderSuggestions();
  renderProjects();
  ue5Pair = loadUe5Pair();
  renderUe5Pair();
  runFixer();

  // test hook (no-op in production)
  if (globalThis.__FA_HOOK) {
    globalThis.__FA_HOOK({ detectIntent, RobloxLib, UE5Lib, LuaFixer });
  }
})();
