/* ============================================================
   ForgeAI — Lua + C++ syntax highlighter (tiny, self-contained)
   ============================================================ */

"use strict";

const Highlight = {
  LuaKeywords: new Set([
    "and", "break", "do", "else", "elseif", "end", "false", "for",
    "function", "goto", "if", "in", "local", "nil", "not", "or",
    "repeat", "return", "then", "true", "until", "while"
  ]),

  CppKeywords: new Set([
    "auto", "bool", "break", "case", "catch", "class", "const", "continue",
    "default", "delete", "do", "double", "else", "enum", "explicit", "export",
    "extern", "false", "float", "for", "friend", "goto", "if", "inline",
    "int", "long", "namespace", "new", "nullptr", "operator", "private",
    "protected", "public", "return", "short", "signed", "sizeof", "static",
    "struct", "switch", "template", "this", "throw", "true", "try",
    "typedef", "typename", "union", "unsigned", "using", "virtual", "void",
    "volatile", "while"
  ]),

  RobloxApiWords: new Set([
    "game", "workspace", "script", "Instance", "Color3", "Vector3", "Vector2",
    "UDim", "UDim2", "CFrame", "Region3", "Ray", "RaycastParams", "TweenInfo",
    "NumberSequence", "NumberRange", "Rect", "DateTime", "Enum", "task",
    "string", "table", "math", "tonumber", "tostring", "type", "typeof",
    "print", "warn", "error", "assert", "pairs", "ipairs", "select", "unpack",
    "spawn", "delay", "wait", "tick", "os", "pcall", "xpcall", "require",
    "TweenService", "RunService", "Players", "ServerStorage", "ReplicatedStorage",
    "ReplicatedFirst", "Lighting", "UserInputService", "ContextActionService",
    "ContentProvider", "DataStoreService", "HttpService", "GamepadService",
    "MaterialService", "Teams", "CollectionService", "SoundService",
    "Material", "HumanoidDescription"
  ]),

  /* Highlight Lua source -> HTML string with .tok-* spans */
  lua(code) {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const out = [];
    const re = /(--\[\[[\s\S]*?\]\]|--[^\n]*|\[\[[\s\S]*?\]\]|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?|\b[A-Za-z_][A-Za-z0-9_]*|::|==|~=|<=|>=|[<>=+\-*/%^#.,:;(){}[\]]|\.\.\.)/g;
    let last = 0, m;
    while ((m = re.exec(code)) !== null) {
      if (m.index > last) out.push(esc(code.slice(last, m.index)));
      const tok = m[0], pre = code.slice(0, m.index);
      const prev = pre.slice(pre.length - 24);
      const isAssignment = /(^|[^A-Za-z0-9_])=(\s*)(?=[^=])$/.test(prev) || prev.trimEnd().endsWith(",");
      let cls = "";
      if (tok.startsWith("--")) cls = "tok-com";
      else if (tok.startsWith("[[") || tok.startsWith("\"") || tok.startsWith("'")) cls = "tok-str";
      else if (/^0x|^\d/.test(tok)) cls = "tok-num";
      else if (this.LuaKeywords.has(tok)) cls = "tok-kw";
      else if (this.RobloxApiWords.has(tok)) cls = "tok-var";
      else if (/^[A-Za-z_]/.test(tok)) {
        // function call -> fn color; property after . -> prop color
        if (/\.$/.test(pre.slice(pre.length - 24))) cls = "tok-prop";
        else if (this.looksLikeCall(code, m.index, tok)) cls = "tok-fn";
        else if (isAssignment) cls = "tok-var";
      }
      out.push('<span class="' + cls + '">' + esc(tok) + "</span>");
      last = m.index + tok.length;
    }
    if (last < code.length) out.push(esc(code.slice(last)));
    return out.join("");
  },

  looksLikeCall(code, idx, tok) {
    let i = idx + tok.length;
    while (i < code.length && /\s/.test(code[i])) i++;
    return code[i] === "(";
  },

  /* Highlight C++ source -> HTML */
  cpp(code) {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const out = [];
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?u?f?l?\b|[A-Za-z_][A-Za-z0-9_]*|::|&&|\|\||[<>=+\-*/%&|^!~?:;,.(){}[\]])/g;
    let last = 0, m;
    while ((m = re.exec(code)) !== null) {
      if (m.index > last) out.push(esc(code.slice(last, m.index)));
      const tok = m[0];
      let cls = "";
      if (tok.startsWith("//") || tok.startsWith("/*")) cls = "tok-com";
      else if (tok.startsWith("\"") || tok.startsWith("'")) cls = "tok-str";
      else if (/^0x|^\d/.test(tok)) cls = "tok-num";
      else if (this.CppKeywords.has(tok)) cls = "tok-kw";
      else if (/^[A-Za-z_]/.test(tok)) {
        if (/::$/.test(code.slice(0, m.index).slice(-3))) cls = "tok-prop";
        else if (/^F[A-Z]/.test(tok) || /^U[A-Z]/.test(tok) || /^A[A-Z]/.test(tok) || /^T[A-Z]/.test(tok)) cls = "tok-var";
        else if (this.looksLikeCall(code, m.index, tok)) cls = "tok-fn";
      }
      out.push('<span class="' + cls + '">' + esc(tok) + "</span>");
      last = m.index + tok.length;
    }
    if (last < code.length) out.push(esc(code.slice(last)));
    return out.join("");
  }
};
