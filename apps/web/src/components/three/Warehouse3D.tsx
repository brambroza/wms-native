'use client';

import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Bin {
  id: string;
  code: string;
  x: number;
  y: number;
  z: number;
  fill: number; // 0..1
  color: string;
}

const BAY = 1.15; // m
const DEPTH = 1.0;
const LEVEL = 1.0;

export function Warehouse3D({ bins, selectedId, onSelect }: { bins: Bin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <Canvas camera={{ position: [18, 14, 20], fov: 38 }} dpr={[1, 2]} style={{ background: '#f8fafc' }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 18, 8]} intensity={0.8} />
      <Controls />
      <gridHelper args={[40, 40, '#dde3ea', '#e9edf2']} position={[6, 0, 5]} />
      <Racks bins={bins} />
      <Stock bins={bins} selectedId={selectedId} onSelect={onSelect} />
    </Canvas>
  );
}

function Controls() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ctl = new OrbitControls(camera, gl.domElement);
    ctl.target.set(6, 0.5, 5);
    ctl.enableDamping = true;
    ctl.maxPolarAngle = Math.PI / 2.1;
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
  }, [camera, gl]);
  return null;
}

/** Thin shelf plates under every bin, plus uprights at every bay. */
function Racks({ bins }: { bins: Bin[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const posts = useRef<THREE.InstancedMesh>(null);
  const top = useMemo(() => Math.max(0, ...bins.map((b) => b.z)) / 1.1 + LEVEL, [bins]);
  const bays = useMemo(() => [...new Map(bins.map((b) => [`${b.x}|${b.y}`, b])).values()], [bins]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    let i = 0;
    bays.forEach((b) => {
      for (const dz of [0.02, DEPTH - 0.02]) {
        m.compose(new THREE.Vector3(b.x + 0.02, top / 2, b.y + dz), new THREE.Quaternion(), new THREE.Vector3(0.05, top, 0.05));
        posts.current?.setMatrixAt(i++, m);
      }
    });
    if (posts.current) {
      posts.current.count = i;
      posts.current.instanceMatrix.needsUpdate = true;
    }
  }, [bays, top]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    bins.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x + BAY / 2, b.z * LEVEL / 1.1 + 0.02, b.y + DEPTH / 2), new THREE.Quaternion(), new THREE.Vector3(BAY - 0.05, 0.04, DEPTH));
      ref.current?.setMatrixAt(i, m);
    });
    if (ref.current) {
      ref.current.count = bins.length;
      ref.current.instanceMatrix.needsUpdate = true;
    }
  }, [bins]);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, Math.max(bins.length, 1)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c7d0da" />
      </instancedMesh>
      <instancedMesh ref={posts} args={[undefined, undefined, Math.max(bins.length * 2, 1)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1c74c4" />
      </instancedMesh>
    </>
  );
}

function Stock({ bins, selectedId, onSelect }: { bins: Bin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const filled = bins.filter((b) => b.fill > 0);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    filled.forEach((b, i) => {
      const h = 0.15 + 0.7 * Math.min(1, b.fill);
      m.compose(new THREE.Vector3(b.x + BAY / 2, b.z * LEVEL / 1.1 + 0.04 + h / 2, b.y + DEPTH / 2), new THREE.Quaternion(), new THREE.Vector3(BAY - 0.15, h, DEPTH - 0.12));
      ref.current?.setMatrixAt(i, m);
      ref.current?.setColorAt(i, col.set(b.id === selectedId ? '#1c74c4' : b.color));
    });
    if (ref.current) {
      ref.current.count = filled.length;
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [filled, selectedId]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(bins.length, 1)]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onSelect(filled[e.instanceId].id);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
