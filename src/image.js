'strict mode';

const api = require('../api/api');
const selectedApi = new URLSearchParams(window.location.search).get("api");
const dataAccess = api[selectedApi] || api[api.default];
const text = require('./text');

let paintingCache = {};
let unusedTextures = [];

const dynamicResThreshold = 2;

function resolution(quality) {
	const factor = !navigator.connection || navigator.connection.downlink > dynamicResThreshold ? 1 : 0.5;
	return {
		"low": 512,
		"high": 1024
	} [quality] * factor;
}

const resizeCanvas = document.createElement('canvas');
resizeCanvas.width = resizeCanvas.height = 2048;
const ctx = resizeCanvas.getContext('2d');
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
let aniso = false;

const emptyImage = (regl) => [
	(unusedTextures.pop() || regl.texture)([[[200, 200, 200]]]),
	text.init((unusedTextures.pop() || regl.texture), ""),
	1
];

async function loadImage(regl, p, res) {
	if (aniso === false) {
		aniso = regl.hasExtension('EXT_texture_filter_anisotropic') ? regl._gl.getParameter(
			regl._gl.getExtension('EXT_texture_filter_anisotropic').MAX_TEXTURE_MAX_ANISOTROPY_EXT
		) : 0;
		console.log(aniso);
	}
	
	let image, title;
	try {
		const data = await dataAccess.fetchImage(p, resolution(res));
		// Resize image to a power of 2 to use mipmap (faster than createImageBitmap resizing)
		image = await createImageBitmap(data.image);
		ctx.drawImage(image, 0, 0, resizeCanvas.width, resizeCanvas.height);
		title = text.init((unusedTextures.pop() || regl.texture), data.title);
	} catch(e) {
		// Try again with a lower resolution, otherwise return an empty image
		console.error(e);
		return res == "high" ? await loadImage(regl, p, "low") : emptyImage(regl);
	}

	return [(unusedTextures.pop() || regl.texture)({
			data: resizeCanvas,
			min: 'mipmap',
			mipmap: 'nice',
			aniso,
			flipY: true
		}),
		title,
		image.width / image.height
	];
}

module.exports = {
	fetch: (regl, count = 10, res = "low", cbOne, cbAll) => {
		const from = Object.keys(paintingCache).length;
		dataAccess.fetchList(from, count).then(paintings => {
			count = paintings.length;
			paintings.map(p => {
				if (paintingCache[p.image_id]) {
					if (--count === 0)
						cbAll();
					return;
				}
				paintingCache[p.image_id] = p;
				loadImage(regl, p, res).then(([tex, text, aspect]) => {
					cbOne({ ...p, tex, text, aspect });
					if (--count === 0)
						cbAll();
				});
			})
		});
	},
	load: (regl, p, res = "low") => {
		if (p.tex || p.loading)
			return;
		p.loading = true;
		loadImage(regl, p, res).then(([tex, text]) => {
			p.loading = false;
			p.tex = tex;
			p.text = text;
		});
	},
	unload: (p) => {
		if (p.tex) {
			unusedTextures.push(p.tex);
			p.tex = undefined;
		}
		if (p.text) {
			unusedTextures.push(p.text);
			p.text = undefined;
		}
	}
};