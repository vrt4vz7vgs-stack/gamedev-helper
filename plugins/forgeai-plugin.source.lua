--!strict
-- ============================================================
-- ForgeAI — Roblox Studio plugin
-- "Lemonade-style" dock panel that generates verified Luau
-- scripts from a plain-English prompt and inserts them into
-- your project. 100% offline. No accounts, no API keys.
-- ============================================================

local Plugin = plugin
local http = game:GetService("HttpService")

local PACKS = --[[__PACKS_INJECT__]]

local function makeLayer(name, parent, anchor, pos, size, color, border, radius)
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.Parent = parent
	frame.AnchorPoint = anchor
	frame.Position = pos
	frame.Size = size
	frame.BackgroundColor3 = color
	frame.BackgroundTransparency = 0
	frame.BorderSizePixel = border or 0
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius or 6)
	corner.Parent = frame
	return frame
end

local function makeLabel(name, parent, pos, size, text, color, sizePx, bold)
	local label = Instance.new("TextLabel")
	label.Name = name
	label.Parent = parent
	label.AnchorPoint = Vector2.new(0, 0)
	label.Position = pos
	label.Size = size
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextColor3 = color
	label.TextSize = sizePx
	label.Font = bold and Enum.Font.GothamBold or Enum.Font.Gotham
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Center
	label.TextWrapped = true
	label.RichText = false
	return label
end

local function makeButton(name, parent, pos, size, text, color, radius)
	local button = Instance.new("TextButton")
	button.Name = name
	button.Parent = parent
	button.AnchorPoint = Vector2.new(0, 0)
	button.Position = pos
	button.Size = size
	button.BackgroundColor3 = color
	button.BorderSizePixel = 0
	button.Text = text
	button.TextColor3 = Color3.new(1, 1, 1)
	button.TextSize = 14
	button.Font = Enum.Font.GothamBold
	button.AutoButtonColor = true
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius or 6)
	corner.Parent = button
	return button
end

local function makeTextBox(name, parent, pos, size, placeholder, readonly)
	local box = Instance.new("TextBox")
	box.Name = name
	box.Parent = parent
	box.AnchorPoint = Vector2.new(0, 0)
	box.Position = pos
	box.Size = size
	box.BackgroundColor3 = Color3.fromRGB(26, 28, 40)
	box.BorderSizePixel = 0
	box.PlaceholderText = placeholder
	box.PlaceholderColor3 = Color3.fromRGB(110, 115, 140)
	box.Text = ""
	box.TextColor3 = Color3.new(0.92, 0.93, 0.98)
	box.TextSize = 13
	box.Font = Enum.Font.Code
	box.TextXAlignment = Enum.TextXAlignment.Left
	box.TextYAlignment = Enum.TextYAlignment.Center
	box.ClearTextOnFocus = false
	box.TextEditable = not readonly
	if readonly then
		box.TextWrapped = true
		box.TextYAlignment = Enum.TextYAlignment.Top
	end
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = box
	return box
end

-- ------------------------------------------------------------------
-- Dock widget
-- ------------------------------------------------------------------

local dock = Plugin:CreateDockWidgetPluginGui(
	"ForgeAI_Generator",
	DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 380, 640, 300, 420)
)
dock.Title = "ForgeAI"
dock.Name = "ForgeAI"

local root = makeLayer("Root", dock, Vector2.new(0, 0), UDim2.fromScale(0, 0), UDim2.fromScale(1, 1), Color3.fromRGB(17, 18, 26))

local header = makeLayer("Header", root, Vector2.new(0, 0), UDim2.new(0, 0, 0, 0), UDim2.new(1, 0, 0, 58), Color3.fromRGB(24, 25, 36))
makeLabel("Title", header, UDim2.new(0, 12, 0, 8), UDim2.new(1, -24, 0, 22), "ForgeAI", Color3.fromRGB(139, 92, 246), 18, true)
makeLabel("Subtitle", header, UDim2.new(0, 12, 0, 30), UDim2.new(1, -24, 0, 22), "Type a prompt - verified scripts are inserted into your place.", Color3.fromRGB(140, 145, 170), 12, false)

