import * as THREE from 'three';

export type TrackTheme = 'violet' | 'cyan' | 'sunset';

export interface TrackSegmentConfig {
  length: number;
  width: number;
  laneSpacing: number;
  markerSpacing: number;
}

export const DEFAULT_TRACK_SEGMENT_CONFIG: Readonly<TrackSegmentConfig> = {
  length: 28,
  width: 9.2,
  laneSpacing: 2.65,
  markerSpacing: 3.5,
};

const THEME_COLOURS: Readonly<Record<TrackTheme, { road: number; edge: number; glow: number }>> = {
  violet: { road: 0x16182d, edge: 0x452b65, glow: 0xaa62ff },
  cyan: { road: 0x12252e, edge: 0x174b58, glow: 0x42e5ff },
  sunset: { road: 0x2c1c2c, edge: 0x603042, glow: 0xff6f91 },
};

export class TrackSegment extends THREE.Group {
  public active = false;
  public index = 0;
  public theme: TrackTheme = 'violet';
  public readonly config: TrackSegmentConfig;

  private readonly roadMaterial: THREE.MeshStandardMaterial;
  private readonly edgeMaterial: THREE.MeshStandardMaterial;
  private readonly markerMaterial: THREE.MeshBasicMaterial;

  public constructor(config: Partial<TrackSegmentConfig> = {}) {
    super();
    this.config = { ...DEFAULT_TRACK_SEGMENT_CONFIG, ...config };
    this.roadMaterial = new THREE.MeshStandardMaterial({ color: 0x16182d, roughness: 0.88 });
    this.edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x452b65, roughness: 0.72 });
    this.markerMaterial = new THREE.MeshBasicMaterial({ color: 0xaa62ff });

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(this.config.width, 0.28, this.config.length),
      this.roadMaterial,
    );
    road.position.y = -0.16;
    road.receiveShadow = true;
    this.add(road);

    const edgeGeometry = new THREE.BoxGeometry(0.55, 0.48, this.config.length);
    const leftEdge = new THREE.Mesh(edgeGeometry, this.edgeMaterial);
    const rightEdge = new THREE.Mesh(edgeGeometry, this.edgeMaterial);
    leftEdge.position.set(-this.config.width * 0.5 - 0.22, 0.05, 0);
    rightEdge.position.set(this.config.width * 0.5 + 0.22, 0.05, 0);
    leftEdge.receiveShadow = true;
    rightEdge.receiveShadow = true;
    this.add(leftEdge, rightEdge);

    const markerGeometry = new THREE.BoxGeometry(0.055, 0.025, 1.65);
    const markerCount = Math.ceil(this.config.length / this.config.markerSpacing);
    for (const laneEdge of [-0.5, 0.5]) {
      for (let marker = 0; marker < markerCount; marker += 1) {
        const mesh = new THREE.Mesh(markerGeometry, this.markerMaterial);
        mesh.position.set(
          laneEdge * this.config.laneSpacing,
          0.002,
          -this.config.length * 0.5 + marker * this.config.markerSpacing + 1,
        );
        this.add(mesh);
      }
    }
    this.visible = false;
  }

  public spawn(index: number, theme: TrackTheme): void {
    this.active = true;
    this.visible = true;
    this.index = index;
    this.theme = theme;
    this.position.set(0, 0, index * this.config.length + this.config.length * 0.5);
    const colours = THEME_COLOURS[theme];
    this.roadMaterial.color.setHex(colours.road);
    this.edgeMaterial.color.setHex(colours.edge);
    this.markerMaterial.color.setHex(colours.glow);
  }

  public reset(): void {
    this.active = false;
    this.visible = false;
    this.index = 0;
    this.position.set(0, 0, 0);
  }

  public dispose(): void {
    this.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
    });
    this.roadMaterial.dispose();
    this.edgeMaterial.dispose();
    this.markerMaterial.dispose();
  }
}
