import * as THREE from "../lib/three.module.js";

let scene, camera, renderer, cityGroup, trafficGroup;
let raycaster, mouse;
let hoverHudEl = null;

// Camera Position & Target (Pan + Orbit)
let cameraTarget = new THREE.Vector3(0, 0, 0);
let targetCameraTarget = new THREE.Vector3(0, 0, 0);

let isDragging = false;
let previousMouse = { x: 0, y: 0 };
let cameraRotation = { x: 0.45, y: 0.0 }; // Pitch & Yaw
let cameraDistance = 70;
let targetDistance = 70;
let targetRotation = { x: 0.45, y: 0.0 };

const CYBER_PALETTE = {
  active: 0x00f3ff,
  legendary: 0xff0055, // 20+ floors
  epic: 0xaa00ff, // 10-19 floors
  rare: 0x00ff66, // 5-9 floors
  common: 0x38bdf8, // 1-4 floors
  ground: 0x090d16,
  highway: 0x1e293b,
};

/**
 * Initialize 3D City Viewport with Controls & Pan Targets
 */
export function init3DWorld(canvasElement) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060913);
  scene.fog = new THREE.FogExp2(0x060913, 0.0025);

  camera = new THREE.PerspectiveCamera(
    50,
    canvasElement.width / canvasElement.height,
    0.1,
    5000,
  );

  renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    antialias: true,
  });
  renderer.setSize(canvasElement.width, canvasElement.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2(-999, -999);

  // Ambient & Directional Lighting
  const ambientLight = new THREE.AmbientLight(0x223344, 2.0);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0x00f3ff, 1.5);
  dirLight1.position.set(50, 100, 50);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xff0055, 1.0);
  dirLight2.position.set(-50, 80, -50);
  scene.add(dirLight2);

  cityGroup = new THREE.Group();
  trafficGroup = new THREE.Group();
  scene.add(cityGroup);
  scene.add(trafficGroup);

  hoverHudEl = document.getElementById("hudCard");

  setupControls(canvasElement);
  setupOnScreenControls();

  function animate() {
    requestAnimationFrame(animate);

    // Smooth Orbit & Pan Inertia Dampening
    cameraRotation.x += (targetRotation.x - cameraRotation.x) * 0.1;
    cameraRotation.y += (targetRotation.y - cameraRotation.y) * 0.1;
    cameraDistance += (targetDistance - cameraDistance) * 0.1;
    cameraTarget.lerp(targetCameraTarget, 0.1);

    // Calculate Camera Position relative to target focus point
    camera.position.x =
      cameraTarget.x +
      cameraDistance * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
    camera.position.y =
      cameraTarget.y + cameraDistance * Math.sin(cameraRotation.x);
    camera.position.z =
      cameraTarget.z +
      cameraDistance * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
    camera.lookAt(cameraTarget);

    // Drones Flying Animation
    trafficGroup.children.forEach((drone) => {
      drone.position.x += drone.userData.speedX;
      drone.position.z += drone.userData.speedZ;
      if (Math.abs(drone.position.x) > 200) drone.position.x *= -1;
      if (Math.abs(drone.position.z) > 40) drone.position.z *= -1;
    });

    checkBuildingHover();
    renderer.render(scene, camera);
  }
  animate();
}

/**
 * Creates 2D Canvas Sprite Text for Dynamic Year/Colony Labels
 */
function createYearLabelSprite(textString) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Neon Banner Background
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "#00f3ff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 108, 16);
  ctx.fill();
  ctx.stroke();

  // Text Styling
  ctx.fillStyle = "#00f3ff";
  ctx.font = "Bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(textString, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(16, 4, 1);
  return sprite;
}

/**
 * Gets color based on exact floor count
 */
function getBuildingColor(floors, isActive) {
  if (isActive) return CYBER_PALETTE.active;
  if (floors >= 20) return CYBER_PALETTE.legendary;
  if (floors >= 10) return CYBER_PALETTE.epic;
  if (floors >= 5) return CYBER_PALETTE.rare;
  return CYBER_PALETTE.common;
}

/**
 * Creates 1 Building where 1 day = 1 floor exactly
 */
