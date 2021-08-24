'use strict';
const mat4 = require('gl-mat4');
const vec3 = require('gl-vec3');
const lock = require('pointer-lock');
//const footstep = require('./footstep')();

const mouseSensibility = 0.002;
const touchSensibility = 0.006;
const rotationFilter = 0.95;
const limitAngle = Math.PI / 4;
const slowAngle = Math.PI / 6;
const durationToClick = 500;
const distToClick = 100;
const walkSpeed = 7;
const runSpeed = 12;
const walkStepLen = 3.6;
const runStepLen = 5;
const height = 2;
const stepHeight = 0.03;
const distToWalls = 0.5;
const viewingDist = 3;
const yLimitTouch = 5;
const touchDistLimit = 40;

const sdLine = (p, a, b, tmp1, tmp2) => {
	const pa = vec3.sub(tmp1, p, a);
	const ba = vec3.sub(tmp2, b, a);
	const h = Math.max(Math.min(vec3.dot(pa, ba) / vec3.dot(ba, ba), 1), 0);
	return vec3.dist(pa, vec3.scale(ba, ba, h));
};

const planeProject = (org, dir, plane) => {
	const dist = -(vec3.dot(org, plane) - plane[3]) / vec3.dot(dir, plane);
	let intersection = vec3.scale([], dir, dist);
	vec3.add(intersection, intersection, org);
	return {dist, intersection};
};

const wallProject = (org, dir, a, b) => {
	// Calculate the vertical place passing through A and B
	const vx = a[0]-b[0], vz = a[1]-b[1];
	const nx = -vz, nz = vx;
	const wAB = a[0] * nx + a[1] * nz;
	// Project to the plane
	let {dist, intersection: i} = planeProject(org, dir, [nx, 0, nz, wAB]);
	// Verify it's between A and B
	const wA = a[0] * vx + a[1] * vz;
	const wB = b[0] * vx + b[1] * vz;
	const wI = i[0] * vx + i[2] * vz;
	if((wI > wA) + (wI > wB) !== 1)
		dist = Infinity;
	//console.log(dist, i);
	return {a, b, dist, intersection: i};
};

