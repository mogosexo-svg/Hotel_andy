// Agua en WebGL puro (sin librerías): la foto vista a través del agua. Refracción con dispersión de color, cáusticas y ondas al tocar.
// Se carga con import() dinámico después del LCP; nunca llega aquí con movimiento reducido, sin WebGL ni con ahorro de datos.
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex; uniform vec2 u_res; uniform vec2 u_img; uniform float u_t; uniform float u_caus; uniform float u_fuerza; uniform vec4 u_rip[8];
varying vec2 v;
vec2 cover(vec2 uv){ float ra=u_res.x/u_res.y, ia=u_img.x/u_img.y; vec2 s = ra>ia ? vec2(1.,ia/ra) : vec2(ra/ia,1.); return (uv-.5)*s+.5; }
float caustic(vec2 uv, float t){
  vec2 p = mod(uv*6.28318, 6.28318) - 250.; vec2 i = p; float c = 1.;
  for(int n=0;n<4;n++){ float tt = t*(1.-(3.5/float(n+1))); i = p + vec2(cos(tt-i.x)+sin(tt+i.y), sin(tt-i.y)+cos(tt+i.x));
    c += 1./length(vec2(p.x/(sin(i.x+tt)/.005), p.y/(cos(i.y+tt)/.005))); }
  c/=4.; c=1.17-pow(c,1.4); return pow(abs(c),8.);
}
void main(){
  vec2 uv=v; vec2 asp=vec2(u_res.x/u_res.y,1.);
  vec2 d=vec2(sin(uv.y*22.+u_t*1.2)+sin(uv.y*9.-u_t*.8+uv.x*6.), cos(uv.x*18.+u_t)+sin(uv.x*7.+u_t*.7+uv.y*5.))*.0034*u_fuerza;
  float ring=0.;
  for(int i=0;i<8;i++){ vec4 r=u_rip[i]; if(r.w>0.){ float age=u_t-r.z; vec2 dv=(uv-r.xy)*asp; float rad=length(dv); float fr=age*.34;
    float w=sin((rad-fr)*44.)*exp(-age*1.25)*exp(-abs(rad-fr)*9.)*r.w; d+=dv/(rad+1e-4)*w*.02; ring+=max(w,0.); } }
  vec3 col=vec3(texture2D(u_tex,cover(uv+d)).r, texture2D(u_tex,cover(uv+d*1.08)).g, texture2D(u_tex,cover(uv+d*1.18)).b);
  float c=caustic(uv*asp*.8,u_t*.45);
  col+=vec3(.55,.85,1.)*c*.2*u_caus + vec3(.7,.9,1.)*ring*.12;
  col=mix(col,col*vec3(.94,1.,1.05),.4);
  gl_FragColor=vec4(col,1.);
}`;

export function iniciar(cv: HTMLCanvasElement, img: HTMLImageElement, caus: number): boolean {
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl || !img.naturalWidth) return false;
  const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tx = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const u = (n: string) => gl.getUniformLocation(pr, n);
  const uRes = u('u_res'), uT = u('u_t'), uRip = u('u_rip');
  gl.uniform2f(u('u_img'), img.naturalWidth, img.naturalHeight);
  gl.uniform1f(u('u_caus'), caus);
  gl.uniform1f(u('u_fuerza'), 1);

  const rip = new Float32Array(32);
  let n = 0;
  const t0 = performance.now();
  const ahora = () => (performance.now() - t0) / 1000;
  const onda = (x: number, y: number, amp: number) => { rip.set([x, y, ahora(), amp], (n++ % 8) * 4); };

  const medir = () => {
    const w = cv.clientWidth, h = cv.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / Math.max(1, w * h)));
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(uRes, cv.width, cv.height);
  };
  new ResizeObserver(medir).observe(cv);
  medir();

  let visible = false;
  let primero = true;
  const cuadro = () => {
    if (!visible || document.hidden) return;
    gl.uniform1f(uT, ahora());
    gl.uniform4fv(uRip, rip);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (primero) { primero = false; cv.classList.add('on'); }
    requestAnimationFrame(cuadro);
  };
  new IntersectionObserver(([e]) => {
    const antes = visible;
    visible = e.isIntersecting;
    if (visible && !antes) requestAnimationFrame(cuadro);
  }).observe(cv);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) requestAnimationFrame(cuadro); });
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); visible = false; cv.classList.remove('on'); });

  const caja = cv.parentElement!;
  let ux = -1e3, uy = -1e3, ut = 0;
  const punto = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, e.clientX, e.clientY]; };
  caja.addEventListener('pointermove', (e) => {
    const [x, y, px, py] = punto(e);
    if (Math.hypot(px - ux, py - uy) > 70 && performance.now() - ut > 90) { ux = px; uy = py; ut = performance.now(); onda(x, y, 0.55); }
  });
  caja.addEventListener('pointerdown', (e) => { const [x, y] = punto(e); onda(x, y, 1.3); });
  onda(0.5, 0.35, 0.8); // una gota de bienvenida
  return true;
}