function createCyberBuilding(streakDays, isActive = false, metadata = {}) {
  const buildingGroup = new THREE.Group();

  const floorHeight = 0.9;
  const buildingWidth = 2.2;
  const buildingDepth = 2.2;

  const numFloors = Math.max(1, Math.floor(streakDays));
  const totalHeight = numFloors * floorHeight;

  const colorHex = getBuildingColor(numFloors, isActive);

  const bodyGeo = new THREE.BoxGeometry(
    buildingWidth,
    totalHeight,
    buildingDepth,
  );
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.8,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = totalHeight / 2;

  bodyMesh.userData = {
    isSelectable: true,
    floors: numFloors,
    isActive,
    endDate: metadata.endDate || "Active Now",
    colonyName: metadata.colonyName || "Genesis Colony",
    rank:
      numFloors >= 20
        ? "Legendary Spire"
        : numFloors >= 10
          ? "Epic Skyscraper"
          : numFloors >= 5
            ? "Tower"
            : "Standard Building",
  };

  buildingGroup.add(bodyMesh);

  // Floor Ledges
  const windowMat = new THREE.MeshBasicMaterial({ color: colorHex });
  for (let floor = 0; floor < numFloors; floor++) {
    const floorY = floor * floorHeight + floorHeight / 2;
    const ribGeo = new THREE.BoxGeometry(
      buildingWidth + 0.1,
      0.08,
      buildingDepth + 0.1,
    );
    const ribMesh = new THREE.Mesh(ribGeo, windowMat);
    ribMesh.position.y = floorY;
    buildingGroup.add(ribMesh);
  }

  // Rooftop
  const roofGeo = new THREE.BoxGeometry(
    buildingWidth + 0.15,
    0.25,
    buildingDepth + 0.15,
  );
  const roofMesh = new THREE.Mesh(roofGeo, windowMat);
  roofMesh.position.y = totalHeight + 0.125;
  buildingGroup.add(roofMesh);

  if (numFloors >= 10 || isActive) {
    const antennaGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.0, 8);
    const antenna = new THREE.Mesh(antennaGeo, windowMat);
    antenna.position.y = totalHeight + 1.6;
    buildingGroup.add(antenna);
  }

  return buildingGroup;
}

/**
 * Creates Colony Archway with High-Res Billboard Year Signage
 */
function createColonyArchway(colonyLabelText, xPos) {
  const archGroup = new THREE.Group();
  const archMat = new THREE.MeshBasicMaterial({ color: CYBER_PALETTE.active });

  // Pillars
  const pillar1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), archMat);
  pillar1.position.set(xPos, 7, -12);

  const pillar2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), archMat);
  pillar2.position.set(xPos, 7, 12);

  // Overhead Bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 24.8), archMat);
  bridge.position.set(xPos, 14, 0);

  archGroup.add(pillar1);
  archGroup.add(pillar2);
  archGroup.add(bridge);

  // Add 3D Dynamic Text Label above Archway
  const textSprite = createYearLabelSprite(colonyLabelText);
  textSprite.position.set(xPos, 17, 0);
  archGroup.add(textSprite);

  return archGroup;
}

/**
 * Extracts Year from Date String (e.g., "2024-03-15" -> "2024")
 */
function parseYearFromDate(dateStr) {
  if (!dateStr || dateStr.includes("Present") || dateStr.includes("Active")) {
    return new Date().getFullYear().toString();
  }
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : new Date().getFullYear().toString();
}

/**
 * Organize History Chronologically with Year-Labeled Colonies
 */