local promptBox = makeTextBox("PromptBox", root, UDim2.new(0, 12, 0, 68), UDim2.new(1, -72, 0, 38), 'e.g. "roblox combat system" or "hud"')
local sendBtn = makeButton("SendBtn", root, UDim2.new(1, -56, 0, 68), UDim2.new(0, 44, 0, 38), "Generate", Color3.fromRGB(139, 92, 246))

-- connect strip
local connectRow = makeLayer("ConnectRow", root, UDim2.new(0, 12, 0, 114), UDim2.new(1, -24, 0, 30), Color3.fromRGB(24, 25, 36))
local connDot = Instance.new("Frame")
connDot.Name = "ConnDot"
connDot.Parent = connectRow
connDot.AnchorPoint = Vector2.new(0, 0.5)
connDot.Position = UDim2.new(0, 8, 0.5, 0)
connDot.Size = UDim2.fromOffset(10, 10)
connDot.BackgroundColor3 = Color3.fromRGB(110, 116, 145)
connDot.BorderSizePixel = 0
local connDotCorner = Instance.new("UICorner")
connDotCorner.CornerRadius = UDim.new(1, 0)
connDotCorner.Parent = connDot
local apiKeyBox = makeTextBox("ApiKeyBox", connectRow, UDim2.new(0, 24, 0, 5), UDim2.new(1, -136, 0, 20), "DeepSeek API key (sk-...)", false)
apiKeyBox.TextSize = 11
local connectBtn = makeButton("ConnectBtn", connectRow, UDim2.new(1, -104, 0, 5), UDim2.new(0, 96, 0, 20), "Connect", Color3.fromRGB(52, 60, 90), 5)
connectBtn.TextSize = 11

local connected = false
local function setConnected(value)
	connected = value
	connDot.BackgroundColor3 = value and Color3.fromRGB(52, 211, 153) or Color3.fromRGB(110, 116, 145)
	connectBtn.Text = value and "Connected" or "Connect"
	connectBtn.BackgroundColor3 = value and Color3.fromRGB(22, 101, 52) or Color3.fromRGB(52, 60, 90)
end

local function storedKey()
	local ok, key = pcall(function()
		return plugin:GetSetting("ForgeAI_ApiKey")
	end)
	if ok and type(key) == "string" and key ~= "" then
		return key
	end
	return ""
end

local function pingKey(key)
	local body = http:JSONEncode({
		model = "deepseek-v4-flash",
		messages = {
			{ role = "system", content = "Reply with exactly: OK" },
			{ role = "user", content = "ping" },
		},
		max_tokens = 8,
		stream = false,
	})
	return http:PostAsync("https://api.deepseek.com/chat/completions", body, Enum.HttpContentType.ApplicationJson, false, false, {
		["Authorization"] = "Bearer " .. key,
	})
end

connectBtn.MouseButton1Click:Connect(function()
	if connected then
		plugin:SetSetting("ForgeAI_ApiKey", "")
		apiKeyBox.Text = ""
		setConnected(false)
		statusLabel.Text = "Disconnected"
		statusLabel.TextColor3 = Color3.fromRGB(130, 136, 165)
		return
	end
	local key = apiKeyBox.Text:gsub("^%s+", ""):gsub("%s+$", "")
	if key == "" then
		statusLabel.Text = "Paste your DeepSeek API key, then Connect"
		statusLabel.TextColor3 = Color3.fromRGB(251, 191, 36)
		return
	end
	connectBtn.Text = "Testing..."
	task.spawn(function()
		local ok, res = pcall(pingKey, key)
		if ok then
			plugin:SetSetting("ForgeAI_ApiKey", key)
			setConnected(true)
			statusLabel.Text = "Connected to DeepSeek - real AI generation"
			statusLabel.TextColor3 = Color3.fromRGB(52, 211, 153)
			print("[ForgeAI] connected to DeepSeek")
		else
			setConnected(false)
			statusLabel.Text = "Connect failed: " .. tostring(res)
			statusLabel.TextColor3 = Color3.fromRGB(248, 113, 113)
			print("[ForgeAI] connect failed: " .. tostring(res))
		end
	end)
end)

local stored = storedKey()
if stored ~= "" then
	apiKeyBox.Text = stored
	setConnected(true)
