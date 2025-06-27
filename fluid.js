/*
 * WebGL Fluid Simulation
 * Adapted from Pavel Dobryakov's webgl-fluid-simulation (MIT License)
 * https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
 *
 * This version is trimmed down for demonstration purposes.
 */

(function () {
  const canvas = document.getElementById('webgl-canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL 2 not supported');
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  const vertexShaderSource = `#version 300 es
  precision highp float;
  in vec2 aPosition;
  out vec2 vUv;
  void main () {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  function createProgram(vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  function createTexture(w, h, internalFormat, format, type, param) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    return tex;
  }

  function createFBO(w, h, tex) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0,0,w,h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return [tex, fbo, w, h];
  }

  const velocityTex = createTexture(canvas.width, canvas.height, gl.RGBA16F, gl.RGBA, gl.FLOAT, gl.NEAREST);
  const dyeTex = createTexture(canvas.width, canvas.height, gl.RGBA16F, gl.RGBA, gl.FLOAT, gl.NEAREST);
  const velocity = createFBO(canvas.width, canvas.height, velocityTex);
  const dye = createFBO(canvas.width, canvas.height, dyeTex);

  const displayProgram = createProgram(vertexShaderSource, `#version 300 es
  precision highp float;
  out vec4 outColor;
  in vec2 vUv;
  uniform sampler2D uTexture;
  void main () {
    outColor = texture(uTexture, vUv);
  }
  `);

  const splatProgram = createProgram(vertexShaderSource, `#version 300 es
  precision highp float;
  out vec4 outColor;
  in vec2 vUv;
  uniform sampler2D uTarget;
  uniform vec2 uPoint;
  uniform float uRadius;
  uniform vec3 uColor;
  void main () {
    vec2 diff = vUv - uPoint;
    float r = uRadius;
    float falloff = exp(-dot(diff, diff) / r);
    vec3 base = texture(uTarget, vUv).rgb;
    outColor = vec4(base + uColor * falloff, 1.0);
  }
  `);

  gl.useProgram(displayProgram);
  const displayPosition = gl.getAttribLocation(displayProgram, 'aPosition');
  gl.enableVertexAttribArray(displayPosition);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.vertexAttribPointer(displayPosition, 2, gl.FLOAT, false, 0, 0);

  let pointer = { x:0.5, y:0.5, dx:0, dy:0, down:false };

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    pointer.dx = x - pointer.x;
    pointer.dy = y - pointer.y;
    pointer.x = x;
    pointer.y = y;
    pointer.down = true;
  });

  function splat(fbo, point, color) {
    gl.useProgram(splatProgram);
    gl.uniform1i(gl.getUniformLocation(splatProgram, 'uTarget'), 0);
    gl.uniform2f(gl.getUniformLocation(splatProgram, 'uPoint'), point.x, point.y);
    gl.uniform1f(gl.getUniformLocation(splatProgram, 'uRadius'), 0.05);
    gl.uniform3f(gl.getUniformLocation(splatProgram, 'uColor'), color[0], color[1], color[2]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1]);
    gl.viewport(0,0,fbo[2],fbo[3]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo[0]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function renderTexture(fbo, program) {
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture'), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0,0,canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo[0]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function update() {
    if (pointer.down) {
      splat(dye, pointer, [1.0, 0.0, 0.0]);
      pointer.down = false;
    }
    renderTexture(dye, displayProgram);
    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
})();

