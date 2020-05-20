'strict mode';

let paintingCache = {};
let unusedTextures = [];

//const noCors = 'https://cors-anywhere.herokuapp.com/';
const noCors = 'https://api.allorigins.win/raw?url=';
const baseURL = 'https://aggregator-data.artic.edu/api/v1/artworks/search';
const query = '?query[bool][must][][term][classification_titles.keyword]=painting';
const fields = '&fields=image_id,title,artist_display,date_display,category_titles';

const resizeCanvas = document.createElement('canvas');
resizeCanvas.width = resizeCanvas.height = 2048;
const ctx = resizeCanvas.getContext('2d');
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
let aniso = false;

function loadImage(regl, url) {
	if (aniso === false) {
		aniso = regl.hasExtension('EXT_texture_filter_anisotropic') ? regl._gl.getParameter(
			regl._gl.getExtension('EXT_texture_filter_anisotropic').MAX_TEXTURE_MAX_ANISOTROPY_EXT
		) : 0;
		console.log(aniso);
	}

	return fetch(url)
		.then((resp) => resp.blob())
		.then((data) => createImageBitmap(data))
		.then((image) => {
			// Resize image to a power of 2 to use mipmap (faster than createImageBitmap resizing)
			ctx.drawImage(image, 0, 0, resizeCanvas.width, resizeCanvas.height);
			return [(unusedTextures.pop() || regl.texture)({
				data: resizeCanvas,
				min: 'mipmap',
				mipmap: 'nice',
				aniso,
				flipY: true
			}), image.width / image.height];
		});
}

module.exports = {
	fetch: (regl, count = 10, resolution = 512, cbOne, cbAll) => {
		let from = Object.keys(paintingCache).length;
		//console.log(from);
		fetch(baseURL + query + fields + `&from=${from}&size=${count}`)
			.then((r) => r.json())
			.then((paintings) => {
				paintings = paintings.data.filter((d) => d.image_id).map((d) => ({
					...d,
					url: noCors + `https://www.artic.edu/iiif/2/${d.image_id}/full/,${resolution}/0/default.jpg`
				}));
				count = paintings.length;
				paintings.map(p => {
					if (paintingCache[p.url + resolution]) {
						if (--count === 0)
							cbAll();
						return;
					}
					paintingCache[p.url + resolution] = p;
					loadImage(regl, p.url).then(([tex, aspect]) => {
						cbOne({ ...p, tex, aspect });
						if (--count === 0)
							cbAll();
					});
				})
			});
	},
	load: (regl, p) => {
		if (p.tex || p.loading)
			return;
		p.loading = true;
		loadImage(regl, p.url).then(([tex]) => {
			p.loading = false;
			p.tex = tex
		});
	},
	unload: (p) => {
		if (p.tex) {
			unusedTextures.push(p.tex);
			p.tex = undefined;
		}
	}
};
