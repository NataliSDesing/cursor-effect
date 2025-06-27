# WebGL Fluid Cursor Effect

This project now showcases a lightweight WebGL fluid simulation inspired by [Pavel Dobryakov's webgl-fluid-simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation).  The effect reproduces the liquid cursor interaction seen on sites like [advanced.team](https://advanced.team/) and [colbacolorbar.ru](https://colbacolorbar.ru/).  It reacts to mouse movement, creating colorful swirling patterns and can be embedded in website builders such as Tilda.

## Usage

Include the `fluid.js` file and the canvas element in your page. The simplest setup is provided in `index.html`:

```html
<canvas id="webgl-canvas"></canvas>
<script src="fluid.js"></script>
```

Make sure the canvas covers the entire page and that the default cursor is hidden if you wish to hide the pointer.

You can copy the contents of `fluid.js` into a custom code block on Tilda or host the file separately and reference it with a `<script>` tag. The script requires WebGL 2 support.

To enable the effect on another website, simply include the above canvas and script tags in your HTML. No additional dependencies are required.
