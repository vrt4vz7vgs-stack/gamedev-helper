/* ============================================================
   ForgeAI — Unreal Engine 5 generator library
   Procedural map generation: runtime terrain mesh (C++),
   foliage spawner, and full setup guides.
   The map builder is project-aware: pair it to a .uproject and
   the generated code targets that project's module names.
   ============================================================ */

"use strict";

const UE5Lib = (function () {

  /* ---------------- shared helpers ---------------- */

  function sanitizeModuleName(s) {
    let n = String(s || "").replace(/[^A-Za-z0-9_]/g, "");
    if (!n) n = "MapGen";
    if (/^[0-9]/.test(n)) n = "M_" + n;
    return n;
  }

  /* ---------------- map description parser ---------------- */

  function parseMapDescription(text) {
    const t = " " + String(text || "").toLowerCase() + " ";
    const has = (re) => re.test(t);

    const s = {
      grid: 192,
      cell: 150,
      height: 1500,
      noise: 0.004,
      island: false,
      radius: 9000,
      density: 0.35,
      spacing: 500,
      region: 20000,
      seed: Math.floor(Math.random() * 90000) + 1000,
      notes: [],
    };

    if (has(/island|beach|coast|ocean|sea|lagoon|lake|water|surrounded|atoll/)) {
      s.island = true;
      s.notes.push("island mode");
    }
    if (has(/big|large|huge|enormous|giant|massive|vast|open world/)) {
      s.grid = 256; s.cell = 200;
      s.notes.push("large map");
    } else if (has(/small|tiny|compact|arena|mini/)) {
      s.grid = 128; s.cell = 100;
      s.notes.push("small map");
    }
    if (has(/mountain|cliff|peak|snow|alpine|rocky|hill/)) {
      s.height = 2600; s.noise = 0.0035;
      s.notes.push("mountains");
    }
    if (has(/flat|plains|desert|smooth|gentle|low/)) {
      s.height = 700;
      s.notes.push("gentle terrain");
    }
    if (has(/forest|jungle|wood|tree|vegetation|greenery|foliage/)) {
      s.density = 0.5; s.spacing = 350;
      s.notes.push("dense forest");
    }
    if (has(/desert|barren|rock|sparse|arid/)) {
      s.density = 0.12; s.spacing = 700;
      s.notes.push("sparse foliage");
    }
    if (s.island) {
      s.radius = s.grid >= 256 ? 14000 : (s.grid <= 128 ? 5000 : 9000);
    }
    const seedMatch = String(text).match(/seed\s*[:=]?\s*(\d{2,})/i);
    if (seedMatch) {
      s.seed = parseInt(seedMatch[1], 10);
      s.notes.push("seed " + s.seed);
    }
    return s;
  }

  /* ---------------- parameterized C++ templates ---------------- */

  const terrainHeader = (p) => `// ProceduralTerrain.h — runtime-generated terrain using Perlin noise.
// 1) Add "ProceduralMeshComponent" to your project's Build.cs PublicDependencyModuleNames.
// 2) Place this Actor in your level. The terrain builds itself on BeginPlay.
// 3) For an island map, tick bIslandMode and tweak IslandRadius.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ProceduralTerrain.generated.h"

class UProceduralMeshComponent;
class UMaterialInterface;
struct FProcMeshTangent;

UCLASS()
class ${p.api}_API AProceduralTerrain : public AActor
{
	GENERATED_BODY()

public:
	AProceduralTerrain();

	/** How many vertices per side (grid resolution). 128 = 16k vertices. */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = "8", ClampMax = "512"))
	int32 GridSize = ${p.grid};

	/** Distance between vertices in world units. */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = "10"))
	float CellSize = ${p.cell}.0f;

	/** How tall mountains can get. */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = "1"))
	float HeightScale = ${p.height}.0f;

	/** Noise frequency. Smaller = smoother hills. */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = "0.0001"))
	float NoiseScale = ${p.noise}f;

	/** Random seed so every map is different. */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	int32 Seed = ${p.seed};

	/** Flattens the edges into water (island mode). */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	bool bIslandMode = ${p.island ? "true" : "false"};

	/** How far from center the island drops to sea level. */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (EditCondition = "bIslandMode", ClampMin = "100"))
	float IslandRadius = ${p.radius}.0f;

	/** Material to apply over the generated mesh. */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	UMaterialInterface* TerrainMaterial;

	/** The generated mesh. */
	UPROPERTY(VisibleAnywhere, Category = "Terrain")
	TObjectPtr<UProceduralMeshComponent> MeshComponent;

	/** Builds the mesh. Call this again to regenerate the map. */
	UFUNCTION(BlueprintCallable, Category = "Terrain")
	void GenerateTerrain();

protected:
	virtual void BeginPlay() override;

private:
	float GetHeight(float WorldX, float WorldY) const;
	void ComputeNormals(int32 Size);

	TArray<FVector> Vertices;
	TArray<int32> Triangles;
	TArray<FVector> Normals;
	TArray<FVector2D> UV0;
	TArray<FProcMeshTangent> Tangents;
};`;

  const terrainCpp = `// ProceduralTerrain.cpp
#include "ProceduralTerrain.h"
#include "ProceduralMeshComponent.h"

AProceduralTerrain::AProceduralTerrain()
{
	PrimaryActorTick.bCanEverTick = false;

	MeshComponent = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("TerrainMesh"));
	RootComponent = MeshComponent;
	MeshComponent->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	MeshComponent->SetCollisionResponseToAllChannels(ECR_Block);
	MeshComponent->bUseAsyncCooking = true;
}

void AProceduralTerrain::BeginPlay()
{
	Super::BeginPlay();
	GenerateTerrain();
}

void AProceduralTerrain::GenerateTerrain()
{
	Vertices.Empty();
	Triangles.Empty();
	Normals.Empty();
	UV0.Empty();
	Tangents.Empty();

	const int32 Size = GridSize;
	const int32 VertexCount = Size * Size;
	const float HalfSize = (Size - 1) * CellSize * 0.5f;

	TArray<float> HeightMap;
	HeightMap.Reserve(VertexCount);

	Vertices.Reserve(VertexCount);
	UV0.Reserve(VertexCount);

	// 1) Build the heightmap and vertex grid
	for (int32 Y = 0; Y < Size; ++Y)
	{
		for (int32 X = 0; X < Size; ++X)
		{
			const float WorldX = X * CellSize - HalfSize;
			const float WorldY = Y * CellSize - HalfSize;
			const float Height = GetHeight(WorldX, WorldY);

			HeightMap.Add(Height);
			Vertices.Add(FVector(WorldX, WorldY, Height));
			UV0.Add(FVector2D(
				static_cast<float>(X) / static_cast<float>(Size - 1),
				static_cast<float>(Y) / static_cast<float>(Size - 1)));
		}
	}

	// 2) Build triangles (two per grid cell)
	for (int32 Y = 0; Y < Size - 1; ++Y)
	{
		for (int32 X = 0; X < Size - 1; ++X)
		{
			const int32 A = Y * Size + X;
			const int32 B = A + 1;
			const int32 C = A + Size;
			const int32 D = C + 1;

			Triangles.Add(A);
			Triangles.Add(C);
			Triangles.Add(B);

			Triangles.Add(B);
			Triangles.Add(C);
			Triangles.Add(D);
		}
	}

	// 3) Per-vertex smooth normals
	ComputeNormals(Size);

	// 4) Flat tangents (fine for a terrain with a triplanar material)
	Tangents.SetNum(VertexCount);
	for (int32 Index = 0; Index < VertexCount; ++Index)
	{
		Tangents[Index] = FProcMeshTangent(FVector(1.0f, 0.0f, 0.0f), false);
	}

	MeshComponent->CreateMeshSection(0, Vertices, Triangles, Normals, UV0, TArray<FColor>(), Tangents, true);
	MeshComponent->SetMaterial(0, TerrainMaterial);
}

void AProceduralTerrain::ComputeNormals(int32 Size)
{
	const int32 VertexCount = Size * Size;
	Normals.SetNum(VertexCount);

	// zero the normals first
	for (int32 Index = 0; Index < VertexCount; ++Index)
	{
		Normals[Index] = FVector::ZeroVector;
	}

	// accumulate face normals
	for (int32 Y = 0; Y < Size - 1; ++Y)
	{
		for (int32 X = 0; X < Size - 1; ++X)
		{
			const int32 A = Y * Size + X;
			const int32 B = A + 1;
			const int32 C = A + Size;
			const int32 D = C + 1;

			const FVector& VA = Vertices[A];
			const FVector& VB = Vertices[B];
			const FVector& VC = Vertices[C];
			const FVector& VD = Vertices[D];

			const FVector FaceNormal1 = FVector::CrossProduct(VC - VA, VB - VA).GetSafeNormal();
			const FVector FaceNormal2 = FVector::CrossProduct(VB - VC, VD - VC).GetSafeNormal();

			Normals[A] += FaceNormal1;
			Normals[B] += FaceNormal1 + FaceNormal2;
			Normals[C] += FaceNormal1 + FaceNormal2;
			Normals[D] += FaceNormal2;
		}
	}

	for (int32 Index = 0; Index < VertexCount; ++Index)
	{
		Normals[Index] = Normals[Index].GetSafeNormal();
	}
}

float AProceduralTerrain::GetHeight(float WorldX, float WorldY) const
{
	// two octaves of Perlin noise = hills + detail
	const float Base = FMath::PerlinNoise2D(FVector2D(WorldX, WorldY) * NoiseScale + FVector2D(Seed * 7.31f, Seed * 13.17f));
	const float Detail = FMath::PerlinNoise2D(FVector2D(WorldX, WorldY) * NoiseScale * 3.0f + FVector2D(Seed * 31.7f, Seed * 17.9f)) * 0.3f;

	float Height = (Base + Detail) * HeightScale;

	if (bIslandMode)
	{
		// falloff toward the edge so the land sinks into the sea
		const float DistanceFromCenter = FVector2D(WorldX, WorldY).Size();
		const float Falloff = FMath::Clamp((IslandRadius - DistanceFromCenter) / (IslandRadius * 0.35f), 0.0f, 1.0f);
		Height *= Falloff * Falloff;

		// carve a small lagoon in the middle
		const float LagoonDist = FVector2D(WorldX, WorldY).Size();
		const float LagoonBlend = FMath::SmoothStep(600.0f, 1400.0f, LagoonDist);
		Height = FMath::Lerp(-200.0f, Height, LagoonBlend);
	}

	return Height;
}`;

  const foliageHeader = (p) => `// FoliageSpawner.h — scatters trees/rocks on the terrain using
// InstancedStaticMesh — hundreds of actors worth of detail at zero draw calls.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FoliageSpawner.generated.h"

class UInstancedStaticMeshComponent;
class UStaticMesh;

UCLASS()
class ${p.api}_API AFoliageSpawner : public AActor
{
	GENERATED_BODY()

public:
	AFoliageSpawner();

	/** Mesh to scatter (e.g. a low-poly tree). */
	UPROPERTY(EditAnywhere, Category = "Foliage")
	TObjectPtr<UStaticMesh> FoliageMesh;

	/** Region bounds in world units, centered on the actor. */
	UPROPERTY(EditAnywhere, Category = "Foliage", meta = (ClampMin = "100"))
	float RegionSize = ${p.region}.0f;

	/** Distance between scatter grid points. */
	UPROPERTY(EditAnywhere, Category = "Foliage", meta = (ClampMin = "50"))
	float Spacing = ${p.spacing}.0f;

	/** Chance (0..1) an instance spawns at each grid point. */
	UPROPERTY(EditAnywhere, Category = "Foliage", meta = (ClampMin = "0", ClampMax = "1"))
	float Density = ${p.density}f;

	/** Minimum noise value for a spawn spot (keeps trees off the water). */
	UPROPERTY(EditAnywhere, Category = "Foliage", meta = (ClampMin = "-1", ClampMax = "1"))
	float HeightThreshold = 0.0f;

	UPROPERTY(EditAnywhere, Category = "Foliage")
	int32 Seed = ${p.foliageSeed};

	UPROPERTY(VisibleAnywhere, Category = "Foliage")
	TObjectPtr<UInstancedStaticMeshComponent> Instances;

	UFUNCTION(BlueprintCallable, Category = "Foliage")
	void Scatter();

protected:
	virtual void BeginPlay() override;

private:
	float SampleTerrainHeight(const FVector& WorldLocation) const;
};`;

  const foliageCpp = (p) => `// FoliageSpawner.cpp
#include "FoliageSpawner.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"

AFoliageSpawner::AFoliageSpawner()
{
	PrimaryActorTick.bCanEverTick = false;

	Instances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("FoliageInstances"));
	RootComponent = Instances;
	Instances->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Instances->bCastShadow = true;
}

void AFoliageSpawner::BeginPlay()
{
	Super::BeginPlay();
	Scatter();
}

void AFoliageSpawner::Scatter()
{
	if (!FoliageMesh)
	{
		UE_LOG(LogTemp, Warning, TEXT("FoliageSpawner: assign FoliageMesh!"));
		return;
	}

	Instances->ClearInstances();
	Instances->SetStaticMesh(FoliageMesh);

	FRandomStream Stream(Seed);
	const float Half = RegionSize * 0.5f;

	// find every terrain actor in the level for height sampling
	TArray<AActor*> TerrainActors;
	UGameplayStatics::GetAllActorsOfClass(GetWorld(), AActor::StaticClass(), TerrainActors);

	FVector Origin = GetActorLocation();

	for (float X = -Half; X <= Half; X += Spacing)
	{
		for (float Y = -Half; Y <= Half; Y += Spacing)
		{
			const FVector WorldLocation(Origin.X + X, Origin.Y + Y, 0.0f);

			// noise drives placement — mirrors the terrain generator's noise
			const float Noise = FMath::PerlinNoise2D(FVector2D(WorldLocation.X, WorldLocation.Y) * ${p.noise}f + FVector2D(${p.seed}.0f * 7.31f, ${p.seed}.0f * 13.17f));
			if (Noise < HeightThreshold)
			{
				continue;
			}

			if (Stream.FRand() > Density)
			{
				continue;
			}

			const float TerrainHeight = SampleTerrainHeight(WorldLocation);
			if (TerrainHeight <= -50.0f)
			{
				continue; // underwater — skip
			}

			const FVector SpawnLocation(WorldLocation.X, WorldLocation.Y, TerrainHeight);
			const FRotator SpawnRotation(0.0f, Stream.FRandRange(0.0f, 360.0f), 0.0f);
			const float Scale = Stream.FRandRange(0.8f, 1.5f);
			const FVector SpawnScale(Scale, Scale, Scale);

			Instances->AddInstance(FTransform(SpawnRotation, SpawnLocation, SpawnScale));
		}
	}

	UE_LOG(LogTemp, Log, TEXT("FoliageSpawner: placed %d instances"), Instances->GetInstanceCount());
}

float AFoliageSpawner::SampleTerrainHeight(const FVector& WorldLocation) const
{
	// simple line trace straight down to find the ground
	FCollisionQueryParams Params;
	Params.bTraceComplex = true;

	FHitResult Hit;
	const FVector Start(WorldLocation.X, WorldLocation.Y, 20000.0f);
	const FVector End(WorldLocation.X, WorldLocation.Y, -20000.0f);

	if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_WorldStatic, Params))
	{
		return Hit.ImpactPoint.Z;
	}

	return 0.0f;
}`;

  const buildCsTemplate = (module) => `// ${module}.Build.cs — generated by ForgeAI for the procedural map system.
// Contains the ProceduralMeshComponent dependency the terrain needs.
using UnrealBuildTool;

public class ${module} : ModuleRules
{
	public ${module}(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] {
			"Core", "CoreUObject", "Engine", "InputCore",
			"ProceduralMeshComponent"
		});
	}
}`;

  const mapReport = (p, module, pairName) => `# Map Report — ${module} (built by ForgeAI)

Project: ${pairName || "Unpaired"}
Target module: ${module}

## Generated settings
| Setting | Value |
|---|---|
| Grid size | ${p.grid} x ${p.grid} vertices |
| Cell size | ${p.cell} uu |
| Height scale | ${p.height} uu |
| Noise scale | ${p.noise} |
| Seed | ${p.seed} |
| Island mode | ${p.island ? "ON (radius " + p.radius + " uu)" : "OFF (mainland)"} |
| Foliage density | ${p.density} |
| Foliage spacing | ${p.spacing} uu |
| Foliage region | ${p.region} uu |

${p.notes.length ? "## Map features\n- " + p.notes.join("\n- ") + "\n" : ""}## Steps
1. Add the 4 C++ files to Source/${module}/.
2. Make sure "ProceduralMeshComponent" is in your Build.cs
   (ForgeAI's Build.cs template already includes it).
3. Compile (Ctrl+Alt+F11). Wait for "Build succeeded".
4. Drag AProceduralTerrain into the level -> click Generate Terrain.
5. Add Water Body Ocean (Sea Level Z = 0) if island mode is on.
6. Drag AFoliageSpawner in, assign a tree mesh, click Scatter.
7. Add Directional Light + Sky Atmosphere + Exponential Height Fog.

Change the Seed in the Details panel for a brand-new map.`;

  /* ---------------- buildMap: project-aware map generation ---------------- */

  function buildMap(description, pair) {
    const p = parseMapDescription(description);
    const module = sanitizeModuleName(pair && pair.module);
    const api = module.toUpperCase();
    const pairName = (pair && pair.name) || null;

    const files = [
      { filename: "ProceduralTerrain.h", lang: "cpp", code: terrainHeader({ api: api, grid: p.grid, cell: p.cell, height: p.height, noise: p.noise, seed: p.seed, island: p.island, radius: p.radius }) },
      { filename: "ProceduralTerrain.cpp", lang: "cpp", code: terrainCpp },
      { filename: "FoliageSpawner.h", lang: "cpp", code: foliageHeader({ api: api, region: p.region, spacing: p.spacing, density: p.density, foliageSeed: p.seed }) },
      { filename: "FoliageSpawner.cpp", lang: "cpp", code: foliageCpp({ noise: p.noise, seed: p.seed }) },
      { filename: module + ".Build.cs", lang: "cs", code: buildCsTemplate(module) },
      { filename: "MapReport.md", lang: "md", code: mapReport(p, module, pairName) },
    ];

    return {
      id: "ue5-map",
      title: "UE5 Map — " + module,
      intro: [
        (pairName
          ? "Built for <strong>" + pairName + "</strong> (module <code>" + module + "</code>) — every file matches your project's module name and the <code>ProceduralMeshComponent</code> dependency is handled."
          : "Here's a full <strong>procedural map generation system</strong> for Unreal Engine 5 in C++ — match your project by pairing it above (or use the <code>MapGen</code> module name and rename after).") +
          " The map matches your description: " + (p.notes.length ? p.notes.join(", ") : "default terrain") + ".",
      ],
      steps: [
        "Add the C++ files to <code>Source/" + module + "/</code>.",
        "Ensure <code>ProceduralMeshComponent</code> is in your Build.cs (the generated Build.cs template already includes it).",
        "Compile, drag AProceduralTerrain + AFoliageSpawner into your level.",
        "Follow MapReport.md for water, lighting and the player spawn.",
      ],
      settings: [
        p.grid + "x" + p.grid + " grid",
        "cell " + p.cell + " uu",
        "height " + p.height + " uu",
        "seed " + p.seed,
        p.island ? "island (r " + p.radius + ")" : "mainland",
        "foliage " + p.density,
      ],
      module: module,
      files: files,
    };
  }

  /* ---------------- static packs (Downloads tab + chat intents) ---------------- */

  const DEFAULT_TERRAIN = {
    api: "TERRAINGEN",
    grid: 128,
    cell: 100,
    height: 1500,
    noise: 0.004,
    seed: 1337,
    island: false,
    radius: 8000,
  };
  const DEFAULT_FOLIAGE_H = {
    api: "TERRAINGEN",
    region: 16000,
    spacing: 500,
    density: 0.35,
    foliageSeed: 2024,
  };
  const DEFAULT_FOLIAGE_CPP = { noise: 0.004, seed: 1337 };

  const islandGuide = `# UE5 Island Map — Full Setup Guide (ForgeAI)

Follow these steps in order. Everything is free and built into Unreal Engine 5.

## 1. Create the project
1. Unreal Engine 5.x -> New Project -> Game -> Blank
2. Name it "IslandMap", check **C++** -> Create
3. Enable plugins: **Procedural Mesh Component** (Edit > Plugins, search "Procedural Mesh")

## 2. Add the C++ classes
1. Place \`ProceduralTerrain.h/.cpp\` in \`Source/IslandMap/\`
2. Place \`FoliageSpawner.h/.cpp\` in \`Source/IslandMap/\`
3. Open \`IslandMap.Build.cs\` and add to \`PublicDependencyModuleNames\`:
   \`\`\`cs
   "Core", "CoreUObject", "Engine", "InputCore",
   "ProceduralMeshComponent", "UMG", "SlateCore"
   \`\`\`
4. Compile (Ctrl+Alt+F11). Wait for "Build succeeded".

## 3. Spawn the terrain
1. Add \`AProceduralTerrain\` to your level (Content Browser -> C++ Classes -> drag in)
2. Select it. Details panel:
   - **GridSize** = 256
   - **CellSize** = 100
   - **HeightScale** = 1200
   - **bIslandMode** = ON
   - **IslandRadius** = 10000
3. Click **Generate Terrain** (or just press Play)

## 4. Water
1. Place the built-in **Water Body Ocean** (Place Actors -> search "Water")
2. Set **Sea Level Z** to 0. The island falloff drops the land below it.

## 5. Foliage
1. Import a tree mesh (Quixel Bridge / free pack / simple cone)
2. Place \`AFoliageSpawner\`, assign the tree to **FoliageMesh**
3. RegionSize 16000, Density 0.3, HeightThreshold 0.05 -> Click **Scatter**

## 6. Player spawn
1. Place a **PlayerStart** anywhere on the island
2. Add **Third Person** character controller (Edit > Project Settings > Maps & Modes)

## 7. Lighting & atmosphere
1. Place a **Directional Light** (Sun) + **Sky Atmosphere** + **Exponential Height Fog**
2. **Volumetric Clouds** for the sky -> press Play and walk around your island

> Tip: change the **Seed** in the Details panel for a brand-new island every time.`;

  const landscapeGuide = `# UE5 Landscape Material — Island Terrain (ForgeAI)

Build a professional-looking terrain material in the Blueprint Material Editor.
No textures required — everything is procedural noise.

## Create the material
1. Right-click Content Browser -> **Material** -> name it \`M_Terrain\`
2. Open it. Material domain = **Surface**, Blend = **Opaque**

## Node graph (bottom-up)
1. **LandscapeLayerCoords** (Texture Coordinates group)
   - Scale = 64 (tiling)
2. **PerlinNoise01** x2 (Material Expressions > Noise)
   - One large-scale (Detail Scale 1.0) -> smooth hills color blend
   - One small-scale (Detail Scale 8.0) -> pebble detail
3. **ColorRamp / LinearInterpolate**:
   - Sand color (low) -> Grass (mid) -> Rock (high) using the noise as alpha
4. **LandscapeLayerBlend** for painting in the editor:
   - Layer "Grass" (weight 1), "Rock", "Sand", "Snow"
5. **FlattenNormal** + noise -> **Normal** pin for subtle relief
6. **ConstantBiasScale**: roughness = noise * 0.3 + 0.55
7. Connect: Base Color (A), Normal (B), Roughness (R), Metallic = 0

## Apply to the terrain
1. Select your Landscape actor
2. Materials section -> assign \`M_Terrain\`
3. Select the terrain -> Sculpt/Paint mode -> **Paint** tab
4. Paint Grass / Rock / Sand layers over the island by hand — or skip it,
   the procedural blend already looks great on its own

## Extra polish
- **RVT (Runtime Virtual Texture)** for huge maps:
  Create RVT asset, assign to Landscape, set material to use
  LandscapeLayerBlend with RVT → massive performance win
- **Decal** for footstep paths
- **Water Material**: built-in Water plugin ships ready-made

## Matching your C++ terrain
The C++ generator's \`GetHeight\` uses two Perlin octaves.
In the material, stack **two PerlinNoise01 nodes** (scale 1 and scale 3)
and lerp them the same way to make color match elevation exactly.`;

  const ue5Terrain = {
    id: "ue5-terrain",
    title: "UE5 Procedural Map Generation",
    intro: [
      "Here's a full <strong>procedural map generation system</strong> for Unreal Engine 5 in C++: a Perlin-noise terrain mesh built at runtime with <strong>island mode</strong> built in, plus a <strong>foliage spawner</strong> that scatters trees using instanced meshes.",
      "Different seed = different map. Zero manual level building.",
    ],
    steps: [
      "Add the 4 files to <code>Source/YourProject/</code>.",
      "Add <code>ProceduralMeshComponent</code> to your Build.cs modules.",
      "Compile, drag AProceduralTerrain + AFoliageSpawner into your level.",
      "Follow the setup guide for water, lighting and the player spawn.",
    ],
    files: [
      { filename: "ProceduralTerrain.h", lang: "cpp", code: terrainHeader(DEFAULT_TERRAIN) },
      { filename: "ProceduralTerrain.cpp", lang: "cpp", code: terrainCpp },
      { filename: "FoliageSpawner.h", lang: "cpp", code: foliageHeader(DEFAULT_FOLIAGE_H) },
      { filename: "FoliageSpawner.cpp", lang: "cpp", code: foliageCpp(DEFAULT_FOLIAGE_CPP) },
    ],
  };

  const ue5IslandGuide = {
    id: "ue5-island",
    title: "UE5 Island Map Guide",
    intro: [
      "Here's a complete step-by-step <strong>UE5 island map</strong> guide — project setup, the C++ terrain from the map generator, water, foliage, player spawn and atmosphere. Follow it top to bottom and you'll have a full island world.",
    ],
    steps: [
      "Download the guide file and follow the numbered steps.",
      "Pair it with the Procedural Map Generation files above.",
    ],
    files: [
      { filename: "UE5_Island_Guide.md", lang: "md", code: islandGuide },
      { filename: "UE5_Landscape_Material_Guide.md", lang: "md", code: landscapeGuide },
    ],
  };

  return {
    ue5Terrain,
    ue5IslandGuide,
    buildMap,
    parseMapDescription,
    sanitizeModuleName,
  };
})();
