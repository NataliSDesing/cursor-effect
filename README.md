# Custom Cursor Effect

This example demonstrates a lightweight canvas-based cursor effect inspired by the animation on [lusion.co](https://lusion.co/). It draws a trailing line that follows the mouse cursor. The effect does not rely on external libraries so it can be easily embedded in services like Tilda.

## Usage

Include the `cursor.js` file and the canvas element in your page. The simplest setup is provided in `index.html`:

```html
<canvas id="cursor-canvas"></canvas>
<script src="cursor.js"></script>
```

Make sure the canvas covers the entire page and that the default cursor is hidden.

You can copy the contents of `cursor.js` into a custom code block on Tilda or host the file separately and reference it with a `<script>` tag.