export function update3DForest(currentStreak, forestArray = []) {
  if (!cityGroup) return;

  while (cityGroup.children.length > 0) cityGroup.remove(cityGroup.children[0]);
  while (trafficGroup.children.length > 0)
    trafficGroup.remove(trafficGroup.children[0]);

  const fullTimeline = [...forestArray];
  if (currentStreak > 0) {
    fullTimeline.push({
      finalStreak: currentStreak,
      endDate: "Present (Active)",
      isActive: true,
    });
  }

  const BUILDINGS_PER_COLONY = 6;
  const colonyCount = Math.max(
    1,
    Math.ceil(fullTimeline.length / BUILDINGS_PER_COLONY),
  );

  const colonyWidth = 28;
  const totalCityLength = colonyCount * colonyWidth;
  const startX = -((colonyCount - 1) * colonyWidth) / 2;

  // Ground Plane
  const groundGeo = new THREE.PlaneGeometry(totalCityLength + 30, 36);
  const groundMat = new THREE.MeshStandardMaterial({
    color: CYBER_PALETTE.ground,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  cityGroup.add(ground);

  // Highway
  const highwayGeo = new THREE.PlaneGeometry(totalCityLength + 30, 4);
  const highwayMat = new THREE.MeshBasicMaterial({
    color: CYBER_PALETTE.highway,
  });
  const highway = new THREE.Mesh(highwayGeo, highwayMat);
  highway.rotation.x = -Math.PI / 2;
  highway.position.y = 0.01;
  cityGroup.add(highway);

  // Populate Colonies & Collect Date Ranges per Colony
  for (let c = 0; c < colonyCount; c++) {
    const colonyItems = fullTimeline.slice(
      c * BUILDINGS_PER_COLONY,
      (c + 1) * BUILDINGS_PER_COLONY,
    );

    // Determine Colony Year / Date Label Range
    const startYear = parseYearFromDate(colonyItems[0]?.endDate);
    const endYear = parseYearFromDate(
      colonyItems[colonyItems.length - 1]?.endDate,
    );
    const yearLabel =
      startYear === endYear
        ? `COLONY #${c + 1} (${startYear})`
        : `COLONY #${c + 1} (${startYear} - ${endYear})`;

    const colonyCenterX = startX + c * colonyWidth;

    colonyItems.forEach((item, indexInColony) => {
      const building = createCyberBuilding(
        item.finalStreak || 1,
        item.isActive || false,
        { endDate: item.endDate, colonyName: yearLabel },
      );

      const row = Math.floor(indexInColony / 3);
      const col = indexInColony % 3;

      const x = colonyCenterX + (col - 1) * 6;
      const z = row === 0 ? -9 : 9;

      building.position.set(x, 0, z);
      cityGroup.add(building);
    });

    // Create Year Archway Portal for each Colony
    const archX = colonyCenterX - colonyWidth / 2;
    const archway = createColonyArchway(yearLabel, archX);
    cityGroup.add(archway);
  }

  // Drones
  for (let i = 0; i < 20; i++) {
    const droneGeo = new THREE.BoxGeometry(0.5, 0.15, 1.0);
    const droneMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? CYBER_PALETTE.active : CYBER_PALETTE.legendary,
    });
    const drone = new THREE.Mesh(droneGeo, droneMat);

    drone.position.set(
      (Math.random() - 0.5) * totalCityLength,
      4 + Math.random() * 10,
      (Math.random() - 0.5) * 20,
    );

    drone.userData = {
      speedX: (Math.random() - 0.5) * 0.3,
      speedZ: (Math.random() - 0.5) * 0.1,
    };

    trafficGroup.add(drone);
  }
}

/**
 * Setup Keyboard & Mouse Control Listener
 */
function setupControls(canvas) {
  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    previousMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / canvas.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / canvas.height) * 2 + 1;

    if (!isDragging) return;

    const deltaX = e.clientX - previousMouse.x;
    const deltaY = e.clientY - previousMouse.y;

    targetRotation.y -= deltaX * 0.008;
    targetRotation.x = Math.max(
      0.05,
      Math.min(Math.PI / 2 - 0.05, targetRotation.x + deltaY * 0.008),
    );

    previousMouse = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    targetDistance = Math.max(
      10,
      Math.min(1000, targetDistance + e.deltaY * 0.08),
    );
  });

  // WASD / Arrow Key Camera Panning Along Timeline
  window.addEventListener("keydown", (e) => {
    const panSpeed = 6;
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")
      targetCameraTarget.x -= panSpeed;
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight")
      targetCameraTarget.x += panSpeed;
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp")
      targetCameraTarget.z -= panSpeed;
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown")
      targetCameraTarget.z += panSpeed;
    if (e.key === "r" || e.key === "R") targetCameraTarget.set(0, 0, 0);
  });
}

/**
 * Connect UI Buttons to Camera Target Controls
 */
function setupOnScreenControls() {
  const panSpeed = 12;
  document
    .getElementById("btnPanLeft")
    ?.addEventListener("click", () => (targetCameraTarget.x -= panSpeed));
  document
    .getElementById("btnPanRight")
    ?.addEventListener("click", () => (targetCameraTarget.x += panSpeed));
  document
    .getElementById("btnPanUp")
    ?.addEventListener("click", () => (targetCameraTarget.z -= panSpeed));
  document
    .getElementById("btnPanDown")
    ?.addEventListener("click", () => (targetCameraTarget.z += panSpeed));
  document.getElementById("btnPanReset")?.addEventListener("click", () => {
    targetCameraTarget.set(0, 0, 0);
    targetRotation = { x: 0.45, y: 0.0 };
    targetDistance = 70;
  });
}

/**
 * Instant Mouse Hover Check for HUD
 */
function checkBuildingHover() {
  if (!raycaster || !cityGroup || !hoverHudEl) return;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cityGroup.children, true);

  const hit = intersects.find((item) => item.object.userData?.isSelectable);

  if (hit) {
    const data = hit.object.userData;
    hoverHudEl.style.display = "block";
    hoverHudEl.innerHTML = `
      <div class="hud-header">
        <span>📍 ${data.colonyName}</span>
      </div>
      <div class="hud-body">
        <div><strong>Type:</strong> ${data.rank}</div>
        <div><strong>Floors (Days):</strong> ${data.floors}</div>
        <div><strong>Completion Date:</strong> ${data.endDate}</div>
      </div>
    `;
  } else {
    hoverHudEl.style.display = "none";
  }
}