module.exports = function ({getGridSegments}, fovY) {
	var mouse = [0, Math.PI * 3 / 4];
	var fmouse = [0, Math.PI * 3 / 4];
	var dir = [0, 0, 0];
	var pos = [2, height, 2];
	var forward = [0.707, 0, 0.707], up = [0, 1, 0];
	var force = [0, 0, 0];
	var walkTime = 0.5;
	var view = mat4.identity([]);
	var proj = mat4.identity([]);
	var run = false;

	const orientCamera = (dx, dy, sensibility)=> {
		dx = Math.max(Math.min(dx, 100), -100);
		dy = Math.max(Math.min(dy, 100), -100);
		let smooth = 1;
		if (Math.abs(mouse[0]) > slowAngle && Math.sign(mouse[0]) == Math.sign(dy))
			smooth = (limitAngle - Math.abs(mouse[0])) / (limitAngle - slowAngle);
		mouse[0] += smooth * dy * sensibility;
		mouse[1] += dx * sensibility;
	};

	// Mouse input
	let pointer = lock(document.body);
	pointer.on('attain', (movements) => {
		movements.on('data', (move) => {
			orientCamera(move.dx, move.dy, mouseSensibility);
		});
	});

	// Touch input
	let firstTouch = false;
	let lastTouch = false;
	let touchTimestamp = 0;
	const handleTouch = (e) => {
		if(pointer) {
			pointer.destroy();
			pointer = false;
		}
		if(e.type === "touchstart"){
			firstTouch = lastTouch = e.touches[0];
			touchTimestamp = e.timeStamp;
		} else if(e.type === "touchend") {
			const d = Math.hypot(
				firstTouch.pageX - lastTouch.pageX,
				firstTouch.pageY - lastTouch.pageY
			);
			if(e.timeStamp - touchTimestamp < durationToClick && d < distToClick) {
				// compute touch vector
				let tmp = [], tmp1 = [], tmp2 = [];
				let touchDir = [-1 + 2 * lastTouch.pageX / window.innerWidth, 1 - 2 * lastTouch.pageY / window.innerHeight, 0];
				vec3.transformMat4(touchDir, touchDir, mat4.invert(tmp, proj));
				vec3.transformMat4(touchDir, touchDir, mat4.invert(tmp, view));
				vec3.sub(touchDir, touchDir, pos);
				vec3.normalize(touchDir, touchDir);
				// project to the floor and the ceilling
				let {intersection: floorPos, dist: floorDist} = planeProject(pos, touchDir, [0,1,0,0]);
				let {dist: ceilingDist} = planeProject(pos, touchDir, [0,1,0,yLimitTouch]);
				console.log(floorDist, ceilingDist);
				// get the walls suceptibles to intersect with the raycast
				let [x,,z] = pos;
				let [dx,,dz] = touchDir;
				dx /= Math.hypot(dx, dz);
				dz /= Math.hypot(dx, dz);
				let walls = getGridSegments(x, z);
				for(let i = 0; i < touchDistLimit / 8; i++) {
					x += dx * 8; z += dz * 8;
					// select cells every 8m shifted 4m left and right to miss none
					walls = [...walls, ...getGridSegments(x - dz*4, z + dx*4)];
					walls = [...walls, ...getGridSegments(x + dz*4, z - dx*4)];
				}
				// project to walls
				let intersections = [... new Set(walls)]
					.map(([a, b]) => wallProject(pos, touchDir, a, b))
					.filter(({dist}) => dist > 0 && dist < Math.max(floorDist, ceilingDist) && dist < touchDistLimit);
				intersections.sort((a, b) => a.dist < b.dist);
				//console.log(intersections);
				if (intersections.length !== 0) { 
					// teleport to wall
					const {intersection: [xpos,, zpos]} = intersections[0];
					vec3.set(pos, xpos, pos[1], zpos);
				} else if(floorDist > 0) {
					// teleport to floor
					vec3.set(pos, floorPos[0], pos[1], floorPos[2]);
				} else {
					return;
				}
				// snap position to allowed area
				let collisions = getGridSegments(pos[0], pos[2])
					.map(([[ax, ay], [bx, by]]) => [[ax, height, ay], [bx, height, by]])
					.map(([a, b]) => ({a, b, dist: sdLine(pos, a, b, tmp1, tmp2)}))
					.filter(({dist}) => dist < viewingDist);
				collisions.sort((a, b) => a.dist < b.dist);
				//console.log(collisions);
				if (collisions.length !== 0) {
					for (let {a, b} of collisions) {
						const distance = viewingDist - sdLine(pos, a, b, tmp1, tmp2);
						if(distance < 0) continue;
						// Segment normal
						const delta = vec3.sub(tmp1, b, a).reverse();
						delta[0] = -delta[0];
						vec3.normalize(delta, delta);
						vec3.scale(delta, delta, distance);
						// Offset by viewingDist from the wall
						vec3.add(pos, pos, delta);
						//console.log(distance, delta);
					}
				}
			}
			firstTouch = lastTouch = false;
		} else if(e.type === "touchmove") {
			orientCamera(e.touches[0].pageX - lastTouch.pageX, 
						 e.touches[0].pageY - lastTouch.pageY,
						 touchSensibility);
			lastTouch = e.touches[0];
		}
		//console.log(e);
	}
	window.addEventListener('touchstart', handleTouch);
	window.addEventListener('touchmove', handleTouch);
	window.addEventListener('touchend', handleTouch);

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
		proj: () => {
			mat4.perspective(proj, fovY, window.innerWidth / window.innerHeight, 0.1, 100);
			return proj;
		},
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
				.filter(([a, b]) => sdLine(newPos, a, b, tmp1, tmp2) < distToWalls);
			if (collisions.length !== 0) {
				for (let [a, b] of collisions) {
					const distance = distToWalls - sdLine(newPos, a, b, tmp1, tmp2);
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
