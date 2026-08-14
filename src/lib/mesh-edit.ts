import * as THREE from "three";

/**
 * Edit caches for the cleanup (erase) brush. Works on non-indexed triangles
 * so that removing a triangle never affects its neighbors.
 */
export interface MeshEditCache {
  mesh: THREE.Mesh;
  positions: Float32Array;
  normals: Float32Array | null;
  uvs: Float32Array | null;
  centroids: Float32Array;
  triangleCount: number;
  removed: Set<number>;
}

export function buildEditCaches(root: THREE.Object3D): MeshEditCache[] {
  const caches: MeshEditCache[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const posAttr = source.getAttribute("position");
    if (!posAttr) return;
    const positions = new Float32Array(posAttr.array as Float32Array);
    const normalAttr = source.getAttribute("normal");
    const normals = normalAttr ? new Float32Array(normalAttr.array as Float32Array) : null;
    const uvAttr = source.getAttribute("uv");
    const uvs = uvAttr ? new Float32Array(uvAttr.array as Float32Array) : null;
    const triangleCount = Math.floor(positions.length / 9);
    if (triangleCount === 0) return;
    const centroids = new Float32Array(triangleCount * 3);
    for (let i = 0; i < triangleCount; i++) {
      const o = i * 9;
      centroids[i * 3] = (positions[o] + positions[o + 3] + positions[o + 6]) / 3;
      centroids[i * 3 + 1] = (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3;
      centroids[i * 3 + 2] = (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3;
    }
    caches.push({ mesh, positions, normals, uvs, centroids, triangleCount, removed: new Set() });
  });
  return caches;
}

/** Marks triangles within `radius` (world units) of `worldPoint`. Returns count added. */
export function eraseNear(
  caches: MeshEditCache[],
  worldPoint: THREE.Vector3,
  radius: number,
): number {
  let added = 0;
  for (const cache of caches) {
    const local = cache.mesh.worldToLocal(worldPoint.clone());
    const r2 = radius * radius;
    for (let i = 0; i < cache.triangleCount; i++) {
      if (cache.removed.has(i)) continue;
      const dx = cache.centroids[i * 3] - local.x;
      const dy = cache.centroids[i * 3 + 1] - local.y;
      const dz = cache.centroids[i * 3 + 2] - local.z;
      if (dx * dx + dy * dy + dz * dz <= r2) {
        cache.removed.add(i);
        added += 1;
      }
    }
  }
  return added;
}

/** Rebuilds each cached mesh's geometry from the kept triangles. */
export function applyRemovals(caches: MeshEditCache[]): void {
  for (const cache of caches) {
    const kept: number[] = [];
    for (let i = 0; i < cache.triangleCount; i++) {
      if (!cache.removed.has(i)) kept.push(i);
    }
    const pos = new Float32Array(kept.length * 9);
    const nor = cache.normals ? new Float32Array(kept.length * 9) : null;
    const uv = cache.uvs ? new Float32Array(kept.length * 6) : null;
    for (let k = 0; k < kept.length; k++) {
      const t = kept[k];
      pos.set(cache.positions.subarray(t * 9, t * 9 + 9), k * 9);
      if (nor) nor.set((cache.normals as Float32Array).subarray(t * 9, t * 9 + 9), k * 9);
      if (uv) uv.set((cache.uvs as Float32Array).subarray(t * 6, t * 6 + 6), k * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (nor) geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    if (uv) geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    cache.mesh.geometry.dispose();
    cache.mesh.geometry = geo;
  }
}

export function removedCount(caches: MeshEditCache[]): number {
  let n = 0;
  for (const c of caches) n += c.removed.size;
  return n;
}

export function snapshotRemovals(caches: MeshEditCache[]): Map<THREE.Mesh, Set<number>> {
  const map = new Map<THREE.Mesh, Set<number>>();
  for (const c of caches) map.set(c.mesh, new Set(c.removed));
  return map;
}

export function restoreRemovals(
  caches: MeshEditCache[],
  snapshot: Map<THREE.Mesh, Set<number>>,
): void {
  for (const c of caches) {
    const saved = snapshot.get(c.mesh);
    c.removed.clear();
    if (saved) for (const i of saved) c.removed.add(i);
  }
}
