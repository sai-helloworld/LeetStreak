import * as THREE from "../lib/three.module.js";

let scene, camera, renderer, cityGroup, labelGroup;
let raycaster, mouse;
let hoverHudEl = null;

let cameraTarget = new THREE.Vector3(0, 0, 10);
let targetCameraTarget = new THREE.Vector3(0, 0, 10);

let isDragging = false;
let previousMouse = { x: 0, y: 0 };

// Raw client coords for accurate tooltip positioning
let mouseClient = { x: 0, y: 0 };

let cameraRotation = { x: Math.PI / 3.5, y: 0.0 };
let cameraDistance = 140;
let targetDistance = 140;
let targetRotation = { x: Math.PI / 3.5, y: 0.0 };

// Computed in update3DForest and used to clamp camera movement.
const CITY_BOUNDS = {
  minX: -50,
  maxX: 50,
  minZ: -20,
  maxZ: 200,
};

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

const PALETTE = {
  emptyPlot: 0x1e293b,
  emptyPlotBorder: 0x334155,
  colonyRoad: 0x00f3ff,
  yearDivider: 0xff0055,
};

export function init3DWorld(canvasElement) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060913);

  // Read on-screen size (CSS-driven), fall back to attributes.
  const initialW = canvasElement.clientWidth || canvasElement.width || 800;
  const initialH = canvasElement.clientHeight || canvasElement.height || 400;

  camera = new THREE.PerspectiveCamera(50, initialW / initialH, 0.1, 4000);

  renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialW, initialH, false); // false = leave CSS size alone

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2(-999, -999);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
  dirLight.position.set(100, 200, 100);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x00f3ff, 1.2);
  fillLight.position.set(-100, 60, -100);
  scene.add(fillLight);

  // Floor grid — drawn manually so no X/Y axis lines appear.
  (function buildFloorGrid() {
    const GRID_SIZE = 600;
    const GRID_DIVISIONS = 120;
    const GRID_STEP = GRID_SIZE / GRID_DIVISIONS;
    const half = GRID_SIZE / 2;

    const gridMat = new THREE.LineBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.15,
    });

    const pts = [];
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const x = -half + i * GRID_STEP;
      pts.push(new THREE.Vector3(x, 0, -half), new THREE.Vector3(x, 0, half));
    }
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const z = -half + i * GRID_STEP;
      pts.push(new THREE.Vector3(-half, 0, z), new THREE.Vector3(half, 0, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const lines = new THREE.LineSegments(geo, gridMat);
    lines.position.set(0, -0.1, 150);
    scene.add(lines);
  })();

  cityGroup = new THREE.Group();
  labelGroup = new THREE.Group();
  scene.add(cityGroup);
  scene.add(labelGroup);

  hoverHudEl = document.getElementById("hudCard");

  // Keep renderer + camera in sync with the container's actual size.
  const resize = () => {
    const w = canvasElement.clientWidth;
    const h = canvasElement.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(canvasElement);
  }

  setupControls(canvasElement);
  setupOnScreenControls();

  function animate() {
    requestAnimationFrame(animate);

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

function createTextSprite(textString, colorStr = "#ffe600", isLarge = false) {
  const canvas = document.createElement("canvas");
  canvas.width = isLarge ? 512 : 256;
  canvas.height = isLarge ? 128 : 96;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgb(0, 0, 1)";
  ctx.strokeStyle = colorStr;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 12);
  else ctx.rect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colorStr;
  ctx.font = isLarge ? "Bold 48px monospace" : "Bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(textString, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(isLarge ? 22 : 9, isLarge ? 5.5 : 3.2, 1);
  return sprite;
}

/**
 * Creates a Chicago-style skyscraper placed on top of an elevated streak platform
 */
