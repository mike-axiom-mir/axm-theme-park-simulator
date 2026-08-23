import * as THREE from "../../vendor/three.module.min.js";
import { GRID_SIZE, TILE_SIZE, catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { canPlace, entityCells } from "../core/simulation.js";
import { LivingGlobeAdapter } from "../world/livingGlobeAdapter.js";
import { openingCameraPose } from "../presentation/cameraFlight.js";
import {
  animatePerson, createDiscoveryModel, createEntranceModel, createEntityModel, createPathModel,
  createGuestSignalSprite, createLitterModel, createPersonModel, createStaffModel, modelFootprint,
  setGuestSignalSpriteType
} from "./models.js";
import { createWeatherEffects } from "./weatherEffects.js";
import { createParkAtmosphere } from "./parkAtmosphere.js";
import { deriveGuestSignalPlan } from "../presentation/guestSignals.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class WorldRenderer {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.state = null;
    this.mode = "manage";
    this.buildTool = null;
    this.removePathTool = false;
    this.buildRotation = 0;
    this.selectedEntityId = null;
    this.selectedVisitorId = null;
    this.selectedStaffId = null;
    this.hoverCell = null;
    this.entityModels = new Map();
    this.pathModels = new Map();
    this.visitorModels = new Map();
    this.staffModels = new Map();
    this.litterModels = new Map();
    this.discoveryModels = new Map();
    this.keys = {};
    this.pointer = { down: false, moved: false, built: false, button: 0, x: 0, y: 0, startX: 0, startY: 0 };
    this.lastDragBuildKey = null;
    this.gamepad = { connected: false, moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, zoom: 0, buttons: [] };
    this.qualityScale = 0.58;
    this.qualityProfile = "retro";
    this.manage = { x: 0, z: 8, yaw: -0.72, pitch: 0.64, distance: 46 };
    this.avatar = { x: 0, z: 27, yaw: Math.PI, pitch: 0, speed: 0 };
    this.ride = { entityId: null, startedAt: 0 };
    this.openingCamera = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x7194b5, 75, 245);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
    this.globe = new LivingGlobeAdapter(this.scene, { radius: 48 });
    this.weatherEffects = createWeatherEffects(this.globe);
    this.globe.root.add(this.weatherEffects.root);
    this.parkAtmosphere = createParkAtmosphere(this.globe);
    this.globe.root.add(this.parkAtmosphere.root);

    this.parkRoot = new THREE.Group();
    this.parkRoot.name = "park-presentation";
    this.globe.root.add(this.parkRoot);
    this.peopleRoot = new THREE.Group();
    this.globe.root.add(this.peopleRoot);
    this.avatarModel = createPersonModel("local", true);
    this.avatarModel.visible = false;
    this.globe.root.add(this.avatarModel);
    this.entranceModel = createEntranceModel();
    this.globe.placeObject(this.entranceModel, 15, 29, { altitude: 0.2 });
    this.globe.root.add(this.entranceModel);

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.ghostRoot = new THREE.Group();
    this.globe.root.add(this.ghostRoot);
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd86a, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthTest: false })
    );
    this.selectionRing.visible = false;
    this.selectionRing.renderOrder = 30;
    this.globe.root.add(this.selectionRing);

    this.clock = new THREE.Clock();
    this.bindEvents();
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  bindEvents() {
    addEventListener("resize", () => this.resize());
    addEventListener("keydown", (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      this.keys[event.code] = true;
      if (event.code === "KeyR" && this.buildTool) {
        this.buildRotation = (this.buildRotation + 1) % 4;
        this.callbacks.onBuildRotation?.(this.buildRotation);
        this.updateGhost();
      }
      if (event.code === "Escape") {
        if (this.mode === "ride") this.stopRideExperience();
        else if (this.buildTool || this.removePathTool) this.callbacks.onCancelBuild?.();
      }
      if (event.code === "Space" && this.mode === "walk") {
        event.preventDefault();
        this.interactNearby();
      }
    });
    addEventListener("keyup", (event) => { this.keys[event.code] = false; });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerdown", (event) => {
      this.canvas.setPointerCapture?.(event.pointerId);
      Object.assign(this.pointer, {
        down: true, moved: false, built: false, button: event.button,
        x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY
      });
      this.lastDragBuildKey = null;
      this.updatePointerRay(event.clientX, event.clientY);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      if (this.pointer.down && Math.abs(event.clientX - this.pointer.startX) + Math.abs(event.clientY - this.pointer.startY) > 6) {
        this.pointer.moved = true;
      }
      this.updatePointerRay(event.clientX, event.clientY);
      if (this.pointer.down) {
        if (this.mode === "manage") {
          const isPathDrag = this.pointer.button === 0 && this.buildTool
            && catalogDefinition(this.buildTool).kind === "path";
          if (isPathDrag) {
            this.buildHoveredPath();
          } else if (this.pointer.button === 2 || event.shiftKey) {
            this.manage.x -= dx * 0.055;
            this.manage.z -= dy * 0.055;
            this.clampManageTarget();
          } else {
            this.manage.yaw -= dx * 0.006;
            this.manage.pitch = clamp(this.manage.pitch + dy * 0.004, 0.22, 1.12);
          }
        } else if (this.mode === "walk") {
          this.avatar.yaw -= dx * 0.006;
          this.avatar.pitch = clamp(this.avatar.pitch + dy * 0.004, -0.3, 0.42);
        }
      }
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
    });
    this.canvas.addEventListener("pointerup", (event) => {
      if (!this.pointer.moved && !this.pointer.built && this.mode === "manage") this.handleClick(event.clientX, event.clientY);
      this.pointer.down = false;
      this.lastDragBuildKey = null;
    });
    this.canvas.addEventListener("wheel", (event) => {
      if (this.mode !== "manage") return;
      event.preventDefault();
      this.manage.distance = clamp(this.manage.distance + event.deltaY * 0.035, 15, 82);
    }, { passive: false });
  }

  resize() {
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.renderer.setSize(Math.max(320, Math.floor(width * this.qualityScale)), Math.max(180, Math.floor(height * this.qualityScale)), false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setQuality(profile) {
    this.qualityProfile = ["crisp", "retro", "tiny"].includes(profile) ? profile : "retro";
    this.qualityScale = profile === "crisp" ? 0.82 : profile === "tiny" ? 0.44 : 0.58;
    this.renderer.shadowMap.enabled = profile !== "tiny";
    this.weatherEffects.setQuality(profile);
    this.parkAtmosphere.setQuality(profile);
    this.resize();
  }

  startOpeningCamera(signal) {
    const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const durationMs = reducedMotion ? 1100 : Math.max(1800, Number(signal?.parameters?.durationMs) || 5600);
    this.openingCamera = {
      signalId: String(signal?.signal_id ?? "opening-camera"),
      startedAt: performance.now(),
      durationMs,
      reducedMotion
    };
    this.entranceModel.userData.resetOpening?.();
    return this.openingCamera;
  }

  finishOpeningCamera() {
    this.openingCamera = null;
    this.entranceModel.userData.finishOpening?.();
  }

  openingProgress(nowMs = performance.now()) {
    if (!this.openingCamera) return null;
    if (this.openingCamera.reducedMotion) return 1;
    return clamp((nowMs - this.openingCamera.startedAt) / this.openingCamera.durationMs, 0, 1);
  }

  getVisualHealth() {
    return Object.freeze({
      openingCameraActive: Boolean(this.openingCamera),
      ...this.weatherEffects.status(),
      ...this.parkAtmosphere.status()
    });
  }

  setState(state) {
    const changedAuthority = this.state !== state;
    this.state = state;
    if (changedAuthority) {
      for (const model of this.pathModels.values()) this.globe.root.remove(model);
      for (const model of this.entityModels.values()) this.globe.root.remove(model);
      for (const model of this.visitorModels.values()) this.peopleRoot.remove(model);
      for (const model of this.staffModels.values()) this.peopleRoot.remove(model);
      for (const model of this.litterModels.values()) this.globe.root.remove(model);
      for (const model of this.discoveryModels.values()) this.globe.root.remove(model);
      this.pathModels.clear();
      this.entityModels.clear();
      this.visitorModels.clear();
      this.staffModels.clear();
      this.litterModels.clear();
      this.discoveryModels.clear();
      this.selectedEntityId = null;
      this.selectedVisitorId = null;
      this.selectedStaffId = null;
      this.selectionRing.visible = false;
      this.clearGhost();
    }
    this.syncWorld();
  }

  setMode(mode) {
    if (!this.state || !["manage", "walk"].includes(mode)) return;
    this.mode = mode;
    this.avatarModel.visible = mode === "walk";
    if (mode === "walk") {
      const entrance = this.globe.gridToLocal(...this.state.world.entrance);
      this.avatar.x = entrance.x;
      this.avatar.z = entrance.z - TILE_SIZE * 0.3;
      this.avatar.yaw = Math.PI;
      this.avatar.pitch = 0;
    }
    this.buildTool = null;
    this.removePathTool = false;
    this.clearGhost();
    this.callbacks.onModeChanged?.(mode);
  }

  setBuildTool(catalogId, rotation = 0) {
    this.buildTool = catalogId;
    this.removePathTool = false;
    this.buildRotation = rotation;
    this.selectedEntityId = null;
    this.selectedStaffId = null;
    this.selectionRing.visible = false;
    this.updateGhost();
  }

  clearBuildTool() {
    this.buildTool = null;
    this.removePathTool = false;
    this.clearGhost();
  }

  setRemovePathTool(active = true) {
    this.removePathTool = Boolean(active);
    this.buildTool = null;
    this.selectedEntityId = null;
    this.selectedVisitorId = null;
    this.selectedStaffId = null;
    this.selectionRing.visible = false;
    this.updateGhost();
  }

  selectEntity(entityId) {
    this.selectedEntityId = entityId;
    this.selectedVisitorId = null;
    this.selectedStaffId = null;
    const entity = this.state?.world.entities.find((item) => item.id === entityId);
    if (!entity) {
      this.selectionRing.visible = false;
      return;
    }
    const [width, depth] = modelFootprint(entity);
    const frame = this.globe.frameAtGrid(entity.x, entity.z, width, depth, 0.28);
    const radius = Math.max(width, depth) * TILE_SIZE * 0.62;
    this.selectionRing.scale.setScalar(radius / 1.35);
    this.selectionRing.position.copy(frame.position);
    this.selectionRing.quaternion.copy(frame.quaternion);
    this.selectionRing.rotateX(-Math.PI / 2);
    this.selectionRing.visible = true;
  }

  selectVisitor(visitorId) {
    this.selectedEntityId = null;
    this.selectedVisitorId = visitorId;
    this.selectedStaffId = null;
    const model = this.visitorModels.get(visitorId);
    const local = model?.userData.localPosition;
    if (!local) {
      this.selectionRing.visible = false;
      return;
    }
    this.positionSelectionAtLocal(local.x, local.z, 0.82);
  }

  selectStaff(staffId) {
    this.selectedEntityId = null;
    this.selectedVisitorId = null;
    this.selectedStaffId = staffId;
    const local = this.staffModels.get(staffId)?.userData.localPosition;
    if (!local) {
      this.selectionRing.visible = false;
      return;
    }
    this.positionSelectionAtLocal(local.x, local.z, 0.9);
  }

  positionSelectionAtLocal(x, z, radius = 1) {
    const frame = this.globe.frameAtLocal(x, z, 0.3);
    this.selectionRing.scale.setScalar(radius / 1.35);
    this.selectionRing.position.copy(frame.position);
    this.selectionRing.quaternion.copy(frame.quaternion);
    this.selectionRing.rotateX(-Math.PI / 2);
    this.selectionRing.visible = true;
  }

  focusEntity(entityId) {
    const entity = this.state?.world.entities.find((item) => item.id === entityId);
    if (!entity) return false;
    const definition = catalogDefinition(entity.catalogId);
    const [width, depth] = rotatedFootprint(definition, entity.rotation);
    const local = this.globe.gridToLocal(entity.x, entity.z, width, depth);
    this.manage.x = local.x;
    this.manage.z = local.z;
    this.manage.distance = clamp(16 + Math.max(width, depth) * 2.6, 18, 38);
    if (this.mode !== "manage") this.setMode("manage");
    return true;
  }

  syncWorld() {
    if (!this.state) return;
    const livePathKeys = new Set();
    for (const path of this.state.world.paths) {
      const key = `${path.x},${path.z}`;
      livePathKeys.add(key);
      if (!this.pathModels.has(key)) {
        const model = createPathModel(path.type, path.x, path.z);
        this.globe.placeObject(model, path.x, path.z, { altitude: 0.16 });
        this.globe.root.add(model);
        this.pathModels.set(key, model);
      }
    }
    for (const [key, model] of this.pathModels) {
      if (!livePathKeys.has(key)) {
        this.globe.root.remove(model);
        this.pathModels.delete(key);
      }
    }

    const liveEntities = new Set();
    for (const entity of this.state.world.entities) {
      liveEntities.add(entity.id);
      if (!this.entityModels.has(entity.id)) {
        const model = createEntityModel(entity);
        const [width, depth] = rotatedFootprint(catalogDefinition(entity.catalogId), entity.rotation);
        this.globe.placeObject(model, entity.x, entity.z, { width, depth, altitude: 0.18, rotation: entity.rotation });
        this.globe.root.add(model);
        this.entityModels.set(entity.id, model);
      }
    }
    for (const [id, model] of this.entityModels) {
      if (!liveEntities.has(id)) {
        this.globe.root.remove(model);
        this.entityModels.delete(id);
      }
    }
    const liveDiscoveries = new Set();
    for (const stamp of this.state.adventure?.stamps ?? []) {
      if (stamp.found) continue;
      liveDiscoveries.add(stamp.id);
      if (!this.discoveryModels.has(stamp.id)) {
        const model = createDiscoveryModel(stamp.id);
        model.userData.discoveryId = stamp.id;
        this.globe.placeObject(model, stamp.x, stamp.z, { altitude: 0.28 });
        this.globe.root.add(model);
        this.discoveryModels.set(stamp.id, model);
      }
    }
    for (const [id, model] of this.discoveryModels) {
      if (!liveDiscoveries.has(id)) {
        this.globe.root.remove(model);
        this.discoveryModels.delete(id);
      }
    }
    if (this.selectedEntityId) this.selectEntity(this.selectedEntityId);
  }

  syncVisitors(time) {
    if (!this.state) return;
    const live = new Set();
    const signalByVisitor = new Map(deriveGuestSignalPlan(this.state.visitors, this.qualityProfile)
      .map((signal) => [signal.visitorId, signal]));
    for (const visitor of this.state.visitors.slice(0, 90)) {
      live.add(visitor.id);
      let model = this.visitorModels.get(visitor.id);
      if (!model) {
        model = createPersonModel(visitor.segment);
        model.traverse((child) => { child.userData.visitorId = visitor.id; });
        this.peopleRoot.add(model);
        this.visitorModels.set(visitor.id, model);
      }
      model.visible = visitor.state !== "riding";
      if (!model.visible) continue;
      let x;
      let z;
      let facingX = 0;
      let facingZ = 1;
      const activityEntity = ["queueing", "usingService", "resting"].includes(visitor.state)
        ? this.state.world.entities.find((entity) => entity.id === visitor.targetId)
        : null;
      let altitude = 0.24;
      if (activityEntity?.accessCell) {
        const access = this.globe.gridToLocal(activityEntity.accessCell[0], activityEntity.accessCell[1]);
        const definition = catalogDefinition(activityEntity.catalogId);
        const [width, depth] = rotatedFootprint(definition, activityEntity.rotation);
        const center = this.globe.gridToLocal(activityEntity.x, activityEntity.z, width, depth);
        const length = Math.hypot(access.x - center.x, access.z - center.z) || 1;
        const outwardX = (access.x - center.x) / length;
        const outwardZ = (access.z - center.z) / length;
        if (visitor.state === "resting" && definition.need === "rest") {
          const slot = Math.max(0, activityEntity.riders.indexOf(visitor.id));
          const side = (slot - (Math.max(1, activityEntity.riders.length) - 1) / 2) * 0.58;
          x = center.x - outwardX * 0.08 - outwardZ * side;
          z = center.z - outwardZ * 0.08 + outwardX * side;
          altitude = 0.29;
        } else if (visitor.state === "usingService" && definition.kind === "service") {
          const slot = Math.max(0, activityEntity.riders.indexOf(visitor.id));
          const row = Math.floor(slot / 4);
          const rowCount = Math.min(4, activityEntity.riders.length - row * 4);
          const side = (slot % 4 - (rowCount - 1) / 2) * 0.38;
          x = access.x - outwardX * (0.18 + row * 0.42) - outwardZ * side;
          z = access.z - outwardZ * (0.18 + row * 0.42) + outwardX * side;
        } else {
          const slot = Math.max(0, activityEntity.queue.indexOf(visitor.id));
          const row = Math.floor(slot / 2);
          const side = slot % 2 === 0 ? -0.27 : 0.27;
          x = access.x + outwardX * row * 0.58 - outwardZ * side;
          z = access.z + outwardZ * row * 0.58 + outwardX * side;
        }
        facingX = -outwardX;
        facingZ = -outwardZ;
      } else {
        const current = visitor.cell;
        const next = visitor.route?.[Math.min(visitor.routeIndex + 1, visitor.route.length - 1)] ?? current;
        const currentLocal = this.globe.gridToLocal(current[0], current[1]);
        const nextLocal = this.globe.gridToLocal(next[0], next[1]);
        const progress = clamp(visitor.routeProgress ?? 0, 0, 1);
        x = THREE.MathUtils.lerp(currentLocal.x, nextLocal.x, progress);
        z = THREE.MathUtils.lerp(currentLocal.z, nextLocal.z, progress);
        facingX = nextLocal.x - currentLocal.x;
        facingZ = nextLocal.z - currentLocal.z;
      }
      const frame = this.globe.frameAtLocal(x, z, altitude);
      model.position.copy(frame.position);
      model.quaternion.copy(frame.quaternion);
      if (Math.abs(facingX) + Math.abs(facingZ) > 0.01) model.rotateY(Math.atan2(facingX, facingZ));
      model.userData.localPosition = { x, z };
      animatePerson(
        model,
        time + Number(visitor.id.split("-")[1] ?? 0),
        visitor.state === "walking" || visitor.state === "leaving",
        visitor.state === "usingService",
        visitor.state === "resting" ? "resting" : "standing"
      );
      const signal = signalByVisitor.get(visitor.id) ?? null;
      let signalSprite = model.userData.guestSignalSprite;
      if (signal && !signalSprite) {
        signalSprite = createGuestSignalSprite(signal.type);
        model.add(signalSprite);
        model.userData.guestSignalSprite = signalSprite;
      }
      if (signalSprite) {
        signalSprite.visible = Boolean(signal);
        if (signal) {
          setGuestSignalSpriteType(signalSprite, signal.type);
          const pulse = 0.92 + Math.sin(time * 4.2 + Number(visitor.id.split("-")[1] ?? 0)) * 0.08;
          signalSprite.scale.set(0.86 * pulse, 0.86 * pulse, 1);
          signalSprite.position.y = 2.34 + Math.sin(time * 2.6 + signal.urgency * 3) * 0.08;
        }
      }
      if (visitor.id === this.selectedVisitorId) this.positionSelectionAtLocal(x, z, 0.82);
    }
    for (const [id, model] of this.visitorModels) {
      if (!live.has(id)) {
        this.peopleRoot.remove(model);
        this.visitorModels.delete(id);
        if (id === this.selectedVisitorId) {
          this.selectedVisitorId = null;
          this.selectionRing.visible = false;
          this.callbacks.onSelectVisitor?.(null);
        }
      }
    }
  }

  syncStaffAndLitter(time) {
    if (!this.state) return;
    const liveStaff = new Set();
    for (const agent of this.state.staffAgents ?? []) {
      liveStaff.add(agent.id);
      let model = this.staffModels.get(agent.id);
      if (!model) {
        model = createStaffModel(agent.role);
        model.traverse((child) => { child.userData.staffId = agent.id; });
        this.peopleRoot.add(model);
        this.staffModels.set(agent.id, model);
      }
      const current = agent.cell;
      const next = agent.route?.[Math.min(agent.routeIndex + 1, agent.route.length - 1)] ?? current;
      const currentLocal = this.globe.gridToLocal(current[0], current[1]);
      const nextLocal = this.globe.gridToLocal(next[0], next[1]);
      const progress = clamp(agent.routeProgress ?? 0, 0, 1);
      const x = THREE.MathUtils.lerp(currentLocal.x, nextLocal.x, progress);
      const z = THREE.MathUtils.lerp(currentLocal.z, nextLocal.z, progress);
      const frame = this.globe.frameAtLocal(x, z, 0.25);
      model.position.copy(frame.position);
      model.quaternion.copy(frame.quaternion);
      const facingX = nextLocal.x - currentLocal.x;
      const facingZ = nextLocal.z - currentLocal.z;
      if (Math.abs(facingX) + Math.abs(facingZ) > 0.01) model.rotateY(Math.atan2(facingX, facingZ));
      model.userData.localPosition = { x, z };
      animatePerson(model, time + Number(agent.id.split("-")[1] ?? 0), agent.state !== "idle");
      model.userData.updateWorkVisual?.(time, agent);
      if (agent.id === this.selectedStaffId) this.positionSelectionAtLocal(x, z, 0.9);
    }
    for (const [id, model] of this.staffModels) {
      if (!liveStaff.has(id)) {
        this.peopleRoot.remove(model);
        this.staffModels.delete(id);
        if (id === this.selectedStaffId) {
          this.selectedStaffId = null;
          this.selectionRing.visible = false;
          this.callbacks.onSelectStaff?.(null);
        }
      }
    }

    const liveLitter = new Set();
    for (const pile of this.state.world.litter ?? []) {
      liveLitter.add(pile.id);
      let model = this.litterModels.get(pile.id);
      if (!model) {
        model = createLitterModel();
        model.userData.litterId = pile.id;
        this.globe.placeObject(model, pile.cell[0], pile.cell[1], { altitude: 0.24 });
        this.globe.root.add(model);
        this.litterModels.set(pile.id, model);
      }
      delete model.userData.retiringAt;
      model.userData.updateVisual?.(time, pile.amount);
    }
    for (const [id, model] of this.litterModels) {
      if (!liveLitter.has(id)) {
        if (model.userData.retiringAt === undefined) {
          model.userData.retiringAt = time;
          model.userData.retireScale = model.userData.liveScale ?? model.scale.x ?? 1;
        }
        const progress = clamp((time - model.userData.retiringAt) / 0.46, 0, 1);
        model.scale.setScalar(model.userData.retireScale * (1 - progress));
        model.rotation.y += 0.08;
        if (progress >= 1) {
          this.globe.root.remove(model);
          this.litterModels.delete(id);
        }
      }
    }
  }

  updatePointerRay(clientX, clientY) {
    if (!this.state || this.mode !== "manage") return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.raycaster.intersectObjects(this.globe.surfaceObjects, false)[0];
    if (!hit) {
      this.hoverCell = null;
      this.clearGhost();
      return;
    }
    const cell = this.globe.worldToGrid(hit.point);
    if (cell.x < 0 || cell.z < 0 || cell.x >= GRID_SIZE || cell.z >= GRID_SIZE) {
      this.hoverCell = null;
      this.clearGhost();
      return;
    }
    this.hoverCell = cell;
    this.updateGhost();
  }

  handleClick(clientX, clientY) {
    if (!this.state) return;
    if (this.removePathTool && this.hoverCell) {
      this.callbacks.onRemovePath?.({ ...this.hoverCell });
      return;
    }
    if (this.buildTool && this.hoverCell) {
      this.callbacks.onBuild?.({ ...this.hoverCell, catalogId: this.buildTool, rotation: this.buildRotation });
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const models = [...this.entityModels.values(), ...this.visitorModels.values(), ...this.staffModels.values()];
    const hit = this.raycaster.intersectObjects(models, true)[0];
    if (hit?.object?.userData?.visitorId) {
      this.selectVisitor(hit.object.userData.visitorId);
      this.callbacks.onSelectVisitor?.(hit.object.userData.visitorId);
    } else if (hit?.object?.userData?.staffId) {
      this.selectStaff(hit.object.userData.staffId);
      this.callbacks.onSelectStaff?.(hit.object.userData.staffId);
    } else if (hit?.object?.userData?.entityId) {
      this.selectEntity(hit.object.userData.entityId);
      this.callbacks.onSelectEntity?.(hit.object.userData.entityId);
    } else {
      this.selectEntity(null);
      this.selectedVisitorId = null;
      this.selectedStaffId = null;
      this.callbacks.onSelectEntity?.(null);
      this.callbacks.onSelectVisitor?.(null);
      this.callbacks.onSelectStaff?.(null);
    }
  }

  buildHoveredPath() {
    if (!this.hoverCell || !this.buildTool || catalogDefinition(this.buildTool).kind !== "path") return;
    const key = `${this.buildTool}:${this.hoverCell.x},${this.hoverCell.z}`;
    if (key === this.lastDragBuildKey) return;
    this.lastDragBuildKey = key;
    this.pointer.built = true;
    this.callbacks.onBuild?.({ ...this.hoverCell, catalogId: this.buildTool, rotation: this.buildRotation, dragging: true });
  }

  clearGhost() {
    while (this.ghostRoot.children.length) {
      const child = this.ghostRoot.children[0];
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((item) => item.dispose?.());
      else child.material?.dispose?.();
      this.ghostRoot.remove(child);
    }
  }

  updateGhost() {
    this.clearGhost();
    if (!this.state || !this.hoverCell) return;
    if (this.removePathTool) {
      const path = this.state.world.paths.find((item) => item.x === this.hoverCell.x && item.z === this.hoverCell.z);
      const material = new THREE.MeshBasicMaterial({
        color: path ? 0xff8a70 : 0x7b6570,
        transparent: true,
        opacity: 0.55,
        depthTest: false
      });
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 0.92, TILE_SIZE * 0.92), material);
      const frame = this.globe.frameAtGrid(this.hoverCell.x, this.hoverCell.z, 1, 1, 0.34);
      tile.position.copy(frame.position);
      tile.quaternion.copy(frame.quaternion);
      tile.rotateX(-Math.PI / 2);
      tile.renderOrder = 20;
      this.ghostRoot.add(tile);
      this.callbacks.onHoverRemove?.({ cell: this.hoverCell, path });
      return;
    }
    if (!this.buildTool) return;
    const definition = catalogDefinition(this.buildTool);
    const [width, depth] = rotatedFootprint(definition, this.buildRotation);
    const check = canPlace(this.state, this.buildTool, this.hoverCell.x, this.hoverCell.z, this.buildRotation);
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: check.ok ? 0x78e08f : 0xe56a72,
      transparent: true,
      opacity: 0.48,
      depthTest: false
    });
    for (let dx = 0; dx < width; dx += 1) {
      for (let dz = 0; dz < depth; dz += 1) {
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 0.92, TILE_SIZE * 0.92), ghostMaterial);
        const frame = this.globe.frameAtGrid(this.hoverCell.x + dx, this.hoverCell.z + dz, 1, 1, 0.34);
        tile.position.copy(frame.position);
        tile.quaternion.copy(frame.quaternion);
        tile.rotateX(-Math.PI / 2);
        tile.renderOrder = 20;
        this.ghostRoot.add(tile);
      }
    }
    this.callbacks.onHoverBuild?.({ check, definition, cell: this.hoverCell, rotation: this.buildRotation });
  }

  clampManageTarget() {
    const extent = GRID_SIZE * TILE_SIZE * 0.44;
    this.manage.x = clamp(this.manage.x, -extent, extent);
    this.manage.z = clamp(this.manage.z, -extent, extent);
  }

  updateManageInput(dt) {
    const speed = 15 * dt * Math.max(0.55, this.manage.distance / 40);
    if (this.keys.KeyW || this.keys.ArrowUp) this.manage.z -= speed;
    if (this.keys.KeyS || this.keys.ArrowDown) this.manage.z += speed;
    if (this.keys.KeyA || this.keys.ArrowLeft) this.manage.x -= speed;
    if (this.keys.KeyD || this.keys.ArrowRight) this.manage.x += speed;
    this.manage.x += this.gamepad.moveX * speed;
    this.manage.z -= this.gamepad.moveY * speed;
    if (this.keys.KeyQ) this.manage.yaw += dt * 0.9;
    if (this.keys.KeyE) this.manage.yaw -= dt * 0.9;
    this.manage.yaw -= this.gamepad.lookX * dt * 1.7;
    this.manage.pitch = clamp(this.manage.pitch + this.gamepad.lookY * dt * 1.25, 0.22, 1.12);
    this.manage.distance = clamp(this.manage.distance + this.gamepad.zoom * dt * 22, 15, 82);
    this.clampManageTarget();
  }

  isAvatarBlocked(nextX, nextZ) {
    if (!this.state) return false;
    const cell = this.globe.localToGrid(nextX, nextZ);
    if (cell.x < 0 || cell.z < 0 || cell.x >= GRID_SIZE || cell.z >= GRID_SIZE) return true;
    return this.state.world.entities.some((entity) => entityCells(entity).some(([x, z]) => x === cell.x && z === cell.z));
  }

  updateWalkInput(dt) {
    const forwardInput = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) + this.gamepad.moveY;
    const strafeInput = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0) + this.gamepad.moveX;
    if (this.keys.KeyQ || this.keys.ArrowLeft) this.avatar.yaw += dt * 1.5;
    if (this.keys.KeyE || this.keys.ArrowRight) this.avatar.yaw -= dt * 1.5;
    this.avatar.yaw -= this.gamepad.lookX * dt * 2.2;
    this.avatar.pitch = clamp(this.avatar.pitch + this.gamepad.lookY * dt * 1.25, -0.3, 0.42);
    const rawMagnitude = Math.hypot(forwardInput, strafeInput);
    const magnitude = Math.min(1, rawMagnitude);
    const run = this.keys.ShiftLeft || this.keys.ShiftRight || this.gamepad.run;
    const targetSpeed = magnitude ? (run ? 8.2 : 5.1) : 0;
    this.avatar.speed += (targetSpeed - this.avatar.speed) * Math.min(1, dt * 8);
    if (magnitude) {
      const normalizedForward = forwardInput / rawMagnitude;
      const normalizedStrafe = strafeInput / rawMagnitude;
      const forwardX = Math.sin(this.avatar.yaw);
      const forwardZ = Math.cos(this.avatar.yaw);
      const rightX = Math.cos(this.avatar.yaw);
      const rightZ = -Math.sin(this.avatar.yaw);
      const nextX = this.avatar.x + (forwardX * normalizedForward + rightX * normalizedStrafe) * this.avatar.speed * dt;
      const nextZ = this.avatar.z + (forwardZ * normalizedForward + rightZ * normalizedStrafe) * this.avatar.speed * dt;
      if (!this.isAvatarBlocked(nextX, this.avatar.z)) this.avatar.x = nextX;
      if (!this.isAvatarBlocked(this.avatar.x, nextZ)) this.avatar.z = nextZ;
    }
    const frame = this.globe.frameAtLocal(this.avatar.x, this.avatar.z, 0.26);
    this.avatarModel.position.copy(frame.position);
    this.avatarModel.quaternion.copy(frame.quaternion);
    this.avatarModel.rotateY(this.avatar.yaw);
    animatePerson(this.avatarModel, performance.now() / 1000, magnitude > 0);
  }

  updateCamera(nowMs = performance.now()) {
    if (this.openingCamera) {
      const progress = this.openingProgress(nowMs);
      const pose = openingCameraPose(progress, this.manage);
      const frame = this.globe.frameAtLocal(pose.x, pose.z, 0.4);
      const horizontal = frame.xAxis.clone().multiplyScalar(Math.sin(pose.yaw))
        .add(frame.zAxis.clone().multiplyScalar(Math.cos(pose.yaw))).normalize();
      const height = Math.sin(pose.pitch) * pose.distance;
      const reach = Math.cos(pose.pitch) * pose.distance;
      this.camera.position.copy(frame.position)
        .add(frame.normal.clone().multiplyScalar(height))
        .add(horizontal.multiplyScalar(reach));
      this.camera.up.copy(frame.normal);
      this.camera.lookAt(frame.position);
      return;
    }
    if (this.mode === "manage") {
      const frame = this.globe.frameAtLocal(this.manage.x, this.manage.z, 0.4);
      const horizontal = frame.xAxis.clone().multiplyScalar(Math.sin(this.manage.yaw))
        .add(frame.zAxis.clone().multiplyScalar(Math.cos(this.manage.yaw))).normalize();
      const height = Math.sin(this.manage.pitch) * this.manage.distance;
      const reach = Math.cos(this.manage.pitch) * this.manage.distance;
      this.camera.position.copy(frame.position)
        .add(frame.normal.clone().multiplyScalar(height))
        .add(horizontal.multiplyScalar(reach));
      this.camera.up.copy(frame.normal);
      this.camera.lookAt(frame.position);
      return;
    }
    if (this.mode === "walk") {
      const frame = this.globe.frameAtLocal(this.avatar.x, this.avatar.z, 0.3);
      const forward = frame.xAxis.clone().multiplyScalar(Math.sin(this.avatar.yaw))
        .add(frame.zAxis.clone().multiplyScalar(Math.cos(this.avatar.yaw))).normalize();
      this.camera.position.copy(frame.position)
        .add(frame.normal.clone().multiplyScalar(3.0 + this.avatar.pitch * 1.4))
        .add(forward.clone().multiplyScalar(-5.4));
      this.camera.up.copy(frame.normal);
      this.camera.lookAt(frame.position.clone()
        .add(frame.normal.clone().multiplyScalar(1.7 + this.avatar.pitch * 3.4))
        .add(forward.multiplyScalar(2.3)));
      return;
    }
    const model = this.entityModels.get(this.ride.entityId);
    const anchor = model?.userData.rideAnchor;
    if (!anchor) {
      this.stopRideExperience();
      return;
    }
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    anchor.getWorldPosition(position);
    anchor.getWorldQuaternion(quaternion);
    this.camera.position.copy(position);
    this.camera.quaternion.copy(quaternion);
  }

  interactNearby() {
    if (!this.state) return;
    let nearestStamp = null;
    let nearestStampDistance = Infinity;
    for (const stamp of this.state.adventure?.stamps?.filter((item) => !item.found) ?? []) {
      const local = this.globe.gridToLocal(stamp.x, stamp.z);
      const distance = Math.hypot(local.x - this.avatar.x, local.z - this.avatar.z);
      if (distance < nearestStampDistance) {
        nearestStamp = stamp;
        nearestStampDistance = distance;
      }
    }
    if (nearestStamp && nearestStampDistance <= 3.4) {
      this.callbacks.onCollectDiscovery?.(nearestStamp.id);
      return;
    }
    let nearestStaff = null;
    let nearestStaffDistance = Infinity;
    for (const agent of this.state.staffAgents ?? []) {
      const local = this.globe.gridToLocal(agent.cell[0], agent.cell[1]);
      const distance = Math.hypot(local.x - this.avatar.x, local.z - this.avatar.z);
      if (distance < nearestStaffDistance) {
        nearestStaff = agent;
        nearestStaffDistance = distance;
      }
    }
    if (nearestStaff && nearestStaffDistance <= 3.2) {
      this.selectStaff(nearestStaff.id);
      this.callbacks.onSelectStaff?.(nearestStaff.id);
      return;
    }
    let nearest = null;
    let nearestDistance = Infinity;
    for (const entity of this.state.world.entities) {
      const definition = catalogDefinition(entity.catalogId);
      const [width, depth] = rotatedFootprint(definition, entity.rotation);
      const local = this.globe.gridToLocal(entity.x, entity.z, width, depth);
      const distance = Math.hypot(local.x - this.avatar.x, local.z - this.avatar.z);
      if (distance < nearestDistance) {
        nearest = entity;
        nearestDistance = distance;
      }
    }
    if (!nearest || nearestDistance > 7) {
      this.callbacks.onWorldMessage?.("Walk closer to a ride or service to inspect it.");
      return;
    }
    this.selectEntity(nearest.id);
    this.callbacks.onSelectEntity?.(nearest.id);
    this.callbacks.onInspectFromWorld?.(nearest.id);
  }

  startRideExperience(entityId) {
    const model = this.entityModels.get(entityId);
    if (!model?.userData.rideAnchor) return false;
    this.ride = { entityId, startedAt: performance.now() };
    this.mode = "ride";
    this.avatarModel.visible = false;
    this.callbacks.onModeChanged?.("ride");
    return true;
  }

  stopRideExperience() {
    this.mode = "walk";
    this.ride = { entityId: null, startedAt: 0 };
    this.avatarModel.visible = true;
    this.callbacks.onModeChanged?.("walk");
  }

  setVirtualControl(code, active) {
    this.keys[code] = active;
  }

  pollGamepad() {
    const pad = typeof navigator !== "undefined"
      ? Array.from(navigator.getGamepads?.() ?? []).find(Boolean)
      : null;
    const connected = Boolean(pad);
    if (connected !== this.gamepad.connected) {
      this.gamepad.connected = connected;
      this.callbacks.onControllerChanged?.(connected);
    }
    if (!pad) {
      Object.assign(this.gamepad, { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, zoom: 0, buttons: [] });
      return;
    }
    const deadzone = (value) => Math.abs(value ?? 0) < 0.16 ? 0 : value;
    const buttons = pad.buttons.map((button) => button.pressed);
    const justPressed = (index) => buttons[index] && !this.gamepad.buttons[index];
    this.gamepad.moveX = deadzone(pad.axes[0]);
    this.gamepad.moveY = -deadzone(pad.axes[1]);
    this.gamepad.lookX = deadzone(pad.axes[2]);
    this.gamepad.lookY = deadzone(pad.axes[3]);
    this.gamepad.run = buttons[6] || buttons[10];
    this.gamepad.zoom = (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0);
    if (justPressed(0) && this.mode === "walk") this.interactNearby();
    if (justPressed(1)) {
      if (this.mode === "ride") this.stopRideExperience();
      else if (this.buildTool || this.removePathTool) this.callbacks.onCancelBuild?.();
    }
    if (justPressed(3) && this.mode !== "ride") this.callbacks.onToggleMode?.();
    this.gamepad.buttons = buttons;
  }

  frame() {
    if (!this.state) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    const time = now / 1000;
    this.pollGamepad();
    if (!this.openingCamera) {
      if (this.mode === "manage") this.updateManageInput(dt);
      else if (this.mode === "walk") this.updateWalkInput(dt);
    }
    this.syncVisitors(time);
    this.syncStaffAndLitter(time);
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      model?.userData.updateVisual?.(time, entity);
    }
    for (const model of this.discoveryModels.values()) model.userData.updateVisual?.(time);
    for (const model of this.pathModels.values()) model.userData.updateVisual?.(time);
    const openingPose = this.openingCamera
      ? openingCameraPose(this.openingProgress(now), this.manage)
      : null;
    this.entranceModel.userData.updateVisual?.(time, this.state.park, openingPose?.gateProgress ?? null);
    this.weatherEffects.update(time, this.state.weather);
    this.parkAtmosphere.update(time, this.state);
    this.globe.updateDayNight(this.state.clock.minute, this.state.weather);
    this.updateCamera(now);
    this.renderer.render(this.scene, this.camera);
  }
}
