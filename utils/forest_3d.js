import * as THREE from "../lib/three.module.js";

let scene, camera, renderer, cityGroup, labelGroup;
let raycaster, mouse;
let hoverHudEl = null;

let cameraTarget = new THREE.Vector3(0, 0, 10);
let targetCameraTarget = new THREE.Vector3(0, 0, 10);

let isDragging = false;
let previousMouse = { x: 0, y: 0 };

let cameraRotation = { x: Math.PI / 3.5, y: 0.0 };
let cameraDistance = 120;
let targetDistance = 120;
let targetRotation = { x: Math.PI / 3.5, y: 0.0 };

const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
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

  camera = new THREE.PerspectiveCamera(
    50,
    canvasElement.width / canvasElement.height,
    0.1,
    3000,
  );

  renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    antialias: true,
  });
  renderer.setSize(canvasElement.width, canvasElement.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

  const gridHelper = new THREE.GridHelper(500, 100, 0x00f3ff, 0x1e293b);
  gridHelper.position.set(0, -0.1, 100);
  scene.add(gridHelper);

  cityGroup = new THREE.Group();
  labelGroup = new THREE.Group();
  scene.add(cityGroup);
  scene.add(labelGroup);

  hoverHudEl = document.getElementById("hudCard");

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

function createTextSprite(textString, colorStr = "#00f3ff", isLarge = false) {
  const canvas = document.createElement("canvas");
  canvas.width = isLarge ? 512 : 256;
  canvas.height = isLarge ? 128 : 96;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
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
  sprite.scale.set(isLarge ? 16 : 6, isLarge ? 4.0 : 2.2, 1);
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

  // Platform Glowing Frame Edge
  const platEdges = new THREE.EdgesGeometry(platGeo);
  const platLineMat = new THREE.LineBasicMaterial({
    color: streakColor,
    linewidth: 2,
  });
  const platWire = new THREE.LineSegments(platEdges, platLineMat);
  platWire.position.y = platformHeight / 2;
  buildingGroup.add(platWire);

  // 2. CHICAGO-STYLE SKYSCRAPER TOWER
  const floorHeight = 1.2;
  const numFloors = Math.max(1, Math.min(20, Math.floor(dayData.submissions)));
  const buildingHeight = numFloors * floorHeight;

  // Concrete/Steel Core
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

  // 3. CHICAGO WINDOW GRID FACADES (3 Bays)
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

    // Horizontal Spandrel Band
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

  // Roof Structure
  const roofGeo = new THREE.BoxGeometry(width + 0.2, 0.3, depth + 0.2);
  const roofMesh = new THREE.Mesh(roofGeo, frameMat);
  roofMesh.position.y = platformHeight + buildingHeight + 0.15;
  buildingGroup.add(roofMesh);

  // Spire / Antenna
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

function createYearBoundaryWall(height = 120) {
  const wallGroup = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.5, 0.2, height);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.yearDivider });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.1, height / 2);
  wallGroup.add(mesh);
  return wallGroup;
}

/**
 * 2-AXIS MATRIX GENERATION:
 * - X-Axis: Years placed side-by-side (Year Columns)
 * - Z-Axis: Month Colonies flowing vertically inside each year column
 */