function createElevatedBuilding(dayData) {
  const buildingGroup = new THREE.Group();

  const platformHeight = dayData.platformHeight || 1.2;
  const streakColor = dayData.streakColor;
  const width = 3.6;
  const depth = 3.6;

  // 1. ELEVATED PLATFORM BASE
  const platGeo = new THREE.BoxGeometry(
    width + 0.6,
    platformHeight,
    depth + 0.6,
  );
  const platMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: streakColor,
    emissiveIntensity: 0.25,
    roughness: 0.4,
    metalness: 0.8,
  });
  const platMesh = new THREE.Mesh(platGeo, platMat);
  platMesh.position.y = platformHeight / 2;
  buildingGroup.add(platMesh);

  // Platform Edge Wireframe
  const platEdges = new THREE.EdgesGeometry(platGeo);
  const platLineMat = new THREE.LineBasicMaterial({
    color: streakColor,
    linewidth: 2,
  });
  const platWire = new THREE.LineSegments(platEdges, platLineMat);
  platWire.position.y = platformHeight / 2;
  buildingGroup.add(platWire);

  // 2. CHICAGO SKYSCRAPER CORE
  const floorHeight = 1.2;
  const numFloors = Math.max(1, Math.floor(dayData.submissions));
  const buildingHeight = numFloors * floorHeight;

  const coreGeo = new THREE.BoxGeometry(width, buildingHeight, depth);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x080e1e,
    roughness: 0.6,
    metalness: 0.9,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.y = platformHeight + buildingHeight / 2;

  coreMesh.userData = {
    isSelectable: true,
    type: "Building",
    floors: numFloors,
    submissions: dayData.submissions,
    streakId: dayData.streakId,
    totalStreakLength: dayData.totalStreakLength,
    platformHeight: platformHeight.toFixed(1),
    date: dayData.date,
  };
  buildingGroup.add(coreMesh);

  // 3. CHICAGO WINDOW BAYS (3 per face)
  const windowCols = 3;
  const windowWidth = (width - 0.6) / windowCols;
  const windowHeight = 0.65;
  const windowDepthOffset = width / 2 + 0.02;

  const windowMat = new THREE.MeshStandardMaterial({
    color: streakColor,
    emissive: streakColor,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.9,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.8,
  });

  for (let f = 0; f < numFloors; f++) {
    const floorY = platformHeight + f * floorHeight + floorHeight / 2;

    for (let col = 0; col < windowCols; col++) {
      const offsetX = -((width - 0.8) / 2) + col * (windowWidth + 0.15);
      const windowGeo = new THREE.PlaneGeometry(windowWidth, windowHeight);

      // Front (+Z)
      const frontWin = new THREE.Mesh(windowGeo, windowMat);
      frontWin.position.set(offsetX, floorY, windowDepthOffset);
      buildingGroup.add(frontWin);

      // Back (-Z)
      const backWin = new THREE.Mesh(windowGeo, windowMat);
      backWin.position.set(offsetX, floorY, -windowDepthOffset);
      backWin.rotation.y = Math.PI;
      buildingGroup.add(backWin);

      // Right (+X)
      const rightWin = new THREE.Mesh(windowGeo, windowMat);
      rightWin.position.set(windowDepthOffset, floorY, offsetX);
      rightWin.rotation.y = Math.PI / 2;
      buildingGroup.add(rightWin);

      // Left (-X)
      const leftWin = new THREE.Mesh(windowGeo, windowMat);
      leftWin.position.set(-windowDepthOffset, floorY, offsetX);
      leftWin.rotation.y = -Math.PI / 2;
      buildingGroup.add(leftWin);
    }

    // Horizontal Spandrel Beams
    const spandrelGeo = new THREE.BoxGeometry(width + 0.08, 0.25, depth + 0.08);
    const spandrelMesh = new THREE.Mesh(spandrelGeo, frameMat);
    spandrelMesh.position.y = platformHeight + f * floorHeight + 0.1;
    buildingGroup.add(spandrelMesh);
  }

  // Vertical Mullions
  const verticalColumnGeo = new THREE.BoxGeometry(0.12, buildingHeight, 0.12);
  const colPositions = [-width / 2, -width / 6, width / 6, width / 2];

  colPositions.forEach((posX) => {
    colPositions.forEach((posZ) => {
      if (Math.abs(posX) === width / 2 || Math.abs(posZ) === depth / 2) {
        const colMesh = new THREE.Mesh(verticalColumnGeo, frameMat);
        colMesh.position.set(posX, platformHeight + buildingHeight / 2, posZ);
        buildingGroup.add(colMesh);
      }
    });
  });

  // Roof Crown
  const roofGeo = new THREE.BoxGeometry(width + 0.2, 0.3, depth + 0.2);
  const roofMesh = new THREE.Mesh(roofGeo, frameMat);
  roofMesh.position.y = platformHeight + buildingHeight + 0.15;
  buildingGroup.add(roofMesh);

  // Antenna Spire
  if (numFloors >= 5) {
    const spireGeo = new THREE.CylinderGeometry(0.04, 0.15, 2.5, 8);
    const spireMat = new THREE.MeshBasicMaterial({ color: streakColor });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = platformHeight + buildingHeight + 1.55;
    buildingGroup.add(spire);
  }

  return buildingGroup;
}

