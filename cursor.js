const canvas = document.getElementById('cursor-canvas');
const ctx = canvas.getContext('2d');

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('resize', resize);
resize();

// hide the native cursor
document.body.style.cursor = 'none';

const points = [];
const maxPoints = 30;

window.addEventListener('mousemove', (event) => {
  points.push({ x: event.clientX, y: event.clientY });
  if (points.length > maxPoints) points.shift();
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const alpha = (i + 1) / points.length;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = (maxPoints - i) / 5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}

draw();
