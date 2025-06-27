console.log('Shader загружен!');

const DistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) }
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
    uniform float uTime;
    uniform vec2 uMouse;
    varying vec2 vUv;

    void main() {
      vec2 distortedUv = vUv + 0.02 * vec2(sin(uTime + vUv.y * 10.0), cos(uTime + vUv.x * 10.0));
      vec4 color = texture2D(tDiffuse, distortedUv);
      gl_FragColor = color;
    }
  `
};
