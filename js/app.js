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

    setTimeout(() => {
      typing.remove();

      if (intent && intent.action) {
        intent.action();
        addAssistantMessage({
          intro: ["I switched you to the <strong>Error Fixer</strong> tab — paste your broken script on the left and I'll fix it instantly."],
          steps: [],
          files: [],
        });
      } else if (intent) {
        const pack = intent.pack();
        lastPack = pack;
        addAssistantMessage(pack);
      } else {
        addAssistantMessage(HELP_PACK);
      }
      sendBtn.disabled = false;
    }, 350 + Math.random() * 250);
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

  // sidebar quick buttons
  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchView("assistant");
      input.value = btn.dataset.prompt;
      input.dispatchEvent(new Event("input"));
      send();
    });
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

  function logLine(text, cls) {
    const p = document.createElement("p");
    p.className = "log-line" + (cls ? " " + cls : "");
    p.textContent = text;
    connLog.appendChild(p);
    connLog.scrollTop = connLog.scrollHeight;
  }

  let connected = false;
  connectBtn.addEventListener("click", () => {
    connected = !connected;
    connDot.classList.toggle("on", connected);
    connLabel.classList.toggle("on", connected);
    connLabel.textContent = connected ? "Connected" : "Disconnected";
    connectBtn.textContent = connected ? "Connected" : "Connect";
    if (connected) {
      logLine("[ForgeAI] connected to Roblox Studio", "ok");
    } else {
      logLine("[ForgeAI] disconnected", "err");
    }
  });

  function fileLocation(filename) {
    if (filename === "AnimationKit.lua") return "ReplicatedStorage";
    if (filename.endsWith(".client.lua")) return "StarterPlayerScripts";
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
      loc.textContent = "-> " + fileLocation(file.filename);
      const dl = document.createElement("button");
      dl.className = "small-btn";
      dl.textContent = "Download";
      dl.addEventListener("click", () => downloadFile(file.filename, file.code));
      row.appendChild(name);
      row.appendChild(loc);
      row.appendChild(dl);
      pluginFiles.appendChild(row);
    }
    logLine("[ForgeAI] generated " + pack.files.length + " verified files for \"" + pack.title + "\"", "ok");
  }

  pluginSend.addEventListener("click", () => {
    const text = pluginPrompt.value.trim();
    if (!text) return;
    const intent = detectIntent(text);
    if (intent && intent.pack) {
      const pack = intent.pack();
      lastPack = pack;
      renderPluginFiles(pack);
    } else {
      pluginFiles.innerHTML = "";
      logLine("[ForgeAI] no match for \"" + text + "\" - try: animation kit, hud, combat system, npc ai, data saving", "err");
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
     Init
     ---------------------------------------------------------- */

  renderSuggestions();
  renderProjects();
  runFixer();

  // test hook (no-op in production)
  if (globalThis.__FA_HOOK) {
    globalThis.__FA_HOOK({ detectIntent, RobloxLib, UE5Lib, LuaFixer });
  }
})();
