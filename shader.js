console.log("Shader загружен!");
const DistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0.0 },
    uStrength: { value: 0.2 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uMouse;
    uniform float uTime;
    uniform float uStrength;
    uniform vec2 uResolution;
    varying vec2 vUv;

    void main() {
      vec2 mouse = uMouse;
      vec2 diff = vUv - mouse;
      float dist = length(diff);
      float effect = exp(-dist * 40.0) * uStrength;
      vec2 uv = vUv + normalize(diff) * effect;
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `
};
