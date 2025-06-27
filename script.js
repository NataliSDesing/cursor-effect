console.log('Script работает!');

const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  (texture) => {
    console.log('Картинка загружена!');
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Composer
    const composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    const shaderPass = new THREE.ShaderPass(DistortionShader);
    composer.addPass(shaderPass);

    const mouse = new THREE.Vector2(0.5, 0.5);
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = 1.0 - e.clientY / window.innerHeight;
    });

    function animate(t) {
      shaderPass.uniforms.uTime.value = t * 0.001;
      shaderPass.uniforms.uMouse.value = mouse;
      composer.render();
      requestAnimationFrame(animate);
    }

    animate();
  }
);
