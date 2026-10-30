import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { loadGLTF } from "../../../loader.js";

const thoughts = [
  "I don't feel like doing anything today.",
  "Everything feels completely overwhelming.",
  "I'm exhausted no matter how much I sleep.",
  "I just want to stay in bed and hide away."
];

const bubble = document.getElementById("thoughtBubble");
const choices = document.getElementById("choices");
const impactPanel = document.getElementById("impactPanel");
const impactText = document.getElementById("impactText");
const infoPanel = document.getElementById("infoPanel");

let anchorGroup = null;
let isTargetVisible = false;

// Markerless WebXR variables
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let placedContent = false;

/* ------------------------------
   INITIALIZE MARKERLESS AR
------------------------------ */

const initializeMarkerlessAR = () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Create WebXR AR Button requiring hit-test capability
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test']
    })
  );

  return { renderer, scene, camera };
};

/* ------------------------------
   SETUP LIGHTING & RETICLE
------------------------------ */

const setupLightingAndReticle = (scene) => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // Surface indicator ring
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
};

/* ------------------------------
   GLOBAL ANIMATION VARIABLES
------------------------------ */

let mixer = null;
let actions = {};
const clock = new THREE.Clock();

/* ------------------------------
   LOAD AVATAR MODEL
------------------------------ */

const loadAvatarModel = async () => {
  const avatar = await loadGLTF(
    "../fyp/assets/models/depressionmoving.glb"
  );

  avatar.scene.scale.set(0.4, 0.4, 0.4);
  avatar.scene.position.set(0, 0, 0);
  avatar.scene.rotation.y = -Math.PI / 2;

  if (avatar.animations && avatar.animations.length > 0) {
    mixer = new THREE.AnimationMixer(avatar.scene);

    avatar.animations.forEach((clip) => {
      console.log("Found animation clip:", clip.name);
      const action = mixer.clipAction(clip);
      actions[clip.name] = action;
      action.reset().play();
    });
  } else {
    console.warn("No animations found in depressionmoving.glb");
  }

  avatar.scene.updateMatrixWorld(true);
  return avatar;
};

/* ------------------------------
   LOAD CUSTOM SCENE
------------------------------ */

const loadCustomScene = async () => {
  const environment = await loadGLTF(
    "../fyp/assets/scenes/bedroomwibu.glb"
  );

  const testScale = 0.2;
  environment.scene.scale.set(testScale, testScale, testScale);
  environment.scene.position.set(0, 0, -0.5);
  environment.scene.rotation.y = -Math.PI;

  environment.scene.updateMatrixWorld(true);
  return environment;
};

/* ------------------------------
   SETUP PLACEMENT LISTENER (TAP TO PLACE)
------------------------------ */

const setupPlacement = (renderer, scene, avatarModel, sceneModel) => {
  const controller = renderer.xr.getController(0);

  controller.addEventListener('select', () => {
    if (reticle.visible && !placedContent) {
      anchorGroup = new THREE.Group();
      anchorGroup.position.setFromMatrixPosition(reticle.matrix);

      anchorGroup.add(sceneModel.scene);
      anchorGroup.add(avatarModel.scene);
      scene.add(anchorGroup);

      placedContent = true;
      reticle.visible = false;
      isTargetVisible = true;

      if (
        impactPanel.style.display !== "block" &&
        choices.style.display !== "flex"
      ) {
        bubble.innerHTML = "Tap the screen to read thoughts. Drag screen to rotate.";
        infoPanel.innerHTML = "Interact with the avatar to explore responses.";
      }
    }
  });

  scene.add(controller);
};

/* ------------------------------
   TOUCH CONTROLS
------------------------------ */

