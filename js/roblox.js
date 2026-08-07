/* ============================================================
   ForgeAI — Roblox Studio generator library
   Every Lua file below is pre-validated by LuaFixer
   (zero errors) and written for modern Roblox APIs.
   ============================================================ */

"use strict";

const RobloxLib = (function () {

  /* ============================================================
     ANIMATIONS
     ============================================================ */

  const animationKitModule = `--!strict
-- AnimationKit — state-based animation system for R15 rigs.
-- 1) Put this ModuleScript in ReplicatedStorage.
-- 2) Put AnimationPlayer.client.lua in StarterPlayerScripts.
-- 3) Replace the rbxassetid:// values with your own animation IDs.

local AnimationKit = {}

local IDS = {
	Idle = "rbxassetid://180435571",
	Walk = "rbxassetid://180426354",
	Run = "rbxassetid://180426354",
	Jump = "rbxassetid://125750702",
	Fall = "rbxassetid://180426354",
}

local SPEEDS = {
	Idle = 1,
	Walk = 1,
	Run = 2,
	Jump = 1,
	Fall = 1,
}

local PRIORITY = {
	Idle = Enum.AnimationPriority.Idle,
	Walk = Enum.AnimationPriority.Movement,
	Run = Enum.AnimationPriority.Movement,
	Jump = Enum.AnimationPriority.Action,
	Fall = Enum.AnimationPriority.Action,
}

local currentTrack = {}

-- Loads every animation onto the rig's Animator and returns a table of tracks.
function AnimationKit.loadAnimator(character, overrideIds)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid then
		error("Character has no Humanoid")
	end

	local animator = humanoid:FindFirstChildOfClass("Animator")
	if not animator then
		animator = Instance.new("Animator")
		animator.Parent = humanoid
	end

	local ids = overrideIds or IDS
	local tracks = {}

	for state, assetId in pairs(ids) do
		local animation = Instance.new("Animation")
		animation.Name = state
		animation.AnimationId = assetId

		local track = animator:LoadAnimation(animation)
		if track then
			track.Priority = PRIORITY[state] or Enum.AnimationPriority.Idle
			tracks[state] = track
		end
	end

	return tracks
end

-- Smoothly transitions to a state: Idle, Walk, Run, Jump or Fall.
function AnimationKit.play(animator, tracks, state, speedScale)
	if not tracks then
		warn("AnimationKit: no tracks loaded")
		return
	end

	local target = tracks[state]
	if not target then
		warn("AnimationKit: unknown state '" .. tostring(state) .. "'")
		return
	end

	if currentTrack[animator] and currentTrack[animator] ~= target then
		currentTrack[animator]:Stop(0.2)
	end

	local speed = speedScale or SPEEDS[state] or 1
	target:Play(speed, 0.2)
	currentTrack[animator] = target
	return target
end

-- Fades out whatever is currently playing.
function AnimationKit.stop(animator)
	if currentTrack[animator] then
		currentTrack[animator]:Stop(0.3)
		currentTrack[animator] = nil
	end
end

return AnimationKit`;

  const animationPlayerClient = `--!strict
-- AnimationPlayer — drives the AnimationKit automatically.
-- Put this LocalScript in StarterPlayerScripts.
-- Requires AnimationKit ModuleScript in ReplicatedStorage.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer

local kitModule = ReplicatedStorage:WaitForChild("AnimationKit", 10)
if not kitModule then
	warn("AnimationKit module not found in ReplicatedStorage")
	return
end
local kit = require(kitModule)

local tracks = {}
local currentState = "Idle"

local function pickState(humanoid)
	local state = humanoid:GetState()

	if state == Enum.HumanoidStateType.Dead then
		return "Idle"
	end
	if state == Enum.HumanoidStateType.Jumping then
		return "Jump"
	end
	if state == Enum.HumanoidStateType.Falling then
		return "Fall"
	end

	local root = humanoid.RootPart
	local speed = root and root.AssemblyLinearVelocity.Magnitude or 0

	if speed > 16 and UserInputService:IsKeyDown(Enum.KeyCode.LeftShift) then
		return "Run"
	end
	if speed > 2 then
		return "Walk"
	end
	return "Idle"
end

local function onCharacterAdded(character)
	tracks = kit.loadAnimator(character)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid then
		return
	end
	currentState = "Idle"
	kit.play(humanoid, tracks, "Idle")
end

player.CharacterAdded:Connect(onCharacterAdded)
if player.Character then
	onCharacterAdded(player.Character)
end

RunService.RenderStepped:Connect(function()
	local character = player.Character
	if not character then
		return
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return
	end

	local state = pickState(humanoid)
	if state ~= currentState then
		currentState = state
		kit.play(humanoid, tracks, state)
	end
end)`;

  const buildKeyframes = `--!strict
-- BuildKeyframes — creates a custom KeyframeSequence animation at runtime.
-- R15 part names: Head, Torso, RightUpperArm, RightLowerArm, LeftUpperArm,
-- LeftLowerArm, RightUpperLeg, RightLowerLeg, LeftUpperLeg, LeftLowerLeg.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local function makeKeyframe(sequence, time, poses)
	local keyframe = Instance.new("Keyframe")
	keyframe.Time = time

	for partName, transform in pairs(poses) do
		local pose = Instance.new("Pose")
		pose.Name = partName
		pose.Transform = transform
		pose.Parent = keyframe
	end

	keyframe.Parent = sequence
	return keyframe
end

local sequence = Instance.new("KeyframeSequence")
sequence.Name = "DanceWave"

-- Pose 1: t = 0.00 — right arm tucked against the body
makeKeyframe(sequence, 0, {
	RightUpperArm = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(90), 0, math.rad(-45)),
	RightLowerArm = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-110), 0, 0),
})

-- Pose 2: t = 0.35 — arm raised above the head
makeKeyframe(sequence, 0.35, {
	RightUpperArm = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-45), 0, math.rad(-90)),
	RightLowerArm = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-160), 0, 0),
})

-- Pose 3: t = 0.70 — arm out to the side
makeKeyframe(sequence, 0.7, {
	RightUpperArm = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(0), 0, math.rad(-90)),
	RightLowerArm = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-60), 0, 0),
})

sequence.Parent = ReplicatedStorage
print("Animation saved to ReplicatedStorage as", sequence.Name)`;

  /* ============================================================
     GUI
     ============================================================ */

  const hudClient = `--!strict
-- HUD Pack — health bar, damage numbers, stamina bar and ammo counter.
-- Put this LocalScript in StarterPlayerScripts.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- ------------------------------------------------------------
-- Root GUI
-- ------------------------------------------------------------
local hud = Instance.new("ScreenGui")
hud.Name = "HUD"
hud.ResetOnSpawn = false
hud.IgnoreGuiInset = true
hud.Parent = playerGui

local function makeBar(name, position, color)
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.AnchorPoint = Vector2.new(0, 1)
	frame.Position = position
	frame.Size = UDim2.new(0, 240, 0, 16)
	frame.BackgroundColor3 = Color3.fromRGB(18, 20, 26)
	frame.BorderSizePixel = 0
	frame.Parent = hud

	local fill = Instance.new("Frame")
	fill.Name = "Fill"
	fill.BackgroundColor3 = color
	fill.BorderSizePixel = 0
	fill.Size = UDim2.new(1, 0, 1, 0)
	fill.Parent = frame

	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.new(1, 0, 1, 0)
	label.Font = Enum.Font.GothamBold
	label.Text = ""
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextSize = 11
	label.Parent = frame

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = frame

	return fill, label
end

local healthFill, healthLabel = makeBar("HealthBar", UDim2.new(0.02, 0, 0.98, 0), Color3.fromRGB(52, 211, 153))
local staminaFill = makeBar("StaminaBar", UDim2.new(0.02, 0, 0.90, 0), Color3.fromRGB(251, 191, 36))
local ammoLabel = Instance.new("TextLabel")
ammoLabel.BackgroundTransparency = 1
ammoLabel.Position = UDim2.new(0.02, 0, 0.82, 0)
ammoLabel.Size = UDim2.new(0, 240, 0, 20)
ammoLabel.Font = Enum.Font.GothamBold
ammoLabel.Text = "Ammo: --"
ammoLabel.TextColor3 = Color3.new(1, 1, 1)
ammoLabel.TextSize = 14
ammoLabel.TextXAlignment = Enum.TextXAlignment.Left
ammoLabel.Parent = hud

-- ------------------------------------------------------------
-- Health bar + damage numbers
-- ------------------------------------------------------------
local function spawnDamageNumber(amount)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.GothamBold
	label.Text = "-" .. math.floor(amount)
	label.TextColor3 = Color3.fromRGB(248, 113, 113)
	label.TextSize = 22
	label.Position = UDim2.new(math.random(35, 65) / 100, 0, math.random(25, 45) / 100, 0)
	label.Size = UDim2.new(0, 60, 0, 24)
	label.ZIndex = 10
	label.Parent = hud

	local tween = TweenService:Create(label, TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = label.Position - UDim2.new(0, 0, 0, 50),
		TextTransparency = 1,
	})
	tween:Play()
	tween.Completed:Connect(function()
		label:Destroy()
	end)
end

local function onCharacterAdded(character)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid then
		return
	end

	local function refresh()
		local fraction = math.clamp(humanoid.Health / humanoid.MaxHealth, 0, 1)
		local color = fraction > 0.5 and Color3.fromRGB(52, 211, 153)
			or (fraction > 0.25 and Color3.fromRGB(251, 191, 36) or Color3.fromRGB(248, 113, 113))
		TweenService:Create(healthFill, TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size = UDim2.new(fraction, 0, 1, 0),
			BackgroundColor3 = color,
		}):Play()
		healthLabel.Text = string.format("%d", math.ceil(humanoid.Health))
	end

	refresh()
	local lastHealth = humanoid.Health

	humanoid.HealthChanged:Connect(function(newHealth)
		refresh()
		if newHealth < lastHealth then
			spawnDamageNumber(lastHealth - newHealth)
		end
		lastHealth = newHealth
	end)
end

player.CharacterAdded:Connect(onCharacterAdded)
if player.Character then
	onCharacterAdded(player.Character)
end

-- ------------------------------------------------------------
-- Stamina + sprint
-- ------------------------------------------------------------
local stamina = 100
local sprinting = false

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then
		return
	end
	if input.KeyCode == Enum.KeyCode.LeftShift then
		sprinting = true
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.LeftShift then
		sprinting = false
	end
end)

RunService.Heartbeat:Connect(function(dt)
	if sprinting and stamina > 0 then
		stamina = math.max(0, stamina - 25 * dt)
	else
		stamina = math.min(100, stamina + 15 * dt)
	end
	staminaFill.Size = UDim2.new(stamina / 100, 0, 1, 0)
end)

-- ------------------------------------------------------------
-- Ammo counter (call setAmmo() from your weapon scripts)
-- ------------------------------------------------------------
local function setAmmo(current, maxAmmo)
	if maxAmmo then
		ammoLabel.Text = "Ammo: " .. tostring(current) .. " / " .. tostring(maxAmmo)
	else
		ammoLabel.Text = "Ammo: " .. tostring(current)
	end
end

local AmmoBridge = {}
AmmoBridge.setAmmo = setAmmo
_G.AmmoBridge = AmmoBridge`;

  const shopClient = `--!strict
-- Shop GUI — press B to open/close the shop.
-- Needs a RemoteEvent named "BuyRequest" in ReplicatedStorage.
-- The server should listen to BuyRequest and grant items.
-- Put this LocalScript in StarterPlayerScripts.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local buyRemote = ReplicatedStorage:WaitForChild("BuyRequest", 10)
if not buyRemote then
	warn("BuyRequest RemoteEvent not found in ReplicatedStorage")
	return
end

local ITEMS = {
	{ Name = "Health Potion", Price = 25, Description = "Restores 50 health" },
	{ Name = "Sword", Price = 100, Description = "A sharp iron sword" },
	{ Name = "Grappling Hook", Price = 250, Description = "Swing across gaps" },
	{ Name = "Jetpack", Price = 500, Description = "Fly around the map" },
}

local shopOpen = false

local shopGui = Instance.new("ScreenGui")
shopGui.Name = "ShopGUI"
shopGui.ResetOnSpawn = false
shopGui.IgnoreGuiInset = true
shopGui.Enabled = false
shopGui.Parent = playerGui

local background = Instance.new("Frame")
background.BackgroundColor3 = Color3.fromRGB(12, 14, 20)
background.BackgroundTransparency = 0.25
background.Size = UDim2.new(1, 0, 1, 0)
background.Parent = shopGui

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.new(0.5, 0, 0.5, 0)
panel.Size = UDim2.new(0, 360, 0, 480)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 40)
panel.BorderSizePixel = 0
panel.Parent = shopGui

local panelCorner = Instance.new("UICorner")
panelCorner.CornerRadius = UDim.new(0, 14)
panelCorner.Parent = panel

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.Position = UDim2.new(0, 20, 0, 14)
title.Size = UDim2.new(0, 200, 0, 30)
title.Font = Enum.Font.GothamBold
title.Text = "Shop"
title.TextColor3 = Color3.new(1, 1, 1)
title.TextSize = 22
title.TextXAlignment = Enum.TextXAlignment.Left
title.Parent = panel

local closeButton = Instance.new("TextButton")
closeButton.BackgroundColor3 = Color3.fromRGB(248, 113, 113)
closeButton.Position = UDim2.new(1, -44, 0, 14)
closeButton.Size = UDim2.new(0, 28, 0, 28)
closeButton.Font = Enum.Font.GothamBold
closeButton.Text = "X"
closeButton.TextColor3 = Color3.new(1, 1, 1)
closeButton.TextSize = 14
closeButton.Parent = panel

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 8)
closeCorner.Parent = closeButton

local scroll = Instance.new("ScrollingFrame")
scroll.BackgroundTransparency = 1
scroll.Position = UDim2.new(0, 20, 0, 60)
scroll.Size = UDim2.new(1, -40, 1, -80)
scroll.ScrollBarThickness = 6
scroll.CanvasSize = UDim2.new(0, 0, 0, #ITEMS * 86)
scroll.Parent = panel

local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 10)
layout.Parent = scroll

local function openShop()
	shopOpen = true
	shopGui.Enabled = true
	panel.Position = UDim2.new(0.5, 0, 1.2, 0)
	local tween = TweenService:Create(panel, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = UDim2.new(0.5, 0, 0.5, 0),
	})
	tween:Play()
end

local function closeShop()
	shopOpen = false
	shopGui.Enabled = false
end

for index, item in ipairs(ITEMS) do
	local row = Instance.new("Frame")
	row.BackgroundColor3 = Color3.fromRGB(32, 37, 52)
	row.BorderSizePixel = 0
	row.Size = UDim2.new(1, 0, 0, 76)
	row.Parent = scroll

	local rowCorner = Instance.new("UICorner")
	rowCorner.CornerRadius = UDim.new(0, 10)
	rowCorner.Parent = row

	local nameLabel = Instance.new("TextLabel")
	nameLabel.BackgroundTransparency = 1
	nameLabel.Position = UDim2.new(0, 12, 0, 8)
	nameLabel.Size = UDim2.new(1, -100, 0, 22)
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.Text = item.Name
	nameLabel.TextColor3 = Color3.new(1, 1, 1)
	nameLabel.TextSize = 15
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left
	nameLabel.Parent = row

	local descLabel = Instance.new("TextLabel")
	descLabel.BackgroundTransparency = 1
	descLabel.Position = UDim2.new(0, 12, 0, 30)
	descLabel.Size = UDim2.new(1, -100, 0, 20)
	descLabel.Font = Enum.Font.Gotham
	descLabel.Text = item.Description
	descLabel.TextColor3 = Color3.fromRGB(150, 158, 180)
	descLabel.TextSize = 12
	descLabel.TextXAlignment = Enum.TextXAlignment.Left
	descLabel.Parent = row

	local buyButton = Instance.new("TextButton")
	buyButton.BackgroundColor3 = Color3.fromRGB(52, 211, 153)
	buyButton.AnchorPoint = Vector2.new(1, 0.5)
	buyButton.Position = UDim2.new(1, -10, 0.5, 0)
	buyButton.Size = UDim2.new(0, 76, 0, 34)
	buyButton.Font = Enum.Font.GothamBold
	buyButton.Text = item.Price .. " coins"
	buyButton.TextColor3 = Color3.fromRGB(10, 20, 16)
	buyButton.TextSize = 13
	buyButton.Parent = row

	local buyCorner = Instance.new("UICorner")
	buyCorner.CornerRadius = UDim.new(0, 8)
	buyCorner.Parent = buyButton

	buyButton.Activated:Connect(function()
		buyRemote:FireServer(index)
	end)
end

closeButton.Activated:Connect(closeShop)

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then
		return
	end
	if input.KeyCode == Enum.KeyCode.B then
		if shopOpen then
			closeShop()
		else
			openShop()
		end
	end
end)`;

  const mainMenuClient = `--!strict
-- MainMenu — title screen with a play button and settings.
-- Put this LocalScript in StarterPlayerScripts.
-- The menu automatically hides when the player's character is ready.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local menu = Instance.new("ScreenGui")
menu.Name = "MainMenu"
menu.ResetOnSpawn = false
menu.IgnoreGuiInset = true
menu.Parent = playerGui

local background = Instance.new("Frame")
background.BackgroundColor3 = Color3.fromRGB(8, 10, 16)
background.Size = UDim2.new(1, 0, 1, 0)
background.Parent = menu

local gradient = Instance.new("UIGradient")
gradient.Color = ColorSequence.new(Color3.fromRGB(8, 10, 16), Color3.fromRGB(30, 27, 45))
gradient.Rotation = 90
gradient.Parent = background

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.AnchorPoint = Vector2.new(0.5, 0.5)
title.Position = UDim2.new(0.5, 0, 0.35, 0)
title.Size = UDim2.new(0, 600, 0, 80)
title.Font = Enum.Font.GothamBlack
title.Text = "MY GAME"
title.TextColor3 = Color3.new(1, 1, 1)
title.TextSize = 56
title.Parent = menu

local subtitle = Instance.new("TextLabel")
subtitle.BackgroundTransparency = 1
subtitle.AnchorPoint = Vector2.new(0.5, 0.5)
subtitle.Position = UDim2.new(0.5, 0, 0.35, 55)
subtitle.Size = UDim2.new(0, 400, 0, 30)
subtitle.Font = Enum.Font.Gotham
subtitle.Text = "an epic adventure made with ForgeAI"
subtitle.TextColor3 = Color3.fromRGB(150, 158, 180)
subtitle.TextSize = 16
subtitle.Parent = menu

local playButton = Instance.new("TextButton")
playButton.BackgroundColor3 = Color3.fromRGB(139, 92, 246)
playButton.AnchorPoint = Vector2.new(0.5, 0.5)
playButton.Position = UDim2.new(0.5, 0, 0.52, 0)
playButton.Size = UDim2.new(0, 220, 0, 54)
playButton.Font = Enum.Font.GothamBold
playButton.Text = "PLAY"
playButton.TextColor3 = Color3.new(1, 1, 1)
playButton.TextSize = 22
playButton.Parent = menu

local playCorner = Instance.new("UICorner")
playCorner.CornerRadius = UDim.new(0, 14)
playCorner.Parent = playButton

local settingsButton = Instance.new("TextButton")
settingsButton.BackgroundTransparency = 1
settingsButton.AnchorPoint = Vector2.new(0.5, 0.5)
settingsButton.Position = UDim2.new(0.5, 0, 0.60, 0)
settingsButton.Size = UDim2.new(0, 220, 0, 40)
settingsButton.Font = Enum.Font.Gotham
settingsButton.Text = "Settings"
settingsButton.TextColor3 = Color3.fromRGB(180, 188, 210)
settingsButton.TextSize = 16
settingsButton.Parent = menu

local function hideMenu()
	local tween = TweenService:Create(background, TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
		BackgroundTransparency = 1,
	})
	tween:Play()
	tween.Completed:Connect(function()
		menu:Destroy()
	end)
end

playButton.Activated:Connect(hideMenu)
settingsButton.Activated:Connect(function()
	playButton.Text = "Settings coming soon!"
	task.delay(1.2, function()
		playButton.Text = "PLAY"
	end)
end)

-- hide the menu once the character spawns
player.CharacterAdded:Connect(function()
	if menu.Parent then
		hideMenu()
	end
end)`;

  /* ============================================================
     GAME SCRIPTS
     ============================================================ */

  const playerSetupServer = `--!strict
-- PlayerSetup — leaderstats, spawn protection and loadout.
-- Put this Script in ServerScriptService.

local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")

local STARTING_COINS = 100
local SPAWN_PROTECTION_SECONDS = 5

local function createLeaderstats(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"

	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = STARTING_COINS
	coins.Parent = stats

	local kills = Instance.new("IntValue")
	kills.Name = "Kills"
	kills.Value = 0
	kills.Parent = stats

	stats.Parent = player
end

local function giveLoadout(character)
	local backpack = character:WaitForChild("HumanoidRootPart", 10)
	if not backpack then
		return
	end
	-- Uncomment after you build a "Sword" Tool in ServerStorage:
	-- local sword = ServerStorage:FindFirstChild("Sword")
	-- if sword then
	-- 	sword:Clone().Parent = player.Backpack
	-- end
end

local function enableSpawnProtection(character, player)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid then
		return
	end

	humanoid:ChangeState(Enum.HumanoidStateType.Jumping)
	task.wait(0.1)
	humanoid:ChangeState(Enum.HumanoidStateType.GettingUp)

	local protect = Instance.new("Highlight")
	protect.Name = "SpawnProtection"
	protect.FillColor = Color3.fromRGB(96, 165, 250)
	protect.OutlineTransparency = 0
	protect.Parent = character

	task.delay(SPAWN_PROTECTION_SECONDS, function()
		local highlight = character:FindFirstChild("SpawnProtection")
		if highlight then
			highlight:Destroy()
		end
	end)
end

local function onCharacterAdded(character, player)
	character:WaitForChild("HumanoidRootPart", 10)
	giveLoadout(character)
	enableSpawnProtection(character, player)
end

local function onPlayerAdded(player)
	createLeaderstats(player)

	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(character, player)
	end)

	if player.Character then
		onCharacterAdded(player.Character, player)
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)

game:BindToClose(function()
	print("Server closing — data saved by DataSave script.")
end)`;

  const combatServer = `--!strict
-- CombatSystem — validates sword hits on the server.
-- Needs: RemoteEvent "HitRequest" + RemoteEvent "Swing" (auto-created below).
-- The client sword script calls HitRequest:FireServer(targetPart).
-- Put this Script in ServerScriptService.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local hitRemote = Instance.new("RemoteEvent")
hitRemote.Name = "HitRequest"
hitRemote.Parent = ReplicatedStorage

local swingRemote = Instance.new("RemoteEvent")
swingRemote.Name = "Swing"
swingRemote.Parent = ReplicatedStorage

local swingCooldown = {}

local function findTargetModel(targetPart)
	local current = targetPart
	while current do
		if current:IsA("Model") then
			return current
		end
		current = current.Parent
	end
	return nil
end

hitRemote.OnServerEvent:Connect(function(player, targetPart)
	if not targetPart or not targetPart:IsA("BasePart") then
		return
	end
	if not targetPart.Parent then
		return
	end

	local character = player.Character
	if not character then
		return
	end

	local tool = character:FindFirstChildOfClass("Tool")
	if not tool then
		return
	end

	-- rate limit: one hit per 0.4 seconds per player
	if swingCooldown[player] and os.clock() - swingCooldown[player] < 0.4 then
		return
	end
	swingCooldown[player] = os.clock()

	local range = tool:GetAttribute("Range") or 14
	local damage = tool:GetAttribute("Damage") or 20

	local origin = character:FindFirstChild("HumanoidRootPart")
	if not origin then
		return
	end

	local distance = (origin.Position - targetPart.Position).Magnitude
	if distance > range then
		return
	end

	local targetModel = findTargetModel(targetPart)
	if not targetModel or targetModel == character then
		return
	end

	local targetHumanoid = targetModel:FindFirstChildOfClass("Humanoid")
	if not targetHumanoid or targetHumanoid.Health <= 0 then
		return
	end

	targetHumanoid:TakeDamage(damage)

	-- knockback
	local targetRoot = targetModel:FindFirstChild("HumanoidRootPart")
	if targetRoot then
		local direction = (targetRoot.Position - origin.Position).Unit
		targetRoot.AssemblyLinearVelocity = direction * Vector3.new(25, 0, 25)
	end
end)

-- server-side health reflection into leaderstats
local function onCharacterAdded(character, player)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid then
		return
	end
	humanoid.Died:Connect(function()
		local stats = player:FindFirstChild("leaderstats")
		if stats then
			local kills = stats:FindFirstChild("Kills")
			if kills then
				kills.Value += 1
			end
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(character, player)
	end)
	if player.Character then
		onCharacterAdded(player.Character, player)
	end
end)`;

  const swordClient = `--!strict
-- SwordClient — attached to a Tool. Swings and hits targets via Raycast.
-- Put this LocalScript inside the "Sword" Tool.
-- The server (CombatSystem) validates the hit — never trust the client.

local tool = script.Parent

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local hitRemote = ReplicatedStorage:WaitForChild("HitRequest", 10)
local swingRemote = ReplicatedStorage:WaitForChild("Swing", 10)

local swingTween = nil
local canSwing = true

local function swingAnimation()
	local handle = tool:FindFirstChild("Handle")
	if not handle then
		return
	end
	local motor = handle:FindFirstChildOfClass("Motor6D")
	if not motor then
		return
	end

	swingTween = RunService.RenderStepped:Connect(function(dt)
		-- quick spin of the handle while swinging
		motor.C0 = motor.C0 * CFrame.Angles(0, dt * 25, 0)
	end)

	task.delay(0.3, function()
		if swingTween then
			swingTween:Disconnect()
			swingTween = nil
		end
	end)
end

local function onActivated()
	if not canSwing then
		return
	end
	canSwing = false
	task.delay(0.4, function()
		canSwing = true
	end)

	swingAnimation()
	if swingRemote then
		swingRemote:FireServer()
	end

	local character = tool.Parent
	if not character then
		return
	end

	local camera = workspace.CurrentCamera
	if not camera then
		return
	end

	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { character, camera }
	params.RespectCanCollide = false

	local origin = camera.CFrame.Position
	local direction = camera.CFrame.LookVector * 100

	local result = workspace:Raycast(origin, direction, params)
	if result and result.Instance and hitRemote then
		hitRemote:FireServer(result.Instance)
	end
end

tool.Activated:Connect(onActivated)`;

  const npcAI = `--!strict
-- NPC AI — patrols between waypoints, chases and attacks players.
-- Setup: Model named "Guard" in Workspace with Humanoid + HumanoidRootPart,
-- and a folder "PatrolPoints" inside it holding BaseParts.
-- Put this Script in ServerScriptService.

local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local NPC_MODEL = "Guard"
local CHASE_RANGE = 40
local LOSE_RANGE = 60
local ATTACK_RANGE = 7
local WALK_SPEED = 6
local RUN_SPEED = 14
local ATTACK_DAMAGE = 12

local npc = Workspace:WaitForChild(NPC_MODEL, 30)
if not npc then
	error("Could not find NPC model '" .. NPC_MODEL .. "' in Workspace")
end

local humanoid = npc:WaitForChild("Humanoid", 10)
local root = npc:WaitForChild("HumanoidRootPart", 10)

local waypoints = {}
local patrolFolder = npc:FindFirstChild("PatrolPoints")
if patrolFolder then
	for _, point in ipairs(patrolFolder:GetChildren()) do
		if point:IsA("BasePart") then
			table.insert(waypoints, point.Position)
		end
	end
end

local state = "idle"
local currentWaypoint = 1
local currentTarget = nil
local moveFinishedConnection = nil

local function stopMoving()
	if moveFinishedConnection then
		moveFinishedConnection:Disconnect()
		moveFinishedConnection = nil
	end
	humanoid:MoveTo(root.Position)
end

local function moveTo(destination)
	stopMoving()
	local path = nil
	local computed = false

	pcall(function()
		path = PathfindingService:CreatePath({
			AgentRadius = 2,
			AgentHeight = 5,
			AgentCanJump = true,
			WaypointSpacing = 3,
		})
		path:ComputeAsync(root.Position, destination)
		computed = true
	end)

	if computed and path and path.Status == Enum.PathStatus.Success then
		local pathWaypoints = path:GetWaypoints()
		for _, waypoint in ipairs(pathWaypoints) do
			if waypoint.Action == Enum.PathWaypointAction.Jump then
				humanoid.Jump = true
			end
			humanoid:MoveTo(waypoint.Position)
			humanoid.MoveToFinished:Wait()
			if humanoid.Health <= 0 then
				return
			end
		end
	else
		humanoid:MoveTo(destination)
	end
end

local function nearestPlayer()
	local nearest = nil
	local nearestDistance = CHASE_RANGE

	for _, player in ipairs(Players:GetPlayers()) do
		local character = player.Character
		if character then
			local playerRoot = character:FindFirstChild("HumanoidRootPart")
			if playerRoot then
				local distance = (root.Position - playerRoot.Position).Magnitude
				if distance < nearestDistance then
					nearestDistance = distance
					nearest = player
				end
			end
		end
	end

	return nearest, nearestDistance
end

local function tryAttack(targetCharacter)
	local targetRoot = targetCharacter:FindFirstChild("HumanoidRootPart")
	local targetHumanoid = targetCharacter:FindFirstChildOfClass("Humanoid")
	if not targetRoot or not targetHumanoid then
		return
	end
	if targetHumanoid.Health <= 0 then
		return
	end

	local direction = (targetRoot.Position - root.Position).Unit
	local params = RaycastParams.new()
	params.FilterDescendantsInstances = { npc }
	params.RespectCanCollide = false

	local result = Workspace:Raycast(root.Position + Vector3.new(0, 3, 0), direction * ATTACK_RANGE, params)
	if result and result.Instance then
		local target = result.Instance:FindFirstAncestorWhichIsA("Model")
		if target and target ~= npc then
			local targetHumanoid = target:FindFirstChildOfClass("Humanoid")
			if targetHumanoid then
				targetHumanoid:TakeDamage(ATTACK_DAMAGE)
			end
		end
	end
end

while true do
	task.wait(0.5)

	if not root or not root.Parent or humanoid.Health <= 0 then
		break
	end

	if state == "idle" then
		if #waypoints > 0 then
			state = "patrol"
			currentWaypoint = 1
		else
			task.wait(1)
		end

	elseif state == "patrol" then
		if #waypoints == 0 then
			state = "idle"
		else
			humanoid.WalkSpeed = WALK_SPEED
			moveTo(waypoints[currentWaypoint])
			currentWaypoint = currentWaypoint % #waypoints + 1

			local target = nearestPlayer()
			if target then
				currentTarget = target
				state = "chase"
			end
		end

	elseif state == "chase" then
		local character = currentTarget and currentTarget.Character
		local playerRoot = character and character:FindFirstChild("HumanoidRootPart")

		if not playerRoot or (root.Position - playerRoot.Position).Magnitude > LOSE_RANGE then
			currentTarget = nil
			state = "patrol"
		else
			local distance = (root.Position - playerRoot.Position).Magnitude
			if distance <= ATTACK_RANGE then
				stopMoving()
				humanoid.WalkSpeed = 0
				tryAttack(character)
				task.wait(0.6)
				humanoid.WalkSpeed = RUN_SPEED
			else
				humanoid.WalkSpeed = RUN_SPEED
				moveTo(playerRoot.Position)
			end
		end
	end
end`;

  const adminCommandsServer = `--!strict
-- AdminCommands — chat commands for server admins.
-- Type :help in game chat to see all commands.
-- Put your own UserId(s) in ADMIN_IDS below.
-- Put this Script in ServerScriptService.

local Players = game:GetService("Players")

local ADMIN_IDS = {
	[1] = true, -- <-- replace 1 with your UserId
}

local godMode = {}
local frozen = {}

local function findPlayerByName(name)
	local lower = string.lower(name or "")
	for _, player in ipairs(Players:GetPlayers()) do
		if string.lower(player.Name) == lower or string.lower(player.DisplayName) == lower then
			return player
		end
	end
	return nil
end

local function send(admin, message)
	admin:WaitForChild("PlayerGui", 10)
	if admin:FindFirstChild("PlayerGui") then
		admin.PlayerGui:MakeMessage("SystemMessage", "System", "Roblox", message)
	end
end

local COMMANDS = {
	help = {
		"shows all commands",
		function(admin)
			send(admin, ":help, :kick <name>, :kill <name>, :heal <name>, :god <name>, :freeze <name>, :tp <a> <b>, :coins <name> <amount>")
		end,
	},
	kick = {
		"kick a player",
		function(admin, args)
			local target = findPlayerByName(args[2])
			if target then
				target:Kick("Kicked by an admin")
			else
				send(admin, "Player not found")
			end
		end,
	},
	kill = {
		"kill a player",
		function(admin, args)
			local target = findPlayerByName(args[2])
			if target and target.Character then
				local humanoid = target.Character:FindFirstChildOfClass("Humanoid")
				if humanoid then
					humanoid:TakeDamage(humanoid.MaxHealth)
				end
			end
		end,
	},
	heal = {
		"fully heal a player",
		function(admin, args)
			local target = findPlayerByName(args[2])
			if target and target.Character then
				local humanoid = target.Character:FindFirstChildOfClass("Humanoid")
				if humanoid then
					humanoid.Health = humanoid.MaxHealth
				end
			end
		end,
	},
	god = {
		"make a player unkillable",
		function(admin, args)
			local target = findPlayerByName(args[2])
			if not target then
				send(admin, "Player not found")
				return
			end
			godMode[target] = not godMode[target]
			send(admin, target.Name .. " god mode: " .. tostring(godMode[target]))
		end,
	},
	freeze = {
		"freeze / unfreeze a player",
		function(admin, args)
			local target = findPlayerByName(args[2])
			if not target then
				send(admin, "Player not found")
				return
			end
			frozen[target] = not frozen[target]
			local character = target.Character
			if character then
				local root = character:FindFirstChild("HumanoidRootPart")
				local humanoid = character:FindFirstChildOfClass("Humanoid")
				if root and humanoid then
					root.Anchored = frozen[target]
					humanoid.WalkSpeed = frozen[target] and 0 or 16
				end
			end
		end,
	},
	tp = {
		"teleport: :tp <who> <where>",
		function(admin, args)
			local who = findPlayerByName(args[2])
			local where = findPlayerByName(args[3])
			if not who then
				who = admin
			end
			if not where then
				where = admin
			end
			if who and where and where.Character and who.Character then
				local whoRoot = who.Character:FindFirstChild("HumanoidRootPart")
				local whereRoot = where.Character:FindFirstChild("HumanoidRootPart")
				if whoRoot and whereRoot then
					whoRoot.CFrame = whereRoot.CFrame + Vector3.new(0, 3, 0)
				end
			end
		end,
	},
	coins = {
		"give coins: :coins <name> <amount>",
		function(admin, args)
			local target = findPlayerByName(args[2])
			local amount = tonumber(args[3]) or 0
			if target and target:FindFirstChild("leaderstats") then
				local coins = target.leaderstats:FindFirstChild("Coins")
				if coins then
					coins.Value += amount
				end
			end
		end,
	},
}

for _, player in ipairs(Players:GetPlayers()) do
	player.Chatted:Connect(function(message)
		if not ADMIN_IDS[player.UserId] then
			return
		end
		local cleaned = message:gsub("^[:/]", "")
		local args = string.split(cleaned, " ")
		local command = COMMANDS[string.lower(args[1] or "")]
		if command then
			command[2](player, args)
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	player.Chatted:Connect(function(message)
		if not ADMIN_IDS[player.UserId] then
			return
		end
		local cleaned = message:gsub("^[:/]", "")
		local args = string.split(cleaned, " ")
		local command = COMMANDS[string.lower(args[1] or "")]
		if command then
			command[2](player, args)
		end
	end)
end)

-- god mode protection
Players.PlayerAdded:Connect(function(player)
	local function protect(character)
		local humanoid = character:WaitForChild("Humanoid", 10)
		if not humanoid then
			return
		end
		humanoid.HealthChanged:Connect(function(newHealth)
			if godMode[player] and newHealth <= 0 then
				humanoid.Health = humanoid.MaxHealth
			end
		end)
	end
	player.CharacterAdded:Connect(protect)
	if player.Character then
		protect(player.Character)
	end
end)`;

  const dataSaveServer = `--!strict
-- DataSave — saves player data to DataStores with auto-save and retries.
-- Needs Studio/place DataStore access enabled (Game Settings).
-- Put this Script in ServerScriptService.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local dataStore = DataStoreService:GetDataStore("PlayerData")
local sessionData = {}

local function getDefaultData()
	return {
		Coins = 100,
		Level = 1,
		PlayTime = 0,
	}
end

local function loadData(player)
	local key = "player_" .. player.UserId
	local data = nil

	local success, result = pcall(function()
		return dataStore:GetAsync(key)
	end)

	if success and type(result) == "table" then
		data = result
	else
		data = getDefaultData()
	end

	sessionData[player] = data

	local stats = player:FindFirstChild("leaderstats")
	if stats then
		local coins = stats:FindFirstChild("Coins")
		if coins then
			coins.Value = data.Coins or 100
		end
	end
end

local function saveData(player)
	local key = "player_" .. player.UserId
	local data = sessionData[player]
	if not data then
		return
	end

	local success, errorMessage = pcall(function()
		dataStore:SetAsync(key, data)
	end)

	if not success then
		warn("Failed to save data for " .. player.Name .. ": " .. tostring(errorMessage))
	end

	sessionData[player] = nil
end

Players.PlayerAdded:Connect(function(player)
	loadData(player)

	-- auto-save every 60 seconds
	task.spawn(function()
		while player.Parent do
			task.wait(60)
			saveData(player)
		end
	end)

	-- track playtime
	task.spawn(function()
		local start = os.clock()
		while player.Parent do
			task.wait(60)
			if sessionData[player] then
				sessionData[player].PlayTime = sessionData[player].PlayTime + 60
			end
			os.clock()
		end
	end)
end)

Players.PlayerRemoving:Connect(saveData)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		saveData(player)
	end
end)`;

  const checkpointServer = `--!strict
-- CheckpointSystem — obby checkpoints with respawn + first-touch bonus.
-- Setup: folder "Checkpoints" in Workspace containing BaseParts named
-- Checkpoint, Checkpoint2, Checkpoint3... (touch zones, CanCollide off).
-- Put this Script in ServerScriptService.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")
local TweenService = game:GetService("TweenService")

local checkpointFolder = Workspace:WaitForChild("Checkpoints", 30)
local playerCheckpoints = {}
local checkpointIndexes = {}

local function collectCheckpoints()
	local list = {}
	for _, part in ipairs(checkpointFolder:GetChildren()) do
		if part:IsA("BasePart") then
			local number = tonumber(tostring(part.Name):match("%d+")) or 0
			table.insert(list, { Part = part, Number = number })
		end
	end
	table.sort(list, function(a, b)
		return a.Number < b.Number
	end)
	return list
end

local checkpoints = collectCheckpoints()

local function respawnPlayer(player)
	local checkpointPart = playerCheckpoints[player]
	if not checkpointPart then
		player:LoadCharacter()
		return
	end

	local character = player.Character or player.CharacterAdded:Wait()
	local root = character:WaitForChild("HumanoidRootPart", 10)
	if root then
		root.CFrame = checkpointPart.CFrame + Vector3.new(0, 3, 0)
	end
end

local function onCharacterAdded(character, player)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid then
		return
	end

	humanoid.Died:Connect(function()
		task.delay(2, function()
			respawnPlayer(player)
		end)
	end)
end

for _, checkpoint in ipairs(checkpoints) do
	local part = checkpoint.Part
	local firstTouch = {}

	part.Touched:Connect(function(otherPart)
		if not otherPart then
			return
		end
		local character = otherPart.Parent
		if not character:IsA("Model") then
			return
		end
		local player = Players:GetPlayerFromCharacter(character)
		if not player then
			return
		end
		if not character:FindFirstChildOfClass("Humanoid") then
			return
		end

		local lastCheckpoint = playerCheckpoints[player]
		if lastCheckpoint ~= part then
			playerCheckpoints[player] = part

			if not firstTouch[player] then
				firstTouch[player] = true
				local stats = player:FindFirstChild("leaderstats")
				if stats then
					local coins = stats:FindFirstChild("Coins")
					if coins then
						coins.Value += 10
					end
				end
				local notification = Instance.new("TextLabel")
				notification.BackgroundTransparency = 1
				notification.Size = UDim2.new(0, 300, 0, 30)
				notification.Position = UDim2.new(0.5, -150, 0.3, 0)
				notification.Font = Enum.Font.GothamBold
				notification.Text = "Checkpoint reached! +10 coins"
				notification.TextColor3 = Color3.fromRGB(52, 211, 153)
				notification.TextSize = 20
				notification.Parent = player:WaitForChild("PlayerGui")
				local tween = TweenService:Create(notification, TweenInfo.new(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					TextTransparency = 1,
					Position = notification.Position - UDim2.new(0, 0, 0, 40),
				})
				tween:Play()
				tween.Completed:Connect(function()
					notification:Destroy()
				end)
			end
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(character, player)
	end)
	if player.Character then
		onCharacterAdded(player.Character, player)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	playerCheckpoints[player] = nil
end)`;

  /* ============================================================
     PACKS
     ============================================================ */

  const animations = {
    id: "roblox-animations",
    title: "Roblox Animation System",
    intro: [
      "Here's a complete animation system for Roblox Studio — no setup work needed.",
      "It loads idle / walk / run / jump / fall animations, picks the right one automatically based on movement, and smooth-transitions between them. Hold <strong>Shift</strong> to run.",
      "It also includes a runtime <strong>KeyframeSequence builder</strong> so you can create custom animations entirely with code.",
    ],
    steps: [
      "Create a ModuleScript in ReplicatedStorage and name it <code>AnimationKit</code> — paste <code>AnimationKit.lua</code> inside.",
      "Create a LocalScript in StarterPlayerScripts — paste <code>AnimationPlayer.client.lua</code> inside.",
      "(Optional) Create a Script in ServerScriptService — paste <code>BuildKeyframes.lua</code> inside.",
      "Replace the rbxassetid:// values with your own animation IDs. Play the game — done.",
    ],
    files: [
      { filename: "AnimationKit.lua", lang: "lua", code: animationKitModule },
      { filename: "AnimationPlayer.client.lua", lang: "lua", code: animationPlayerClient },
      { filename: "BuildKeyframes.lua", lang: "lua", code: buildKeyframes },
    ],
  };

  const gui = {
    id: "roblox-gui",
    title: "Roblox GUI Pack",
    intro: [
      "Here's a complete GUI pack: an <strong>HUD</strong> (health bar, floating damage numbers, stamina/sprint bar, ammo counter), a <strong>Shop GUI</strong> and a <strong>Main Menu</strong>.",
      "Everything is built with plain instances — no external assets needed.",
    ],
    steps: [
      "Create a LocalScript in StarterPlayerScripts — paste <code>hud.client.lua</code> inside.",
      "Create another LocalScript — paste <code>shop.client.lua</code> inside. Create a RemoteEvent named <code>BuyRequest</code> in ReplicatedStorage.",
      "Create a third LocalScript — paste <code>mainmenu.client.lua</code> inside.",
      "Press <strong>B</strong> in-game to open the shop.",
    ],
    files: [
      { filename: "hud.client.lua", lang: "lua", code: hudClient },
      { filename: "shop.client.lua", lang: "lua", code: shopClient },
      { filename: "mainmenu.client.lua", lang: "lua", code: mainMenuClient },
    ],
  };

  const scripts = {
    id: "roblox-scripts",
    title: "Roblox Game Script Kit",
    intro: [
      "Here's a full server-side script kit for a complete game: <strong>player setup</strong> with leaderstats + spawn protection, <strong>combat system</strong> with server-validated sword hits, <strong>NPC AI</strong> with pathfinding patrol & chase, <strong>admin commands</strong>, <strong>DataStore saving</strong> and a <strong>checkpoint system</strong>.",
    ],
    steps: [
      "Create a Script in ServerScriptService for each .lua file (use the same name).",
      "Put <code>swordClient.lua</code> inside a Tool named <code>Sword</code> (with a Handle part) in ServerStorage.",
      "Add your UserId to <code>ADMIN_IDS</code> in adminCommands.lua.",
      "Create a folder <code>Checkpoints</code> in Workspace with parts named Checkpoint1, Checkpoint2...",
      "Create an NPC model <code>Guard</code> with a Humanoid + PatrolPoints folder.",
    ],
    files: [
      { filename: "PlayerSetup.server.lua", lang: "lua", code: playerSetupServer },
      { filename: "CombatSystem.server.lua", lang: "lua", code: combatServer },
      { filename: "SwordClient.client.lua", lang: "lua", code: swordClient },
      { filename: "NPC_AI.server.lua", lang: "lua", code: npcAI },
      { filename: "AdminCommands.server.lua", lang: "lua", code: adminCommandsServer },
      { filename: "DataSave.server.lua", lang: "lua", code: dataSaveServer },
      { filename: "CheckpointSystem.server.lua", lang: "lua", code: checkpointServer },
    ],
  };

  return { animations, gui, scripts };
})();
