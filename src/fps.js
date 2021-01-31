'use strict';
const mat4 = require('gl-mat4');
const vec3 = require('gl-vec3');
const lock = require('pointer-lock');
//const footstep = require('./footstep')();

const sensibility = 0.002;
const rotationFilter = 0.95;
const limitAngle = Math.PI / 4;
const slowAngle = Math.PI / 6;
const walkSpeed = 7;
const runSpeed = 12;
const walkStepLen = 3.6;
const runStepLen = 5;
const height = 2;
const stepHeight = 0.03;
const dist = 0.5;

const sdLine = (p, a, b, tmp1, tmp2) => {
	const pa = vec3.sub(tmp1, p, a);
	const ba = vec3.sub(tmp2, b, a);
	const h = Math.max(Math.min(vec3.dot(pa, ba) / vec3.dot(ba, ba), 1), 0);
	return vec3.dist(pa, vec3.scale(ba, ba, h));
};

module.exports = function ({getGridSegments}) {
	//var colliders = segments.map(([[ax, ay], [bx, by]]) => [[ax, height, ay], [bx, height, by]]);
	var mouse = [0, Math.PI * 3 / 4];
	var fmouse = [0, Math.PI * 3 / 4];
	var dir = [0, 0, 0];
	var pos = [2, height, 2];
	var forward = [0.707, 0, 0.707], up = [0, 1, 0];
	var force = [0, 0, 0];
	var walkTime = 0.5;
	var view = mat4.identity([]);
	var run = false;

	// Mouse input
	const pointer = lock(document.body);
	pointer.on('attain', (movements) => {
		movements.on('data', (move) => {
			move.dx = Math.max(Math.min(move.dx, 100), -100);
			move.dy = Math.max(Math.min(move.dy, 100), -100);
			let smooth = 1;
			if (Math.abs(mouse[0]) > slowAngle && Math.sign(mouse[0]) == Math.sign(move.dy))
				smooth = (limitAngle - Math.abs(mouse[0])) / (limitAngle - slowAngle);
			mouse[0] += smooth * move.dy * sensibility;
			mouse[1] += move.dx * sensibility;
		});
	});

	// Keyboard input
	var keys = {};
	const handleKey = (e) => {
		if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
		keys[e.code] = e.type === 'keydown';
		run = e.shiftKey;
		const left = keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0;
		const right = keys['KeyD'] || keys['ArrowRight'] ? 1 : 0;
		const up = keys['KeyW'] || keys['ArrowUp'] ? 1 : 0;
		const down = keys['KeyS'] || keys['ArrowDown'] ? 1 : 0;
		dir = [right - left, 0, down - up];
		e.preventDefault();
	};
	window.addEventListener('keydown', handleKey);
	window.addEventListener('keyup', handleKey);

	// First person scope
	var lastTime = 0;
	return {
		pos, fmouse, forward, up,
		view: () => view,
		tick: ({ time }) => {
			// Delta time
			const dt = time - lastTime;
			lastTime = time;
			// Cache matrix
			//if (!rotate && dir[0] === 0 && dir[2] === 0 && walkTime === 0.25) return;
			//rotate = false;
			// Force, Up and Forward direction
			let tmp1 = [0, 0, 0], tmp2 = []; //reduce gc performance problem
			vec3.set(forward, 1, 0, 0);
			vec3.set(up, 0, 1, 0);
			vec3.rotateY(force, dir, tmp1, -mouse[1]);
			vec3.rotateY(forward, forward, tmp1, -mouse[1]);
			vec3.rotateX(forward, forward, tmp1, -mouse[0]);
			vec3.rotateX(up, up, tmp1, -mouse[0]);
			vec3.normalize(force, force);
			//console.log(forward, up);
			// Move
			const speed = (run ? runSpeed : walkSpeed);
			vec3.scale(force, force, speed * dt);
			pos[1] = height;
			const newPos = vec3.add([], pos, force);
			// Collide
			const collisions = getGridSegments(newPos[0], newPos[2])
				.map(([[ax, ay], [bx, by]]) => [[ax, height, ay], [bx, height, by]])
				.filter(([a, b]) => sdLine(newPos, a, b, tmp1, tmp2) < dist);
			if (collisions.length !== 0) {
				for (let [a, b] of collisions) {
					const distance = dist - sdLine(newPos, a, b, tmp1, tmp2);
					const delta = vec3.sub(tmp1, b, a).reverse();
					delta[0] = -delta[0];
					vec3.normalize(delta, delta);
					vec3.scale(delta, delta, distance);
					vec3.add(force, force, delta);
				}
			}
			// Apply walk y motion
			const d = vec3.len(force);
			if (d === 0 && walkTime !== 0.25) {
				walkTime = (Math.abs((walkTime + 0.5) % 1 - 0.5) - 0.25) * 0.8 + 0.25;
				if ((walkTime + 0.01) % 0.25 < 0.02)
					walkTime = 0.25;
			}
			const lastWalkTime = walkTime;
			walkTime += d / (run ? runStepLen : walkStepLen);
			//console.log(d / (run ? runStepLen : walkStepLen) / dt * 60);
			pos[1] = height + stepHeight * Math.cos(2 * Math.PI * walkTime);
			vec3.add(pos, pos, force);
			// Filter mouse mouvement
			fmouse[0] = rotationFilter * mouse[0] + (1 - rotationFilter) * fmouse[0];
			fmouse[1] = rotationFilter * mouse[1] + (1 - rotationFilter) * fmouse[1];
			// Update view
			mat4.identity(view);
			mat4.rotateX(view, view, fmouse[0]);
			mat4.rotateY(view, view, fmouse[1]);
			mat4.translate(view, view, vec3.scale(tmp1, pos, -1));
			// Update footstep
			/*if (walkTime > 0.5)
				footstep.update(pos, force, up);
			if (lastWalkTime % 1 <= 0.5 && walkTime % 1 > 0.5)
				footstep.step([pos[0], 0, pos[2]], run);*/
			return;
		}
	};
};