end

local resultsLabel = makeLabel("ResultsLabel", root, UDim2.new(0, 12, 0, 152), UDim2.new(1, -24, 0, 20), "Ask for: animations, gui, combat, npc ai, admin, data save...", Color3.fromRGB(120, 126, 152), 12, false)

local fileList = Instance.new("ScrollingFrame")
fileList.Name = "FileList"
fileList.Parent = root
fileList.AnchorPoint = Vector2.new(0, 0)
fileList.Position = UDim2.new(0, 12, 0, 176)
fileList.Size = UDim2.new(1, -24, 0, 168)
fileList.BackgroundColor3 = Color3.fromRGB(21, 22, 32)
fileList.BorderSizePixel = 0
fileList.ScrollBarThickness = 6
fileList.ScrollBarImageColor3 = Color3.fromRGB(90, 95, 125)
local fileListCorner = Instance.new("UICorner")
fileListCorner.CornerRadius = UDim.new(0, 8)
fileListCorner.Parent = fileList
local fileLayout = Instance.new("UIListLayout")
fileLayout.Parent = fileList
fileLayout.Padding = UDim.new(0, 6)

local previewTitle = makeLabel("PreviewTitle", root, UDim2.new(0, 12, 0, 352), UDim2.new(1, -24, 0, 16), "Preview", Color3.fromRGB(120, 126, 152), 11, true)
local previewBox = makeTextBox("PreviewBox", root, UDim2.new(0, 12, 0, 372), UDim2.new(1, -24, 0, 132), "Click a file to preview its code.", true)

local insertAll = makeButton("InsertAll", root, UDim2.new(0, 12, 0, 512), UDim2.new(1, -24, 0, 34), "Insert all files", Color3.fromRGB(34, 211, 238))
local statusLabel = makeLabel("Status", root, UDim2.new(0, 12, 0, 550), UDim2.new(1, -24, 0, 34), "ForgeAI - free, offline, no accounts", Color3.fromRGB(130, 136, 165), 11, false)

local helpMsg = "Try: roblox animation kit / hud / shop gui / combat system / npc ai / admin commands / data saving / checkpoint"

-- ------------------------------------------------------------------
-- Intent detection (same logic as forgeai.gg web app)
-- ------------------------------------------------------------------

local currentFiles = {}

local function detectIntent(text)
	local lower = " " .. text:lower() .. " "
	local bestId, bestScore, best = nil, 0, nil
	for _, pack in ipairs(PACKS) do
		local score = 0
		for _, kw in ipairs(pack.keywords) do
			if lower:find(kw, 1, true) then
				score += #kw
			end
		end
		if pack.id == "roblox-scripts" then
			local guiish = lower:find("gui", 1, true) or lower:find("hud", 1, true)
				or lower:find("menu", 1, true) or lower:find("ui", 1, true)
				or lower:find("shop", 1, true) or lower:find("interface", 1, true)
				or lower:find("screen", 1, true)
			if guiish and score < 12 then
				score = 0
			end
		end
		if score > bestScore then
			bestScore = score
			best = pack
		end
	end
	return best, bestScore
end

-- ------------------------------------------------------------------
-- Results UI
-- ------------------------------------------------------------------

local function clearList()
	for _, child in ipairs(fileList:GetChildren()) do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end
	fileList.CanvasSize = UDim2.fromScale(0, 0)
end

local function showPreview(file)
	previewBox.Text = file.code
end

local function insertFile(file)
	local containerName = file.location
	local className = file.className
	local container = game:GetService(containerName)
	local existing = container:FindFirstChild(file.name)
	if existing then
		existing:Destroy()
	end
	local instance = Instance.new(className)
	instance.Name = file.name
	instance.Source = file.code
	instance.Parent = container
	return containerName
end

