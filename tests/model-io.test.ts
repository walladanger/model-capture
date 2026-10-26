import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  MODEL_FORMATS,
  IMPORT_ACCEPT,
  detectFormat,
  normalizeModel,
  computeStats,
  buildDemoModel,
  blobToFile,
} from "../src/lib/model-io";

describe("detectFormat", () => {
  test("detects formats exactly matching MODEL_FORMATS keys", () => {
    expect(detectFormat("test.glb")).toBe("glb");
    expect(detectFormat("test.gltf")).toBe("gltf");
    expect(detectFormat("test.obj")).toBe("obj");
    expect(detectFormat("test.stl")).toBe("stl");
    expect(detectFormat("test.ply")).toBe("ply");
  });

  test("is case-insensitive for extensions", () => {
    expect(detectFormat("test.GLB")).toBe("glb");
    expect(detectFormat("TEST.gLtF")).toBe("gltf");
    expect(detectFormat("model.OBJ")).toBe("obj");
    expect(detectFormat("MODEL.StL")).toBe("stl");
    expect(detectFormat("mesh.PLy")).toBe("ply");
  });

  test("handles filenames with multiple dots", () => {
    expect(detectFormat("my.model.v1.obj")).toBe("obj");
    expect(detectFormat("archive.tar.gz.glb")).toBe("glb");
  });

  test("returns null for no extension or unknown extensions", () => {
    expect(detectFormat("test")).toBeNull();
    expect(detectFormat("test.txt")).toBeNull();
    expect(detectFormat("model.fbx")).toBeNull();
    expect(detectFormat("mesh.dae")).toBeNull();
    expect(detectFormat(".glb.old")).toBeNull();
  });
});

describe("IMPORT_ACCEPT", () => {
  test("matches exactly the extensions defined in MODEL_FORMATS", () => {
    const expected = Object.keys(MODEL_FORMATS)
      .map((k) => `.${k}`)
      .join(",");
    expect(IMPORT_ACCEPT).toBe(expected);
    // Hardcoded check just to be absolutely certain based on source
    expect(IMPORT_ACCEPT).toBe(".glb,.gltf,.obj,.stl,.ply");
  });
});

describe("computeStats", () => {
  test("computes exact vertices, triangles, and meshes count based on source logic", () => {
    const group = new THREE.Group();

    // 1. Indexed Geometry (BoxGeometry)
    // By default, BoxGeometry in Three.js has 24 vertices and 36 indices (12 triangles).
    const indexedGeo = new THREE.BoxGeometry(1, 1, 1);
    const indexedMesh = new THREE.Mesh(indexedGeo);
    group.add(indexedMesh);

    // 2. Non-indexed Geometry (BufferGeometry with just positions)
    // 1 triangle = 3 vertices, no index
    const nonIndexedGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]);
    nonIndexedGeo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    const nonIndexedMesh = new THREE.Mesh(nonIndexedGeo);
    group.add(nonIndexedMesh);

    const stats = computeStats(group);

    expect(stats.meshes).toBe(2);

    // vertices = indexed geo pos count (24) + non-indexed geo pos count (3) = 27
    const expectedVertices =
      (indexedGeo.getAttribute("position")?.count ?? 0) +
      (nonIndexedGeo.getAttribute("position")?.count ?? 0);
    expect(stats.vertices).toBe(expectedVertices);
    expect(stats.vertices).toBe(24 + 3);

    // triangles = indexed (36 / 3 = 12) + non-indexed (3 / 3 = 1) = 13
    const expectedTriangles =
      (indexedGeo.getIndex()!.count / 3) +
      ((nonIndexedGeo.getAttribute("position")?.count ?? 0) / 3);
    expect(stats.triangles).toBe(expectedTriangles);
    expect(stats.triangles).toBe(12 + 1);
  });
});

describe("normalizeModel", () => {
  test("centers and scales geometry into a ~2-unit box, baking the transform", () => {
    const geo = new THREE.BoxGeometry(10, 10, 10);
    // Shift it so center is initially at (10, 10, 10)
    geo.translate(10, 10, 10);
    const mesh = new THREE.Mesh(geo);

    // We add it to a group to test traversal
    const group = new THREE.Group();
    group.add(mesh);

    const result = normalizeModel(group);

    // 1. The returned object should be the exact same object passed in
    expect(result.object).toBe(group);

    // 2. The geometry should have been modified directly (baked).
    // The max dimension was 10. Scale should be 2/10 = 0.2.
    // The initial center was (10, 10, 10). The applied matrix moves center to origin and scales by 0.2.
    geo.computeBoundingBox();
    const newBox = geo.boundingBox!;

    // The new size should be 10 * 0.2 = 2.
    const newSize = newBox.getSize(new THREE.Vector3());
    expect(newSize.x).toBeCloseTo(2);
    expect(newSize.y).toBeCloseTo(2);
    expect(newSize.z).toBeCloseTo(2);

    // The new center should be roughly origin
    const newCenter = newBox.getCenter(new THREE.Vector3());
    expect(newCenter.x).toBeCloseTo(0);
    expect(newCenter.y).toBeCloseTo(0);
    expect(newCenter.z).toBeCloseTo(0);

    // 3. The returned center and radius should come from a final bounding sphere computed on the object
    const expectedSphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
    expect(result.center.x).toBeCloseTo(expectedSphere.center.x);
    expect(result.center.y).toBeCloseTo(expectedSphere.center.y);
    expect(result.center.z).toBeCloseTo(expectedSphere.center.z);
    expect(result.radius).toBeCloseTo(expectedSphere.radius);

    // Mathematically, a 2x2x2 box centered at origin has radius sqrt(1^2 + 1^2 + 1^2) = sqrt(3) ~= 1.732
    expect(result.radius).toBeCloseTo(Math.sqrt(3));
  });
});

describe("buildDemoModel", () => {
  test("returns an Object3D with non-zero vertices and triangles", () => {
    const demo = buildDemoModel();

    expect(demo).toBeInstanceOf(THREE.Object3D);

    const stats = computeStats(demo);
    // It has a body (Box), cabin (Box), and 4 wheels (Cylinder)
    expect(stats.meshes).toBe(6);
    expect(stats.vertices).toBeGreaterThan(0);
    expect(stats.triangles).toBeGreaterThan(0);
  });
});

describe("blobToFile", () => {
  test("keeps name and type exactly from the passed blob", () => {
    const blob = new Blob(["test data"], { type: "text/plain" });
    const file = blobToFile(blob, "test-file.txt");

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("test-file.txt");
    expect(file.type).toBe(blob.type);

    // Check with another type
    const blob2 = new Blob([new Uint8Array([1, 2, 3])], { type: "model/gltf-binary" });
    const file2 = blobToFile(blob2, "model.glb");

    expect(file2.name).toBe("model.glb");
    expect(file2.type).toBe(blob2.type);
  });
});
