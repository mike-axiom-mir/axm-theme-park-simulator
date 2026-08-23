import * as THREE from "../../vendor/three.module.min.js";
import { TILE_SIZE, catalogDefinition } from "../core/catalog.js";
import { deriveRideMotion, deriveServiceMotion } from "../presentation/parkMotion.js";

const materialCache = new Map();
const geometryCache = new Map();

function material(color, options = {}) {
  const key = `${color}-${options.emissive ?? 0}-${options.opacity ?? 1}-${options.roughness ?? 0.84}-${options.metalness ?? 0.03}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: options.roughness ?? 0.84,
      metalness: options.metalness ?? 0.03,
      transparent: (options.opacity ?? 1) < 1,
      opacity: options.opacity ?? 1,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0
    }));
  }
  return materialCache.get(key);
}

function box(w, h, d, color, y = h / 2) {
  const key = `box-${w}-${h}-${d}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  const mesh = new THREE.Mesh(geometryCache.get(key), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(rt, rb, h, sides, color, y = h / 2) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sphere(radius, color, y = 0) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

function cone(radius, height, sides, color, y = height / 2) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, sides), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

function base(group, definition, color = 0x4f565b) {
  const [w, d] = definition.footprint;
  group.add(box(w * TILE_SIZE * 0.92, 0.2, d * TILE_SIZE * 0.92, color, 0.1));
}

function passenger(parent, x, y, z, color = 0x68c2cc) {
  const p = new THREE.Group();
  p.name = "animated-ride-passenger";
  p.position.set(x, y, z);
  p.userData.baseY = y;
  p.add(box(0.23, 0.32, 0.2, color, 0.16));
  p.add(sphere(0.13, 0xd8ac85, 0.43));
  p.visible = false;
  parent.add(p);
  return p;
}

function showPassengers(items, motion, time) {
  items.forEach((item, index) => {
    item.visible = motion.active && index < motion.riderCount;
    item.position.y = item.userData.baseY + Math.sin(time * 4.5 + index * 0.7) * 0.025 * motion.boardingPulse;
  });
}

function setRideAnchor(group, parent, x = 0, y = 1.2, z = 0) {
  const anchor = new THREE.Object3D();
  anchor.position.set(x, y, z);
  parent.add(anchor);
  group.userData.rideAnchor = anchor;
}

function frontage(group, definition) {
  const root = new THREE.Group();
  root.position.z = definition.footprint[1] * TILE_SIZE * 0.43;
  const left = box(0.08, 1.55, 0.08, 0x4b5158, 0.78);
  left.position.x = -0.9;
  const right = left.clone(); right.position.x = 0.9;
  const sign = box(2.05, 0.4, 0.12, definition.color, 1.38);
  const glow = sphere(0.1, 0xffd467, 1.38);
  glow.position.z = 0.12;
  glow.material = material(0x5b481e, { emissive: 0xffd467, emissiveIntensity: 1.4 });
  root.add(left, right, sign, glow);
  group.add(root);
  return (time, live) => {
    const open = Boolean(live.open);
    glow.visible = open;
    glow.scale.setScalar(0.82 + Math.sin(time * 4.8) * 0.18);
    sign.scale.y = open ? 0.94 + Math.sin(time * 2.3) * 0.06 : 0.78;
  };
}

function createCups(entity, definition) {
  const group = new THREE.Group(); base(group, definition, 0x6d5a62);
  const rotor = new THREE.Group(); rotor.position.y = 0.24; group.add(rotor);
  rotor.add(cylinder(2.25, 2.25, 0.24, 18, 0xd8b66e, 0.12));
  const cups = [];
  const riders = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = i / 6 * Math.PI * 2;
    const cup = new THREE.Group(); cup.position.set(Math.cos(angle) * 1.55, 0.2, Math.sin(angle) * 1.55);
    cup.add(cylinder(0.52, 0.66, 0.6, 10, i % 2 ? 0xe8a5c5 : 0x8ccbd3, 0.3));
    riders.push(passenger(cup, 0, 0.62, 0, i % 2 ? 0xf1b85b : 0x7dc3a1));
    riders.push(passenger(cup, 0.18, 0.62, 0.1, 0xe57878));
    rotor.add(cup); cups.push(cup);
  }
  setRideAnchor(group, cups[0], 0, 0.85, 0);
  const front = frontage(group, definition);
  let phase = 0, last = null;
  group.userData.updateVisual = (time, live) => {
    const m = deriveRideMotion(live, time); const dt = last === null ? 0 : Math.min(0.1, time - last); last = time;
    phase += dt * m.speed * 1.8; rotor.rotation.y = phase;
    cups.forEach((cup, i) => { cup.rotation.y = -phase * 1.7 + i; });
    showPassengers(riders, m, time); front(time, live);
  };
  return group;
}

