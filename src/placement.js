'use strict';
const texture = require('./image');
const mat4 = require('gl-mat4');

const renderDist = 20;
const loadDist = 20;
const unloadDist = 40;

const dynamicResPeriod = 3000;
let dynamicRes = "high";
let dynamicResTimer;

// Apply riffle shuffle to sub-arrays
const merge = (dest, org, aStart, aEnd, bStart, bEnd) => {
    let a = org.slice(aStart, aEnd).reverse();
    let b = org.slice(bStart, bEnd);
    let prop = a.length / b.length;
    while (a.length > 0 && b.length > 0)
        dest.push(a.length / b.length > prop ? a.pop() : b.pop());
    while (a.length > 0) dest.push(a.pop());
    while (b.length > 0) dest.push(b.pop());
    return dest;
};

const culling = (ppos, pangle, fovx, {vseg, angle}) => {
    const sx1 = vseg[0][0] - ppos[0];
    const sy1 = vseg[0][1] - ppos[2];
    const sx2 = vseg[1][0] - ppos[0];
    const sy2 = vseg[1][1] - ppos[2];
    const angles = [angle, pangle - fovx + Math.PI/2, pangle + fovx - Math.PI/2];
    for(let a of angles) {
        const nx = Math.sin(a);
        const ny = -Math.cos(a);
        if(nx * sx1 + ny * sy1 < 0 && nx * sx2 + ny * sy2 < 0)
            return false;
    }
    return true;
};

