import * as THREE from "three";
import { fetchHealth } from "./api.js";

async function showBackendStatus() {
  const el = document.getElementById("backend-status");
  try {
    const { status } = await fetchHealth();
    el.textContent = `Backend: ${status}`;
    el.dataset.state = "ok";
  } catch (error) {
    el.textContent = `Backend: sin conexión (${error.message})`;
    el.dataset.state = "error";
  }
}

// Esfera provisional: se reemplaza por GlobeView en la fase 4.
function startPlaceholderGlobe() {
  const canvas = document.getElementById("globe");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 3.5;

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1 }),
  );
  scene.add(moon);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(5, 1, 2);
  scene.add(sun, new THREE.AmbientLight(0xffffff, 0.05));

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  renderer.setAnimationLoop(() => {
    moon.rotation.y += 0.002;
    renderer.render(scene, camera);
  });
}

showBackendStatus();
startPlaceholderGlobe();
