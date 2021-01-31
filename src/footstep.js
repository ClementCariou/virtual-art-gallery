'use strict';

/*
    We don't use this module because it doesn't sound good enough
*/

const vol = 10;
const freq = 80;
const freqRange = 15;
const params = [{
    /*
    attack: 0.01,
    hold: 0,
    release: 0.015*/
    attack: 0.01,
    hold: 0.05,
    release: 0.05
}, {
    attack: 0.005,
    hold: 0,
    release: 0.015
}];
const decay = 30;
const filterType = "bandpass";
const filterFreq = 1000;
const filterQ = 2;


const createPanner = (ac) => {
    const panner = ac.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 0;
    panner.coneOuterGain = 0;
    return panner;
}

const createCompressor = (ac) => {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-4, ac.currentTime);
    comp.knee.setValueAtTime(40, ac.currentTime);
    comp.ratio.setValueAtTime(2, ac.currentTime);
    comp.attack.setValueAtTime(0, ac.currentTime);
    comp.release.setValueAtTime(0.25, ac.currentTime);
    return comp;
}

const createFilter = (ac) => {
    let filter = ac.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, ac.currentTime);
    filter.Q.setValueAtTime(filterQ, ac.currentTime);
    return filter;
};

const createConvolver = (ac) => {
    const length = ac.sampleRate * 3;
    const impulse = ac.createBuffer(2, length, ac.sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    const conv = ac.createConvolver();
    conv.buffer = impulse;
    return conv;
}

module.exports = () => {
    let ac, osc, gain, comp, conv, filter, panner, listener;
    let isInit = false;

    const init = () => {
        isInit = true;
        ac = new AudioContext();
        osc = ac.createOscillator();
        osc.type = 'sine';
        gain = ac.createGain();
        gain.gain.setValueAtTime(0, ac.currentTime);
        comp = createCompressor(ac);
        conv = createConvolver(ac);
        filter = createFilter(ac);
        panner = createPanner(ac);
        listener = ac.listener;

        osc.connect(gain);
        gain.connect(conv);
        conv.connect(filter);
        filter.connect(ac.destination);
        //comp.connect(ac.destination);
        //panner.connect(ac.destination);
        osc.start(ac.currentTime);
    };

    return {
        update: (pos, dir, up) => {
            if (!isInit)
                init();
            if (listener.positionX) {
                listener.positionX.value = pos[0];
                listener.positionY.value = pos[1];
                listener.positionZ.value = pos[2];
            } else {
                listener.setPosition(...pos);
            }
            if (listener.forwardX) {
                listener.forwardX.value = dir[0];
                listener.forwardY.value = dir[1];
                listener.forwardZ.value = dir[2];
                listener.upX.value = up[0];
                listener.upY.value = up[1];
                listener.upZ.value = up[2];
            } else {
                listener.setOrientation(...dir, ...up);
            }
        },
        step: (pos, run) => {
            if (!isInit)
                init();
            if (panner.positionX) {
                panner.positionX.value = pos[0];
                panner.positionY.value = pos[1];
                panner.positionZ.value = pos[2];
            } else {
                panner.setPosition(...pos);
            }
            const t = ac.currentTime;
            const p = params[run ? 1 : 0];
            const f = freq + freqRange * Math.random();
            osc.frequency.cancelScheduledValues(t);
            osc.frequency.setValueAtTime(f, t);
            osc.frequency.setValueAtTime(0, t + p.attack + p.hold + p.release);
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(vol, t + p.attack);
            gain.gain.setValueAtTime(vol, t + p.attack + p.hold);
            gain.gain.linearRampToValueAtTime(0, t + p.attack + p.hold + p.release);
        }
    };
};