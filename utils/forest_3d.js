import * as THREE from "../lib/three.module.js";

let scene, camera, renderer, cityGroup, labelGroup;
let raycaster, mouse;
let hoverHudEl = null;

// Camera Focus & Target Logic
let cameraTarget = new THREE.Vector3(0, 0, 0);
let targetCameraTarget = new THREE.Vector3(0, 0, 0);

let isDragging = false;
let previousMouse = { x: 0, y: 0 };

let cameraRotation = { x: Math.PI / 2.4, y: 0.0 };
let cameraDistance = 95;
let targetDistance = 95;
let targetRotation = { x: Math.PI / 2.4, y: 0.0 };

const PALETTE = {
  activeBuilding: 0x00f3ff,
  completedBuilding: 0x38bdf8,
  highStreakBuilding: 0xff0055,
  emptyPlot: 0x0f172a,
  emptyPlotBorder: 0x334155,
  road: 0x0284c7,
};

/**
 * Initialize Top-Down Calendar City Viewport
 */
export function init3DWorld(canvasElement) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060913);

  camera = new THREE.PerspectiveCamera(
    45,
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

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x00f3ff, 1.5);
  dirLight.position.set(30, 100, 50);
  scene.add(dirLight);

  cityGroup = new THREE.Group();
  labelGroup = new THREE.Group();
  scene.add(cityGroup);
  scene.add(labelGroup);

  hoverHudEl = document.getElementById("hudCard");

  setupControls(canvasElement);
  setupOnScreenControls();

  function animate() {
    requestAnimationFrame(animate);

    // Smooth Dampening
    cameraRotation.x += (targetRotation.x - cameraRotation.x) * 0.1;
    cameraRotation.y += (targetRotation.y - cameraRotation.y) * 0.1;
    cameraDistance += (targetDistance - cameraDistance) * 0.1;
    cameraTarget.lerp(targetCameraTarget, 0.1);

    camera.position.x =
      cameraTarget.x +
      cameraDistance * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
    camera.position.y =
      cameraTarget.y + cameraDistance * Math.sin(cameraRotation.x);
    camera.position.z =
      cameraTarget.z +
      cameraDistance * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
    camera.lookAt(cameraTarget);

    checkHover();
    renderer.render(scene, camera);
  }
  animate();
}

/**
 * Canvas Sprite Text Header Labels (SUN - SAT)
 */
function createLabelSprite(textString) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.strokeStyle = "#00f3ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 84, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#00f3ff";
  ctx.font = "Bold 36px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(textString, 128, 48);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(6, 2.2, 1);
  return sprite;
}

/**
 * Creates 1 Building where 1 day = 1 floor exactly
 */
function createStreakBuilding(streakDays, isActive = false, dateStr = "") {
  const buildingGroup = new THREE.Group();

  const floorHeight = 1.0;
  const width = 3.2;
  const depth = 3.2;

  const numFloors = Math.max(1, Math.floor(streakDays));
  const totalHeight = numFloors * floorHeight;

  const color = isActive
    ? PALETTE.activeBuilding
    : numFloors >= 10
      ? PALETTE.highStreakBuilding
      : PALETTE.completedBuilding;

  const geo = new THREE.BoxGeometry(width, totalHeight, depth);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.7,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = totalHeight / 2;

  mesh.userData = {
    isSelectable: true,
    type: "Building",
    floors: numFloors,
    isActive,
    date: dateStr,
  };
  buildingGroup.add(mesh);

  // Ledges/Floors
  const ribMat = new THREE.MeshBasicMaterial({ color });
  for (let f = 0; f < numFloors; f++) {
    const ribGeo = new THREE.BoxGeometry(width + 0.15, 0.1, depth + 0.15);
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.y = f * floorHeight + floorHeight / 2;
    buildingGroup.add(rib);
  }

  // Roof
  const roofGeo = new THREE.BoxGeometry(width + 0.25, 0.3, depth + 0.25);
  const roof = new THREE.Mesh(roofGeo, ribMat);
  roof.position.y = totalHeight + 0.15;
  buildingGroup.add(roof);

  return buildingGroup;
}

/**
 * Creates Empty Plot for Inactive Days (Merged Consecutive Missed Days)
 */
function createEmptyPlot(consecutiveMissedDays, dateStr = "") {
  const plotGroup = new THREE.Group();

  const width = 3.2;
  const depth = 3.2 * consecutiveMissedDays + 1.8 * (consecutiveMissedDays - 1);

  const geo = new THREE.BoxGeometry(width, 0.15, depth);
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.emptyPlot,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.075;

  mesh.userData = {
    isSelectable: true,
    type: "Inactive Plot",
    missedDays: consecutiveMissedDays,
    date: dateStr,
  };
  plotGroup.add(mesh);

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({
    color: PALETTE.emptyPlotBorder,
  });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  wireframe.position.y = 0.08;
  plotGroup.add(wireframe);

  return plotGroup;
}

/**
 * Road Divider placed after completed streaks
 */
function createRoadDivider() {
  const roadGroup = new THREE.Group();
  const geo = new THREE.BoxGeometry(4.2, 0.05, 1.2);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.road });
  const roadMesh = new THREE.Mesh(geo, mat);
  roadMesh.position.y = 0.025;
  roadGroup.add(roadMesh);
  return roadGroup;
}

/**
 * Render Calendar Layout Engine
 */
