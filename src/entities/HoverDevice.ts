import * as THREE from 'three';

const DECK_GEOMETRY = new THREE.CapsuleGeometry(0.34, 1.35, 3, 8);
const RAIL_GEOMETRY = new THREE.TorusGeometry(0.27, 0.045, 5, 12, Math.PI);

export class HoverDevice extends THREE.Group {
  public active = false;
  private age = 0;
  private readonly glow: THREE.PointLight;
  private readonly deckMaterial: THREE.MeshStandardMaterial;
  private readonly railMaterial: THREE.MeshBasicMaterial;

  public constructor(colour = 0x56f2ff) {
    super();
    this.deckMaterial = new THREE.MeshStandardMaterial({
      color: colour,
      emissive: colour,
      emissiveIntensity: 0.45,
      metalness: 0.55,
      roughness: 0.24,
    });
    this.railMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const deck = new THREE.Mesh(DECK_GEOMETRY, this.deckMaterial);
    deck.rotation.z = Math.PI * 0.5;
    deck.scale.set(1, 0.24, 1);
    deck.castShadow = true;

    const frontRail = new THREE.Mesh(RAIL_GEOMETRY, this.railMaterial);
    frontRail.position.x = 0.68;
    frontRail.rotation.y = Math.PI * 0.5;
    const rearRail = frontRail.clone();
    rearRail.position.x = -0.68;

    this.glow = new THREE.PointLight(colour, 0.85, 4, 2);
    this.position.y = 0.12;
    this.rotation.y = Math.PI * 0.5;
    this.add(deck, frontRail, rearRail, this.glow);
    this.visible = false;
  }

  public activate(): void {
    this.active = true;
    this.visible = true;
    this.age = 0;
  }

  public deactivate(): void {
    this.active = false;
    this.visible = false;
  }

  public setAppearance(colour: number): void {
    this.deckMaterial.color.setHex(colour);
    this.deckMaterial.emissive.setHex(colour);
    this.railMaterial.color.setHex(colour).lerp(new THREE.Color(0xffffff), 0.55);
    this.glow.color.setHex(colour);
  }

  public update(deltaSeconds: number): void {
    if (!this.active) return;
    this.age += deltaSeconds;
    this.position.y = 0.11 + Math.sin(this.age * 7) * 0.035;
    this.glow.intensity = 0.7 + Math.sin(this.age * 9) * 0.18;
  }
}
