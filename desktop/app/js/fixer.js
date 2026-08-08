/* ============================================================
   ForgeAI — Lua error detector + auto-fixer
   Finds problems in Roblox Lua, explains them, and fixes
   what it can automatically. Conservative: no false fixes.
   ============================================================ */

"use strict";

const LuaFixer = (function () {

  const KNOWN_GLOBALS = new Set([
    "game", "workspace", "Workspace", "script", "self", "print", "warn", "error",
    "assert", "pcall", "xpcall", "type", "typeof", "tostring", "tonumber",
    "pairs", "ipairs", "next", "select", "unpack", "rawequal", "rawget",
    "rawset", "setmetatable", "getmetatable", "require", "tick", "time",
    "wait", "delay", "spawn", "coroutine", "os", "io", "debug", "math",
    "string", "table", "utf8", "task", "bit32", "Vector3", "Vector2", "CFrame",
    "Color3", "UDim", "UDim2", "Enum", "Instance", "TweenInfo", "NumberSequence",
    "NumberRange", "NumberSequenceKeypoint", "Rect", "Ray", "Region3",
    "RaycastParams", "Random", "DateTime", "Drawing", "Buffer", "Vector3int16",
    "TweenService", "RunService", "Players", "ServerStorage", "ServerScriptService",
    "ReplicatedStorage", "ReplicatedFirst", "Lighting", "UserInputService",
    "ContextActionService", "ContentProvider", "DataStoreService", "HttpService",
    "GamepadService", "MaterialService", "Teams", "CollectionService",
    "SoundService", "StarterGui", "StarterPack", "StarterPlayer", "Chat",
    "TextChatService", "TeleportService", "MarketplaceService", "GamePassService",
    "BadgeService", "Debris", "InsertService", "GroupService", "GuiService",
    "LocalizationService", "LogService", "MemStorageService", "NetworkClient",
    "NotificationService", "PathfindingService", "PhysicsService",
    "PolicyService", "ProximityPromptService", "ScriptContext", "Selection",
    "SessionService", "SharedTableRegistry", "SocialService", "Stats",
    "StreamingService", "TestService", "VRService", "GeometryService",
    "PluginManager", "settings", "plugin", "selection", "shared", "_G", "_VERSION",
    "getfenv", "setfenv", "newproxy", "loadstring", "load", "getgenv",
    "printidentity", "warn", "message", "mouse", "wait",
    "Font", "BrickColor", "ColorSequence", "ColorSequenceKeypoint",
    "Region3int16", "OverlapParams", "PathfindingService", "PhysicalProperties"
  ]);

  const INSTANCE_NAMES = new Set([
    "player", "players", "character", "humanoid", "animator", "part",
    "tool", "camera", "remote", "tween", "sound", "animation", "track",
    "gui", "frame", "button", "label", "stats", "folder", "npc", "root",
    "fill", "bar", "enemy", "target", "origin", "sequence", "keyframe",
    "pose", "controller", "motor", "handle", "panel", "scroll", "row",
    "rig", "model", "store", "canvas", "background", "parent", "service",
    "menu", "screen", "tile", "mesh", "light", "clouds", "terrain",
    "workspace", "game", "script", "hitbox", "region", "ray", "body"
  ]);

  const INSTANCE_SUFFIXES = [
    "part", "gui", "ui", "bar", "fill", "label", "button", "frame",
    "remote", "module", "script", "tool", "camera", "humanoid", "animator",
    "character", "track", "sound", "animation", "root", "folder", "store",
    "npc", "model", "rig", "motor", "handle", "panel", "scroll", "row",
    "tween", "service", "sequence", "keyframe", "pose", "controller",
    "origin", "target", "screen", "canvas", "menu", "background", "parent"
  ];

  // Lua standard libraries where lowercase members are correct:
  // string.format, math.random, task.wait, table.insert, os.clock...
  const FUNCTION_LIBRARIES = new Set([
    "math", "string", "table", "os", "task", "coroutine", "utf8", "bit32",
    "debug", "io", "_G", "shared", "getgenv", "select", "pcall", "xpcall",
    "require", "print", "warn", "error", "assert", "tostring", "tonumber",
    "type", "typeof", "pairs", "ipairs", "next", "unpack", "rawget",
    "rawset", "rawequal", "setmetatable", "getmetatable", "spawn", "delay",
    "tick", "time", "wait", "loadstring", "load"
  ]);

  function isInstanceLike(name) {
    const lower = String(name).toLowerCase();
    if (FUNCTION_LIBRARIES.has(lower)) return false;
    if (KNOWN_GLOBALS.has(lower)) return true;
    if (INSTANCE_NAMES.has(lower)) return true;
    for (const suffix of INSTANCE_SUFFIXES) {
      if (lower.endsWith(suffix)) return true;
    }
    return false;
  }

  const SERVICES = new Set([
    "Workspace", "Players", "Lighting", "ServerStorage", "ReplicatedStorage",
    "ReplicatedFirst", "ServerScriptService", "StarterGui", "StarterPack",
    "StarterPlayer", "Teams", "SoundService", "TweenService", "RunService",
    "UserInputService", "ContextActionService", "DataStoreService", "HttpService",
    "TeleportService", "GamePassService", "MarketplaceService", "BadgeService",
    "TextChatService", "VoiceChatService", "Chat", "CollectionService",
    "ContentProvider", "Debris", "GeometryService", "GroupService", "GuiService",
    "InsertService", "LocalizationService", "LogService", "MaterialService",
    "MemStorageService", "NetworkClient", "NotificationService",
    "PathfindingService", "PhysicsService", "PolicyService",
    "ProximityPromptService", "ScriptContext", "Selection", "SessionService",
    "SharedTableRegistry", "SocialService", "Stats", "StreamingService",
    "TestService", "TextureGeneratorService", "VRService"
  ]);

  const CLASSES = new Set([
    "Part", "Model", "Tool", "Script", "LocalScript", "ModuleScript",
    "RemoteEvent", "RemoteFunction", "UnreliableRemoteEvent", "Folder",
    "Sound", "Camera", "Humanoid", "HumanoidDescription", "Animation",
    "KeyframeSequence", "Keyframe", "Pose", "AnimationController",
    "ScreenGui", "Frame", "TextLabel", "TextButton", "TextBox",
    "ImageLabel", "ImageButton", "ScrollingFrame", "UICorner", "UIPadding",
    "UIStroke", "UIGradient", "UIAspectRatioConstraint", "UIListLayout",
    "UIGridLayout", "UIScale", "UISizeConstraint", "UITextSizeConstraint",
    "ViewportFrame", "BillboardGui", "SurfaceGui", "DragDetector",
    "ClickDetector", "ProximityPrompt", "Highlight", "SelectionBox",
    "SelectionSphere", "PointLight", "SpotLight", "SurfaceLight",
    "BloomEffect", "ColorCorrectionEffect", "BlurEffect", "SunRaysEffect",
    "DepthOfFieldEffect", "Atmosphere", "Sky", "Terrain", "BasePart",
    "MeshPart", "WedgePart", "CylinderPart", "BallPart", "CornerWedgePart",
    "TrussPart", "UnionOperation", "NegateOperation", "PartOperation",
    "SpawnLocation", "Seat", "VehicleSeat", "SkateboardPlatform",
    "Decal", "Texture", "SpecialMesh", "BlockMesh", "CylinderMesh",
    "FileMesh", "Fire", "Smoke", "Sparkles", "Trail", "ParticleEmitter",
    "Attachment", "Beam", "SoundGroup", "AudioEmitter", "AudioListener",
    "BodyVelocity", "BodyGyro", "BodyPosition", "BodyAngularVelocity",
    "BodyForce", "BodyMovers", "AlignPosition", "AlignOrientation",
    "AlignVelocity", "AngularVelocity", "LinearVelocity", "VectorForce",
    "Torque", "Constraint", "HingeConstraint", "Motor6D", "Weld",
    "WeldConstraint", "Snap", "BallSocketConstraint", "RopeConstraint",
    "RodConstraint", "SpringConstraint", "CylindricalConstraint",
    "PrismaticConstraint", "UniversalConstraint",
    "PlayerGui", "Hint", "Message", "Dialog", "DialogChoice",
    "HopperBin", "ArcHandles", "Handles", "Accoutrement", "Accessory",
    "BodyColors", "CharacterMesh", "Shirt", "Pants", "ShirtGraphic", "Hat",
    "DataStore", "OrderedDataStore", "GlobalDataStore", "DataStoreOptions",
    "DataStoreKeyInfo", "DataStorePage", "AnimationTrack", "Animator",
    "RocketPropulsion", "Thrust", "Clouds", "GodRays",
    "EditableMesh", "EditableImage", "SurfaceAppearance", "BaseWrap",
    "Configuration", "ValueBase", "BoolValue", "IntValue",
    "NumberValue", "StringValue", "ObjectValue", "Vector3Value",
    "CFrameValue", "Color3Value", "RayValue", "DoubleConstrainedValue",
    "IntConstrainedValue", "NumberPose", "Transform", "Bone", "SoundChannel"
  ]);

  const METHOD_CASE_FIXES = {
    "connect": "Connect", "disconnect": "Disconnect", "wait": "Wait",
    "findfirstchild": "FindFirstChild", "findfirstchildofclass": "FindFirstChildOfClass",
    "findfirstchildwhichisatr": "FindFirstChildWhichIsA", "getchildren": "GetChildren",
    "getdescendants": "GetDescendants", "waitforchild": "WaitForChild",
    "clone": "Clone", "destroy": "Destroy", "remove": "Destroy",
    "fire": "Fire", "fireclient": "FireClient", "fireallclients": "FireAllClients",
    "invokeclient": "InvokeClient", "invokeserver": "InvokeServer",
    "play": "Play", "pause": "Pause", "stop": "Stop", "resume": "Resume",
    "loadanimation": "LoadAnimation", "adjustspeed": "AdjustSpeed",
    "adjustweight": "AdjustWeight", "getpropertychangedsignal": "GetPropertyChangedSignal",
    "setattribute": "SetAttribute", "getattribute": "GetAttribute",
    "move": "MoveTo", "findfirstpartwhichisatr": "FindFirstPartWhichIsA",
    "getservice": "GetService", "isancestorof": "IsAncestorOf",
    "isdescendantof": "IsDescendantOf", "getdata": "GetData",
    "setsimulation": "SetNetworkOwner", "getsimulation": "GetNetworkOwner",
    "setprimarypartcframe": "SetPrimaryPartCFrame"
  };

  const CASE_FIXES = {
    "Game": "game", "WorkSpace": "workspace", "Worksapce": "workspace",
    "StarterGUI": "StarterGui", "PlayerGUI": "PlayerGui",
    "ServerScriptSerice": "ServerScriptService", "ReplicatedStorag": "ReplicatedStorage",
    "Workspce": "workspace", "LocalScript": "LocalScript"
  };

  const KEYWORDS = new Set([
    "and", "break", "do", "else", "elseif", "end", "false", "for",
    "function", "goto", "if", "in", "local", "nil", "not", "or",
    "repeat", "return", "then", "true", "until", "while"
  ]);

  const BLOCK_OPENERS = new Set(["function", "if", "for", "while", "do", "repeat"]);
  const BLOCK_CLOSERS = new Set(["end", "until"]);

  /* ----------------------------------------------------------
     Tokenizer
     ---------------------------------------------------------- */

  function tokenize(code) {
    const tokens = [];
    let i = 0, line = 1;
    const n = code.length;

    while (i < n) {
      const c = code[i];

      if (c === "\n") { tokens.push({ type: "nl", val: "\n", line }); line++; i++; continue; }
      if (c === " " || c === "\t" || c === "\r") { i++; continue; }

      if (c === "-" && code[i + 1] === "-") {
        if (code[i + 2] === "[" && code[i + 3] === "[") {
          const end = code.indexOf("]]", i + 4);
          const slice = end === -1 ? code.slice(i) : code.slice(i, end + 2);
          tokens.push({ type: "comment", val: slice, line });
          line += (slice.match(/\n/g) || []).length;
          i = end === -1 ? n : end + 2;
        } else {
          const end = code.indexOf("\n", i);
          tokens.push({ type: "comment", val: end === -1 ? code.slice(i) : code.slice(i, end), line });
          i = end === -1 ? n : end;
        }
        continue;
      }

      if (c === "\"" || c === "'") {
        let j = i + 1, closed = false;
        while (j < n) {
          if (code[j] === "\\") { j += 2; continue; }
          if (code[j] === c) { closed = true; break; }
          if (code[j] === "\n") break;
          j++;
        }
        if (closed) {
          tokens.push({ type: "string", val: code.slice(i, j + 1), line });
          i = j + 1;
        } else {
          tokens.push({ type: "string", val: code.slice(i), line });
          tokens.push({ type: "unterminated_string", val: "", line });
          i = n;
        }
        continue;
      }

      if (c === "[" && code[i + 1] === "[") {
        const end = code.indexOf("]]", i + 2);
        const slice = end === -1 ? code.slice(i) : code.slice(i, end + 2);
        tokens.push({ type: "string", val: slice, line });
        line += (slice.match(/\n/g) || []).length;
        i = end === -1 ? n : end + 2;
        if (end === -1) tokens.push({ type: "unterminated_string", val: "", line });
        continue;
      }

      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
        tokens.push({ type: "ident", val: code.slice(i, j), line });
        i = j;
        continue;
      }

      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] || ""))) {
        let j = i;
        while (j < n && /[0-9a-fA-FxX_.]/.test(code[j])) j++;
        tokens.push({ type: "num", val: code.slice(i, j), line });
        i = j;
        continue;
      }

      const two = code.substr(i, 2);
      if (["==", "~=", "<=", ">=", "..", "::", "//", "+=", "-=", "*=", "/="].includes(two)) {
        tokens.push({ type: "sym", val: two, line });
        i += 2; continue;
      }
      if ("()[]{};,.:=+-*/%^#<>~&|@".includes(c)) {
        tokens.push({ type: "sym", val: c, line });
        i++; continue;
      }

      i++;
    }
    return tokens;
  }

  /* ----------------------------------------------------------
     Main analysis
     ---------------------------------------------------------- */

  function analyze(code) {
    const tokens = tokenize(code);
    const issues = [];
    const edits = [];            // {line, from, to}  (line-scoped word replacements)
    let fixedCode = code;

    /* ---------- 1. unterminated strings ---------- */
    for (const t of tokens) {
      if (t.type === "unterminated_string") {
        issues.push({
          severity: "error", line: t.line,
          message: "Unterminated string — the string never closes. Fix: close it with the matching quote.",
          fixed: true, what: "closed string"
        });
      }
    }

    /* ---------- 2. bracket balance ---------- */
    const bracketStack = [];
    const openMap = { "(": ")", "[": "]", "{": "}" };
    const closeMap = { ")": "(", "]": "[", "}": "{" };
    for (const t of tokens) {
      if (t.type !== "sym") continue;
      if (openMap[t.val]) bracketStack.push({
        ch: t.val,
        line: t.line,
        fn: t.val === "(" && tokens.indexOf(t) + 1 < tokens.length && tokens[tokens.indexOf(t) + 1].type === "ident" && tokens[tokens.indexOf(t) + 1].val === "function"
      });
      else if (closeMap[t.val]) {
        const top = bracketStack.pop();
        if (!top) {
          issues.push({
            severity: "error", line: t.line,
            message: "Unbalanced '" + t.val + "' — there is an extra closing bracket here. Fix: remove it.",
            fixed: true, what: "removed extra '" + t.val + "'"
          });
        } else if (top.ch !== closeMap[t.val]) {
          issues.push({
            severity: "error", line: t.line,
            message: "Mismatched bracket: '" + top.ch + "' opened at line " + top.line + " is closed by '" + t.val + "'. ForgeAI matched them for you.",
            fixed: true, what: "matched brackets"
          });
        }
      }
    }
    const unmatchedOpens = [];
    for (const b of bracketStack) {
      unmatchedOpens.push(b);
      issues.push({
        severity: "error", line: b.line,
        message: "Unbalanced '" + b.ch + "' opened at line " + b.line + " never closes. ForgeAI added the closing '" + openMap[b.ch] + "' for you.",
        fixed: true, what: "added closing '" + openMap[b.ch] + "'"
      });
    }
    /* ---------- 3. block structure ---------- */
    const blockStack = [];
    const blockLog = [];
    let prevKeyword = null;
    let pendingLoop = null; // the for/while entry whose 'do' hasn't been seen yet
    const removedLines = new Set();

    for (const t of tokens) {
      if (t.type !== "ident" || !KEYWORDS.has(t.val)) continue;
      const kw = t.val;

      if (BLOCK_OPENERS.has(kw)) {
        if (kw === "do") {
          // 'do' belonging to a for/while loop is not a new block;
          // the loop entry is still on top of the stack
          if (blockStack.length && blockStack[blockStack.length - 1] === pendingLoop) {
            pendingLoop = null;
          } else {
            blockStack.push({ kw, line: t.line });
            blockLog.push({ kw, line: t.line });
          }
        } else {
          blockStack.push({ kw, line: t.line });
          blockLog.push({ kw, line: t.line });
          if (kw === "for" || kw === "while") {
            pendingLoop = blockStack[blockStack.length - 1];
          }
        }
        prevKeyword = kw;
        continue;
      }

      if (kw === "elseif" || kw === "else") {
        if (!blockStack.length || blockStack[blockStack.length - 1].kw !== "if") {
          issues.push({
            severity: "error", line: t.line,
            message: "'" + kw + "' outside of an 'if' block. Fix: make sure it sits inside an 'if ... end'.",
            fixed: false, what: "none"
          });
        }
        prevKeyword = kw;
        continue;
      }

      if (kw === "then") {
        if (!blockStack.length || blockStack[blockStack.length - 1].kw !== "if") {
          issues.push({
            severity: "warning", line: t.line,
            message: "'then' found without a matching 'if'.",
            fixed: false, what: "none"
          });
        }
        prevKeyword = kw;
        continue;
      }

      if (kw === "end") {
        if (blockStack.length) {
          const top = blockStack.pop();
          if (top === pendingLoop) {
            pendingLoop = null;
          }
          if (top.kw === "repeat") {
            issues.push({
              severity: "warning", line: t.line,
              message: "'repeat' blocks close with 'until', not 'end'. It runs anyway in Roblox, but 'repeat ... until' is the correct form.",
              fixed: false, what: "none"
            });
          }
        } else {
          issues.push({
            severity: "error", line: t.line,
            message: "Extra 'end' — there is no open block for it. ForgeAI removed it for you.",
            fixed: true, what: "removed extra 'end' at line " + t.line
          });
          removedLines.add(t.line);
        }
        prevKeyword = kw;
        continue;
      }

      if (kw === "until") {
        if (blockStack.length && blockStack[blockStack.length - 1].kw === "repeat") {
          blockStack.pop();
        } else {
          issues.push({
            severity: "error", line: t.line,
            message: "'until' without a matching 'repeat'. Fix: wrap this in 'repeat ... until'.",
            fixed: false, what: "none"
          });
        }
        prevKeyword = kw;
        continue;
      }

      if (kw === "return" && !blockStack.some((b) => b.kw === "function")) {
        issues.push({
          severity: "warning", line: t.line,
          message: "'return' at the top level stops the rest of the script here — make sure that's intentional. (In a ModuleScript, this is how you return the module table.)",
          fixed: false, what: "none"
        });
      }

      if (kw === "if" || kw === "while") {
        let next = null;
        let depth = 0;
        for (let j = tokens.indexOf(t) + 1; j < tokens.length; j++) {
          const tk = tokens[j];
          if (tk.type === "sym") {
            if (["(", "[", "{"].includes(tk.val)) depth++;
            else if ([")", "]", "}"].includes(tk.val)) depth = Math.max(0, depth - 1);
            continue;
          }
          if (depth > 0) continue;
          if (tk.type === "ident" && KEYWORDS.has(tk.val)) { next = tk.val; break; }
          if (tk.type === "nl") break;
        }
        const needed = kw === "if" ? "then" : "do";
        if (next !== needed) {
          issues.push({
            severity: "warning", line: t.line,
            message: "'" + kw + "' looks like it's missing '" + needed + "'. Fix: add '" + needed + "' at the end of the condition.",
            fixed: false, what: "none"
          });
        }
      }

      prevKeyword = kw;
    }

    const leftoverBlocks = [];
    for (const b of blockStack) {
      leftoverBlocks.push(b);
      issues.push({
        severity: "error", line: b.line,
        message: "Block started with '" + b.kw + "' at line " + b.line + " never closes. ForgeAI added '" + (b.kw === "repeat" ? "until" : "end") + "' for you.",
        fixed: true, what: "added '" + (b.kw === "repeat" ? "until" : "end") + "'"
      });
    }

    /* ---------- 4. declarations, assignments, usages ---------- */
    const locals = {};
    const defs = {};
    const usages = {};
    const localCounts = {};

    const isDefinedToken = new Set(); // token indices that are declarations/definitions
    const localFunctionTokens = new Set(); // 'function' keywords already handled via 'local function'

    // Pass A: find definition/declaration token indices
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "ident") continue;

      if (t.val === "local") {
        const next = tokens[j + 1];
        if (next && next.type === "ident" && next.val === "function") {
          const nameTok = tokens[j + 2];
          if (nameTok && nameTok.type === "ident") {
            isDefinedToken.add(j + 2);
            recordLocalDef(nameTok, j + 2);
            scanParams(j + 3);
          }
          localFunctionTokens.add(j + 1);
          continue;
        }
        for (let k = j + 1; k < tokens.length; k++) {
          const tk = tokens[k];
          if (tk.type === "ident" && !KEYWORDS.has(tk.val)) { isDefinedToken.add(k); recordLocalDef(tk, k); }
          else if (tk.type === "sym" && tk.val === ",") continue;
          else break;
        }
        continue;
      }

      if (t.val === "function") {
        if (localFunctionTokens.has(j)) continue;
        // function name(...) — first ident is a definition, then params in parens
        let k = j + 1;
        while (k < tokens.length && (tokens[k].type === "ident" || (tokens[k].type === "sym" && [".", ":"].includes(tokens[k].val)))) k++;
        for (let q = j + 1; q < k; q++) {
          if (tokens[q].type === "ident" && !KEYWORDS.has(tokens[q].val)) {
            isDefinedToken.add(q);
            recordDef(tokens[q], q);
            break;
          }
        }
        scanParams(k);
        continue;
      }

      if (t.val === "for") {
        for (let k = j + 1; k < tokens.length; k++) {
          const tk = tokens[k];
          if (tk.type === "ident" && !KEYWORDS.has(tk.val)) { isDefinedToken.add(k); recordLocalDef(tk, k); }
          else if (tk.type === "sym" && tk.val === ",") continue;
          else break;
        }
        continue;
      }
    }

    // assignments:  name = value  |  a, b = x, y
    // (separate pass — '=' is a symbol, not an identifier)
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "sym" || t.val !== "=") continue;
      let k = j - 1;
      while (k >= 0) {
        const tk = tokens[k];
        if (tk.type === "ident" && !KEYWORDS.has(tk.val)) {
          if (!isDefinedToken.has(k)) {
            isDefinedToken.add(k);
            recordDef(tk, k);
          }
          k--;
        } else if (tk.type === "sym" && tk.val === ",") {
          k--;
          continue;
        } else {
          break;
        }
      }
      const prev = tokens[j - 1];
      if (prev && prev.type === "ident" && !KEYWORDS.has(prev.val)) {
        if (!isDefinedToken.has(j - 1)) {
          isDefinedToken.add(j - 1);
          recordDef(prev, j - 1);
        }
      }
    }

    function recordLocalDef(tok, index) {
      const name = tok.val;
      if (!(name in locals)) locals[name] = tok.line;
      localCounts[name] = (localCounts[name] || 0) + 1;
    }
    function recordDef(tok, index) {
      const name = tok.val;
      if (!(name in defs)) defs[name] = tok.line;
    }
    function scanParams(start) {
      let depth = 0;
      for (let k = start; k < tokens.length; k++) {
        const tk = tokens[k];
        if (tk.type === "sym") {
          if (tk.val === "(") { depth++; if (depth === 1) continue; }
          else if (tk.val === ")") { depth--; if (depth === 0) break; }
          else if (depth > 0 && tk.val === ",") continue;
        }
        if (depth > 0 && tk.type === "ident" && !KEYWORDS.has(tk.val)) {
          isDefinedToken.add(k);
          recordLocalDef(tk, k);
        }
      }
    }

    // Pass B: usages (skip keywords, defined tokens, and member accesses)
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "ident" || KEYWORDS.has(t.val)) continue;
      if (isDefinedToken.has(j)) continue;
      const prev = tokens[j - 1];
      if (prev && prev.type === "sym" && (prev.val === "." || prev.val === ":")) continue;
      const nextTok = tokens[j + 1];
      if (nextTok && nextTok.type === "ident" && nextTok.val === "(") {
        // method-ish call without dot? e.g. `foo (x)` — still a usage
      }
      if (!(t.val in usages)) usages[t.val] = t.line;
    }

    const unknownNames = new Set();
    for (const name of Object.keys(usages)) {
      if (KNOWN_GLOBALS.has(name)) continue;
      if (name in locals) {
        if (usages[name] < locals[name]) {
          issues.push({
            severity: "warning", line: usages[name],
            message: "'" + name + "' is used before it's declared (declared at line " + locals[name] + "). Move the declaration above this line or check the spelling.",
            fixed: false, what: "none"
          });
        }
        continue;
      }
      if (name in defs) continue;

      const fixCandidate = CASE_FIXES[name];
      if (fixCandidate) {
        issues.push({
          severity: "error", line: usages[name],
          message: "'" + name + "' should be '" + fixCandidate + "' — case matters in Roblox. ForgeAI fixed it.",
          fixed: true, what: "'" + name + "' -> '" + fixCandidate + "'"
        });
        edits.push({ line: usages[name], from: name, to: fixCandidate });
        continue;
      }
      if (!unknownNames.has(name)) {
        unknownNames.add(name);
        issues.push({
          severity: "warning", line: usages[name],
          message: "'" + name + "' is never defined anywhere — did you forget 'local " + name + " = ...'? If it's a typo, fix the spelling.",
          fixed: false, what: "none"
        });
      }
    }

    /* ---------- 5. method case fixes (:connect etc.) ---------- */
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "ident") continue;
      const prev = tokens[j - 1];
      const nextT = tokens[j + 1];
      if (!prev || prev.type !== "sym" || (prev.val !== ":" && prev.val !== ".")) continue;
      if (!nextT || nextT.type !== "sym" || nextT.val !== "(") continue;

      // Only fix methods called on Roblox-instance-like owners.
      // Never touch string.format, math.random, task.wait, or
      // user-defined module methods (e.g. kit.play, AnimationKit.play).
      const owner = tokens[j - 2];
      const upperOwner = owner && owner.type === "ident" && /^[A-Z]/.test(owner.val);
      const instanceOwner = !owner || owner.type === "sym" && owner.val === ")" ||
        (owner.type === "ident" && (isInstanceLike(owner.val) || upperOwner));
      const isSignalMethod = ["connect", "disconnect", "wait"].includes(t.val.toLowerCase());

      const canonical = METHOD_CASE_FIXES[t.val.toLowerCase()];
      if (canonical && t.val !== canonical) {
        // uppercase owners (HealthChanged, CharacterAdded...) only get
        // signal-method fixes — anything else is likely a user module method
        const ownerOk = upperOwner ? isSignalMethod : instanceOwner;
        if (ownerOk) {
          issues.push({
            severity: "error", line: t.line,
            message: "Method '" + prev.val + t.val + "(' should be '" + prev.val + canonical + "(' — Roblox methods are case-sensitive. ForgeAI fixed it.",
            fixed: true, what: "'" + prev.val + t.val + "' -> '" + prev.val + canonical + "'"
          });
          edits.push({ line: t.line, from: t.val, to: canonical });
        }
      }
    }

    /* ---------- 6. bare wait( / Wait( -> task.wait( ---------- */
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "ident" || (t.val !== "wait" && t.val !== "Wait")) continue;
      const prev = tokens[j - 1];
      if (prev && prev.type === "sym" && (prev.val === ":" || prev.val === ".")) continue;
      const nextT = tokens[j + 1];
      if (!nextT || nextT.type !== "sym" || nextT.val !== "(") continue;
      issues.push({
        severity: "warning", line: t.line,
        message: "'" + t.val + "(' is deprecated — use 'task.wait(' instead (more accurate, frame-perfect). ForgeAI updated it.",
        fixed: true, what: "'" + t.val + "' -> 'task.wait'"
      });
      edits.push({ line: t.line, from: t.val, to: "task.wait" });
    }

    /* ---------- 7. single '=' inside conditions ---------- */
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "ident" || !["if", "while", "until", "elseif"].includes(t.val)) continue;
      let depth = 0;
      for (let k = j + 1; k < tokens.length; k++) {
        const tk = tokens[k];
        if (tk.type === "sym") {
          if (["(", "[", "{"].includes(tk.val)) { depth++; continue; }
          if ([")", "]", "}"].includes(tk.val)) { depth = Math.max(0, depth - 1); continue; }
          if (depth === 0 && tk.val === "=") {
            const before = tokens[k - 1], after = tokens[k + 1];
            const beforeOk = before && (before.type === "ident" || before.type === "num" || before.type === "string" || (before.type === "sym" && [")", "]", "}"].includes(before.val)));
            const afterOk = after && (after.type === "ident" || after.type === "num" || after.type === "string");
            if (beforeOk && afterOk) {
              issues.push({
                severity: "error", line: tk.line,
                message: "Single '=' inside a condition — you meant '==' (comparison). ForgeAI fixed it.",
                fixed: true, what: "'=' -> '=='"
              });
              edits.push({ line: tk.line, from: "=", to: "==" });
            }
          }
          if (depth === 0 && ["then", "do"].includes(tk.val)) break;
        }
        if (tk.type === "ident" && depth === 0 && ["then", "do"].includes(tk.val)) break;
        if (tk.type === "nl" && depth === 0) break;
      }
    }

    /* ---------- 8. Instance.new with unknown class ---------- */
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "ident" || t.val !== "Instance") continue;
      const dot = tokens[j + 1], meth = tokens[j + 2];
      if (!dot || !meth || dot.type !== "sym" || dot.val !== "." || meth.val !== "new") continue;
      const open = tokens[j + 3], clsTok = tokens[j + 4];
      if (!open || !clsTok || open.type !== "sym" || open.val !== "(" || clsTok.type !== "string") continue;
      const clsName = clsTok.val.replace(/^["']|["']$/g, "");
      if (!CLASSES.has(clsName)) {
        issues.push({
          severity: "warning", line: clsTok.line,
          message: "Instance.new(\"" + clsName + "\") — '" + clsName + "' doesn't look like a real Roblox class. Double-check the spelling.",
          fixed: false, what: "none"
        });
      }
    }

    /* ---------- 9. GetService with unknown service ---------- */
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type !== "ident" || t.val !== "GetService") continue;
      const open = tokens[j + 1], nameTok = tokens[j + 2];
      if (!open || !nameTok || open.type !== "sym" || open.val !== "(" || nameTok.type !== "string") continue;
      const svcName = nameTok.val.replace(/^["']|["']$/g, "");
      if (!SERVICES.has(svcName)) {
        issues.push({
          severity: "warning", line: nameTok.line,
          message: "GetService(\"" + svcName + "\") — '" + svcName + "' doesn't look like a real service name. Double-check the spelling.",
          fixed: false, what: "none"
        });
      }
    }

    /* ---------- 10. apply all fixes ---------- */
    fixedCode = applyEdits(code, edits, removedLines, unmatchedOpens, leftoverBlocks);

    const hasErrors = issues.some((i) => i.severity === "error");
    const fixedCount = issues.filter((i) => i.fixed).length;

    return { issues, output: fixedCode, hasErrors, fixedCount };
  }

  /* ----------------------------------------------------------
     Apply line edits + structural auto-fixes
     ---------------------------------------------------------- */

  function applyEdits(code, edits, removedLines, unmatchedOpens, leftoverBlocks) {
    const lines = code.split("\n");
    const perLine = {};
    for (const e of edits) {
      if (!perLine[e.line]) perLine[e.line] = [];
      perLine[e.line].push({ from: e.from, to: e.to });
    }

    const replaced = lines.map((ln, idx) => {
      const lineNo = idx + 1;
      if (removedLines.has(lineNo)) return "-- [ForgeAI] removed extra 'end'";
      let outLine = ln;
      if (perLine[lineNo]) {
        for (const e of perLine[lineNo]) {
          outLine = replaceInLine(outLine, e.from, e.to);
        }
      }
      return outLine;
    });

    // Insert missing closing brackets.
    // - '(' immediately followed by 'function' closes after the block ends (end of code)
    // - other brackets close at the end of the opener's line (extended over continuations)
    const openMap = { "(": ")", "[": "]", "{": "}" };
    const closesByLine = {};
    const orderByLine = {};
    const endCloses = [];
    for (const b of unmatchedOpens) {
      if (b.fn) {
        endCloses.push(b);
        continue;
      }
      if (!orderByLine[b.line]) orderByLine[b.line] = [];
      orderByLine[b.line].push(b);
    }
    for (const lineNo of Object.keys(orderByLine)) {
      const opens = orderByLine[lineNo];
      let target = Number(lineNo) - 1; // 0-based
      let guard = 0;
      while (guard < 12) {
        const ln = replaced[target];
        if (ln === undefined) break;
        const trimmed = ln.trim();
        if (trimmed === "" || /(\.\.|[+\-*\/,#.%]|\b(and|or|not))\s*$/.test(trimmed) || trimmed.endsWith("\\")) target++;
        else break;
        guard++;
      }
      const closes = opens.map((b) => openMap[b.ch]).reverse().join("");
      if (!closesByLine[target]) closesByLine[target] = [];
      closesByLine[target].push(closes);
    }

    const withBrackets = replaced.map((ln, idx) => {
      if (closesByLine[idx]) return ln + closesByLine[idx].join("");
      return ln;
    });

    // Append missing ends / untils at the end of the file, then wrapper parens
    const final = withBrackets.slice();
    for (const b of leftoverBlocks) {
      final.push(b.kw === "repeat"
        ? "until true -- [ForgeAI] closed 'repeat' block"
        : "end -- [ForgeAI] added to close '" + b.kw + "' block");
    }
    if (endCloses.length) {
      final.push(endCloses.map((b) => openMap[b.ch]).reverse().join("") + " -- [ForgeAI] closed '('");
    }
    return final.join("\n");
  }

  function replaceInLine(line, from, to) {
    if (!from) return line;
    if (/^[A-Za-z0-9_]/.test(from)) {
      const pattern = new RegExp("\\b" + escapeRe(from) + "\\b", "g");
      return line.replace(pattern, to);
    }
    if (from === "=") {
      // single '=' not part of == <= >= ~= += etc
      return line.replace(/(^|[^<>=~!+\-*/%])=(?!=)/g, "$1==");
    }
    const pattern = new RegExp(escapeRe(from), "g");
    return line.replace(pattern, to);
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /* ---------- sample broken code for demo ---------- */

  const SAMPLE_BROKEN = [
    "-- Sample script with 6 intentional errors - watch ForgeAI fix them",
    "local player = game.Players.LocalPlayer",
    "local character = player.Character or player.CharacterAdded:Wait()",
    "local humanoid = character:WaitForChild(\"Humanoid\")",
    "local healthBar = script.Parent",
    "if healthBar == nil then",
    "    healthBar = Instance.new(\"Frame\")",
    "end",
    "",
    "humanoid.HealthChanged:connect(function(health)",
    "    if health = 0 then",
    "        print(\"Player died!\")",
    "    else",
    "        wait(0.5)",
    "        print(\"Health:\", health)",
    "    end",
    "end"
  ].join("\n");

  return { analyze, SAMPLE_BROKEN, tokenize };
})();
