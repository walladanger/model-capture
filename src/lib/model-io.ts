import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";

export type ModelFormat = "glb" | "gltf" | "obj" | "stl" | "ply";

export const MODEL_FORMATS: Record<
  ModelFormat,
  { label: string; mime: string; ext: string; description: string }
> = {
  glb: {
    label: "GLB",
    mime: "model/gltf-binary",
    ext: ".glb",
    description: "Binary glTF — best for web & AR",
  },
  gltf: {
    label: "glTF",
    mime: "application/json",
    ext: ".gltf",
    description: "JSON glTF scene",
  },
  obj: {
    label: "OBJ",
    mime: "text/plain",
    ext: ".obj",
    description: "Wavefront OBJ — universal",
  },
  stl: {
    label: "STL",
    mime: "model/stl",
    ext: ".stl",
    description: "3D printing mesh",
  },
  ply: {
    label: "PLY",
    mime: "application/octet-stream",
    ext: ".ply",
    description: "Point cloud / triangle mesh",
  },
};

export const IMPORT_ACCEPT = ".glb,.gltf,.obj,.stl,.ply";

export function detectFormat(filename: string): ModelFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".glb")) return "glb";
  if (lower.endsWith(".gltf")) return "gltf";
  if (lower.endsWith(".obj")) return "obj";
  if (lower.endsWith(".stl")) return "stl";
  if (lower.endsWith(".ply")) return "ply";
  return null;
}

function defaultMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    metalness: 0.15,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
}

/** Loads a model file (by object URL) into a normalized THREE.Object3D. */
export async function loadModel(
  url: string,
  format: ModelFormat,
): Promise<THREE.Object3D> {
  if (format === "glb" || format === "gltf") {
    const gltf = await new GLTFLoader().loadAsync(url);
    return gltf.scene;
  }
  if (format === "obj") {
    const group = await new OBJLoader().loadAsync(url);
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geo = mesh.geometry;
        if (!geo.getAttribute("normal")) geo.computeVertexNormals();
        const mat = mesh.material as THREE.Material;
        if (!mat || Array.isArray(mat) || (mat as THREE.MeshStandardMaterial).color === undefined) {
          mesh.material = defaultMaterial();
        }
      }
    });
    return group;
  }
  if (format === "stl" || format === "ply") {
    const geo =
      format === "stl"
        ? await new STLLoader().loadAsync(url)
        : await new PLYLoader().loadAsync(url);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, defaultMaterial());
    return mesh;
  }
  throw new Error(`Unsupported format: ${format}`);
}

/** Centers + scales geometry into a ~2-unit box, baking the transform into geometry. */
export function normalizeModel(
  object: THREE.Object3D,
): { object: THREE.Object3D; radius: number; center: THREE.Vector3 } {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2 / maxDim;
  const matrix = new THREE.Matrix4().compose(
    center.clone().multiplyScalar(-scale),
    new THREE.Quaternion(),
    new THREE.Vector3(scale, scale, scale),
  );
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const geo = (child as THREE.Mesh).geometry;
      geo.applyMatrix4(matrix);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
    }
  });
  object.updateMatrixWorld(true);
  const sphere = new THREE.Box3()
    .setFromObject(object)
    .getBoundingSphere(new THREE.Sphere());
  return { object, radius: sphere.radius, center: sphere.center };
}

export interface ModelStats {
  vertices: number;
  triangles: number;
  meshes: number;
}

export function computeStats(object: THREE.Object3D): ModelStats {
  let vertices = 0;
  let triangles = 0;
  let meshes = 0;
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    meshes += 1;
    const geo = (child as THREE.Mesh).geometry;
    vertices += geo.getAttribute("position")?.count ?? 0;
    const index = geo.getIndex();
    triangles += index ? index.count / 3 : (geo.getAttribute("position")?.count ?? 0) / 3;
  });
  return { vertices, triangles, meshes };
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  mime: string;
}

export async function exportModel(
  object: THREE.Object3D,
  format: ModelFormat,
  name: string,
): Promise<ExportResult> {
  const base = name.replace(/\.[^/.]+$/, "").replace(/[^\w\- ]+/g, "").trim() || "model";
  const ext = MODEL_FORMATS[format].ext;

  if (format === "glb") {
    const data = await new GLTFExporter().parseAsync(object, { binary: true });
    return {
      blob: new Blob([data as ArrayBuffer], { type: MODEL_FORMATS.glb.mime }),
      filename: `${base}${ext}`,
      mime: MODEL_FORMATS.glb.mime,
    };
  }
  if (format === "gltf") {
    const data = await new GLTFExporter().parseAsync(object, { binary: false });
    return {
      blob: new Blob([JSON.stringify(data)], { type: MODEL_FORMATS.gltf.mime }),
      filename: `${base}${ext}`,
      mime: MODEL_FORMATS.gltf.mime,
    };
  }
  if (format === "obj") {
    const text = new OBJExporter().parse(object);
    return {
      blob: new Blob([text], { type: MODEL_FORMATS.obj.mime }),
      filename: `${base}${ext}`,
      mime: MODEL_FORMATS.obj.mime,
    };
  }
  if (format === "stl") {
    const data = new STLExporter().parse(object, { binary: true });
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return {
      blob: new Blob([bytes], { type: MODEL_FORMATS.stl.mime }),
      filename: `${base}${ext}`,
      mime: MODEL_FORMATS.stl.mime,
    };
  }
  if (format === "ply") {
    const data = await new Promise<ArrayBuffer>((resolve) => {
      new PLYExporter().parse(object, resolve, { binary: true });
    });
    return {
      blob: new Blob([data], { type: MODEL_FORMATS.ply.mime }),
      filename: `${base}${ext}`,
      mime: MODEL_FORMATS.ply.mime,
    };
  }
  throw new Error(`Unsupported export format: ${format}`);
}

export function downloadBlob(result: ExportResult) {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type });
}

// Mesh edit cache + erase/undo helpers live in mesh-edit.ts (three-only import,
// unit-testable without the example loaders/exporters). Re-exported here so
// existing callers can keep importing from model-io.
export {
  applyRemovals,
  buildEditCaches,
  eraseNear,
  removedCount,
  restoreRemovals,
  snapshotRemovals,
} from "./mesh-edit";
export type { MeshEditCache } from "./mesh-edit";

// ---------------------------------------------------------------------------
// Demo reconstruction: a stylized low-poly car used when no photogrammetry
// provider is configured. Clearly labeled in the UI as a demo stand-in.
// ---------------------------------------------------------------------------

export function buildDemoModel(): THREE.Object3D {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.3,
    roughness: 0.4,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.6,
    roughness: 0.2,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.1,
    roughness: 0.9,
  });

  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 1.15), bodyMat);
  body.position.y = 0.55;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.55, 1.0), glassMat);
  cabin.position.set(-0.15, 1.05, 0);
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const positions: Array<[number, number, number]> = [
    [-0.85, 0.34, 0.62],
    [0.85, 0.34, 0.62],
    [-0.85, 0.34, -0.62],
    [0.85, 0.34, -0.62],
  ];
  for (const [x, y, z] of positions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).geometry.computeVertexNormals();
    }
  });
  return group;
}