function createBumpers(entity, definition) {
  const group = new THREE.Group(); base(group, definition, 0x535a61);
  const roof = box(7.1, 0.18, 7.1, 0x31404d, 4.2); roof.material = material(0x31404d, { opacity: 0.5 }); group.add(roof);
  for (const [x, z] of [[-3,-3],[3,-3],[-3,3],[3,3]]) { const p = cylinder(0.08,0.1,4.1,6,0x59646c,2.05); p.position.set(x,2.05,z); group.add(p); }
  const cars = [], riders = [];
  for (let i=0;i<12;i+=1) {
    const car = new THREE.Group(); car.userData.home = { x: -2.4 + (i%4)*1.6, z: -2 + Math.floor(i/4)*2 };
    car.add(box(0.9,0.28,0.7,[0xe86d77,0x65bed1,0xf0c766,0x75d5ad][i%4],0.2));
    riders.push(passenger(car,0,0.5,0)); group.add(car); cars.push(car);
  }
  setRideAnchor(group, cars[0], 0, 0.75, 0); const front = frontage(group, definition);
  group.userData.updateVisual = (time, live) => {
    const m = deriveRideMotion(live,time);
    cars.forEach((car,i)=>{ const h=car.userData.home; const active=m.active?1:0.08; car.position.set(h.x+Math.sin(time*(0.7+i*0.03)+i)*0.55*active,0,h.z+Math.cos(time*(0.8+i*0.02)+i*1.7)*0.55*active); car.rotation.y=time*(0.25+i*0.015)*active+i; });
    showPassengers(riders,m,time); front(time,live);
  };
  return group;
}

function createTower(entity, definition, mode) {
  const group = new THREE.Group(); base(group, definition, 0x4f565e);
  const height = mode === "dropTower" ? 9 : mode === "observation" ? 7.5 : 5.8;
  group.add(cylinder(0.18,0.28,height,8,0x68747d,height/2));
  const carriage = new THREE.Group(); carriage.add(cylinder(1.05,1.05,0.45,12,definition.color,0.22)); group.add(carriage);
  const riders=[]; for(let i=0;i<Math.min(12,definition.capacity);i++){ const a=i/Math.min(12,definition.capacity)*Math.PI*2; riders.push(passenger(carriage,Math.cos(a)*0.72,0.55,Math.sin(a)*0.72)); }
  setRideAnchor(group,carriage,0,0.8,0); const front=frontage(group,definition);
  group.userData.updateVisual=(time,live)=>{ const m=deriveRideMotion(live,time); let y=1;
    if(mode==="dropTower") y=m.active ? 1.1 + Math.abs(Math.sin(time*1.15))*6.7 : 1.1;
    else if(mode==="observation") y=m.active ? 1.2 + (Math.sin(time*0.55)*0.5+0.5)*5.6 : 1.2;
    else y=m.active ? 1.1 + (Math.sin(time*2.3)*0.5+0.5)*3.2 : 1.1;
    carriage.position.y=y; carriage.rotation.y=mode==="observation"?time*0.18*m.speed:0; showPassengers(riders,m,time); front(time,live); };
  return group;
}

