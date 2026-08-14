import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  applyRemovals,
  buildEditCaches,
  eraseNear,
  removedCount,
  restoreRemovals,
  snapshotRemovals,
  type MeshEditCache,
} from "../src/lib/mesh-edit";

type Vec3 = [number, number, number];

/** Builds a non-indexed geometry from a list of triangles. */
function triangleGeometry(triangles: Vec3[][]): THREE.BufferGeometry {
  const positions = new Float32Array(triangles.length * 9);
  triangles.forEach((tri, i) => {
    tri.forEach((p, v) => {
      positions[i * 9 + v * 3] = p[0];
      positions[i * 9 + v * 3 + 1] = p[1];
      positions[i * 9 + v * 3 + 2] = p[2];
    });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Three unit triangles with well-separated centroids. */
function threeTriangles(): THREE.BufferGeometry {
  return triangleGeometry([
    [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [2, 0, 0],
      [3, 0, 0],
      [2.5, 1, 0],
    ],
    [
      [4, 0, 0],
      [5, 0, 0],
      [4.5, 1, 0],
    ],
  ]);
}

describe("buildEditCaches", () => {
  test("builds one cache per mesh with correct triangle count and centroids", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    const caches = buildEditCaches(mesh);

    expect(caches).toHaveLength(1);
    expect(caches[0].triangleCount).toBe(3);
    expect(caches[0].removed.size).toBe(0);

    // centroid of triangle 0 is (1/3, 1/3, 0)
    expect(caches[0].centroids[0]).toBeCloseTo(1 / 3);
    expect(caches[0].centroids[1]).toBeCloseTo(1 / 3);
    expect(caches[0].centroids[2]).toBeCloseTo(0);
    // centroid of triangle 1 is (2.5, 1/3, 0)
    expect(caches[0].centroids[3]).toBeCloseTo(2.5);
    expect(caches[0].centroids[4]).toBeCloseTo(1 / 3);
  });

  test("converts indexed geometry to non-indexed triangles", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const caches = buildEditCaches(mesh);

    expect(caches).toHaveLength(1);
    expect(caches[0].triangleCount).toBe(12);
    // A box has 8 unique vertices but 36 after de-indexing.
    expect(caches[0].positions.length).toBe(12 * 9);
  });

  test("skips non-mesh children, skinned meshes, and empty geometry", () => {
    const group = new THREE.Group();
    group.add(new THREE.Object3D());
    group.add(new THREE.SkinnedMesh(new THREE.BufferGeometry()));
    group.add(new THREE.Mesh(new THREE.BufferGeometry()));

    expect(buildEditCaches(group)).toHaveLength(0);
  });

  test("collects caches across nested meshes", () => {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(new THREE.Mesh(threeTriangles()));
    inner.add(new THREE.Mesh(threeTriangles()));
    group.add(inner);

    expect(buildEditCaches(group)).toHaveLength(2);
  });
});

describe("eraseNear", () => {
  test("marks only triangles whose centroid is within the radius and returns newly added count", () => {
    const caches = buildEditCaches(new THREE.Mesh(threeTriangles()));

    // Triangle 0 centroid ~ (0.333, 0.333, 0); triangle 1 is ~2.2 units away.
    const added = eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1);
    expect(added).toBe(1);
    expect(removedCount(caches)).toBe(1);

    // Re-erasing the same spot adds nothing (already removed).
    expect(eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1)).toBe(0);

    // A second, distinct spot removes only triangle 1.
    expect(eraseNear(caches, new THREE.Vector3(2.5, 0.33, 0), 0.05)).toBe(1);
    expect(removedCount(caches)).toBe(2);
  });

  test("respects boundary: centroids outside the radius are kept", () => {
    const caches = buildEditCaches(new THREE.Mesh(threeTriangles()));

    // Pointed at triangle 0 but radius too small to reach its centroid.
    const added = eraseNear(caches, new THREE.Vector3(0.2, 0.2, 0), 0.01);
    expect(added).toBe(0);
    expect(removedCount(caches)).toBe(0);
  });

  test("maps world points through the mesh transform", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    mesh.position.set(10, 0, 0);
    mesh.updateMatrixWorld(true);
    const caches = buildEditCaches(mesh);

    // World-space point near the translated triangle 0 centroid.
    expect(eraseNear(caches, new THREE.Vector3(10.3, 0.3, 0), 0.1)).toBe(1);
  });

  test("does not erase when the world point lands far from every centroid after transform", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    mesh.position.set(10, 0, 0);
    mesh.updateMatrixWorld(true);
    const caches = buildEditCaches(mesh);

    expect(eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1)).toBe(0);
  });
});

