'use strict';

const text = require('./text');

module.exports = (regl) => {
	const drawText = text.draw(regl);
	const painting =
		regl({
			frag: `
	precision mediump float;
	uniform sampler2D tex;
	varying vec3 uv;

	float hash( float n ) { return fract(sin(n)*43758.5453123); }
	float noise( in vec3 x ){
		vec3 p = floor(x);
		vec3 f = fract(x);
		f = f*f*(3.0-2.0*f);
		
		float n = p.x + p.y*157.0 + 113.0*p.z;
		return mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
					mix( hash(n+157.0), hash(n+158.0),f.x),f.y),
				mix(mix( hash(n+113.0), hash(n+114.0),f.x),
					mix( hash(n+270.0), hash(n+271.0),f.x),f.y),f.z);
	}
	
	float sdBox( in vec2 p, in vec2 b ) {
		vec2 d = abs(p)-b;
		return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
	}

	void main () {
		float alpha = 1.0;
		alpha -= 5.0*pow(max(0.0,0.07+sdBox(uv.xy - vec2(0.5,0.48), vec2(0.55))), 0.7);
		alpha -= 3.0*pow(max(0.0,sdBox(uv.xy - vec2(0.5,0.5), vec2(0.49))), 0.7);
		alpha *= 0.9 + 0.1*noise(200.0*uv.xyy) + uv.z;
		vec3 col = texture2D(tex, uv.xy - sign(uv.x-0.5) * 0.005*vec2(1.0-uv.z,0.0)).rgb;
		col *= pow(uv.z,0.4);
		gl_FragColor = vec4(col, alpha);
	}`,
			vert: `
	precision mediump float;
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
				//pos: [0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0]
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
				8, 9, 10, 11, 10, 9, //Shadow
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
