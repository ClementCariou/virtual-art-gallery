'use strict';

const loadTexture = async (texture, url) => {
    const result = await fetch(url);
    const blob = await result.blob();
    const data = await createImageBitmap(blob);
    texture({data,
        wrapS: 'repeat',
        wrapT: 'repeat'
    });
};

module.exports = (regl, data, useReflexion) => {
    const wallTexture = regl.texture();
    const floorTexture = regl.texture();
    loadTexture(wallTexture, "res/wall.jpg");
    loadTexture(floorTexture, "res/floor.jpg");
    return regl({
        frag: `
        precision lowp float;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform sampler2D wallTexture;
        uniform sampler2D floorTexture;

        vec3 hue2rgb(float h) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
            return mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), 0.08);
        }

        void main() {
            vec3 totalLight = texture2D(wallTexture, vec2(v_pos.x + v_pos.z, 7.0-v_pos.y)/8.0).rgb;
            float dist = length(v_relativepos);
            totalLight = mix(totalLight, vec3(90.0,92.0,95.0)/255.0, step(6.99, v_pos.y));
            totalLight *= mix(0.7, 1.0, smoothstep(0.1, 0.12, v_pos.y));
            totalLight *= abs(v_normal.x)/64.0 + 1.0;
            if(v_normal.y > 0.0) {
                totalLight = 0.47+0.1*texture2D(floorTexture, v_pos.xz / 8.0).rgb;
            }
            totalLight *= (0.5 + 0.5*hue2rgb(0.5 + (v_pos.x + v_pos.z) / 160.0)); //color variation
            float alpha = .98+smoothstep(150.,0.,dist)-v_normal.y; // reflexion
            gl_FragColor = vec4(totalLight, ${useReflexion ? "alpha" : "1.0"});
        }`,

        vert: `
        precision highp float;
        uniform mat4 proj, view;
        attribute vec3 position, normal;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform float yScale;
        void main() {
            vec3 pos = position;
            v_pos = pos;
            v_relativepos = (view * vec4(pos, 1)).xyz;
            pos.y *= yScale;
            v_normal = normal;
            gl_Position = proj * view * vec4(pos, 1);
        }`,

        attributes: {
            position: data.position,
            normal: data.normal
        },

        blend: useReflexion ? {
            enable: true,
            func: {
                src: 'src alpha',
                dst: 'one minus src alpha'
            },
        } : {},

        uniforms: {
            wallTexture,
            floorTexture
        },

        elements: new Uint32Array(data.elements)
    });
};