function createSwing(entity, definition) {
  const group=new THREE.Group(); base(group,definition,0x51575f); const crown=new THREE.Group(); crown.position.y=5; group.add(crown);
  group.add(cylinder(0.18,0.26,5.1,8,0x69737c,2.55)); crown.add(cone(1.45,0.75,12,definition.color,0));
  const chairs=[], riders=[]; for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; const pivot=new THREE.Group(); pivot.rotation.y=-a; const chair=new THREE.Group(); chair.position.set(Math.cos(a)*2.2,-2.2,Math.sin(a)*2.2); chair.add(box(0.55,0.14,0.45,0xd4b16b,0)); riders.push(passenger(chair,0,0.25,0)); crown.add(chair); chairs.push(chair); }
  setRideAnchor(group,chairs[0],0,0.6,0); const front=frontage(group,definition);
  group.userData.updateVisual=(time,live)=>{ const m=deriveRideMotion(live,time); crown.rotation.y=time*0.7*m.speed; chairs.forEach((c,i)=>{ const a=i/12*Math.PI*2; const r=2.2+m.boardingPulse*0.75; c.position.x=Math.cos(a)*r; c.position.z=Math.sin(a)*r; c.position.y=-2.1+(m.active?0.8:0); c.rotation.z=Math.sin(time+i)*0.08*m.boardingPulse; }); showPassengers(riders,m,time); front(time,live); };
  return group;
}

function createWater(entity, definition, family) {
  const group=new THREE.Group(); base(group,definition,0x486570); const [w,d]=definition.footprint;
  const pool=box(w*TILE_SIZE*0.78,0.12,d*TILE_SIZE*0.72,0x4f9fbd,0.24); pool.material=material(0x4f9fbd,{opacity:0.78}); group.add(pool);
  const vehicle=new THREE.Group(); const riders=[];
  if(family==="rapids") vehicle.add(cylinder(0.85,0.9,0.35,12,0xd1a15d,0.18));
  else if(family==="submarine") { vehicle.add(box(2.1,0.65,0.8,0xe1c65f,0.35)); vehicle.add(sphere(0.35,0x79bed4,0.75)); }
  else vehicle.add(box(1.75,0.35,0.65,family==="flume"?0x9a6039:0x6fae8a,0.22));
  for(let i=0;i<Math.min(8,definition.capacity);i++) riders.push(passenger(vehicle,-0.6+(i%4)*0.4,0.55, i<4?-0.18:0.18));
  group.add(vehicle); setRideAnchor(group,vehicle,0,0.8,0); const droplets=[]; for(let i=0;i<8;i++){ const s=sphere(0.09,0x8ddbea,0); s.material=material(0x5eafc1,{emissive:0x2e7181,emissiveIntensity:0.25,opacity:0.75}); group.add(s); droplets.push(s); }
  const front=frontage(group,definition);
  group.userData.updateVisual=(time,live)=>{ const m=deriveRideMotion(live,time); const p=(time*0.12*m.speed)%1; const rx=(w*TILE_SIZE*0.28), rz=(d*TILE_SIZE*0.24); const a=p*Math.PI*2; vehicle.position.set(Math.cos(a)*rx, family==="flume"?0.25+Math.max(0,Math.sin(a))*1.3:0.3,Math.sin(a)*rz); vehicle.rotation.y=-a+Math.PI/2; if(family==="rapids") vehicle.rotation.y+=time*0.35*m.speed;
    droplets.forEach((drop,i)=>{ const dp=(time*0.7+i/8)%1; drop.visible=m.active; drop.position.set(vehicle.position.x+(i%2?0.45:-0.45),0.5+Math.sin(dp*Math.PI)*0.9,vehicle.position.z+(i%3-1)*0.3); }); showPassengers(riders,m,time); front(time,live); };
  return group;
}

