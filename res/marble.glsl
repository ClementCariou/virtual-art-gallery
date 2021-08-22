// Run this on shadertoy and do a screenshot to generate the floor texture

// https://www.shadertoy.com/view/4sfGzS
float hash(vec3 p) {
    p  = fract( p*0.3183099+.1 );
    p *= 17.0;
    return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
}
float noise( in vec3 x ) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix( hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                mix( hash(i+vec3(0,1,0)),    hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix( hash(i+vec3(0,0,1)),    hash(i+vec3(1,0,1)),f.x),
                mix( hash(i+vec3(0,1,1)),    hash(i+vec3(1,1,1)),f.x),f.y),f.z);
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

vec3 marble(vec2 p) {
    const float N = 1.005; // grid ratio
    // filter kernel
    vec2 w = max(abs(dFdx(p)), abs(dFdy(p)));
    vec2 a = p + 0.5*w;
    vec2 b = p - 0.5*w;
    vec2 i = (floor(a)+min(fract(a)*N,1.0)-
                floor(b)-min(fract(b)*N,1.0))/(N*w);

    vec3 pat=mix(vec3(0.82,0.8,0.8)*0.4,vec3(0.82,0.82,0.8)*0.7,1.0-smoothstep(0.4,0.8,0.5+fbm2(floor(p)*2.0+p*1.0+cos(p.yx*2.0)*0.4)))+
                vec3(max(0.0,fbm2(p*0.7)*1.0))+vec3(smoothstep(0.2,0.3,fbm2(-p)))*0.2;

    float lineWidth = 0.001;
    p = mod(p + vec2(0.5), vec2(1.0));
    p = smoothstep(p, vec2(0.5+lineWidth), vec2(0.5-lineWidth)) * smoothstep(p, vec2(0.5-lineWidth), vec2(0.5+lineWidth));
    return clamp(p.x * p.y, 0.3, 1.0) * pat;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/1024.0;

    // Time varying pixel color
    vec3 col = marble(uv.xy*8.0);

    // Output to screen
    fragColor = vec4(col,1.0);
}