function createEmptyPlot(dateStr = "") {
  const plotGroup = new THREE.Group();
  const width = 3.6;
  const depth = 3.6;

  const geo = new THREE.BoxGeometry(width, 0.2, depth);
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.emptyPlot,
    roughness: 0.8,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.1;

  mesh.userData = {
    isSelectable: true,
    type: "Inactive Plot",
    date: dateStr,
  };
  plotGroup.add(mesh);

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({
    color: PALETTE.emptyPlotBorder,
    linewidth: 2,
  });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  wireframe.position.y = 0.11;
  plotGroup.add(wireframe);

  return plotGroup;
}

function createColonyDivider(width = 38) {
  const dividerGroup = new THREE.Group();
  const geo = new THREE.BoxGeometry(width, 0.1, 1.2);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.colonyRoad });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.05, 0);
  dividerGroup.add(mesh);
  return dividerGroup;
}

function createYearBoundaryWall(height = 300) {
  const wallGroup = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.5, 0.2, height);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.yearDivider });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.1, height / 2);
  wallGroup.add(mesh);
  return wallGroup;
}

/**
 * 2-AXIS MATRIX GENERATION (Jan - Dec Full Year Render):
 * Ensures all 12 months (Jan-Dec) are rendered in each year column side-by-side.
 */
