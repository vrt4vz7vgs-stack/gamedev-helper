/* ForgeAI — preload bridge.
   Exposes a tiny, safe API for the UE5 project pairing:
   - selectProject(): pick a .uproject, returns project info + C++ modules
   - writeProjectFiles(): write generated map files into Source/<Module>/
   No node integration — only these two methods cross the bridge. */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forgeAI", {
  isDesktop: true,
  selectProject: () => ipcRenderer.invoke("forgeai:select-project"),
  writeProjectFiles: (payload) => ipcRenderer.invoke("forgeai:write-project-files", payload),
});