describe("applyRemovals", () => {
  test("rebuilds geometry with only the kept triangles", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    const caches = buildEditCaches(mesh);

    eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1); // remove triangle 0
    applyRemovals(caches);

    const pos = mesh.geometry.getAttribute("position");
    expect(pos.count).toBe(6); // 2 triangles * 3 vertices
    // Kept triangles are the original ones at index 1 and 2.
    expect(pos.getX(0)).toBeCloseTo(2);
    expect(pos.getX(1)).toBeCloseTo(3);
    expect(pos.getX(2)).toBeCloseTo(2.5);
    expect(pos.getX(3)).toBeCloseTo(4);
    expect(pos.getX(4)).toBeCloseTo(5);
    expect(pos.getX(5)).toBeCloseTo(4.5);

    // The removed set is untouched; only the rendered geometry shrinks.
    expect(removedCount(caches)).toBe(1);
  });

  test("preserves normals and uvs for kept triangles", () => {
    const geo = triangleGeometry([
      [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
      [
        [2, 0, 0],
        [3, 0, 0],
        [2.5, 1, 0],
      ],
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 10, 10, 11, 10, 10, 11]);
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    const mesh = new THREE.Mesh(geo);
    const caches = buildEditCaches(mesh);

    eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1); // remove triangle 0
    applyRemovals(caches);

    expect(mesh.geometry.getAttribute("normal")).toBeDefined();
    const uv = mesh.geometry.getAttribute("uv");
    expect(uv.count).toBe(3);
    expect(uv.getX(0)).toBeCloseTo(10);
  });

  test("rebuilding with everything removed produces an empty geometry", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    const caches = buildEditCaches(mesh);

    eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 10); // radius covers all three
    applyRemovals(caches);

    expect(mesh.geometry.getAttribute("position").count).toBe(0);
  });
});

describe("snapshotRemovals / restoreRemovals", () => {
  test("restores a prior removal state for undo", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    const caches = buildEditCaches(mesh);

    eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1); // remove triangle 0
    const snapshot = snapshotRemovals(caches);
    expect(removedCount(caches)).toBe(1);

    eraseNear(caches, new THREE.Vector3(2.5, 0.33, 0), 0.05); // also remove triangle 1
    expect(removedCount(caches)).toBe(2);

    restoreRemovals(caches, snapshot);
    expect(removedCount(caches)).toBe(1);

    applyRemovals(caches);
    expect(mesh.geometry.getAttribute("position").count).toBe(6);
  });

  test("snapshots are independent copies, not live references", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    const caches = buildEditCaches(mesh);

    const snapshot = snapshotRemovals(caches);
    eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1);

    // Snapshot captured before the erase must still be empty.
    expect(Array.from(snapshot.get(mesh) ?? []).length).toBe(0);
    expect(removedCount(caches)).toBe(1);
  });

  test("restores each mesh independently across caches", () => {
    const group = new THREE.Group();
    const m1 = new THREE.Mesh(threeTriangles());
    const m2 = new THREE.Mesh(threeTriangles());
    group.add(m1, m2);
    const caches = buildEditCaches(group);
    expect(caches).toHaveLength(2);

    eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1); // hits triangle 0 of both meshes
    expect(removedCount(caches)).toBe(2);
    const snapshot = snapshotRemovals(caches);

    eraseNear(caches, new THREE.Vector3(2.5, 0.33, 0), 0.05); // hits triangle 1 of both
    expect(removedCount(caches)).toBe(4);

    restoreRemovals(caches, snapshot);
    expect(removedCount(caches)).toBe(2);

    applyRemovals(caches);
    expect(m1.geometry.getAttribute("position").count).toBe(6);
    expect(m2.geometry.getAttribute("position").count).toBe(6);
  });
});

describe("erase → undo flow", () => {
  test("mirrors the viewer's stroke/undo sequence", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    const caches = buildEditCaches(mesh);
    const undoStack: Map<THREE.Mesh, Set<number>>[] = [];

    // Stroke 1: push snapshot, then erase.
    undoStack.push(snapshotRemovals(caches));
    expect(eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1)).toBe(1);
    applyRemovals(caches);
    expect(mesh.geometry.getAttribute("position").count).toBe(6);

    // Stroke 2.
    undoStack.push(snapshotRemovals(caches));
    expect(eraseNear(caches, new THREE.Vector3(2.5, 0.33, 0), 0.05)).toBe(1);
    applyRemovals(caches);
    expect(mesh.geometry.getAttribute("position").count).toBe(3);

    // Undo stroke 2.
    restoreRemovals(caches, undoStack.pop()!);
    applyRemovals(caches);
    expect(removedCount(caches)).toBe(1);
    expect(mesh.geometry.getAttribute("position").count).toBe(6);

    // Undo stroke 1.
    restoreRemovals(caches, undoStack.pop()!);
    applyRemovals(caches);
    expect(removedCount(caches)).toBe(0);
    expect(mesh.geometry.getAttribute("position").count).toBe(9);
  });

  test("clearErase resets caches and rebuilds the full geometry", () => {
    const mesh = new THREE.Mesh(threeTriangles());
    const caches = buildEditCaches(mesh);

    eraseNear(caches, new THREE.Vector3(0.3, 0.3, 0), 0.1);
    eraseNear(caches, new THREE.Vector3(2.5, 0.33, 0), 0.05);
    applyRemovals(caches);
    expect(mesh.geometry.getAttribute("position").count).toBe(3);

    // Same steps the viewer's clearErase performs.
    for (const c of caches) c.removed.clear();
    applyRemovals(caches);
    expect(removedCount(caches)).toBe(0);
    expect(mesh.geometry.getAttribute("position").count).toBe(9);
  });
});

describe("removedCount", () => {
  test("sums removed triangles across all caches", () => {
    const caches: MeshEditCache[] = [
      {
        mesh: new THREE.Mesh(new THREE.BufferGeometry()),
        positions: new Float32Array(),
        normals: null,
        uvs: null,
        centroids: new Float32Array(),
        triangleCount: 0,
        removed: new Set([1, 2, 3]),
      },
      {
        mesh: new THREE.Mesh(new THREE.BufferGeometry()),
        positions: new Float32Array(),
        normals: null,
        uvs: null,
        centroids: new Float32Array(),
        triangleCount: 0,
        removed: new Set([7]),
      },
    ];
    expect(removedCount(caches)).toBe(4);
  });
});