function createTransport(entity, definition, family) {
  const group=new THREE.Group(); base(group,definition,0x555b60); const vehicle=new THREE.Group(); group.add(vehicle); const riders=[];
  if(family==="train") { vehicle.add(box(2.2,0.7,0.9,0x9d5b4e,0.45)); vehicle.add(cylinder(0.4,0.4,0.7,10,0x31383d,0.95)); const stack=cylinder(0.12,0.18,0.65,7,0x30363b,1.35); stack.position.x=0.65; vehicle.add(stack); }
  else if(family==="monorail") { vehicle.add(box(3.2,0.85,0.9,definition.color,1.15)); group.add(box(definition.footprint[0]*TILE_SIZE*0.8,0.18,0.18,0x69747c,0.8)); }
  else { vehicle.add(box(0.95,0.35,0.75,definition.color,0.25)); }
  for(let i=0;i<Math.min(8,definition.capacity);i++) riders.push(passenger(vehicle,-0.8+(i%4)*0.5,family==="monorail"?1.55:0.72,i<4?-0.18:0.18));
  setRideAnchor(group,vehicle,0,family==="monorail"?1.8:0.95,0); const front=frontage(group,definition);
  group.userData.updateVisual=(time,live)=>{ const m=deriveRideMotion(live,time); const p=(time*0.1*m.speed)%1; const span=definition.footprint[0]*TILE_SIZE*0.56; vehicle.position.x=-span+((p*2)%1)*span*2; vehicle.position.z=Math.sin(p*Math.PI*2)*0.55; if(family==="drivers") vehicle.rotation.y=Math.sin(time*0.8)*0.4; showPassengers(riders,m,time); front(time,live); };
  return group;
}

function createIndoor(entity, definition, family) {
  const group=new THREE.Group(); base(group,definition,0x454b55); const [w,d]=definition.footprint;
  const shell=box(w*TILE_SIZE*0.82,3.6,d*TILE_SIZE*0.78,family==="submarine"?0x356a7a:0x3e4554,1.9); group.add(shell);
  const sign=box(Math.min(4,w*TILE_SIZE*0.55),0.55,0.14,definition.color,3.35); sign.position.z=d*TILE_SIZE*0.4; group.add(sign);
  const icon=sphere(0.36,definition.color,4.05); icon.material=material(0x3b3420,{emissive:definition.color,emissiveIntensity:1.2}); group.add(icon);
  const screen=box(w*TILE_SIZE*0.55,1.7,0.08,0x24334d,2); screen.position.z=d*TILE_SIZE*0.405; group.add(screen);
  const riders=[]; for(let i=0;i<Math.min(12,definition.capacity);i++) riders.push(passenger(group,-1.3+(i%6)*0.5,0.75,-0.45+(i<6?0:0.7)));
  setRideAnchor(group,group,0,1.4,0); const front=frontage(group,definition);
  group.userData.updateVisual=(time,live)=>{ const m=deriveRideMotion(live,time); const pulse=m.active?1:0.25; icon.scale.setScalar(0.88+Math.sin(time*3.2)*0.12*pulse); screen.material=material(m.active?0x5676aa:0x24334d,{emissive:m.active?definition.color:0,emissiveIntensity:m.active?0.35:0}); if(family==="simulator") riders.forEach((r,i)=>{ r.rotation.z=Math.sin(time*3+i*0.2)*0.12*m.boardingPulse; }); showPassengers(riders,m,time); front(time,live); };
  return group;
}

function createPlay(entity, definition) {
  const group=new THREE.Group(); base(group,definition,0x5e7a58); const tower=box(1.2,2.6,1.2,0x8d603e,1.3); tower.position.x=-1; group.add(tower); group.add(cone(1,1.1,6,definition.color,3.1));
  const slide=new THREE.Mesh(new THREE.BoxGeometry(0.65,0.16,3.2),material(0xe2b659)); slide.position.set(1,1.15,0); slide.rotation.x=-0.46; group.add(slide);
  const bridge=box(2.3,0.18,0.6,0x75a65e,1.6); group.add(bridge); const riders=[]; for(let i=0;i<8;i++) riders.push(passenger(group,-1.4+(i%4)*0.9,0.55,-1+(i<4?0:1.8)));
  setRideAnchor(group,group,0,1.5,0); const front=frontage(group,definition);
  group.userData.updateVisual=(time,live)=>{ const m=deriveRideMotion(live,time); riders.forEach((r,i)=>{ r.visible=m.active&&i<m.riderCount; r.position.y=r.userData.baseY+Math.max(0,Math.sin(time*2.5+i))*0.3*m.boardingPulse; }); front(time,live); };
  return group;
}

