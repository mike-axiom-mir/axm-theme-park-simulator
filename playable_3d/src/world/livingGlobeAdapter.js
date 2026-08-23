import * as THREE from "../../vendor/three.module.min.js";
import { GRID_SIZE, TILE_SIZE } from "../core/catalog.js";
import { hashString } from "../core/random.js";

/*
 * Traced adapter, not a silent copy.
 * Source world: AXM Living Globe / Grafthold Globe
 * Repository: mike-axiom-mir/axm-collaboration-platform
 * Commit: a4f99fbfc05268173458bf3fb8f3fe616919e376
 * Source: worlds/living-globe/index.html
 * Reused concepts: spherical tangent frame, faceted seeded surface,
 * orbiting sun/moon, true terminator, seeded star field.
 *
 * Ownership boundary: the planet remains a world substrate. This adapter owns
 * no park simulation state and exposes transforms/light only. Theme-park state
 * is an attached ruleset and cannot silently replace Living Globe state.
 */

export const LIVING_GLOBE_SOURCE = Object.freeze({
  schema: "axm.theme-park.world-adapter/v1",
  sourceWorldId: "world.grafthold.globe",
  sourceCommit: "a4f99fbfc05268173458bf3fb8f3fe616919e376",
  sourcePath: "worlds/living-globe/index.html",
  stateOwner: "living-world",
  parkOwnsWorld: false,
  adapterOwnsSimulation: false
});

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function seededRandom(seed) {
  let value = (hashString(seed) || 1) % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

export class LivingGlobeAdapter {
  constructor(scene, { seed = "AXM-LIVING-GLOBE-PARK", radius = 48 } = {}) {
    this.scene = scene;
    this.seed = seed;
    this.radius = radius;
    this.root = new THREE.Group();
    this.root.name = "living-globe-map-substrate";
    this.scene.add(this.root);
    this.surfaceObjects = [];
    this.buildPlanet();
    this.buildParkCap();
    this.buildSky();
    this.buildLights();
  }

  localToNormal(localX, localZ) {
    const distance = Math.hypot(localX, localZ);
    if (distance < 1e-7) return new THREE.Vector3(0, 1, 0);
    const angle = distance / this.radius;
    const horizontal = Math.sin(angle);
    return new THREE.Vector3(
      horizontal * localX / distance,
      Math.cos(angle),
      horizontal * localZ / distance
    ).normalize();
  }

  normalToLocal(normal) {
    const n = normal.clone().normalize();
    const horizontal = Math.hypot(n.x, n.z);
    if (horizontal < 1e-7) return { x: 0, z: 0 };
    const distance = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) * this.radius;
    return { x: n.x / horizontal * distance, z: n.z / horizontal * distance };
  }

  gridToLocal(x, z, width = 1, depth = 1) {
    return {
      x: (x + width / 2 - GRID_SIZE / 2) * TILE_SIZE,
      z: (z + depth / 2 - GRID_SIZE / 2) * TILE_SIZE
    };
  }

  localToGrid(localX, localZ) {
    return {
      x: Math.floor(localX / TILE_SIZE + GRID_SIZE / 2),
      z: Math.floor(localZ / TILE_SIZE + GRID_SIZE / 2)
    };
  }

  worldToGrid(worldPoint) {
    const localPoint = this.root.worldToLocal(worldPoint.clone());
    const local = this.normalToLocal(localPoint.normalize());
    return this.localToGrid(local.x, local.z);
  }

  frameAtLocal(localX, localZ, altitude = 0) {
    const normal = this.localToNormal(localX, localZ);
    const epsilon = 0.02;
    const xAhead = this.localToNormal(localX + epsilon, localZ).multiplyScalar(this.radius);
    const xBehind = this.localToNormal(localX - epsilon, localZ).multiplyScalar(this.radius);
    const xAxis = xAhead.sub(xBehind).normalize();
    let zAxis = xAxis.clone().cross(normal).normalize();
    const expectedZ = this.localToNormal(localX, localZ + epsilon)
      .sub(this.localToNormal(localX, localZ - epsilon)).normalize();
    if (zAxis.dot(expectedZ) < 0) zAxis.negate();
    const basis = new THREE.Matrix4().makeBasis(xAxis, normal, zAxis);
    return {
      normal,
      xAxis,
      zAxis,
      position: normal.clone().multiplyScalar(this.radius + altitude),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(basis)
    };
  }

  frameAtGrid(x, z, width = 1, depth = 1, altitude = 0) {
    const local = this.gridToLocal(x, z, width, depth);
    return { ...this.frameAtLocal(local.x, local.z, altitude), local };
  }

  placeObject(object, x, z, { width = 1, depth = 1, altitude = 0, rotation = 0 } = {}) {
    const frame = this.frameAtGrid(x, z, width, depth, altitude);
    object.position.copy(frame.position);
    object.quaternion.copy(frame.quaternion);
    object.rotateY(-rotation * Math.PI / 2);
    object.userData.globeFrame = frame;
    return frame;
  }

  buildPlanet() {
    const random = seededRandom(`${this.seed}:surface`);
    const geometry = new THREE.IcosahedronGeometry(this.radius, 5);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    const phase = [random() * 8, random() * 8, random() * 8];
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index) / this.radius;
      const y = position.getY(index) / this.radius;
      const z = position.getZ(index) / this.radius;
      const noise = Math.sin(x * 3.1 + phase[0]) * Math.cos(y * 2.7 + phase[1])
        * Math.sin(z * 3.7 + phase[2]) + 0.42 * Math.sin((x + z) * 8.2);
      const latitude = Math.abs(y);
      if (noise < -0.42) color.setHSL(0.57, 0.48, 0.2 + latitude * 0.05);
      else if (noise < -0.18) color.setHSL(0.48, 0.35, 0.26);
      else color.setHSL(0.27 + noise * 0.025, 0.38, 0.22 + noise * 0.035);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true
    });
    this.planet = new THREE.Mesh(geometry, material);
    this.planet.name = "living-globe-surface";
    this.planet.receiveShadow = true;
    this.root.add(this.planet);
    this.surfaceObjects.push(this.planet);
  }

  buildParkCap() {
    const geometry = new THREE.BoxGeometry(TILE_SIZE * 0.94, 0.12, TILE_SIZE * 0.94);
    const material = new THREE.MeshStandardMaterial({
      color: 0x567a43,
      roughness: 1,
      flatShading: true
    });
    this.parkTiles = new THREE.InstancedMesh(geometry, material, GRID_SIZE * GRID_SIZE);
    this.parkTiles.name = "theme-park-build-cap";
    this.parkTiles.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    let index = 0;
    for (let z = 0; z < GRID_SIZE; z += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const frame = this.frameAtGrid(x, z, 1, 1, 0.04);
        matrix.compose(frame.position, frame.quaternion, scale);
        this.parkTiles.setMatrixAt(index++, matrix);
      }
    }
    this.parkTiles.instanceMatrix.needsUpdate = true;
    this.root.add(this.parkTiles);
    this.surfaceObjects.push(this.parkTiles);
  }

  buildSky() {
    const random = seededRandom(`${this.seed}:stars`);
    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const azimuth = random() * Math.PI * 2;
      const elevation = Math.asin(random() * 2 - 1);
      const distance = 430;
      positions[index * 3] = Math.cos(azimuth) * Math.cos(elevation) * distance;
      positions[index * 3 + 1] = Math.sin(elevation) * distance;
      positions[index * 3 + 2] = Math.sin(azimuth) * Math.cos(elevation) * distance;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xcfe4ff,
      size: 1.65,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0
    });
    this.stars = new THREE.Points(geometry, material);
    this.root.add(this.stars);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbcd3e8, 0x20361f, 0.45);
    this.sun = new THREE.DirectionalLight(0xffd9a0, 1.1);
    this.moon = new THREE.DirectionalLight(0x7d9ac9, 0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.left = -50;
    this.sun.shadow.camera.right = 50;
    this.sun.shadow.camera.top = 50;
    this.sun.shadow.camera.bottom = -50;
    this.root.add(this.hemi, this.sun, this.sun.target, this.moon, this.moon.target);
  }

  updateDayNight(minute, weather = { type: "bright" }) {
    const phase = (minute % 1440) / 1440;
    const angle = (phase - 0.25) * Math.PI * 2;
    const sunDirection = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.24).normalize();
    this.sun.position.copy(sunDirection).multiplyScalar(130);
    this.sun.target.position.set(0, 0, 0);
    this.moon.position.copy(sunDirection).multiplyScalar(-130);
    this.moon.target.position.set(0, 0, 0);
    const daylight = THREE.MathUtils.smoothstep(Math.sin(angle), -0.12, 0.3);
    const dawn = 1 - Math.abs(Math.sin(angle));
    this.sun.intensity = daylight * (weather.type === "rain" ? 0.62 : weather.type === "cloudy" ? 0.78 : 1.18);
    this.moon.intensity = (1 - daylight) * 0.18;
    this.hemi.intensity = 0.12 + daylight * 0.42;
    this.sun.color.set(0xffd7a0).lerp(new THREE.Color(0xfff1dc), daylight).lerp(new THREE.Color(0xffad72), dawn * 0.12);
    this.stars.material.opacity = THREE.MathUtils.clamp((1 - daylight) * 1.15, 0, 1);
    const night = new THREE.Color(0x050711);
    const dawnSky = new THREE.Color(0x4a2638);
    const daySky = new THREE.Color(weather.type === "rain" ? 0x596777 : 0x7194b5);
    const sky = night.clone().lerp(dawnSky, THREE.MathUtils.clamp(daylight * 2.5, 0, 1))
      .lerp(daySky, daylight);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(sky);
    else this.scene.background = sky.clone();
    this.scene.fog?.color.copy(sky);
    return { phase, daylight, sunDirection, sky };
  }
}