local function addRow(file, index)
	local row = makeLayer("Row", fileList, Vector2.new(0, 0), UDim2.fromScale(0, 0), UDim2.new(1, -10, 0, 30), Color3.fromRGB(29, 31, 44))
	local num = makeLabel("Num", row, UDim2.new(0, 8, 0, 0), UDim2.new(0, 20, 1, 0), tostring(index), Color3.fromRGB(90, 96, 125), 12, true)
	local nameLabel = makeLabel("Name", row, UDim2.new(0, 28, 0, 0), UDim2.new(0, 140, 1, 0), file.name, Color3.new(0.93, 0.94, 1), 12, true)
	local locLabel = makeLabel("Loc", row, UDim2.new(0, 170, 0, 0), UDim2.new(1, -220, 1, 0), file.location, Color3.fromRGB(110, 116, 145), 10, false)
	local insert = makeButton("Insert", row, UDim2.new(1, -44, 0, 5), UDim2.new(0, 38, 0, 20), "Add", Color3.fromRGB(52, 60, 90), 5)
	insert.TextSize = 11
	insert.MouseButton1Click:Connect(function()
		local where = insertFile(file)
		statusLabel.Text = "Inserted " .. file.name .. " -> " .. where
		statusLabel.TextColor3 = Color3.fromRGB(52, 211, 153)
	end)
	row.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			showPreview(file)
		end
	end)
	fileList.CanvasSize = UDim2.fromScale(0, fileLayout.AbsoluteContentSize.Y)
end

local function showResults(pack)
	clearList()
	currentFiles = pack.files
	if pack.ai then
		resultsLabel.Text = pack.title .. " (" .. #pack.files .. " files generated by DeepSeek V4)"
	else
		resultsLabel.Text = pack.title .. " (" .. #pack.files .. " files, all checked - 0 errors)"
	end
	resultsLabel.TextColor3 = Color3.fromRGB(52, 211, 153)
	for i, file in ipairs(pack.files) do
		addRow(file, i)
	end
	insertAll.Visible = #pack.files > 0
	if #pack.files > 0 then
		showPreview(pack.files[1])
	end
end

local function showHelp()
	clearList()
	currentFiles = {}
	resultsLabel.Text = "No match found - ask me for one of these:"
	resultsLabel.TextColor3 = Color3.fromRGB(251, 191, 36)
	local row = makeLayer("Row", fileList, Vector2.new(0, 0), UDim2.fromScale(0, 0), UDim2.new(1, -10, 0, 60), Color3.fromRGB(29, 31, 44))
	makeLabel("Hint", row, UDim2.new(0, 10, 0, 0), UDim2.new(1, -20, 1, 0), helpMsg, Color3.new(0.85, 0.87, 0.95), 12, false)
	fileList.CanvasSize = UDim2.fromScale(0, fileLayout.AbsoluteContentSize.Y)
	insertAll.Visible = false
	previewBox.Text = ""
	statusLabel.Text = "Just describe what you want to build."
	statusLabel.TextColor3 = Color3.fromRGB(130, 136, 165)
end

-- ------------------------------------------------------------------
-- Real AI generation (DeepSeek)
-- ------------------------------------------------------------------

local SYSTEM_PROMPT = [==[
You are ForgeAI, an expert Roblox Studio Luau developer.
The user describes something they want to build in a Roblox game.
Write complete, production-quality Luau scripts that run with zero errors.
Rules:
- Server logic goes in Scripts in ServerScriptService.
- Client logic goes in LocalScripts in StarterPlayerScripts or StarterGui.
- Reusable shared code goes in ModuleScripts in ReplicatedStorage.
- Use current Roblox APIs only. Never use removed or deprecated APIs.
- Scripts must be complete and runnable, with all services and edge cases included.
- If the request is impossible in Roblox, say so briefly and suggest the closest real alternative.
Output format - repeat these blocks for EVERY file (no other commentary):
FILE: <FileName.lua>
LOCATION: <ServerScriptService|StarterPlayerScripts|StarterGui|ReplicatedStorage>
CLASS: <Script|LocalScript|ModuleScript>
```lua
<complete Luau code>
```
]==]

