import * as THREE from 'three';

/** Lightweight animated atmosphere shared by menus and active runs. */
export class Environment {
  public readonly group = new THREE.Group();
  public readonly keyLight: THREE.DirectionalLight;

  private readonly scene: THREE.Scene;
  private readonly starField: THREE.Points;
  private readonly horizonRings: THREE.Mesh[] = [];
  private readonly backgroundColour = new THREE.Color();
  private readonly fogColour = new THREE.Color();
  private readonly baseColour = new THREE.Color(0x07091a);
  private readonly distantColour = new THREE.Color(0x170f35);
  private readonly fogAccentColour = new THREE.Color(0x261745);

  public constructor(scene: THREE.Scene, shadows = true) {
    this.scene = scene;
    this.group.name = 'skyline-atmosphere';

    const hemisphere = new THREE.HemisphereLight(0x8cecff, 0x16091e, 1.45);
    this.keyLight = new THREE.DirectionalLight(0xffd9c7, 2.25);
    this.keyLight.position.set(-8, 16, -5);
    this.keyLight.castShadow = shadows;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -14;
    this.keyLight.shadow.camera.right = 14;
    this.keyLight.shadow.camera.top = 20;
    this.keyLight.shadow.camera.bottom = -6;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 55;
    this.keyLight.shadow.bias = -0.0003;

    const rim = new THREE.PointLight(0x6e4cff, 32, 35, 1.8);
    rim.position.set(8, 5, 4);
    const fill = new THREE.PointLight(0x00d9ff, 22, 30, 1.8);
    fill.position.set(-8, 3, 12);
    this.group.add(hemisphere, this.keyLight, rim, fill);

    this.starField = this.createStars();
    this.group.add(this.starField);
    this.createHorizonRings();
    this.scene.add(this.group);
    this.applyQuality(shadows);
    this.update(0, 0);
  }

  public update(deltaSeconds: number, distance: number): void {
    this.starField.rotation.y += deltaSeconds * 0.006;
    const phase = (Math.max(0, distance) % 4500) / 4500;
    const blend = 0.5 - Math.cos(phase * Math.PI * 2) * 0.5;
    this.backgroundColour.copy(this.baseColour).lerp(this.distantColour, blend * 0.65);
    this.fogColour.copy(this.backgroundColour).lerp(this.fogAccentColour, 0.22);
    this.scene.background = this.backgroundColour;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(this.fogColour);

    for (let index = 0; index < this.horizonRings.length; index += 1) {
      const ring = this.horizonRings[index];
      if (ring === undefined) continue;
      ring.rotation.z += deltaSeconds * (0.035 + index * 0.012);
      ring.position.z = distance + 95 + index * 24;
    }
  }

  public applyQuality(shadows: boolean): void {
    this.keyLight.castShadow = shadows;
  }

  public dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        if (Array.isArray(object.material))
          object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      }
    });
  }

  private createStars(): THREE.Points {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const angle = index * 2.399963;
      const radius = 38 + ((index * 17) % 62);
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = 7 + ((index * 29) % 45);
      positions[offset + 2] = Math.sin(angle) * radius + 40;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xc9edff,
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const stars = new THREE.Points(geometry, material);
    stars.name = 'procedural-stars';
    return stars;
  }

  private createHorizonRings(): void {
    const geometry = new THREE.TorusGeometry(19, 0.045, 4, 72);
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(
        geometry.clone(),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0x6b43ff : 0x1cd9ff,
          transparent: true,
          opacity: 0.13,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI * 0.5;
      ring.rotation.z = index * 0.8;
      ring.scale.setScalar(1 + index * 0.45);
      this.horizonRings.push(ring);
      this.group.add(ring);
    }
  }
}
