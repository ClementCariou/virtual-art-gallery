'use strict';

module.exports = (regl, data) => {
    return regl({
        frag: `
        #extension GL_OES_standard_derivatives : enable
        precision mediump float;
        varying vec3 v_normal;
        varying vec3 v_pos;

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

        #define fbm2(g) fbm3(vec3(g, 0.0))

        float fbm3(vec3 p) {
            float f = 0.0, x;
            for(int i = 1; i <= 9; ++i) {
                x = exp2(float(i));
                f += (noise(p * x) - 0.5) / x;
            }
            return f;
        }

        //https://iquilezles.org/www/articles/filterableprocedurals/filterableprocedurals.htm
        vec3 marble(vec2 p) {
            const float N = 1.005; // grid ratio
            // filter kernel
            vec2 w = max(abs(dFdx(p)), abs(dFdy(p)));
            vec2 a = p + 0.5*w;
            vec2 b = p - 0.5*w;
            vec2 i = (floor(a)+min(fract(a)*N,1.0)-
                        floor(b)-min(fract(b)*N,1.0))/(N*w);
            
            vec3 pat=mix(vec3(1.0,1.0,0.8)*0.4,vec3(1.0,1.0,0.8)*0.7,1.0-smoothstep(0.4,0.8,0.5+fbm2(floor(p)*2.0+p*1.0+cos(p.yx*2.0)*0.4)))+
                        vec3(max(0.0,fbm2(p*0.7)*1.0))+vec3(smoothstep(0.2,0.3,fbm2(-p)))*0.2;

            return (i.x*i.y*2.0-1.0) * pat;
        }

        float border(float y) {
            const float h = 0.04;
            const float N = 1.0 + h;
            y = y / 8.0 - h / 2.0;
            // filter kernel
            float w = max(abs(dFdx(y)), abs(dFdy(y)));
            float a = y + 0.5*w;
            float b = y - 0.5*w;
            float i = (floor(a)+min(fract(a)*N,1.0)-
                        floor(b)-min(fract(b)*N,1.0))/(N*w);
            return i;
        }

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            vec3 totalLight = vec3(0.1);
            const float o = 0.0;
            float pattern = 0.05*noise(2.0*v_pos*vec3(10.0,50.0,10.0))
                                *noise(2.0*v_pos*vec3(50.0,10.0,50.0))+0.95;
            for(float x = 0.0; x < 2.0; x++){
                for(float z = 0.0; z < 2.0; z++){
                    vec3 fragPos = mod(v_pos+vec3(4.0,0.0,4.0)*min(1.0,1.0+v_normal.y),8.0);
                    vec3 lightPos = vec3(-o+x*(8.0+2.0*o), 2.0, -o+z*(8.0+2.0*o));
                    vec3 p = floor((v_pos+lightPos-vec3(4.0,0.0,4.0))/8.0);
                    float hue = mod((p.x + p.z)/10.0,2.0) * max(1.0, 1.0+v_normal.y)*min(1.0,1.0+v_normal.y);//noise(p); //color variation
                    float power = 0.1*mod(p.x,2.0)*min(1.0,1.0+v_normal.y)+0.9; //border separation contrast
                    vec3 col = pattern * 1.3*hsv2rgb(vec3(hue,0.07,power));
                    vec3 lightDir = lightPos - fragPos; 
                    float d = length(lightDir);
                    float att = mix(0.2*d*d, 5.0 + 3.0*d, abs(v_normal.y));
                    float diff = max(dot(v_normal, normalize(lightDir)), 0.0);
                    totalLight += diff * col / att;
                }
            }
            //totalLight *= 0.005*noise(v_pos*vec3(50.0,50.0,50.0))+0.995;
            if(v_normal.y > 0.0){
                totalLight *= 0.5*marble(v_pos.xz + vec2(0.5)) + 1.0;
            }else if(v_normal.y == 0.0){
                totalLight *= 0.5*border(v_pos.y) + 0.5;
            }
            totalLight = pow(totalLight, vec3(1.0/2.2));
            gl_FragColor = vec4(totalLight, 1.975-v_normal.y);
        }`,

        vert: `
        precision mediump float;
        uniform mat4 proj, view;
        attribute vec3 position, normal;
        varying vec3 v_pos, v_normal;
        uniform float yScale;
        void main() {
            vec3 pos = position;
            v_pos = pos;
            pos.y *= yScale;
            v_normal = normal;
            gl_Position = proj * view * vec4(pos, 1);
        }`,

        attributes: {
            position: data.position,
            normal: data.normal
        },

        blend: {
            enable: true,
            func: {
                src: 'src alpha',
                dst: 'one minus src alpha'
            },
        },

        elements: new Uint32Array(data.elements)
    });
};