const enableTouchControls = () => {
  let isDragging = false;
  let activePointerId = null;
  let previousPosition = { x: 0, y: 0 };
  let dragDistance = 0;

  const DRAG_THRESHOLD = 10;
  const ROTATION_SPEED = 0.005;

  window.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;

    if (
      event.target instanceof Element &&
      event.target.closest("button, input, textarea, select, a")
    ) {
      return;
    }

    isDragging = true;
    activePointerId = event.pointerId;
    dragDistance = 0;

    previousPosition = {
      x: event.clientX,
      y: event.clientY
    };
  });

  window.addEventListener("pointermove", (event) => {
    if (!isDragging || event.pointerId !== activePointerId) return;

    const deltaX = event.clientX - previousPosition.x;
    const deltaY = event.clientY - previousPosition.y;

    dragDistance += Math.hypot(deltaX, deltaY);

    if (dragDistance >= DRAG_THRESHOLD && anchorGroup) {
      anchorGroup.rotation.y += deltaX * ROTATION_SPEED;
      anchorGroup.rotation.x += deltaY * ROTATION_SPEED;
    }

    previousPosition = {
      x: event.clientX,
      y: event.clientY
    };
  });

  window.addEventListener("pointerup", (event) => {
    if (!isDragging || event.pointerId !== activePointerId) return;

    isDragging = false;
    activePointerId = null;

    if (dragDistance >= DRAG_THRESHOLD) return;
    if (!isTargetVisible) return;
    if (impactPanel.style.display === "block") return;

    const thought = thoughts[Math.floor(Math.random() * thoughts.length)];

    bubble.innerHTML = thought;
    choices.style.display = "flex";
    infoPanel.innerHTML = "Choose how to respond.";
  });

  window.addEventListener("pointercancel", () => {
    isDragging = false;
    activePointerId = null;
    dragDistance = 0;
  });

  window.addEventListener("blur", () => {
    isDragging = false;
    activePointerId = null;
    dragDistance = 0;
  });
};

/* ------------------------------
   RESPONSE BUTTONS
------------------------------ */

document.getElementById("supportBtn").addEventListener("click", () => {
  bubble.innerHTML = "Thank you for listening.";
  choices.style.display = "none";
  impactText.innerHTML =
    "<strong>Support Impact:</strong> Listening without judgement builds trust and reduces isolation, helping the individual feel validated.";
  impactPanel.style.display = "block";
  infoPanel.innerHTML = "Review impact analysis.";
});

document.getElementById("healthyBtn").addEventListener("click", () => {
  bubble.innerHTML = "Maybe I should take one small step today.";
  choices.style.display = "none";
  impactText.innerHTML =
    "<strong>Coping Impact:</strong> Encouraging small routines and professional guidance aids gradual emotional recovery.";
  impactPanel.style.display = "block";
  infoPanel.innerHTML = "Review impact analysis.";
});

document.getElementById("ignoreBtn").addEventListener("click", () => {
  bubble.innerHTML = "I guess I'll keep these feelings to myself.";
  choices.style.display = "none";
  impactText.innerHTML =
    "<strong>Isolation Impact:</strong> Dismissing or ignoring emotional struggles deepens feelings of loneliness and worsens symptoms.";
  impactPanel.style.display = "block";
  infoPanel.innerHTML = "Review impact analysis.";
});

document.getElementById("returnBtn").addEventListener("click", () => {
  impactPanel.style.display = "none";
  bubble.innerHTML = "Tap the screen to read thoughts. Drag screen to rotate.";
  infoPanel.innerHTML = "Interact with the avatar to explore responses.";
});

/* ------------------------------
   START APPLICATION
------------------------------ */

const startApp = async () => {
  try {
    const { renderer, scene, camera } = initializeMarkerlessAR();

    setupLightingAndReticle(scene);

    const [avatar, customScene] = await Promise.all([
      loadAvatarModel(),
      loadCustomScene()
    ]);

    setupPlacement(renderer, scene, avatar, customScene);
    enableTouchControls();

    renderer.setAnimationLoop((timestamp, frame) => {
      const delta = clock.getDelta();

      if (mixer) {
        mixer.update(delta);
      }

      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((viewerSpace) => {
            session.requestHitTestSource({ space: viewerSpace }).then((source) => {
              hitTestSource = source;
            });
          });
          session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            placedContent = false;
            isTargetVisible = false;
          });
          hitTestSourceRequested = true;
        }

        if (hitTestSource && !placedContent) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            reticle.visible = true;
            reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            infoPanel.innerHTML = "Surface detected! Tap screen to place scene.";
          } else {
            reticle.visible = false;
            infoPanel.innerHTML = "Point camera at floor/table to detect surface.";
          }
        }
      }

      renderer.render(scene, camera);
    });

  } catch (error) {
    console.error("Failed to initialize markerless AR application:", error);
  }
};

// Start after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp, {
    once: true
  });
} else {
  startApp();
}