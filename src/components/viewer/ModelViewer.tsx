import * as THREE from "three";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, ContactShadows } from "@react-three/drei";
import {
  applyRemovals,
  buildEditCaches,
  computeStats,
  eraseNear,
  loadModel,
  MeshEditCache,
  ModelFormat,
  ModelStats,
  normalizeModel,
  removedCount,
  restoreRemovals,
  snapshotRemovals,
} from "@/lib/model-io";

export interface ViewerTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface ModelViewerHandle {
  resetCamera(): void;
  undoErase(): boolean;
  clearErase(): void;
  getObject(): THREE.Object3D | null;
  getStats(): ModelStats | null;
  getRadius(): number;
}

interface ModelViewerProps {
  url: string;
  format: ModelFormat;
  mode: "orbit" | "erase";
  brushSize: number; // 0..1, fraction of model radius
  transform: ViewerTransform;
  wireframe: boolean;
  color: string | null; // hex override
  onReady?: (info: { object: THREE.Object3D; stats: ModelStats; radius: number }) => void;
  onEraseCount?: (count: number) => void;
}

function applyMaterialStyle(
  mat: THREE.Material | THREE.Material[],
  originalColors: Map<string, THREE.Color>,
  color: string | null,
  wireframe: boolean,
) {
  const list = Array.isArray(mat) ? mat : [mat];
  for (const m of list) {
    (m as THREE.MeshStandardMaterial).wireframe = wireframe;
    if ((m as THREE.MeshStandardMaterial).color) {
      const key = m.uuid;
      if (color) {
        (m as THREE.MeshStandardMaterial).color.set(color);
      } else if (originalColors.has(key)) {
        (m as THREE.MeshStandardMaterial).color.copy(originalColors.get(key)!);
      }
    }
  }
}

function SceneInner({
  url,
  format,
  mode,
  brushSize,
  transform,
  wireframe,
  color,
  onReady,
  onEraseCount,
  handleRef,
}: ModelViewerProps & { handleRef: React.Ref<ModelViewerHandle> }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);

  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const cachesRef = useRef<MeshEditCache[]>([]);
  const radiusRef = useRef(1);
  const statsRef = useRef<ModelStats | null>(null);
  const originalColorsRef = useRef<Map<string, THREE.Color>>(new Map());
  const undoStackRef = useRef<Map<THREE.Mesh, Set<number>>[]>([]);

  const modeRef = useRef(mode);
  const brushSizeRef = useRef(brushSize);
  const erasingRef = useRef(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  function frameCamera() {
    const obj = objectRef.current;
    const controls = controlsRef.current;
    if (!obj || !controls) return;
    const r = radiusRef.current || 1;
    const center = new THREE.Vector3(0, 0, 0);
    camera.position.set(r * 2.6, r * 1.8, r * 2.6);
    const perspective = camera as THREE.PerspectiveCamera;
    camera.near = r / 100;
    camera.far = r * 200;
    perspective.fov = 45;
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadModel(url, format);
        if (cancelled) return;
        const { object: normalized, radius, center } = normalizeModel(loaded);
        normalized.updateMatrixWorld(true);
        // record original material colors for reset
        const colors = new Map<string, THREE.Color>();
        normalized.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              if ((m as THREE.MeshStandardMaterial).color && !colors.has(m.uuid)) {
                colors.set(m.uuid, (m as THREE.MeshStandardMaterial).color.clone());
              }
            }
          }
        });
        originalColorsRef.current = colors;
        objectRef.current = normalized;
        radiusRef.current = radius;
        statsRef.current = computeStats(normalized);
        cachesRef.current = buildEditCaches(normalized);
        undoStackRef.current = [];
        setObject(normalized);
        frameCamera();
        onReady?.({
          object: normalized,
          stats: statsRef.current,
          radius,
        });
      } catch (err) {
        console.error("Failed to load model:", err);
        onReady?.({ object: new THREE.Group(), stats: { vertices: 0, triangles: 0, meshes: 0 }, radius: 1 });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, format]);

  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;
    obj.position.set(...transform.position);
    obj.rotation.set(...transform.rotation);
    obj.scale.setScalar(transform.scale);
    obj.updateMatrixWorld(true);
  }, [transform]);

  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        applyMaterialStyle(mesh.material, originalColorsRef.current, color, wireframe);
      }
    });
  }, [color, wireframe, object]);

  function paint(point: THREE.Vector3) {
    const caches = cachesRef.current;
    if (!caches.length) return;
    const radius = radiusRef.current * brushSizeRef.current;
    const added = eraseNear(caches, point, radius);
    if (added > 0) {
      applyRemovals(caches);
      const total = removedCount(caches);
      onEraseCount?.(total);
      if (statsRef.current) {
        const s = computeStats(objectRef.current!);
        statsRef.current = s;
      }
    }
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (modeRef.current !== "erase") return;
    erasingRef.current = true;
    undoStackRef.current.push(snapshotRemovals(cachesRef.current));
    paint(e.point);
  };
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (modeRef.current !== "erase" || !erasingRef.current) return;
    paint(e.point);
  };
  const handlePointerUp = () => {
    erasingRef.current = false;
  };

  useImperativeHandle(handleRef, () => ({
    resetCamera: () => frameCamera(),
    undoErase: () => {
      const snapshot = undoStackRef.current.pop();
      if (!snapshot) return false;
      restoreRemovals(cachesRef.current, snapshot);
      applyRemovals(cachesRef.current);
      const total = removedCount(cachesRef.current);
      onEraseCount?.(total);
      if (statsRef.current && objectRef.current) {
        statsRef.current = computeStats(objectRef.current);
      }
      return true;
    },
    clearErase: () => {
      for (const c of cachesRef.current) c.removed.clear();
      undoStackRef.current = [];
      applyRemovals(cachesRef.current);
      onEraseCount?.(0);
      if (statsRef.current && objectRef.current) {
        statsRef.current = computeStats(objectRef.current);
      }
    },
    getObject: () => objectRef.current,
    getStats: () => statsRef.current,
    getRadius: () => radiusRef.current,
  }));

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#cbd5e1", 0.4]} />
      <directionalLight position={[6, 10, 6]} intensity={1.6} />
      <directionalLight position={[-6, 4, -4]} intensity={0.5} />

      <Grid
        position={[0, -1.2, 0]}
        args={[20, 20]}
        cellSize={0.25}
        cellColor="#e5e7eb"
        sectionSize={1}
        sectionColor="#d1d5db"
        fadeDistance={12}
        infiniteGrid
      />
      {object && (
        <>
          <group
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <primitive object={object} />
          </group>
          <ContactShadows
            position={[0, -1.19, 0]}
            opacity={0.35}
            scale={8}
            blur={2.4}
            far={4}
            color="#000000"
          />
        </>
      )}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={mode === "orbit"}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.4}
        maxDistance={40}
      />
    </>
  );
}

export const ModelViewer = forwardRef<ModelViewerHandle, ModelViewerProps>(
  function ModelViewer(props, ref) {
    return (
      <Canvas
        camera={{ position: [3, 2, 3], fov: 45 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
        dpr={[1, 2]}
        style={{ width: "100%", height: "100%", cursor: props.mode === "erase" ? "crosshair" : "grab" }}
      >
        <SceneInner {...props} handleRef={ref} />
      </Canvas>
    );
  },
);
