"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { formatCurrency } from "@/lib/utils";

export type PieSlice = {
  key: string;
  label: string;
  value: number;
  color?: string;
};

type Props = {
  slices: PieSlice[];
  size?: number;
  compact?: boolean;
};

/** Azul / laranja / vermelho — laranja no lugar do branco da referência. */
const PALETTE = ["#2f6bff", "#f97316", "#ef4444", "#22c55e", "#eab308", "#a855f7"];

type Arc = {
  key: string;
  label: string;
  value: number;
  portion: number;
  start: number;
  end: number;
  mid: number;
  color: string;
};

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

function makeSliceGeometry(startDeg: number, endDeg: number, radius: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const steps = Math.max(20, Math.ceil((endDeg - startDeg) / 2.5));
  for (let i = 0; i <= steps; i++) {
    const a = degToRad(startDeg + ((endDeg - startDeg) * i) / steps);
    const x = Math.cos(a - Math.PI / 2) * radius;
    const y = Math.sin(a - Math.PI / 2) * radius;
    shape.lineTo(x, y);
  }
  shape.lineTo(0, 0);

  return new THREE.ExtrudeGeometry(shape, {
    // Espessura discreta — como na foto de referência (não um “bloco”).
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.016,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 28,
  });
}

function buildArcs(slices: PieSlice[]): Arc[] {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return [];
  let angle = -20;
  const gap = Math.min(5, 14 / Math.max(slices.length, 1));
  return slices
    .map((slice, i) => {
      const value = Math.max(0, slice.value);
      const portion = (value / total) * 360;
      const rawStart = angle;
      const rawEnd = angle + portion;
      angle = rawEnd;
      const start = rawStart + gap / 2;
      const end = rawEnd - gap / 2;
      if (end - start < 0.5 || portion <= 0.35) return null;
      return {
        key: slice.key,
        label: slice.label,
        value,
        portion,
        start,
        end,
        mid: (start + end) / 2,
        color: slice.color || PALETTE[i % PALETTE.length],
      };
    })
    .filter((a): a is Arc => a != null);
}

/**
 * Pizza 3D WebGL no estilo da referência anexada:
 * fatias explodidas, extrusão com bisel, material mate, luz suave.
 */
export function PieChart3D({ slices, compact = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const arcs = useMemo(() => buildArcs(slices), [slices]);
  const sceneKey = useMemo(
    () => arcs.map((a) => `${a.key}:${a.value}:${a.color}`).join("|"),
    [arcs]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || arcs.length === 0) return;

    const width = host.clientWidth || (compact ? 320 : 360);
    const height = host.clientHeight || (compact ? 320 : 360);

    const scene = new THREE.Scene();

    // Câmera alta, como na foto — pouco “lado”, espessura só sutil.
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    camera.position.set(0, 4.8, 3.0);
    camera.lookAt(0, 0.08, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.replaceChildren(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.88));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(2.2, 5.5, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.radius = 3;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xf1f5f9, 0.35);
    fill.position.set(-3.0, 2.2, -2.0);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 64),
      new THREE.ShadowMaterial({ opacity: 0.14 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const pie = new THREE.Group();
    scene.add(pie);

    const radius = 1.42;
    const explode = 0.1;
    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [
      ground.geometry,
      ground.material,
    ];

    for (const arc of arcs) {
      const geom = makeSliceGeometry(arc.start, arc.end, radius);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(arc.color),
        roughness: 0.55,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Shape em XY, extrude em +Z → deita no chão (XZ)
      mesh.rotation.x = -Math.PI / 2;
      const midRad = degToRad(arc.mid - 90);
      mesh.position.x = Math.cos(midRad) * explode;
      mesh.position.z = Math.sin(midRad) * explode;
      mesh.position.y = 0;
      pie.add(mesh);
      disposables.push(geom, mat);
    }

    // Estático como a foto — sem girar (isso “engrossava” o efeito).
    renderer.render(scene, camera);
    let frame = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      frame = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || width;
      const h = host.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
    // sceneKey cobre mudanças de fatias; arcs é derivado estável via sceneKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, compact]);

  if (total <= 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-500 ${
          compact ? "h-80" : "h-72"
        }`}
      >
        Sem resultado atribuído no período.
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "flex flex-col items-stretch gap-3"
          : "flex flex-col gap-4 sm:flex-row sm:items-center"
      }
    >
      <div
        ref={hostRef}
        className={
          compact
            ? "mx-auto h-80 w-full max-w-[22rem]"
            : "mx-auto h-[22rem] w-full max-w-[24rem]"
        }
        role="img"
        aria-label="Gráfico de pizza 3D explodida"
      />
      <ul
        className={
          compact
            ? "min-w-0 space-y-1.5 text-xs"
            : "min-w-0 flex-1 space-y-2 text-sm"
        }
      >
        {arcs.map((a) => {
          const pct = (a.value / total) * 100;
          return (
            <li key={a.key} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm ring-1 ring-black/5"
                  style={{ background: a.color }}
                />
                <span className="truncate font-medium text-slate-800">{a.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {pct.toFixed(1)}% · {formatCurrency(a.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
