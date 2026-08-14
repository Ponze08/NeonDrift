import * as THREE from 'three';
import type { PlayerMotionState } from './PlayerController';

export interface CharacterPalette {
  skin: number;
  jacket: number;
  accent: number;
  trousers: number;
  shoes: number;
}

export const DEFAULT_CHARACTER_PALETTE: Readonly<CharacterPalette> = {
  skin: 0xb87852,
  jacket: 0x18b7c9,
  accent: 0xffcc4a,
  trousers: 0x28345d,
  shoes: 0xf4f7ff,
};

interface CharacterRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

function standardMaterial(colour: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.72 });
}

function limb(width: number, length: number, depth: number, material: THREE.Material): THREE.Group {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, depth), material);
  mesh.position.y = -length * 0.5;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

export function createProceduralCharacter(palette: Partial<CharacterPalette> = {}): CharacterRig {
  const colours: CharacterPalette = { ...DEFAULT_CHARACTER_PALETTE, ...palette };
  const root = new THREE.Group();
  root.name = 'runner-character';

  const jacket = standardMaterial(colours.jacket);
  const accent = standardMaterial(colours.accent);
  const skin = standardMaterial(colours.skin);
  const trousers = standardMaterial(colours.trousers);
  const shoes = standardMaterial(colours.shoes);

  const torso = new THREE.Group();
  torso.position.y = 1.38;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.84, 0.43), jacket);
  chest.castShadow = true;
  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.045), accent);
  chestStripe.position.set(0, 0.08, -0.24);
  torso.add(chest, chestStripe);

  const head = new THREE.Group();
  head.position.y = 2.08;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), skin);
  face.scale.set(0.9, 1, 0.88);
  face.castShadow = true;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6, 0, Math.PI * 2, 0, 1.45),
    accent,
  );
  hair.position.y = 0.08;
  hair.castShadow = true;
  head.add(face, hair);

  const leftArm = limb(0.24, 0.78, 0.24, jacket);
  const rightArm = limb(0.24, 0.78, 0.24, jacket);
  leftArm.position.set(-0.54, 1.7, 0);
  rightArm.position.set(0.54, 1.7, 0);

  const leftLeg = limb(0.3, 0.86, 0.32, trousers);
  const rightLeg = limb(0.3, 0.86, 0.32, trousers);
  leftLeg.position.set(-0.23, 0.94, 0);
  rightLeg.position.set(0.23, 0.94, 0);
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.55), shoes);
  const rightShoe = leftShoe.clone();
  leftShoe.position.set(0, -0.87, -0.11);
  rightShoe.position.set(0, -0.87, -0.11);
  leftShoe.castShadow = true;
  rightShoe.castShadow = true;
  leftLeg.add(leftShoe);
  rightLeg.add(rightShoe);

  root.add(torso, head, leftArm, rightArm, leftLeg, rightLeg);
  return { root, torso, head, leftArm, rightArm, leftLeg, rightLeg };
}

export class PlayerAnimator {
  public readonly object: THREE.Group;
  private readonly rig: CharacterRig;
  private runClock = 0;
  private crashTime = 0;
  private crashed = false;

  public constructor(palette: Partial<CharacterPalette> = {}) {
    this.rig = createProceduralCharacter(palette);
    this.object = this.rig.root;
  }

  public reset(): void {
    this.runClock = 0;
    this.crashTime = 0;
    this.crashed = false;
    this.object.position.set(0, 0, 0);
    this.object.rotation.set(0, 0, 0);
    this.object.scale.set(1, 1, 1);
  }

  public crash(): void {
    this.crashed = true;
    this.crashTime = 0;
  }

  public update(deltaSeconds: number, motion: PlayerMotionState, speed: number): void {
    const dt = Math.min(0.1, Math.max(0, deltaSeconds));
    if (this.crashed) {
      this.crashTime += dt;
      const settle = Math.min(1, this.crashTime * 2.8);
      this.object.rotation.z = Math.sin(settle * Math.PI) * 0.24;
      this.object.rotation.x = settle * -0.82;
      this.object.position.y = -settle * 0.32;
      return;
    }

    this.runClock += dt * (7.5 + speed * 0.18);
    const stride = Math.sin(this.runClock);
    const bob = Math.abs(Math.sin(this.runClock)) * 0.055;
    const laneLean = THREE.MathUtils.clamp(-motion.lateralVelocity * 0.28, -0.24, 0.24);
    this.object.rotation.z += (laneLean - this.object.rotation.z) * (1 - Math.exp(-dt * 12));

    if (motion.sliding) {
      this.object.position.y += (-0.08 - this.object.position.y) * (1 - Math.exp(-dt * 18));
      this.object.rotation.x += (-0.9 - this.object.rotation.x) * (1 - Math.exp(-dt * 18));
      this.rig.torso.rotation.x = -0.25;
      this.rig.leftLeg.rotation.x = -1.05;
      this.rig.rightLeg.rotation.x = -0.6;
      this.rig.leftArm.rotation.x = 0.6;
      this.rig.rightArm.rotation.x = 0.85;
    } else if (!motion.grounded) {
      this.object.position.y += (0 - this.object.position.y) * (1 - Math.exp(-dt * 15));
      this.object.rotation.x += (0 - this.object.rotation.x) * (1 - Math.exp(-dt * 10));
      this.rig.torso.rotation.x = -0.08;
      this.rig.leftLeg.rotation.x = 0.45;
      this.rig.rightLeg.rotation.x = -0.4;
      this.rig.leftArm.rotation.x = -1.1;
      this.rig.rightArm.rotation.x = -0.9;
    } else {
      this.object.position.y = bob;
      this.object.rotation.x += (0 - this.object.rotation.x) * (1 - Math.exp(-dt * 14));
      this.rig.torso.rotation.x = Math.sin(this.runClock * 2) * 0.025;
      this.rig.leftLeg.rotation.x = stride * 0.86;
      this.rig.rightLeg.rotation.x = -stride * 0.86;
      this.rig.leftArm.rotation.x = -stride * 0.72;
      this.rig.rightArm.rotation.x = stride * 0.72;
    }
    this.rig.head.rotation.y = laneLean * -0.45;
  }
}
