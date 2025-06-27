console.log('Script работает!');

const canvas = document.getElementById('webgl-canvas');

// Сцена и камера
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2;

// Рендерер
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Загрузка текстуры
const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  (texture) => {
    console.log('Картинка загружена!');
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    // Composer + эффекты
    const composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    const distortionPass = new THREE.ShaderPass(DistortionShader);
    composer.addPass(distortionPass);

    // Обновляем координаты мыши
    const mouse = new THREE.Vector2(0.5, 0.5);
    window.addEventListener('mousemove', (event) => {
      mouse.x = event.clientX / window.innerWidth;
      mouse.y = 1.0 - event.clientY / window.innerHeight;
    });

    // Resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    });

    // Анимация
    function animate(time) {
      requestAnimationFrame(animate);
      distortionPass.uniforms.uMouse.value = mouse;
      distortionPass.uniforms.uTime.value = time * 0.001;
      composer.render();
    }

    animate();
  }
);
