'use strict';
const transform = (a, r, tx, ty, o = 1) => a.map((v) => [(o * v[r] + tx) / 2, (o * v[1 - r] + ty) / 2]);

function hilbert(n) {
	if (n === 1) return transform([[0, 0], [0, 1], [1, 1], [1, 0]], 0, 0.5, 0.5);
	const h = hilbert(n - 1);
	return [
		...transform(h, 1, 0, 0),
		...transform(h, 0, 0, 1),
		...transform(h, 0, 1, 1),
		...transform(h, 1, 2, 1, -1)
	];
}

function genBorder(n, w, m) {
	w /= 2;
	m *= Math.pow(4, n);
	console.time('hilbert');
	const points = hilbert(n);
	console.timeEnd('hilbert');
	// Add points to fix end
	points.unshift(points[3]);
	points.push(points[points.length - 4]);
	// Calculate direction
	console.time('dir');
	let nodes = [];
	for (let i = 0; i < points.length - 2; i++) {
		const p0 = points[i];
		const p1 = points[i + 1];
		const p2 = points[i + 2];
		const d1 = [p1[0] - p0[0], p1[1] - p0[1]];
		const d2 = [p2[0] - p1[0], p2[1] - p1[1]];
		nodes[i] = { p0, p1, p2, s: Math.sign(d1[0] * d2[1] - d1[1] * d2[0]) };
	}
	console.timeEnd('dir');
	// Fix end
	let inverse = nodes.slice(0).reverse();
	inverse = inverse.map(({ p0, p1, p2, s }) => ({ p0: p2, p1, p2: p0, s: -s }));
	if (n % 2) nodes.splice(-3);
	else inverse.splice(0, 3);
	nodes = nodes.concat(inverse);
	// Remove walls
	const removeWall = (r) => {
		if (nodes[r + 1].s === -1 && nodes[r + 2].s === -1) {
			nodes[r].s--;
			nodes[r + 3].s--;
			nodes[r].p2 = nodes[r + 3].p1;
			nodes[r + 3].p0 = nodes[r].p1;
			nodes.splice(r + 1, 2);
		}
	};
	// Remove random walls
	console.time('rnd wall');
	for (let i = 0; i < m; i++) {
		let r = Math.floor(Math.random() * (nodes.length - 3));
		while (nodes[r + 1].s !== -1 || nodes[r + 2].s !== -1) r = (r + 1) % (nodes.length - 3);
		removeWall(r);
	}
	console.timeEnd('rnd wall');
	// Remove bad looking walls
	console.time('pretty wall');
	for (let i = 0; i < nodes.length - 3; i++) {
		if (nodes[i].s === 1 || nodes[i + 3].s === 1) {
			removeWall(i);
		}
	}
	console.timeEnd('pretty wall');
	// Generate borders
	const path = [];
	console.time('border');
	nodes.map(({ p0, p1, p2, s }) => {
		const d1 = [(p1[0] - p0[0]) * w, (p1[1] - p0[1]) * w];
		const d2 = [(p2[0] - p1[0]) * w, (p2[1] - p1[1]) * w];
		if (s === 0) return;
		path.push([p1[0] + s * (d1[0] - d2[0]), p1[1] + s * (d1[1] - d2[1])]);
	});
	console.timeEnd('border');
	// Fix start
	if (n % 2) path.splice(0, 1, path[path.length - 1]);
	else path.splice(-1, 1, path[0]);
	return path;
}

module.exports = function (n = 7, w = 0.9, m = 0.5, h = 7) {
	let s = Math.pow(2, n + 2);
	let border = genBorder(n, w, m).map((v) => [v[0] * s, v[1] * s]);
	console.time('gen mesh');
	let segments = border.slice(0, -1).map((p, i) => [p, border[i + 1]]);
	let normal = segments
		.map(([[x1, y1], [x2, y2]]) => [Math.sign(y1 - y2), 0, Math.sign(x2 - x1)])
		.flatMap((v) => Array(4).fill(v));
	let position = segments.flat().flatMap(([x, y]) => [[x, 0, y], [x, h, y]]);
	segments = segments.filter(([[ax, ay], [bx, by]]) => Math.hypot(ax - bx, ay - by) > 1);
	//Add floor and ceilling
	normal.push([0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
	position.push([0, h, 0], [0, h, s], [s, h, 0], [s, h, s], [0, 0.01, 0], [s, 0.01, 0], [0, 0.01, s], [s, 0.01, s]);
	let elements = Array(border.length - 1 + 8)
		.fill()
		.flatMap((_, i) => [i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3]);
	console.timeEnd('gen mesh');
	return {
		segments,
		position,
		normal,
		elements
	};
};
