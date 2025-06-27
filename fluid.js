(function () {
  const canvas = document.getElementById('webgl-canvas');
  const gl = canvas.getContext('webgl2', { alpha: false });
  if (!gl) {
    alert('WebGL 2 not supported');
    return;
  }

  const dpr = Math.min(window.devicePixelRatio, 2);
  function resizeCanvas() {
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(vertex, fragment) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function createTexture(w, h, internal, format, type, param) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    return tex;
  }

  function createFBO(w, h, internal, format, type, param) {
    const texture = createTexture(w, h, internal, format, type, param);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, fbo, width: w, height: h };
  }

  function createDoubleFBO(w, h, internal, format, type, param) {
    let fbo1 = createFBO(w, h, internal, format, type, param);
    let fbo2 = createFBO(w, h, internal, format, type, param);
    return {
      get read() { return fbo1; },
      get write() { return fbo2; },
      swap() { const temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
    };
  }

  const baseVertexShader = `#version 300 es
  precision highp float;
  in vec2 aPosition;
  out vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }`;

  const displayShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uTexture;
  void main() {
    outColor = texture(uTexture, vUv);
  }`;

  const splatShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uTarget;
  uniform vec2 point;
  uniform float radius;
  uniform vec3 color;
  uniform float aspectRatio;
  void main() {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 base = texture(uTarget, vUv).rgb;
    float r = exp(-dot(p, p) / radius);
    outColor = vec4(base + color * r, 1.0);
  }`;

  const advectionShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  void main() {
    vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
    outColor = dissipation * texture(uSource, coord);
  }`;

  const divergenceShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;
  void main() {
    float L = texture(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture(uVelocity, vUv - vec2(0.0, texelSize.y)).y;
    float T = texture(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
    float div = 0.5 * (R - L + T - B);
    outColor = vec4(div, 0.0, 0.0, 1.0);
  }`;

  const pressureShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 texelSize;
  void main() {
    float L = texture(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float div = texture(uDivergence, vUv).x;
    float pressure = (L + R + B + T - div) * 0.25;
    outColor = vec4(pressure, 0.0, 0.0, 1.0);
  }`;

  const gradientShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;
  void main() {
    float L = texture(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    vec2 velocity = texture(uVelocity, vUv).xy;
    velocity -= vec2(R - L, T - B) * 0.5;
    outColor = vec4(velocity, 0.0, 1.0);
  }`;

  const curlShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;
  void main() {
    float L = texture(uVelocity, vUv - vec2(texelSize.x, 0.0)).y;
    float R = texture(uVelocity, vUv + vec2(texelSize.x, 0.0)).y;
    float B = texture(uVelocity, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture(uVelocity, vUv + vec2(0.0, texelSize.y)).x;
    float curl = R - L - T + B;
    outColor = vec4(curl, 0.0, 0.0, 1.0);
  }`;

  const vorticityShader = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 texelSize;
  uniform float curl;
  uniform float dt;
  void main() {
    float L = texture(uCurl, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture(uCurl, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture(uCurl, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture(uCurl, vUv + vec2(0.0, texelSize.y)).x;
    float C = texture(uCurl, vUv).x;
    vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L));
    force = normalize(force + 1e-5) * curl * C;
    vec2 velocity = texture(uVelocity, vUv).xy;
    velocity += force * dt;
    outColor = vec4(velocity, 0.0, 1.0);
  }`;

  const programs = {
    display: createProgram(baseVertexShader, displayShader),
    splat: createProgram(baseVertexShader, splatShader),
    advection: createProgram(baseVertexShader, advectionShader),
    divergence: createProgram(baseVertexShader, divergenceShader),
    pressure: createProgram(baseVertexShader, pressureShader),
    gradient: createProgram(baseVertexShader, gradientShader),
    curl: createProgram(baseVertexShader, curlShader),
    vorticity: createProgram(baseVertexShader, vorticityShader)
  };

  const simWidth = canvas.width;
  const simHeight = canvas.height;
  const velocity = createDoubleFBO(simWidth, simHeight, gl.RG16F, gl.RG, gl.FLOAT, gl.LINEAR);
  const dye = createDoubleFBO(simWidth, simHeight, gl.RGBA16F, gl.RGBA, gl.FLOAT, gl.LINEAR);
  const divergence = createFBO(simWidth, simHeight, gl.R16F, gl.RED, gl.FLOAT, gl.NEAREST);
  const curl = createFBO(simWidth, simHeight, gl.R16F, gl.RED, gl.FLOAT, gl.NEAREST);
  const pressure = createDoubleFBO(simWidth, simHeight, gl.R16F, gl.RED, gl.FLOAT, gl.NEAREST);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  for (let key in programs) {
    const program = programs[key];
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  const pointer = { id: -1, down: false, x: 0, y: 0, dx: 0, dy: 0 };
  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - rect.left) / rect.width;
    pointer.y = 1.0 - (e.clientY - rect.top) / rect.height;
  }
  document.addEventListener('pointerdown', e => {
    pointer.down = true;
    getMousePos(e);
  });
  document.addEventListener('pointermove', e => {
    if (!pointer.down) return;
    const oldX = pointer.x;
    const oldY = pointer.y;
    getMousePos(e);
    pointer.dx = pointer.x - oldX;
    pointer.dy = pointer.y - oldY;
  });
  document.addEventListener('pointerup', () => {
    pointer.down = false;
  });

  function bindTextures(target, texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(target, 'uTexture'), 0);
  }

  function splat(x, y, dx, dy) {
    gl.useProgram(programs.splat);
    gl.uniform1f(gl.getUniformLocation(programs.splat, 'aspectRatio'), canvas.width / canvas.height);
    gl.uniform1f(gl.getUniformLocation(programs.splat, 'radius'), 0.01);

    gl.uniform2f(gl.getUniformLocation(programs.splat, 'point'), x, y);
    gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), dx, dy, 0.0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocity.write.fbo);
    bindTextures(programs.splat, velocity.read.texture);
    gl.viewport(0,0,velocity.write.width, velocity.write.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    velocity.swap();

    const color = [Math.random()*3+0.5, Math.random()*3+0.5, Math.random()*3+0.5];
    gl.uniform3f(gl.getUniformLocation(programs.splat, 'color'), color[0], color[1], color[2]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dye.write.fbo);
    bindTextures(programs.splat, dye.read.texture);
    gl.viewport(0,0,dye.write.width, dye.write.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    dye.swap();
  }

  function applyAdvection(target, velocityTex, sourceTex, dissipation) {
    gl.useProgram(programs.advection);
    gl.uniform2f(gl.getUniformLocation(programs.advection, 'texelSize'), 1/target.width, 1/target.height);
    gl.uniform1f(gl.getUniformLocation(programs.advection, 'dt'), 0.016);
    gl.uniform1f(gl.getUniformLocation(programs.advection, 'dissipation'), dissipation);
    gl.uniform1i(gl.getUniformLocation(programs.advection, 'uVelocity'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityTex);
    gl.uniform1i(gl.getUniformLocation(programs.advection, 'uSource'), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0,0,target.width,target.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function computeDivergence(vTex) {
    gl.useProgram(programs.divergence);
    gl.uniform2f(gl.getUniformLocation(programs.divergence, 'texelSize'), 1/divergence.width, 1/divergence.height);
    bindTextures(programs.divergence, vTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, divergence.fbo);
    gl.viewport(0,0,divergence.width, divergence.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function solvePressure() {
    gl.useProgram(programs.pressure);
    gl.uniform2f(gl.getUniformLocation(programs.pressure, 'texelSize'), 1/pressure.read.width, 1/pressure.read.height);
    for (let i=0; i<20; i++) {
      gl.uniform1i(gl.getUniformLocation(programs.pressure, 'uPressure'), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, pressure.read.texture);
      gl.uniform1i(gl.getUniformLocation(programs.pressure, 'uDivergence'), 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, divergence.texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.write.fbo);
      gl.viewport(0,0,pressure.write.width, pressure.write.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      pressure.swap();
    }
  }

  function subtractGradient(vTex) {
    gl.useProgram(programs.gradient);
    gl.uniform2f(gl.getUniformLocation(programs.gradient, 'texelSize'), 1/velocity.read.width, 1/velocity.read.height);
    gl.uniform1i(gl.getUniformLocation(programs.gradient, 'uPressure'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pressure.read.texture);
    gl.uniform1i(gl.getUniformLocation(programs.gradient, 'uVelocity'), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, vTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocity.write.fbo);
    gl.viewport(0,0,velocity.write.width, velocity.write.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    velocity.swap();
  }

  function applyCurl() {
    gl.useProgram(programs.curl);
    gl.uniform2f(gl.getUniformLocation(programs.curl, 'texelSize'), 1/velocity.read.width, 1/velocity.read.height);
    bindTextures(programs.curl, velocity.read.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, curl.fbo);
    gl.viewport(0,0,curl.width,curl.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(programs.vorticity);
    gl.uniform2f(gl.getUniformLocation(programs.vorticity, 'texelSize'), 1/velocity.read.width, 1/velocity.read.height);
    gl.uniform1f(gl.getUniformLocation(programs.vorticity, 'curl'), 30.0);
    gl.uniform1f(gl.getUniformLocation(programs.vorticity, 'dt'), 0.016);
    gl.uniform1i(gl.getUniformLocation(programs.vorticity, 'uVelocity'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);
    gl.uniform1i(gl.getUniformLocation(programs.vorticity, 'uCurl'), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, curl.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocity.write.fbo);
    gl.viewport(0,0,velocity.write.width, velocity.write.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    velocity.swap();
  }

  function render() {
    gl.useProgram(programs.display);
    gl.uniform1i(gl.getUniformLocation(programs.display, 'uTexture'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dye.read.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0,0,canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function update() {
    resizeCanvas();
    if (pointer.down) {
      splat(pointer.x, pointer.y, pointer.dx * 500.0, pointer.dy * 500.0);
      pointer.dx = pointer.dy = 0;
    }

    applyCurl();
    applyAdvection(velocity.write, velocity.read.texture, velocity.read.texture, 0.99);
    velocity.swap();
    applyAdvection(dye.write, velocity.read.texture, dye.read.texture, 0.98);
    dye.swap();

    computeDivergence(velocity.read.texture);
    solvePressure();
    subtractGradient(velocity.read.texture);

    render();
    requestAnimationFrame(update);
  }
  update();
})();