module.exports = (regl, segments) => {
    // split segments
    console.time('split segments');
    segments = segments.flatMap(s => {
        // Calculate subsegment length
        let l = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
        l = Math.ceil(l / 8 - 0.3);
        if (l == 0) return [];
        // Lerp coordinates
        let res = [];
        for (let t = 0; t <= 1; t += 1 / l)
            res.push([s[0][0] * (1 - t) + s[1][0] * t, s[0][1] * (1 - t) + s[1][1] * t]);
        // Form pairs of coordinates
        return res.slice(0, -1).map((r, i) => [r, res[i + 1]]);
    });
    console.timeEnd('split segments');
    // reorder segments
    console.time('reorder segments');
    let segs = segments;
    segments = [];
    let i = 0, j = segs.length - 1;
    let it = [], jt = [], len = 0;
    //console.log(segs);
    //debugger;
    //let temp = [...Array(segs.length)].map((_, i) => i);
    while (i < j) {
        let xi = Math.floor((segs[i][0][0] + segs[i][1][0]) / 32);
        let yi = Math.floor((segs[i][0][1] + segs[i][1][1]) / 32);
        let xj = Math.floor((segs[j][0][0] + segs[j][1][0]) / 32);
        let yj = Math.floor((segs[j][0][1] + segs[j][1][1]) / 32);
        //console.log(i, j, xi, yi, xj, yj);
        if (xi == xj && yi == yj) {
            //console.log("converge");
            //console.log(temp.slice(i - len, i + 1), temp.slice(j, j + len + 1));
            merge(segments, segs, i - len, i + 1, j, j + len + 1);
            it = []; jt = []; len = 0;
        } else {
            //console.log("diverge");
            let findi = jt.findIndex(([x, y]) => x === xi && y === yi);
            let findj = it.findIndex(([x, y]) => x === xj && y === yj);
            //console.log(findi, findj);
            if (findi !== -1) {
                //console.log(temp.slice(i - len, i + 1), temp.slice(j + len - findi, j + len + 1));
                merge(segments, segs, i - len, i + 1, j + len - findi, j + len + 1);
                j += len - findi; //rollback
                it = []; jt = []; len = 0;
            } else if (findj !== -1) {
                //console.log(temp.slice(j, j + len + 1), temp.slice(i - len, i - len + findj + 1));
                merge(segments, segs, i - len, i - len + findj + 1, j, j + len + 1);
                i -= len - findj; //rollback
                it = []; jt = []; len = 0;
            } else {
                it.push([xi, yi]);
                jt.push([xj, yj]);
                len++;
            }
        }
        i++; j--;
    }
    //console.log(temp.slice(i - len, j + len + 1));
    segments.push(...segs.slice(i - len, j + len + 1));
    console.timeEnd('reorder segments');
    console.log(segments.length + " available painting placements");
    const areas = segments.map(seg => [
        Math.round((seg[0][0] + seg[1][0]) / 16 + 0.5) * 8 - 4,
        Math.round((seg[0][1] + seg[1][1]) / 16 + 0.5) * 8 - 4
    ]);
    //console.log(areas);
    let batch = [], shownBatch = [];
    let fetching = true;
    let loadPainting = (p) => {
        const seg = segments[batch.length];
        // Calculate painting position, direction, normal angle and scale
        const dir = [seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]];
        const norm = [seg[1][1] - seg[0][1], seg[0][0] - seg[1][0]];
        const segLen = Math.hypot(dir[0], dir[1]);
        let globalScale = 4.5 / (3 + p.aspect); //tweaked to look good
        globalScale = Math.min(globalScale, segLen / p.aspect / 2.2); //clamp horizontal
        globalScale = Math.min(globalScale, 2 / 1.2); //clamp vertical
        const pos = [(seg[0][0] + seg[1][0]) / 2, 2 - globalScale, (seg[0][1] + seg[1][1]) / 2];
        const angle = Math.atan2(dir[1], dir[0]);
        const horiz = Math.abs(angle % 3) < 1 ? 1 : 0;
        const vert = 1 - horiz;
        const scale = [
            2 * globalScale * p.aspect * horiz + 0.1 * vert,
            2 * globalScale,
            2 * globalScale * p.aspect * vert + 0.1 * horiz];
        const d1 = globalScale * p.aspect / segLen;
        const d2 = 0.005 / Math.hypot(norm[0], norm[1]);
        // Visible painting segment for culling
        const vseg = [
            [pos[0] - dir[0] * d1, pos[2] - dir[1] * d1],
            [pos[0] + dir[0] * d1, pos[2] + dir[1] * d1]
        ];
        // Offset pos to account for painting width and depth
        pos[0] -= dir[0] * d1 + norm[0] * d2;
        pos[2] -= dir[1] * d1 + norm[1] * d2;
        // Calculate model matrix
        const model = [];
        mat4.fromTranslation(model, pos);
        mat4.scale(model, model, scale);
        mat4.rotateY(model, model, -angle);
        const textmodel = [];
        mat4.fromTranslation(textmodel, [pos[0], 1.6 - globalScale, pos[2]]);
        mat4.rotateY(textmodel, textmodel, -angle);
        batch.push({ ...p, vseg, angle, model, textmodel });
    };
    // Fetch the first textures
    texture.fetch(regl, 20, dynamicRes, loadPainting, () => fetching = false);
    return {
        update: (pos, angle, fovx) => {
            // Estimate player position index
            let index = areas.findIndex(a => Math.abs(a[0] - pos[0]) < 4 && Math.abs(a[1] - pos[2]) < 4);
            if (index === -1) // Middle of room => search neighbour cells
                index = areas.findIndex(a => Math.abs(a[0] - pos[0]) + Math.abs(a[1] - pos[2]) < 8);
            if (index === -1) return; // Out of bound => do nothing
            // Unload far textures
            batch.slice(0, Math.max(0, index - unloadDist)).map(t => texture.unload(t));
            batch.slice(index + unloadDist).map(t => texture.unload(t));
            // Load close textures
            shownBatch = batch.slice(Math.max(0, index - renderDist), index + renderDist);
            shownBatch.map(t => texture.load(regl, t, dynamicRes));
            // Frustum / Orientation culling
            shownBatch = shownBatch.filter(t => t.tex && culling(pos, angle, fovx, t));
            // Fetch new textures
            if (index <= batch.length - loadDist) return;
            if (!fetching) {
                texture.fetch(regl, 10, dynamicRes, loadPainting, () => fetching = false);
                fetching = true;
            }
            // Update dynamic resolution
            dynamicRes = "low";
            if (dynamicResTimer) clearTimeout(dynamicResTimer);
            dynamicResTimer = setTimeout(() => dynamicRes = "high", dynamicResPeriod);
        },
        batch: () => shownBatch
    };
};