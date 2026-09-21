import * as THREE from "three";
import { ribbonPoint } from "./ribbonGeometry";

/** Three.js is MIT licensed. All ribbon surfaces and choreography are original. */
export function createRibbonRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  let renderSize = 0;
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 30);
  camera.position.set(0, .25, 6.5);
  camera.lookAt(0, 0, 0);
  const sculpture = new THREE.Group();
  scene.add(sculpture);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x326d69, 2.8));
  const light = new THREE.DirectionalLight(0xfffaf1, 4);
  light.position.set(-3, 5, 4);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0x85bcb5, 2);
  rim.position.set(3, -1, -2);
  scene.add(rim);
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.Material[] = [];
  for (let band = 0; band < 3; band++) {
    const geometry = new THREE.PlaneGeometry(1, 1, 144, 10);
    const targets: THREE.Float32BufferAttribute[] = [];
    const normals: THREE.BufferAttribute[] = [];
    for (let stage = 0; stage < 5; stage++) {
      const positions = new Float32Array(145 * 11 * 3);
      for (let j = 0; j <= 10; j++) for (let i = 0; i <= 144; i++) {
        positions.set(ribbonPoint(stage, band, i / 144, j / 5 - 1), (j * 145 + i) * 3);
      }
      const attribute = new THREE.Float32BufferAttribute(positions, 3);
      targets.push(attribute);
      geometry.setAttribute("position", attribute);
      geometry.computeVertexNormals();
      normals.push(geometry.getAttribute("normal").clone() as THREE.BufferAttribute);
    }
    geometry.setAttribute("position", targets[0]);
    geometry.setAttribute("normal", normals[0]);
    geometry.morphAttributes.position = targets;
    geometry.morphAttributes.normal = normals;
    const material = new THREE.MeshStandardMaterial({
      color: band === 1 ? 0xffffff : 0xf0eee5, roughness: .3, metalness: .12,
      side: THREE.DoubleSide,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    sculpture.add(mesh);
    meshes.push(mesh);
  }
  return {
    resize(size: number) {
      const next = Math.max(1, Math.round(size));
      if (next === renderSize) return;
      renderSize = next;
      renderer.setSize(next, next, false);
    },
    paint(progress: number, seconds: number) {
      const stage = Math.min(4, Math.max(0, progress));
      const from = Math.floor(stage), to = Math.min(4, from + 1);
      const fraction = stage - from;
      const blend = fraction ** 3 * (fraction * (fraction * 6 - 15) + 10);
      for (const mesh of meshes) {
        mesh.morphTargetInfluences!.fill(0);
        mesh.morphTargetInfluences![from] = 1 - blend;
        mesh.morphTargetInfluences![to] += blend;
      }
      sculpture.rotation.set(-.2 + Math.sin(seconds * .47) * .08,
        -.24 + Math.sin(seconds * .32) * .18 + Math.sin(blend * Math.PI) ** 2 * .22,
        -.08 + Math.sin(seconds * .39) * .04);
      sculpture.position.y = Math.sin(seconds * .65) * .035;
      renderer.render(scene, camera);
    },
    dispose() {
      meshes.forEach(mesh => mesh.geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