export function update3DForest(currentStreak, calendarHistory = []) {
  if (!cityGroup) return;

  while (cityGroup.children.length > 0) cityGroup.remove(cityGroup.children[0]);
  while (labelGroup.children.length > 0)
    labelGroup.remove(labelGroup.children[0]);

  const CELL_SPACING_X = 5.2;
  const CELL_SPACING_Z = 5.2;
  const MONTH_COLONY_GAP = 6.0;
  const YEAR_COLUMN_WIDTH = 7 * CELL_SPACING_X + 14.0;

  if (!calendarHistory || calendarHistory.length === 0) return;

  // 1. Build Quick Lookup Map for raw history
  const historyLookup = {};
  const activeYearsSet = new Set();

  calendarHistory.forEach((dayData) => {
    historyLookup[dayData.date] = dayData;
    activeYearsSet.add(dayData.year);
  });

  const sortedYears = Array.from(activeYearsSet).sort((a, b) => a - b);
  const totalYears = sortedYears.length;

  let maxDepthZ = 0;

  // 2. Iterate through each year column side-by-side
  sortedYears.forEach((year, yearIndex) => {
    const yearCenterX = (yearIndex - (totalYears - 1) / 2) * YEAR_COLUMN_WIDTH;

    // Year Title Banner
    const yearBanner = createTextSprite(`YEAR ${year}`, "#ff0055", true);
    yearBanner.position.set(yearCenterX, 8.0, -10.0);
    labelGroup.add(yearBanner);

    // Day of week headers above column
    const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];
    daysOfWeek.forEach((dayLabel, colIndex) => {
      const sprite = createTextSprite(dayLabel, "#ffea00");
      sprite.position.set(
        yearCenterX + (colIndex * CELL_SPACING_X - 15.6),
        1.0,
        -4.0,
      );
      labelGroup.add(sprite);
    });

    let currentZ = 0;

    // 3. FORCE FULL 12 MONTHS (Jan = 0 to Dec = 11)
    for (let month = 0; month < 12; month++) {
      const monthName = MONTH_NAMES[month];

      // Month Title Tag
      const monthHeader = createTextSprite(`${monthName}`, "#f2f838", false);
      monthHeader.position.set(yearCenterX, 4.0, currentZ);
      labelGroup.add(monthHeader);

      currentZ += 3.5;

      // Generate all days for this month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let currentRow = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const yStr = dateObj.getFullYear();
        const mStr = String(dateObj.getMonth() + 1).padStart(2, "0");
        const dStr = String(dateObj.getDate()).padStart(2, "0");
        const dateKey = `${yStr}-${mStr}-${dStr}`;

        const dayOfWeek = dateObj.getDay();
        const existingData = historyLookup[dateKey];

        const xPos = yearCenterX + (dayOfWeek * CELL_SPACING_X - 15.6);
        const zPos = currentZ + currentRow * CELL_SPACING_Z;

        if (existingData && existingData.hasCoded) {
          const building = createElevatedBuilding(existingData);
          building.position.set(xPos, 0, zPos);
          cityGroup.add(building);
        } else {
          const emptyPlot = createEmptyPlot(dateKey);
          emptyPlot.position.set(xPos, 0, zPos);
          cityGroup.add(emptyPlot);
        }

        if (dayOfWeek === 6 || d === daysInMonth) {
          currentRow++;
        }
      }

      const colonyDepth = currentRow * CELL_SPACING_Z;
      currentZ += colonyDepth;

      // Road divider between months
      const road = createColonyDivider(38);
      road.position.set(yearCenterX, 0, currentZ + MONTH_COLONY_GAP / 2);
      cityGroup.add(road);

      currentZ += MONTH_COLONY_GAP;
    }

    if (currentZ > maxDepthZ) maxDepthZ = currentZ;

    // Neon Boundary Wall between adjacent years
    if (yearIndex < totalYears - 1) {
      const dividerX = yearCenterX + YEAR_COLUMN_WIDTH / 2;
      const yearWall = createYearBoundaryWall(maxDepthZ || 350);
      yearWall.position.set(dividerX, 0, 0);
      cityGroup.add(yearWall);
    }
  });

  // Adjust camera focal target to middle of matrix
  targetCameraTarget.set(0, 0, maxDepthZ / 2);

  // Record the city extents so we can clamp panning.
  const totalWidthX = totalYears * YEAR_COLUMN_WIDTH;
  CITY_BOUNDS.minX = -totalWidthX / 2 - 10;
  CITY_BOUNDS.maxX = totalWidthX / 2 + 10;
  CITY_BOUNDS.minZ = -30;
  CITY_BOUNDS.maxZ = maxDepthZ + 30;
}

/**
 * Clamps the pan target to the city's extents plus a small margin.
 * Called after every input that can move the camera target.
 */
function clampTarget() {
  const margin = 10;
  targetCameraTarget.x = Math.max(
    CITY_BOUNDS.minX - margin,
    Math.min(CITY_BOUNDS.maxX + margin, targetCameraTarget.x),
  );
  targetCameraTarget.z = Math.max(
    CITY_BOUNDS.minZ - margin,
    Math.min(CITY_BOUNDS.maxZ + margin, targetCameraTarget.z),
  );
  targetCameraTarget.y = 0;
}

function setupControls(canvas) {
  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    previousMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    mouseClient.x = e.clientX;
    mouseClient.y = e.clientY;

    if (!isDragging) return;

    const deltaX = e.clientX - previousMouse.x;
    const deltaY = e.clientY - previousMouse.y;

    targetRotation.y -= deltaX * 0.008;
    targetRotation.x = Math.max(
      0.1,
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
      20,
      Math.min(1000, targetDistance + e.deltaY * 0.25),
    );
  });

  window.addEventListener("keydown", (e) => {
    const speed = 14;
    let moved = false;

    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
      targetCameraTarget.x -= speed;
      moved = true;
    }
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
      targetCameraTarget.x += speed;
      moved = true;
    }
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
      targetCameraTarget.z -= speed;
      moved = true;
    }
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
      targetCameraTarget.z += speed;
      moved = true;
    }
    if (e.key === "r" || e.key === "R") {
      targetCameraTarget.set(0, 0, 10);
      targetRotation = { x: Math.PI / 3.5, y: 0.0 };
      targetDistance = 140;
      moved = false;
    }

    if (moved) clampTarget();
  });
}

