'use strict';

if (navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i)) {
	document.body.innerText = "This project doesn't work properly on mobile devices";
	throw new Error("mobile device");
}

const mat4 = require('gl-mat4');

let regl, map, drawMap, placement, drawPainting, fps;
try {
	regl = require('regl')({
		extensions: [
			//'angle_instanced_arrays',
			'OES_element_index_uint',
			'OES_standard_derivatives'
		],
		optionalExtensions: [
			//'oes_texture_float',
			'EXT_texture_filter_anisotropic'
		],
		attributes: { alpha : false }
	});

	map = require('./map')();
	drawMap = require('./mesh')(regl, map);
	placement = require('./placement')(regl, map);
	drawPainting = require('./painting')(regl);
	fps = require('./fps')(map);
} catch (e) {
	document.body.innerText = "This project doesn't work on certain browsers";
	throw e;
}

const fovY = Math.PI / 3;
const proj = [];
const context = regl({
	cull: {
		enable: true,
		face: 'back'
	},
	uniforms: {
		view: fps.view,
		yScale: 1.0,
		proj: ({
				viewportWidth,
				viewportHeight
			}) =>
			mat4.perspective(proj, fovY, viewportWidth / viewportHeight, 0.1, 100)
	}
});

const reflexion = regl({
	cull: {
		enable: true,
		face: 'front'
	},
	uniforms: {
		yScale: -1.0
	}
});

regl.frame(({
	time,
	viewportWidth,
	viewportHeight
}) => {
	const fovx = 2 * Math.atan(Math.tan(fovY * 0.5) * viewportWidth / viewportHeight);
	fps.tick({
		time
	});
	placement.update(fps.pos, fps.fmouse[1], fovx);
	regl.clear({
		color: [0, 0, 0, 1],
		depth: 1
	});
	context(() => {
		reflexion(() => {
			drawMap();
			drawPainting(placement.batch());
		});
		drawMap();
		drawPainting(placement.batch());
	});
});