'use strict';

const text = require('./text');

module.exports = (regl) => {
	const drawText = text.draw(regl);
	const painting =
		regl({
			frag: `
	precision lowp float;
	uniform sampler2D tex;
	varying vec3 uv;

	// http://madebyevan.com/shaders/fast-rounded-rectangle-shadows/
	// This approximates the error function, needed for the gaussian integral
	vec4 erf(vec4 x) {
		vec4 s = sign(x), a = abs(x);
		x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
		x *= x;
		return s - s / (x * x);
	}

	// Return the mask for the shadow of a box from lower to upper
	float boxShadow(vec2 lower, vec2 upper, vec2 point, float sigma) {
		vec4 query = vec4(point - lower, upper - point);
		vec4 integral = 0.5 + 0.5 * erf(query * (sqrt(0.5) / sigma));
		return (integral.z - integral.x) * (integral.w - integral.y);
	}

	void main () {
		float frontMask = smoothstep(0.9, 1.0, uv.z);
		float paintingMask = step(0.001, uv.z);
		float shadowAlpha = boxShadow(vec2(.5), vec2(.7), abs(uv.xy-vec2(.5)), 0.02);
		float wrapping = 0.005 * sign(uv.x-.5) * (1.-uv.z);
		float sideShading = pow(uv.z/4.0, 0.1);
		vec3 col = texture2D(tex, uv.xy - vec2(wrapping, 0.)).rgb;
		col *= mix(sideShading, 1., frontMask);
		gl_FragColor = mix(vec4(0.,0.,0.,shadowAlpha), vec4(col,1.), paintingMask);
	}`,
			vert: `
	precision highp float;
	uniform mat4 proj, view, model;
	uniform float yScale;
	attribute vec3 pos;
	varying vec3 uv;
	void main () {
		uv = pos;
		vec4 mpos = model * vec4(pos, 1);
		mpos.y *= yScale;
		gl_Position = proj * view * mpos;
	}`,

			attributes: {
				pos: [
					0, 0, 1, //Front
					1, 0, 1,
					0, 1, 1,
					1, 1, 1,
					0, 0, 0, //Contour
					1, 0, 0,
					0, 1, 0,
					1, 1, 0,
					-0.1, -0.1, 0, //Shadow
					1.1,  -0.1, 0,
					-0.1,  1.1, 0,
					1.1,   1.1, 0
				]
			},

			//count: 6
			elements: [
				0, 1, 2, 3, 2, 1, //Front
				1, 0, 5, 4, 5, 0, //Contour
				3, 1, 7, 5, 7, 1,
				0, 2, 4, 6, 4, 2,
				8,  9,  4, 5, 4, 9, //Shadow
				9,  11, 5, 7, 5, 11,
				11, 10, 7, 6, 7, 10,
				10, 8,  6, 4, 6, 8,
			],

			uniforms: {
				model: regl.prop('model'),
				tex: regl.prop('tex')
			},

			blend: {
				enable: true,
				func: {
					srcRGB: 'src alpha',
					srcAlpha: 'one minus src alpha',
					dstRGB: 'one minus src alpha',
					dstAlpha: 1
				},
				color: [0, 0, 0, 0]
			}
		});
	return function (batch) {
		painting(batch);
		drawText(batch);
	}
};
