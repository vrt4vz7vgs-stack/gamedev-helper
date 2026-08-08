/* ============================================================
   ForgeAI — DeepSeek API integration
   Real AI generation via DeepSeek's OpenAI-compatible
   Chat Completions API. Works in the desktop app (via IPC,
   no CORS) and in the Roblox Studio plugin (via HttpService).
   The plain browser site is blocked by DeepSeek's CORS policy,
   so it falls back to the offline packs.
   ============================================================ */

"use strict";

const DeepSeekLib = (function () {
  const ENDPOINT = "https://api.deepseek.com/chat/completions";
  const MODEL = "deepseek-v4-flash";
  const KEY_STORE = "forgeai_deepseek_key";

  const SYSTEM_PROMPT = [
    "You are ForgeAI, an expert Roblox Studio Luau developer.",
    "The user describes something they want to build in a Roblox game.",
    "Write complete, production-quality Luau scripts that run with zero errors.",
    "Rules:",
    "- Server logic goes in Scripts in ServerScriptService.",
    "- Client logic goes in LocalScripts in StarterPlayerScripts or StarterGui.",
    "- Reusable shared code goes in ModuleScripts in ReplicatedStorage.",
    "- Use current Roblox APIs only. Never use removed/deprecated APIs.",
    "- Include all services, events, and edge cases. Scripts must be complete and runnable.",
    "- If the request is impossible in Roblox, say so briefly and suggest the closest real alternative.",
    "Output format — repeat these blocks for EVERY file (no other commentary):",
    "FILE: <FileName.lua>",
    "LOCATION: <ServerScriptService|StarterPlayerScripts|StarterGui|ReplicatedStorage>",
    "CLASS: <Script|LocalScript|ModuleScript>",
    "```lua",
    "<complete Luau code>",
    "```",
  ].join("\n");

  function getKey() {
    try {
      return localStorage.getItem(KEY_STORE) || "";
    } catch (err) {
      return "";
    }
  }

  function setKey(key) {
    try {
      localStorage.setItem(KEY_STORE, key);
    } catch (err) {
      /* ignore */
    }
  }

  function hasKey() {
    return !!getKey().trim();
  }

  /* ----------------------------------------------------------
     Transport: desktop app via IPC, otherwise browser fetch
     ---------------------------------------------------------- */

  async function apiCall(apiKey, messages) {
    const body = {
      model: MODEL,
      messages: messages,
      stream: false,
    };
    if (globalThis.window && window.forgeAI && typeof window.forgeAI.deepseekChat === "function") {
      const res = await window.forgeAI.deepseekChat({ apiKey: apiKey, messages: messages });
      if (!res.ok) {
        const msg = (res.data && res.data.error && res.data.error.message) || "";
        throw new Error("DeepSeek API error " + res.status + (msg ? ": " + msg : ""));
      }
      const content = res.data && res.data.choices && res.data.choices[0] &&
        res.data.choices[0].message && res.data.choices[0].message.content;
      return content || "";
    }
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || "";
      throw new Error("DeepSeek API error " + res.status + (msg ? ": " + msg : ""));
    }
    return (data && data.choices && data.choices[0] && data.choices[0].message &&
      data.choices[0].message.content) || "";
  }

  /* ----------------------------------------------------------
     Parsing: FILE:/LOCATION:/CLASS: markers + fenced lua blocks
     ---------------------------------------------------------- */

  function parseFiles(text) {
    const files = [];
    const parts = String(text).split(/```/);
    let pending = { filename: null, location: null, className: null };

    const grabMarkers = (seg) => {
      const m = seg.match(/FILE:\s*([^\n\r]+)/i);
      if (m) pending.filename = m[1].replace(/\*/g, "").trim();
      const l = seg.match(/LOCATION:\s*([^\n\r]+)/i);
      if (l) pending.location = l[1].replace(/\*/g, "").trim();
      const c = seg.match(/CLASS:\s*([^\n\r]+)/i);
      if (c) pending.className = c[1].replace(/\*/g, "").trim();
    };

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        const code = parts[i].replace(/^(lua|luau)\s*\n/i, "").trim() + "\n";
        files.push({
          filename: pending.filename || ("ForgeAI-" + (files.length + 1) + ".lua"),
          location: pending.location || "ServerScriptService",
          className: pending.className || "Script",
          code: code,
          lang: "lua",
        });
      } else if (i > 0 || parts[0].trim()) {
        grabMarkers(parts[i]);
      }
    }

    if (!files.length && String(text).trim()) {
      files.push({
        filename: "ForgeAI-1.lua",
        location: "ServerScriptService",
        className: "Script",
        code: String(text).trim() + "\n",
        lang: "lua",
      });
    }
    return files;
  }

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */

  async function testKey(apiKey) {
    try {
      const content = await apiCall(apiKey, [
        { role: "system", content: "Reply with exactly: OK" },
        { role: "user", content: "ping" },
      ]);
      return { ok: true, content: content };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function generate(description, opts) {
    const apiKey = (opts && opts.apiKey) || getKey();
    if (!apiKey || !apiKey.trim()) {
      return { files: null, error: "No DeepSeek API key saved. Connect one in the Plugin tab." };
    }
    try {
      const content = await apiCall(apiKey.trim(), [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ]);
      const files = parseFiles(content);
      if (!files.length) {
        return { files: null, error: "DeepSeek replied but no script blocks were found." };
      }
      return { files: files };
    } catch (err) {
      return { files: null, error: err.message };
    }
  }

  return {
    MODEL: MODEL,
    getKey: getKey,
    setKey: setKey,
    hasKey: hasKey,
    testKey: testKey,
    generate: generate,
    parseFiles: parseFiles,
  };
})();

if (globalThis.__FA_HOOK) {
  globalThis.__FA_HOOK({ DeepSeekLib: DeepSeekLib });
}