export function update3DForest(currentStreak, calendarHistory = []) {
  if (!cityGroup) return;

  while (cityGroup.children.length > 0) cityGroup.remove(cityGroup.children[0]);
  while (labelGroup.children.length > 0)
    labelGroup.remove(labelGroup.children[0]);

  const CELL_SPACING_X = 5.2; // Columns (Sun-Sat)
  const CELL_SPACING_Z = 5.2; // Rows (Weeks)

  // Calendar Header Labels
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  daysOfWeek.forEach((dayLabel, colIndex) => {
    const sprite = createLabelSprite(dayLabel);
    sprite.position.set(colIndex * CELL_SPACING_X - 15.6, 0.5, -6.0);
    labelGroup.add(sprite);
  });

  let currentColumn = 0;
  let currentRow = 0;

  let index = 0;
  while (index < calendarHistory.length) {
    const dayData = calendarHistory[index];
    const xPos = currentColumn * CELL_SPACING_X - 15.6;
    const zPos = currentRow * CELL_SPACING_Z;

    if (dayData.hasCoded) {
      // 1. ACTIVE CODING DAY -> TOWER
      const building = createStreakBuilding(
        dayData.streakCount || 1,
        dayData.isActive || false,
        dayData.date,
      );
      building.position.set(xPos, 0, zPos);
      cityGroup.add(building);

      // Road between completed building and next cell
      if (dayData.isStreakEnd) {
        const road = createRoadDivider();
        road.position.set(xPos, 0, zPos + CELL_SPACING_Z / 2);
        cityGroup.add(road);
      }

      index++;
      currentColumn++;
      if (currentColumn >= 7) {
        currentColumn = 0;
        currentRow++;
      }
    } else {
      // 2. INACTIVE DAY -> MERGE CONSECUTIVE DAYS
      let consecutiveMissed = 0;
      const startColumn = currentColumn;
      const startRow = currentRow;

      while (
        index < calendarHistory.length &&
        !calendarHistory[index].hasCoded &&
        currentColumn === startColumn // Keep vertical consecutive merges aligned
      ) {
        consecutiveMissed++;
        index++;
        currentRow++;
      }

      const emptyPlot = createEmptyPlot(consecutiveMissed, `${dayData.date}`);

      const plotOffsetZ = ((consecutiveMissed - 1) * CELL_SPACING_Z) / 2;
      emptyPlot.position.set(xPos, 0, startRow * CELL_SPACING_Z + plotOffsetZ);
      cityGroup.add(emptyPlot);

      currentColumn++;
      currentRow = startRow;
      if (currentColumn >= 7) {
        currentColumn = 0;
        currentRow++;
      }
    }
  }

  // Recenter Camera Focus over entire calendar grid
  const totalRows = Math.max(1, currentRow + 1);
  targetCameraTarget.set(0, 0, (totalRows * CELL_SPACING_Z) / 2 - 2);
}

/**
 * Setup Controls
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
      Math.min(Math.PI / 2 - 0.02, targetRotation.x + deltaY * 0.008),
    );

    previousMouse = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    targetDistance = Math.max(
      15,
      Math.min(600, targetDistance + e.deltaY * 0.1),
    );
  });

  window.addEventListener("keydown", (e) => {
    const speed = 8;
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")
      targetCameraTarget.x -= speed;
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight")
      targetCameraTarget.x += speed;
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp")
      targetCameraTarget.z -= speed;
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown")
      targetCameraTarget.z += speed;
    if (e.key === "r" || e.key === "R") {
      targetCameraTarget.set(0, 0, 10);
      targetRotation = { x: Math.PI / 2.4, y: 0.0 };
      targetDistance = 95;
    }
  });
}

function setupOnScreenControls() {
  const speed = 10;
  document
    .getElementById("btnPanLeft")
    ?.addEventListener("click", () => (targetCameraTarget.x -= speed));
  document
    .getElementById("btnPanRight")
    ?.addEventListener("click", () => (targetCameraTarget.x += speed));
  document
    .getElementById("btnPanUp")
    ?.addEventListener("click", () => (targetCameraTarget.z -= speed));
  document
    .getElementById("btnPanDown")
    ?.addEventListener("click", () => (targetCameraTarget.z += speed));
  document.getElementById("btnPanReset")?.addEventListener("click", () => {
    targetCameraTarget.set(0, 0, 10);
    targetRotation = { x: Math.PI / 2.4, y: 0.0 };
    targetDistance = 95;
  });
}

function checkHover() {
  if (!raycaster || !cityGroup || !hoverHudEl) return;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cityGroup.children, true);

  const hit = intersects.find((item) => item.object.userData?.isSelectable);

  if (hit) {
    const data = hit.object.userData;
    hoverHudEl.style.display = "block";

    if (data.type === "Building") {
      hoverHudEl.innerHTML = `
        <div style="color:#00f3ff; margin-bottom:4px;">🏢 <strong>${data.isActive ? "Active Streak" : "Completed Streak Tower"}</strong></div>
        <div><strong>Date:</strong> ${data.date}</div>
        <div><strong>Streak Height:</strong> ${data.floors} Floors (Days)</div>
      `;
    } else {
      hoverHudEl.innerHTML = `
        <div style="color:#94a3b8; margin-bottom:4px;">🚫 <strong>Inactive Plot</strong></div>
        <div><strong>Date:</strong> ${data.date}</div>
        <div><strong>Missed Days:</strong> ${data.missedDays}</div>
      `;
    }
  } else {
    hoverHudEl.style.display = "none";
  }
}
