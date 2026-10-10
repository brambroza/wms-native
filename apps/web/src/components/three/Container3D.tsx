'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { CONTAINER_TYPES, GROUP_COLORS, type ContainerType, type LoadStep } from '@wms/shared';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Container load plan in 3D. Units: metres (load steps are in cm).
 * Loaded cartons are solid PO colours, the next carton glows, the rest are faint ghosts.
 */
export function Container3D({ steps, loadedSerials, nextSerial, type }: { steps: LoadStep[]; loadedSerials: Set<string>; nextSerial?: string | null; type: ContainerType['code'] }) {
  const c = CONTAINER_TYPES[type];
  const L = c.innerLengthCm / 100;
  const W = c.innerWidthCm / 100;
  const H = c.innerHeightCm / 100;
  return (
    <Canvas camera={{ position: [L * 0.85, H * 2.4, W * 4.2], fov: 40 }} dpr={[1, 2]} style={{ background: '#f8fafc' }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 10, 6]} intensity={0.9} />
      <Controls target={[L / 2, H / 3, W / 2]} />
      <gridHelper args={[30, 30, '#dde3ea', '#e9edf2']} position={[L / 2, 0, W / 2]} />
      <ContainerShell L={L} W={W} H={H} />
      <Cartons steps={steps} loaded={loadedSerials} next={nextSerial ?? null} />
    </Canvas>
  );
}

function Controls({ target }: { target: [number, number, number] }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ctl = new OrbitControls(camera, gl.domElement);
    ctl.target.set(...target);
    ctl.enableDamping = true;
    ctl.maxPolarAngle = Math.PI / 2.05;
    ctl.update();
    let raf = 0;
    const loop = () => {
      ctl.update();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ctl.dispose();
    };
  }, [camera, gl, target]);
  return null;
}

function ContainerShell({ L, W, H }: { L: number; W: number; H: number }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)), [L, H, W]);
  return (
    <group position={[L / 2, H / 2, W / 2]}>
      <mesh>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial color="#9cc3e6" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#4da3f0" />
      </lineSegments>
      <mesh position={[0, -H / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#dfe6ee" />
      </mesh>
    </group>
  );
}

function Cartons({ steps, loaded, next }: { steps: LoadStep[]; loaded: Set<string>; next: string | null }) {
  const solid = useRef<THREE.InstancedMesh>(null);
  const ghost = useRef<THREE.InstancedMesh>(null);
  const groups = useMemo(() => [...new Set(steps.map((s) => s.group))], [steps]);

  const { solidSteps, ghostSteps, nextStep } = useMemo(() => {
    const solidSteps: LoadStep[] = [];
    const ghostSteps: LoadStep[] = [];
    let nextStep: LoadStep | null = null;
    for (const s of steps) {
      if (loaded.has(s.serial)) solidSteps.push(s);
      else if (s.serial === next) nextStep = s;
      else ghostSteps.push(s);
    }
    return { solidSteps, ghostSteps, nextStep };
  }, [steps, loaded, next]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const place = (mesh: THREE.InstancedMesh | null, list: LoadStep[], colorFor?: (s: LoadStep) => string) => {
      if (!mesh) return;
      list.forEach((s, i) => {
        const gap = 0.006;
        m.compose(
          new THREE.Vector3((s.x + s.l / 2) / 100, (s.z + s.h / 2) / 100, (s.y + s.w / 2) / 100),
          new THREE.Quaternion(),
          new THREE.Vector3(s.l / 100 - gap, s.h / 100 - gap, s.w / 100 - gap),
        );
        mesh.setMatrixAt(i, m);
        if (colorFor) mesh.setColorAt(i, color.set(colorFor(s)));
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    place(solid.current, solidSteps, (s) => GROUP_COLORS[groups.indexOf(s.group) % GROUP_COLORS.length]);
    place(ghost.current, ghostSteps);
  }, [solidSteps, ghostSteps, groups]);

  const max = Math.max(steps.length, 1);
  return (
    <group>
      <instancedMesh ref={solid} args={[undefined, undefined, max]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={ghost} args={[undefined, undefined, max]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#9aa6b4" transparent opacity={0.12} depthWrite={false} />
      </instancedMesh>
      {nextStep && (
        <mesh position={[(nextStep.x + nextStep.l / 2) / 100, (nextStep.z + nextStep.h / 2) / 100, (nextStep.y + nextStep.w / 2) / 100]}>
          <boxGeometry args={[nextStep.l / 100, nextStep.h / 100, nextStep.w / 100]} />
          <meshStandardMaterial color="#1c74c4" emissive="#4da3f0" emissiveIntensity={0.6} />
        </mesh>
      )}
    </group>
  );
}
