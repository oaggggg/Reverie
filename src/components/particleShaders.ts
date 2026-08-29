/**
 * Shaders for the particle album cover.
 *
 * Displacement runs on the GPU: the CPU only pushes uniforms each frame, so
 * particle count is bounded by fill rate rather than by a JS loop.
 *
 * snoise() below is the reference 3D simplex noise from webgl-noise by Ashima
 * Arts / Stefan Gustavson (MIT licence), the implementation these effects are
 * conventionally built on.
 * https://github.com/ashima/webgl-noise
 */

const SIMPLEX_3D = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

export const PARTICLE_VERTEX = `
attribute vec3 aColor;
attribute float aSeed;

uniform float uTime;
uniform float uAmp;       // displacement along z
uniform float uFreq;      // spatial frequency of the flow field
uniform float uSpeed;     // how fast the field evolves
uniform float uPulse;     // 0..1 smoothed audio energy
uniform float uShimmer;   // 0..1 high-band energy
uniform float uBeat;      // 0..1 节拍冲击（onset 后指数衰减）
uniform float uSize;      // point diameter in WORLD units
uniform float uProjScale; // css px per world unit at distance 1 (see component)
uniform float uPixelRatio;

varying vec3 vColor;
varying float vGlow;

${SIMPLEX_3D}

void main() {
  vec3 p = position;

  // Two octaves at different scales: the large one shapes the swell, the
  // small one keeps neighbouring particles from moving in lockstep.
  float n1 = snoise(vec3(p.xy * uFreq, uTime * uSpeed));
  float n2 = snoise(vec3(p.yx * uFreq * 2.7, uTime * uSpeed * 1.6 + aSeed * 6.283));

  p.z += (n1 * 0.8 + n2 * 0.2) * uAmp;
  // A touch of lateral drift stops the grid from reading as a flat sheet.
  p.xy += vec2(n2, -n1) * uAmp * 0.10;

  // 节拍冲击：每个粒子按自身 seed 沿噪声场方向被轻轻推开，幅度依
  // seed 不均等——整体呈无规律的"荡开-归位"，而不是整齐的脉冲。
  // 冲击量级偏小 + uBeat 在 CPU 侧已做平滑，观感是流动而非跳动。
  float kick = uBeat * (0.35 + aSeed * 0.65);
  p.z += n2 * kick * 0.3;
  p.xy += vec2(n1, n2) * kick * 0.14;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Exact world->pixel conversion; a hand-tuned constant here is what turns a
  // crisp point cloud into an overlapping smear.
  float pxPerWorld = uProjScale / max(0.001, -mv.z);
  gl_PointSize =
    uSize * pxPerWorld * uPixelRatio * (0.82 + aSeed * 0.3) * (1.0 + uPulse * 0.18 + uBeat * 0.1);
  gl_Position = projectionMatrix * mv;

  vColor = aColor;
  vGlow = 0.9 + n1 * 0.06 + uPulse * 0.08 + uBeat * 0.06 + uShimmer * aSeed * 0.08;
}
`;

export const PARTICLE_FRAGMENT = `
precision highp float;

varying vec3 vColor;
varying float vGlow;

void main() {
  // Round, soft-edged sprite. The default square point is the single biggest
  // reason an untextured particle field looks harsh.
  vec2 d = gl_PointCoord - vec2(0.5);
  float dist = dot(d, d);
  if (dist > 0.25) discard;
  float alpha = smoothstep(0.25, 0.035, dist) * 0.94;
  gl_FragColor = vec4(vColor * vGlow, alpha);
}
`;