function createFacility(entity, definition) {
  const group=new THREE.Group(); base(group,definition,definition.category==="Stores"?0x65584e:0x59646a); const [w,d]=definition.footprint;
  const shop=box(w*TILE_SIZE*0.82,2.7,d*TILE_SIZE*0.78,definition.category==="Stores"?0x7a6556:0x68757a,1.45); group.add(shop);
  const awning=box(w*TILE_SIZE*0.72,0.18,0.75,definition.color,2.35); awning.position.z=d*TILE_SIZE*0.43; group.add(awning);
  const sign=box(Math.max(0.8,w*TILE_SIZE*0.5),0.42,0.12,definition.color,2.9); sign.position.z=d*TILE_SIZE*0.405; group.add(sign);
  const glow=sphere(0.11,0xffde78,2.9); glow.position.z=d*TILE_SIZE*0.48; glow.material=material(0x59491f,{emissive:0xffd666,emissiveIntensity:1.3}); group.add(glow);
  const props=[];
  const family=definition.visualFamily;
  if(family==="lockers") for(let i=0;i<6;i++){ const p=box(0.45,0.62,0.18,[0x7895b2,0xe39b6c,0x72b99a][i%3],1.25+(i>=3?0.72:0)); p.position.x=-0.75+(i%3)*0.75; p.position.z=d*TILE_SIZE*0.42; group.add(p); props.push(p); }
  else if(family==="stroller") for(let i=0;i<3;i++){ const p=new THREE.Group(); p.add(box(0.62,0.25,0.38,0xd99961,0.4)); const wheelA=cylinder(0.12,0.12,0.08,8,0x32383c,0.18); wheelA.rotation.z=Math.PI/2; wheelA.position.x=-0.2; const wheelB=wheelA.clone(); wheelB.position.x=0.2; p.add(wheelA,wheelB); p.position.set(-0.8+i*0.8,0,d*TILE_SIZE*0.46); group.add(p); props.push(p); }
  else if(family==="refill") { const tap=cylinder(0.18,0.24,1.15,8,0x7d8b91,0.7); tap.position.z=d*TILE_SIZE*0.43; group.add(tap); props.push(tap); }
  else if(["popcorn","icecream","candy","toy","photo","custom","apparel","souvenir"].includes(family)) for(let i=0;i<4;i++){ const p=sphere(0.16+i%2*0.05,[definition.color,0xf0c766,0x75d5ad,0x65bed1][i%4],1.2+i%2*0.45); p.position.x=-0.65+(i%2)*1.3; p.position.z=d*TILE_SIZE*0.44; group.add(p); props.push(p); }
  group.userData.updateVisual=(time,live)=>{ const open=live.open!==false; glow.visible=open; glow.scale.setScalar(0.82+Math.sin(time*4.2)*0.18); props.forEach((p,i)=>{ p.rotation.y=Math.sin(time*(0.8+i*0.1)+i)*0.12; }); if(live.kind==="service"){ const m=deriveServiceMotion(live,time); sign.scale.y=m.signPulse; } };
  return group;
}

function finalize(group, entity, definition) {
  group.name=entity.id;
  group.userData.entityId=entity.id;
  group.userData.definition=definition;
  group.userData.specialAttractionId=definition.id;
  group.userData.worldContentFamily=definition.visualFamily;
  group.userData.updateVisual ??= () => {};
  group.traverse((child)=>{ child.userData.entityId=entity.id; });
  return group;
}

export function createWorldContentModel(entity) {
  const definition=catalogDefinition(entity.catalogId);
  const family=definition.visualFamily;
  let group;
  if(family==="cups") group=createCups(entity,definition);
  else if(family==="bumpers") group=createBumpers(entity,definition);
  else if(["bounceTower","dropTower","observation"].includes(family)) group=createTower(entity,definition,family);
  else if(family==="swing") group=createSwing(entity,definition);
  else if(["flume","rapids","boats","submarine"].includes(family)) group=createWater(entity,definition,family);
  else if(["train","monorail","drivers"].includes(family)) group=createTransport(entity,definition,family);
  else if(["darkride","cinema","simulator"].includes(family)) group=createIndoor(entity,definition,family);
  else if(family==="play") group=createPlay(entity,definition);
  else group=createFacility(entity,definition);
  return finalize(group,entity,definition);
}