export function update3DForest(currentStreak, calendarHistory = []) {
  if (!cityGroup) return;

  while (cityGroup.children.length > 0) cityGroup.remove(cityGroup.children[0]);
  while (labelGroup.children.length > 0)
    labelGroup.remove(labelGroup.children[0]);

  const CELL_SPACING_X = 5.2;
  const CELL_SPACING_Z = 5.2;
  const MONTH_COLONY_GAP = 6.0;
  const YEAR_COLUMN_WIDTH = 7 * CELL_SPACING_X + 12.0; // Width of 1 year column

  if (!calendarHistory || calendarHistory.length === 0) return;

  // Group Days by Year -> Month Colonies
  const yearGroupsMap = {};

  calendarHistory.forEach((dayData) => {
    const yr = dayData.year;
    if (!yearGroupsMap[yr]) {
      yearGroupsMap[yr] = {
        year: yr,
        monthColonies: {},
      };
    }

    const mo = dayData.month;
    if (!yearGroupsMap[yr].monthColonies[mo]) {
      yearGroupsMap[yr].monthColonies[mo] = {
        month: mo,
        monthName: MONTH_NAMES[mo],
        days: [],
      };
    }

    yearGroupsMap[yr].monthColonies[mo].days.push(dayData);
  });

  const sortedYears = Object.keys(yearGroupsMap)
    .map(Number)
    .sort((a, b) => a - b);
  const totalYears = sortedYears.length;

  let maxDepthZ = 0;

  sortedYears.forEach((year, yearIndex) => {
    // Calculate X center offset for this year column
    const yearCenterX = (yearIndex - (totalYears - 1) / 2) * YEAR_COLUMN_WIDTH;

    // 1. Render Big Year Title Banner
    const yearBanner = createTextSprite(`YEAR ${year}`, "#ff0055", true);
    yearBanner.position.set(yearCenterX, 8.0, -10.0);
    labelGroup.add(yearBanner);

    // Render Day-of-Week Headers above each year column
    const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];
    daysOfWeek.forEach((dayLabel, colIndex) => {
      const sprite = createTextSprite(dayLabel, "#00f3ff");
      sprite.position.set(
        yearCenterX + (colIndex * CELL_SPACING_X - 15.6),
        1.0,
        -4.0,
      );
      labelGroup.add(sprite);
    });

    let currentZ = 0;

    const yearData = yearGroupsMap[year];
    const sortedMonths = Object.keys(yearData.monthColonies)
      .map(Number)
      .sort((a, b) => a - b);

    sortedMonths.forEach((month) => {
      const colony = yearData.monthColonies[month];

      // Month Title Tag
      const monthHeader = createTextSprite(
        `${colony.monthName}`,
        "#38bdf8",
        false,
      );
      monthHeader.position.set(yearCenterX, 4.0, currentZ);
      labelGroup.add(monthHeader);

      currentZ += 3.5;

      let currentRow = 0;

      colony.days.forEach((dayData) => {
        const colIndex = dayData.dayOfWeek;
        const xPos = yearCenterX + (colIndex * CELL_SPACING_X - 15.6);
        const zPos = currentZ + currentRow * CELL_SPACING_Z;

        if (dayData.hasCoded) {
          const building = createElevatedBuilding(dayData);
          building.position.set(xPos, 0, zPos);
          cityGroup.add(building);
        } else {
          const emptyPlot = createEmptyPlot(dayData.date);
          emptyPlot.position.set(xPos, 0, zPos);
          cityGroup.add(emptyPlot);
        }

        if (colIndex === 6) {
          currentRow++;
        }
      });

      const colonyDepth = (currentRow + 1) * CELL_SPACING_Z;
      currentZ += colonyDepth;

      // Road divider between months
      const road = createColonyDivider(38);
      road.position.set(yearCenterX, 0, currentZ + MONTH_COLONY_GAP / 2);
      cityGroup.add(road);

      currentZ += MONTH_COLONY_GAP;
    });

    if (currentZ > maxDepthZ) maxDepthZ = currentZ;

    // Vertical Cyber Divider Wall between Year Columns
    if (yearIndex < totalYears - 1) {
      const dividerX = yearCenterX + YEAR_COLUMN_WIDTH / 2;
      const yearWall = createYearBoundaryWall(maxDepthZ || 150);
      yearWall.position.set(dividerX, 0, 0);
      cityGroup.add(yearWall);
    }
  });

  // Center camera across the 2-axis matrix
  targetCameraTarget.set(0, 0, maxDepthZ / 2);
}

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
      Math.min(800, targetDistance + e.deltaY * 0.2),
    );
  });

  window.addEventListener("keydown", (e) => {
    const speed = 12;
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
      targetRotation = { x: Math.PI / 3.5, y: 0.0 };
      targetDistance = 120;
    }
  });
}

function setupOnScreenControls() {
  const speed = 14;
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
    targetRotation = { x: Math.PI / 3.5, y: 0.0 };
    targetDistance = 120;
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
        <div style="color:#00f3ff; margin-bottom:4px;">🏢 <strong>Streak Block #${data.streakId}</strong></div>
        <div><strong>Date:</strong> ${data.date}</div>
        <div><strong>Total Streak Length:</strong> ${data.totalStreakLength} Days</div>
        <div><strong>Platform Height:</strong> +${data.platformHeight}m</div>
        <div><strong>Daily Submissions:</strong> ${data.submissions}</div>
      `;
    } else {
      hoverHudEl.innerHTML = `
        <div style="color:#94a3b8; margin-bottom:4px;">🚫 <strong>Inactive Plot</strong></div>
        <div><strong>Date:</strong> ${data.date}</div>
      `;
    }
  } else {
    hoverHudEl.style.display = "none";
  }
}