function setupOnScreenControls() {
  const speed = 16;
  const pan = (dx, dz) => {
    targetCameraTarget.x += dx;
    targetCameraTarget.z += dz;
    clampTarget();
  };

  document
    .getElementById("btnPanLeft")
    ?.addEventListener("click", () => pan(-speed, 0));
  document
    .getElementById("btnPanRight")
    ?.addEventListener("click", () => pan(speed, 0));
  document
    .getElementById("btnPanUp")
    ?.addEventListener("click", () => pan(0, -speed));
  document
    .getElementById("btnPanDown")
    ?.addEventListener("click", () => pan(0, speed));
  document.getElementById("btnPanReset")?.addEventListener("click", () => {
    targetCameraTarget.set(0, 0, 10);
    targetRotation = { x: Math.PI / 3.5, y: 0.0 };
    targetDistance = 140;
  });
}

/**
 * Walks up the parent chain to find the nearest selectable ancestor.
 */
function findSelectableAncestor(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.isSelectable) return cur;
    cur = cur.parent;
  }
  return null;
}

function checkHover() {
  if (!raycaster || !cityGroup || !hoverHudEl) return;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(cityGroup.children, true);

  // Pick the nearest intersection that resolves to a selectable object.
  let selected = null;
  const seen = new Set();
  for (const hit of intersects) {
    const sel = findSelectableAncestor(hit.object);
    if (!sel) continue;
    if (seen.has(sel)) continue;
    seen.add(sel);
    selected = sel;
    break;
  }

  if (!selected) {
    hoverHudEl.style.display = "none";
    return;
  }

  const data = selected.userData || {};
  const container = hoverHudEl.parentElement; // #viewportContainer
  const cRect = container.getBoundingClientRect();

  let html = "";
  if (data.type === "Building") {
    html = `
      <div style="color:#00f3ff; margin-bottom:4px;">🏢 <strong>Streak Block #${data.streakId ?? "-"}</strong></div>
      <div class="hud-row"><span class="hud-label">Date:</span><span class="hud-val">${data.date ?? "-"}</span></div>
      <div class="hud-row"><span class="hud-label">Submissions:</span><span class="hud-val">${data.submissions ?? 0}</span></div>
      <div class="hud-row"><span class="hud-label">Floors:</span><span class="hud-val">${data.floors ?? 0}</span></div>
      <div class="hud-row"><span class="hud-label">Streak Length:</span><span class="hud-val">${data.totalStreakLength ?? 0} d</span></div>
      <div class="hud-row"><span class="hud-label">Platform:</span><span class="hud-val">+${data.platformHeight ?? 0}m</span></div>
    `;
  } else {
    html = `
      <div style="color:#94a3b8; margin-bottom:4px;">🚫 <strong>Inactive Plot</strong></div>
      <div class="hud-row"><span class="hud-label">Date:</span><span class="hud-val">${data.date ?? "-"}</span></div>
    `;
  }

  hoverHudEl.innerHTML = html;
  hoverHudEl.style.display = "block";

  // Position next to cursor, clamped inside the viewport
  const pad = 14;
  const hudW = hoverHudEl.offsetWidth;
  const hudH = hoverHudEl.offsetHeight;

  let x = mouseClient.x - cRect.left + 16;
  let y = mouseClient.y - cRect.top + 16;

  if (x + hudW + pad > cRect.width) {
    x = mouseClient.x - cRect.left - hudW - 16;
  }
  if (y + hudH + pad > cRect.height) {
    y = mouseClient.y - cRect.top - hudH - 16;
  }
  if (x < pad) x = pad;
  if (y < pad) y = pad;

  hoverHudEl.style.transform = `translate(${x}px, ${y}px)`;
}