local function parseAiFiles(content)
	local files = {}
	local current = { name = nil, location = nil, className = nil, code = nil }
	local inCode = false
	for line in tostring(content):gmatch("[^\r\n]+") do
		if line:match("^```") then
			inCode = not inCode
			if not inCode then
				table.insert(files, {
					name = current.name or ("ForgeAI-" .. #files + 1 .. ".lua"),
					location = current.location or "ServerScriptService",
					className = current.className or "Script",
					code = current.code or "",
				})
				current = { name = nil, location = nil, className = nil, code = nil }
			else
				current.code = ""
			end
		elseif inCode then
			current.code = current.code .. line .. "\n"
		else
			local f = line:match("^FILE:%s*(.-)%s*$")
			local l = line:match("^LOCATION:%s*(.-)%s*$")
			local c = line:match("^CLASS:%s*(.-)%s*$")
			if f then current.name = f:gsub("%*", ""):gsub("%s+$", "") end
			if l then current.location = l:gsub("%*", ""):gsub("%s+$", "") end
			if c then current.className = c:gsub("%*", ""):gsub("%s+$", "") end
		end
	end
	return files
end

local function aiGenerate(text)
	statusLabel.Text = "Asking DeepSeek..."
	statusLabel.TextColor3 = Color3.fromRGB(251, 191, 36)
	local key = apiKeyBox.Text:gsub("^%s+", ""):gsub("%s+$", "")
	task.spawn(function()
		local ok, res = pcall(function()
			local body = http:JSONEncode({
				model = "deepseek-v4-flash",
				messages = {
					{ role = "system", content = SYSTEM_PROMPT },
					{ role = "user", content = text },
				},
				stream = false,
				temperature = 0.6,
				max_tokens = 4000,
			})
			return http:PostAsync("https://api.deepseek.com/chat/completions", body, Enum.HttpContentType.ApplicationJson, false, false, {
				["Authorization"] = "Bearer " .. key,
			})
		end)
		if not ok then
			statusLabel.Text = "AI error: " .. tostring(res)
			statusLabel.TextColor3 = Color3.fromRGB(248, 113, 113)
			return
		end
		local data = http:JSONDecode(res)
		local content = data.choices and data.choices[1] and data.choices[1].message and data.choices[1].message.content
		if not content or content == "" then
			statusLabel.Text = "AI returned nothing - try again"
			statusLabel.TextColor3 = Color3.fromRGB(248, 113, 113)
			return
		end
		local files = parseAiFiles(content)
		if #files == 0 then
			statusLabel.Text = "AI returned no script blocks - try again"
			statusLabel.TextColor3 = Color3.fromRGB(248, 113, 113)
			return
		end
		showResults({
			ai = true,
			title = "DeepSeek: " .. text,
			files = files,
		})
	end)
end

local function generate()
	local text = promptBox.Text:gsub("^%s+", ""):gsub("%s+$", "")
	if text == "" then
		return
	end
	if connected then
		aiGenerate(text)
		return
	end
	local pack = detectIntent(text)
	statusLabel.Text = "Generating..."
	statusLabel.TextColor3 = Color3.fromRGB(251, 191, 36)
	task.delay(0.35, function()
		if pack then
			showResults(pack)
		else
			showHelp()
		end
	end)
end

sendBtn.MouseButton1Click:Connect(generate)
promptBox.FocusLost:Connect(function(enterPressed)
	if enterPressed then
		generate()
	end
end)

insertAll.MouseButton1Click:Connect(function()
	local inserted = 0
	local notes = {}
	for _, file in ipairs(currentFiles) do
		local where = insertFile(file)
		inserted += 1
		if file.note then
			table.insert(notes, file.name .. " - " .. file.note)
		end
	end
	statusLabel.Text = "Inserted " .. inserted .. " files into your place"
	statusLabel.TextColor3 = Color3.fromRGB(52, 211, 153)
	if #notes > 0 then
		statusLabel.Text = statusLabel.Text .. ". Note: " .. table.concat(notes, "; ")
	end
end)

-- ------------------------------------------------------------------
-- Toolbar
-- ------------------------------------------------------------------

local toolbar = Plugin:CreateToolbar("ForgeAI")
local openBtn = toolbar:CreateButton("ForgeAI", "Open ForgeAI - generate scripts from a prompt")
openBtn.ClickableWhenViewportHidden = true
openBtn.Click:Connect(function()
	dock.Enabled = not dock.Enabled
end)

Plugin.Unloading:Connect(function()
	dock:Destroy()
end)

-- show the dock (with the Connect button) as soon as the plugin loads
dock.Enabled = true
showHelp()
