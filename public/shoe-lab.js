/**
 * Clessio 3D Shoe Lab — Smooth Physics + Hand Tracking
 */
(function () {
  var scene, camera, renderer, model, composer;
  var spotLights = [], ambientLight, bloomPass;
  var logoMesh, logoMaterial;
  var animId = null, guiInstance = null;
  var wallMeshes = [], wallMat = null, modelMeshes = [];
  var vignettePass = null, filmPass = null, rgbShiftPass = null;

  // ── Hover shader FX v4.0 — surface grid mask, no discard ──
  var wireOrigMats = [];
  var wireHitPoint = new THREE.Vector3();      // smoothed hit point (with momentum)
  var wireHitPointTarget = new THREE.Vector3(); // raw hit point from raycaster
  var wireHovering = false;
  var wireRadius = {value:0,target:0};

  // Shoe grid (showroom mode)
  var gridGroup = null;
  var gridTiles = [];
  var gridMode = false; // false = home (shoe only), true = showroom (grid)
  var gridIntroStart = 0;
  var gridActiveId = null;
  var gridRaycaster = new THREE.Raycaster();
  var gridMouse = new THREE.Vector2();
  var gridTargetCamZ = 0;
  var gridTargetLightMul = 1;
  var gridTargetShoeOpacity = 1;
  var gridHoverId = -1; // currently hovered tile index (-1 = none)

  // ── Smooothy lerp class (target-based smoothing, decouples input from render) ──
  function Smooothy(val,speed){this.value=val;this.target=val;this.speed=speed;}
  Smooothy.prototype.update=function(){this.value+=(this.target-this.value)*this.speed;return this.value;};
  Smooothy.prototype.set=function(v){this.target=v;};
  Smooothy.prototype.force=function(v){this.value=v;this.target=v;};

  // Interaction state
  var isDragging = false;
  var velocity = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 };
  var smoothRotation = { x: 0, y: 0 };
  var mouseNorm = { x: 0, y: 0 };
  var currentScale = 1;
  var lastInteractionTime = 0;

  // Hand tracking — target-based smoothing
  var mpHands = null, mpCamera = null;
  var handVideoEl = null, cursorEl = null;
  var isPinching = false, wasPinching = false;
  var handPos = { x: 0.5, y: 0.5 };
  var prevHandPos = { x: 0.5, y: 0.5 };
  // Smooothy instances (allocated on startHandTracking)
  var sRotX = null, sRotY = null, sCursorX = null, sCursorY = null;
  // Pinch state
  var pinchFrames = 0, pinchReleaseFrames = 0;
  var pinchStartHandX = 0, pinchStartHandY = 0;
  var pinchStartRotX = 0, pinchStartRotY = 0;
  // Velocity tracking for throw on release (last few frames)
  var handHistory = []; // [{x,y,t}, ...]
  var HAND_HIST_SIZE = 5;

  // ── Tuned defaults (locked) ──
  var _isMobile=window.innerWidth<=768;
  var P = {
    modelScale: _isMobile?1.3:1.8669, modelX: _isMobile?0:0.032, modelY: _isMobile?0.06:0.18, modelZ: -0.179,
    modelRotOffsetX: 0.55, modelRotOffsetY: -0.63, modelRotOffsetZ: 0.06,
    cameraZoom: _isMobile?1.3:1.001, cameraFOV: _isMobile?42:43, cameraPosY: _isMobile?0.09:0.26, cameraPosX: 0,
    idleEnabled: true, idleBobSpeed: 0.0007, idleBobAmplitude: 0.02,
    idleSwaySpeed: 0.0003, idleSwayAmplitude: 0.011, idleRotSpeed: 0, idleRotAmplitude: 0.02,
    dragSensitivity: 0.005, friction: 0.846, maxVelocity: 0.15, dragAxisX: true, dragAxisY: true,
    hoverParallaxEnabled: true, hoverParallaxStrengthX: 0.035, hoverParallaxStrengthY: 0.045,
    autoRotateEnabled: false, autoRotateSpeedY: 0.003, autoRotateSpeedX: 0,
    objColorEnabled: false, objColor: '#ffffff', objRoughness: -1, objMetalness: -1,
    objEmissive: '#000000', objEmissiveIntensity: 0, objWireframe: false, objOpacity: 1,
    objTransparent: false, objEnvMapIntensity: 1, objCastShadow: true, objReceiveShadow: false,
    objFlatShading: false, objSide: 'FrontSide',
    logoX: 0.01, logoY: 0.558, logoZ: -2.48, logoScale: _isMobile?1.51:1.655, logoEmission: 50,
    logoColor: '#ffffff', logoVisible: true, logoOpacity: 1,
    roomWidth: 4.7, roomDepth: 7.3, roomFloorY: -0.35, roomCeilingY: 2.85,
    wallColor: '#405e5d', noiseAmount: 0.83, roughness: 0.91, metalness: 0.415,
    wallEmissive: '#000000', wallEmissiveIntensity: 0, wallSide: 'FrontSide', sceneBgColor: '#050505',
    ambientColor: '#7f6c6c', ambientIntensity: _isMobile?0.635:0.51,
    spot1Intensity: _isMobile?3.4:2.2, spot1X: _isMobile?2.4:-0.1, spot1Y: _isMobile?2.5:4.1, spot1Z: 0.8, spot1Penumbra: 0.21, spot1Angle: 0.85, spot1Color: '#ffffff', spot1Decay: 1, spot1Distance: 0,
    spot2Intensity: _isMobile?2.2:1, spot2X: 0.4, spot2Y: 1.1, spot2Z: 10, spot2Penumbra: 0.7, spot2Angle: 0.2, spot2Color: '#ffffff', spot2Decay: 1, spot2Distance: 0,
    spot3Intensity: _isMobile?5.1:2.7, spot3X: _isMobile?-2:-3.9, spot3Y: _isMobile?0.2:2.9, spot3Z: _isMobile?0.3:-0.4, spot3Penumbra: _isMobile?0.8:0.76, spot3Angle: _isMobile?0.67:0.61, spot3Color: '#ffffff', spot3Decay: 1, spot3Distance: 0,
    enableBloom: true, bloomStrength: _isMobile?0.58:0.69, bloomRadius: _isMobile?0.31:0.65, bloomThreshold: _isMobile?0.501:0.5,
    enableToneMapping: true, toneMappingExposure: _isMobile?0.69:0.75, toneMapping: 'Reinhard', enableShadows: true,
    enableVignette: true, vignetteOffset: 0.94, vignetteDarkness: 0.73,
    enableFilmGrain: false, filmGrainIntensity: 0.08, filmGrainSpeed: 0.5,
    enableRGBShift: false, rgbShiftAmount: 0.003, rgbShiftAngle: 0,
    titleFontSize: 64, titleLineHeight: 1.05, titleLetterSpacing: -0.03,
    titleColor: '#e0e0e0', titleOpacity: 0.88, titleMarginBottom: 9, titleTextTransform: 'uppercase',
    subtitleFontSize: 13, subtitleLineHeight: 1.4, subtitleLetterSpacing: 0.125,
    subtitleColor: '#e0e0e0', subtitleOpacity: 0.55, subtitleMarginTop: 14,
    ctaFontSize: 18, ctaPaddingX: 40, ctaPaddingY: 16, ctaBorderRadius: 50,
    ctaBorderColor: '#ffffff', ctaBorderOpacity: 0.3, ctaBgColor: '#dcd7cc', ctaBgOpacity: 0.25,
    ctaTextColor: '#ffffff', ctaTextOpacity: 0.75, ctaBlur: 10,
    countdownFontSize: 23, countdownLetterSpacing: 0.01, countdownColor: '#ffffff', countdownOpacity: 0.75,
    footerGap: 10, footerMarginBottom: 23, footerMarginRight: 40, contentOffsetY: 119,
    headerLogoFontSize: 22, headerLogoLetterSpacing: 0.07, headerLogoColor: '#ffffff', headerLogoOpacity: 1,
    headerCtaFontSize: 14, headerCtaBorderRadius: 24, headerCtaPaddingX: 24, headerCtaPaddingY: 10,
    navBottom: 34, navLeft: 31, navFontSize: 14, navItemPaddingX: 18, navItemPaddingY: 12,

    // ── Physics ──
    physicsSmoothing: 0.08,
    physicsFriction: 0.94,
    throwMultiplier: 1.6,
    easeBackDelay: 2,
    easeBackSpeed: 0.048,
    easeBackTargetX: 0.55,
    easeBackTargetY: -0.63,

    // ── Rotation limits ──
    rotLimitEnabled: true,
    rotMaxX: 1.2,
    rotMaxY: 1.5,
    rotMaxZ: 0.3,

    // ── Head tracking (MediaPipe Face Mesh → camera parallax) ──
    headSmoothing: 0.12,
    headDeadzone: 0.03,
    headParallaxX: 0.35,   // camera X offset strength
    headParallaxY: 0.2,    // camera Y offset strength
    headParallaxZ: 0.15,   // camera Z offset strength (lean-in depth)
    headZoomStrength: 0.6, // face-distance zoom multiplier (subtle)
    showWebcamPIP: false,

    // ── Title Scramble Text ──
    scrambleDuration: 50,       // ms per character
    scrambleChars: 'CLESSIO!@#$%&01ABCDEF',
    scrambleRevealDelay: 400,   // ms after preloader done
    scrambleRandomness: 1,      // 0-1 chaos factor

    // ── Logo Shader FX ──
    // ── Wireframe FBM Reveal ──
    wireEnabled: true,
    wireColor: '#ffffff',
    wireOpacity: 0.29,
    wireThickness: 1.0,
    wireRadius: 0.65,
    wireRadiusLerp: 0.07,
    wireFbmScale: 13.9,
    wireFbmSpeed: 0.55,
    wireFbmOctaves: 2,
    wireFbmStrength: 0.6,
    wireEdgeSoftness: 1.59,
    wireParam1: 0.28,
    wireParam2: 0.11,
    wireParam3: 0.55,
    wireParam4: 0.5,
    wireParam5: 0.4,
    wireParam6: 0.5,
    wireParam7: 0.5,
    wireParam8: 0.5,
    wireParam9: 0.3,
    // ── v4.0 mask grid params ──
    wireMomentum: 0.18,           // hit point smoothing (lower = more lag)
    wireGridScale: 8.0,           // grid cells per world unit
    wireGridLineWidth: 0.05,      // line thickness
    wireGridIntensity: 1.0,       // overall grid mix strength
    wireFbmDistort: 0.15,         // how much FBM warps the grid uvs
    wireFbmEdge: 0.4,             // FBM edge ripple strength
    wireFbmRipple: 0.3,           // secondary noise ripple
    wireMaskInner: 0.0,           // inner softness boost
    wireMaskFalloff: 1.0,         // 0..2 falloff curve power
    wireDarken: 0.5,              // how much grid darkens base texture
    wireGlowColor: '#ffffff',     // grid line glow color
    wireGlowBoost: 1.5,           // emissive boost for grid lines
    wireFollowFaces: true,        // project grid in tangent space (follows surface)
    wireSecondaryGrid: 0.5,       // sub-grid intensity
    wireEffect: 'gridScan',

    logoFxEnabled: false,
    logoFxType: 'none',
    logoFxSpeed: 1.0,
    logoFxIntensity: 0.5,
    logoFxColor2: '#00ffff',
    logoRotX: 0, logoRotY: 0, logoRotZ: 0,
  };

  // ── CSS Bridge ──
  function setCSS(k,v){document.documentElement.style.setProperty('--cl-'+k,v);}
  function hexA(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}
  function syncCSS(){
    setCSS('title-fs',P.titleFontSize+'px');setCSS('title-lh',P.titleLineHeight);
    setCSS('title-ls',P.titleLetterSpacing+'em');setCSS('title-color',hexA(P.titleColor,P.titleOpacity));
    setCSS('title-mb',P.titleMarginBottom+'px');setCSS('title-tt',P.titleTextTransform);
    setCSS('sub-fs',P.subtitleFontSize+'px');setCSS('sub-lh',P.subtitleLineHeight);
    setCSS('sub-ls',P.subtitleLetterSpacing+'em');setCSS('sub-color',hexA(P.subtitleColor,P.subtitleOpacity));
    setCSS('sub-mt',P.subtitleMarginTop+'px');
    setCSS('cta-fs',P.ctaFontSize+'px');setCSS('cta-px',P.ctaPaddingX+'px');setCSS('cta-py',P.ctaPaddingY+'px');
    setCSS('cta-br',P.ctaBorderRadius+'px');setCSS('cta-border',hexA(P.ctaBorderColor,P.ctaBorderOpacity));
    setCSS('cta-bg',hexA(P.ctaBgColor,P.ctaBgOpacity));setCSS('cta-text',hexA(P.ctaTextColor,P.ctaTextOpacity));
    setCSS('cta-blur',P.ctaBlur+'px');
    setCSS('cd-fs',P.countdownFontSize+'px');setCSS('cd-ls',P.countdownLetterSpacing+'em');
    setCSS('cd-color',hexA(P.countdownColor,P.countdownOpacity));
    setCSS('footer-gap',P.footerGap+'px');setCSS('footer-mb',P.footerMarginBottom+'px');
    setCSS('footer-mr',P.footerMarginRight+'px');setCSS('content-oy',P.contentOffsetY+'px');
    setCSS('hlogo-fs',P.headerLogoFontSize+'px');setCSS('hlogo-ls',P.headerLogoLetterSpacing+'em');
    setCSS('hlogo-color',hexA(P.headerLogoColor,P.headerLogoOpacity));
    setCSS('hcta-fs',P.headerCtaFontSize+'px');setCSS('hcta-br',P.headerCtaBorderRadius+'px');
    setCSS('hcta-px',P.headerCtaPaddingX+'px');setCSS('hcta-py',P.headerCtaPaddingY+'px');
    setCSS('nav-bottom',P.navBottom+'px');setCSS('nav-left',P.navLeft+'px');
    setCSS('nav-fs',P.navFontSize+'px');setCSS('nav-ipx',P.navItemPaddingX+'px');setCSS('nav-ipy',P.navItemPaddingY+'px');
    setCSS('cursor-size',P.cursorSize+'px');
  }

  // ── Textures ──
  function createSVGTexture(){
    var c=document.createElement('canvas');c.width=c.height=1024;var ctx=c.getContext('2d');
    var svg='<svg width="396" height="260" viewBox="0 0 396 260" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M183.275 196.858V259.064L108.772 215.04C93.5328 205.445 64.0716 175.08 68.1353 130.379L183.275 196.858ZM325.514 130.379C329.578 175.08 300.116 205.445 284.876 215.04L210.375 259.064V196.858L325.514 130.379ZM394.933 0C398.997 43.3467 366.148 75.6307 349.215 86.3545L196.825 172.71C164.089 153.52 88.1196 109.382 46.1275 86.3545C4.13537 63.3266 -1.84794 19.1899 0.409695 0L196.825 113.446C256.088 79.5817 378.678 9.48209 394.933 0Z" fill="white"/></svg>';
    var img=new Image();var blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});var url=URL.createObjectURL(blob);
    img.onload=function(){ctx.clearRect(0,0,1024,1024);ctx.drawImage(img,512-198,512-130);if(logoMaterial&&logoMaterial.map)logoMaterial.map.needsUpdate=true;URL.revokeObjectURL(url);};
    img.src=url;return new THREE.CanvasTexture(c);
  }
  function genWallTex(){
    var c=document.createElement('canvas');c.width=c.height=512;var ctx=c.getContext('2d');
    ctx.fillStyle=P.wallColor;ctx.fillRect(0,0,512,512);
    for(var i=0;i<5000*P.noiseAmount;i++){ctx.fillStyle='rgba(0,0,0,'+(Math.random()*0.3)+')';ctx.fillRect(Math.random()*512,Math.random()*512,Math.random()*1.5,Math.random()*1.5);}
    var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
  }

  // ── Shader passes ──
  function mkVignettePass(){return new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},offset:{value:P.vignetteOffset},darkness:{value:P.vignetteDarkness}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float offset;uniform float darkness;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 u=vUv*2.0-1.0;float d=1.0-dot(u,u)*darkness*0.5;c.rgb*=mix(1.0,d,offset);gl_FragColor=c;}'});}
  function mkFilmPass(){return new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},intensity:{value:P.filmGrainIntensity}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float time;uniform float intensity;varying vec2 vUv;float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}void main(){vec4 c=texture2D(tDiffuse,vUv);c.rgb+=vec3((rand(vUv+vec2(time,0.0))-0.5)*intensity);gl_FragColor=c;}'});}
  function mkRGBPass(){return new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},amount:{value:P.rgbShiftAmount},angle:{value:P.rgbShiftAngle}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float amount;uniform float angle;varying vec2 vUv;void main(){vec2 o=amount*vec2(cos(angle),sin(angle));vec4 c;c.r=texture2D(tDiffuse,vUv+o).r;c.g=texture2D(tDiffuse,vUv).g;c.b=texture2D(tDiffuse,vUv-o).b;c.a=1.0;gl_FragColor=c;}'});}

  // ══════════════════════════════════════
  // HOVER SHADER FX — 5 switchable effects
  // ══════════════════════════════════════

  // Shared GLSL: noise + FBM
  var GLSL_NOISE=[
    'vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return-1.0+2.0*fract(sin(p)*43758.5453123);}',
    'float noise3(vec3 p){vec3 i=floor(p);vec3 f=fract(p);vec3 u=f*f*(3.0-2.0*f);',
    'return mix(mix(mix(dot(hash3(i),f),dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),',
    'mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}',
    'float fbm(vec3 p,int oct){float v=0.0;float a=0.5;for(int i=0;i<6;i++){if(i>=oct)break;v+=a*noise3(p);p*=2.0;a*=0.5;}return v;}'
  ].join('\n');

  // Shared vertex shader
  var VERT_SHARED=[
    'varying vec3 vWorldPos;',
    'varying vec3 vNormal;',
    'varying vec3 vBarycentric;',
    'varying vec2 vUv;',
    'void main(){',
    '  vWorldPos=(modelMatrix*vec4(position,1.0)).xyz;',
    '  vNormal=normalize(normalMatrix*normal);',
    '  vUv=uv;',
    '  int idx=gl_VertexID%3;',
    '  if(idx==0)vBarycentric=vec3(1,0,0);',
    '  else if(idx==1)vBarycentric=vec3(0,1,0);',
    '  else vBarycentric=vec3(0,0,1);',
    '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
    '}'
  ].join('\n');

  // Shared uniform declarations
  var UNI_SHARED=[
    'uniform float uTime;uniform vec3 uHitPoint;uniform float uRadius;',
    'uniform vec3 uColor;uniform float uOpacity;uniform float uEdgeSoft;',
    'uniform float uScale;uniform float uSpeed;uniform float uStrength;uniform int uOctaves;',
    'uniform float uParam1;uniform float uParam2;uniform float uParam3;',
    'uniform float uParam4;uniform float uParam5;uniform float uParam6;uniform float uParam7;uniform float uParam8;uniform float uParam9;',
    'varying vec3 vWorldPos;varying vec3 vNormal;varying vec3 vBarycentric;varying vec2 vUv;',
    GLSL_NOISE
  ].join('\n');

  // 5 Fragment shaders
  var FRAG_EFFECTS={};

  // 1) FBM Wireframe — classic noise-distorted wireframe reveal
  FRAG_EFFECTS.fbmWireframe=UNI_SHARED+[
    '',
    'void main(){',
    '  float dist=length(vWorldPos-uHitPoint);',
    '  float n=fbm(vWorldPos*uScale+uTime*uSpeed,uOctaves)*uStrength;',
    '  float edge=smoothstep(uRadius+uEdgeSoft,uRadius-uEdgeSoft,dist+n);',
    '  if(edge<0.01)discard;',
    '  float d=min(min(vBarycentric.x,vBarycentric.y),vBarycentric.z);',
    '  float wire=1.0-smoothstep(0.0,0.015+uParam1*0.03,d);',
    '  float alpha=edge*(wire*uOpacity+0.02);',
    '  gl_FragColor=vec4(uColor,alpha);',
    '}'
  ].join('\n');

  // 2) Dissolve — noise dissolves surface revealing nothing (cutout)
  FRAG_EFFECTS.dissolve=UNI_SHARED+[
    '',
    'void main(){',
    '  float dist=length(vWorldPos-uHitPoint);',
    '  float mask=smoothstep(uRadius+uEdgeSoft,uRadius-uEdgeSoft,dist);',
    '  float n=fbm(vWorldPos*uScale+uTime*uSpeed,uOctaves);',
    '  float dissolve=smoothstep(uStrength-0.1,uStrength+0.1,n+mask*0.8);',
    '  if(dissolve<0.5)discard;',
    '  // Glowing edge',
    '  float edgeGlow=1.0-smoothstep(0.0,uParam1*0.4+0.05,abs(dissolve-0.5));',
    '  vec3 col=mix(uColor,vec3(1.0),edgeGlow*uParam2);',
    '  float alpha=mask*uOpacity;',
    '  gl_FragColor=vec4(col,alpha*edgeGlow);',
    '}'
  ].join('\n');

  // 3) Hologram — scan lines + fresnel edge glow
  FRAG_EFFECTS.hologram=UNI_SHARED+[
    '',
    'void main(){',
    '  float dist=length(vWorldPos-uHitPoint);',
    '  float mask=smoothstep(uRadius+uEdgeSoft,uRadius-uEdgeSoft,dist);',
    '  if(mask<0.01)discard;',
    '  // Fresnel',
    '  vec3 viewDir=normalize(cameraPosition-vWorldPos);',
    '  float fresnel=pow(1.0-abs(dot(viewDir,vNormal)),uParam1*3.0+1.0);',
    '  // Scan lines',
    '  float scan=sin(vWorldPos.y*uScale*10.0+uTime*uSpeed*5.0)*0.5+0.5;',
    '  scan=smoothstep(0.3,0.7,scan);',
    '  // Noise flicker',
    '  float flicker=0.8+0.2*noise3(vec3(uTime*uSpeed*2.0,0.0,0.0));',
    '  float alpha=mask*(fresnel*0.6+scan*uParam2*0.4)*uOpacity*flicker;',
    '  gl_FragColor=vec4(uColor,alpha);',
    '}'
  ].join('\n');

  // 4) X-Ray — fresnel-based edge reveal, transparent center
  FRAG_EFFECTS.xray=UNI_SHARED+[
    '',
    'void main(){',
    '  float dist=length(vWorldPos-uHitPoint);',
    '  float mask=smoothstep(uRadius+uEdgeSoft,uRadius-uEdgeSoft,dist);',
    '  if(mask<0.01)discard;',
    '  vec3 viewDir=normalize(cameraPosition-vWorldPos);',
    '  float fresnel=pow(1.0-abs(dot(viewDir,vNormal)),uParam1*2.0+0.5);',
    '  float n=fbm(vWorldPos*uScale+uTime*uSpeed*0.3,uOctaves)*uStrength;',
    '  float alpha=mask*fresnel*(0.5+n*0.5)*uOpacity;',
    '  vec3 col=mix(uColor,uColor*1.5,fresnel);',
    '  gl_FragColor=vec4(col,alpha);',
    '}'
  ].join('\n');

  // 5) Grid Scan — advanced projected grid with glow, fresnel, dots, pulse ring, chromatic
  FRAG_EFFECTS.gridScan=UNI_SHARED+[
    '',
    'void main(){',
    '  float dist=length(vWorldPos-uHitPoint);',
    '  float mask=smoothstep(uRadius+uEdgeSoft,uRadius-uEdgeSoft,dist);',
    '  if(mask<0.01)discard;',
    '',
    '  // Noise displacement',
    '  float n=fbm(vWorldPos*uScale*0.5+uTime*uSpeed,uOctaves)*uStrength;',
    '',
    '  // Primary grid',
    '  vec3 gp=vWorldPos*uScale*2.0+n;',
    '  float gx=abs(fract(gp.x)-0.5);',
    '  float gy=abs(fract(gp.y)-0.5);',
    '  float gz=abs(fract(gp.z)-0.5);',
    '  float grid=min(min(gx,gy),gz);',
    '  float lineW=uParam1*0.08+0.005;',
    '  float line=1.0-smoothstep(0.0,lineW,grid);',
    '',
    '  // Glow around grid lines (soft halo)',
    '  float glowW=lineW+uParam4*0.15+0.02;',
    '  float glow=(1.0-smoothstep(0.0,glowW,grid))*uParam5;',
    '',
    '  // Secondary finer grid (half scale)',
    '  vec3 gp2=vWorldPos*uScale*4.0+n*0.5;',
    '  float g2=min(min(abs(fract(gp2.x)-0.5),abs(fract(gp2.y)-0.5)),abs(fract(gp2.z)-0.5));',
    '  float subLine=(1.0-smoothstep(0.0,lineW*0.5,g2))*uParam6*0.4;',
    '',
    '  // Dot pattern at grid intersections',
    '  float dotX=abs(fract(gp.x)-0.5);',
    '  float dotY=abs(fract(gp.y)-0.5);',
    '  float dotZ=abs(fract(gp.z)-0.5);',
    '  float dotDist=length(vec2(min(dotX,dotZ),dotY));',
    '  float dots=(1.0-smoothstep(0.0,uParam7*0.06+0.01,dotDist))*0.7;',
    '',
    '  // Pulse ring expanding from hit point',
    '  float pulseRing=sin(dist*uParam2*8.0-uTime*uSpeed*4.0);',
    '  float pulse=smoothstep(0.7,1.0,pulseRing)*uParam8*0.5;',
    '',
    '  // Fresnel edge',
    '  vec3 viewDir=normalize(cameraPosition-vWorldPos);',
    '  float fresnel=pow(1.0-abs(dot(viewDir,vNormal)),uParam9*2.0+1.0);',
    '',
    '  // Depth fade (farther from camera = dimmer)',
    '  float camDist=length(cameraPosition-vWorldPos);',
    '  float depthFade=1.0-smoothstep(0.5,3.0+uParam3*5.0,camDist);',
    '',
    '  // Combine all layers',
    '  float combined=line+glow+subLine+dots+pulse+fresnel*0.3;',
    '  combined=clamp(combined,0.0,1.0);',
    '  float alpha=mask*combined*uOpacity*depthFade;',
    '',
    '  // Chromatic tint: shift color at edges',
    '  float chromaShift=fresnel*uParam3*0.3;',
    '  vec3 col=uColor+vec3(chromaShift,-chromaShift*0.5,chromaShift*0.8);',
    '',
    '  gl_FragColor=vec4(col,alpha);',
    '}'
  ].join('\n');

  var EFFECT_NAMES=['fbmWireframe','dissolve','hologram','xray','gridScan'];
  var EFFECT_LABELS={'fbmWireframe':'FBM Wireframe','dissolve':'Dissolve','hologram':'Hologram','xray':'X-Ray','gridScan':'Grid Scan'};

  function createHoverShaderMat(effectKey){
    return new THREE.ShaderMaterial({
      uniforms:{
        uTime:{value:0},
        uHitPoint:{value:new THREE.Vector3()},
        uRadius:{value:0},
        uColor:{value:new THREE.Color(P.wireColor)},
        uOpacity:{value:P.wireOpacity},
        uEdgeSoft:{value:P.wireEdgeSoftness},
        uScale:{value:P.wireFbmScale},
        uSpeed:{value:P.wireFbmSpeed},
        uStrength:{value:P.wireFbmStrength},
        uOctaves:{value:P.wireFbmOctaves},
        uParam1:{value:P.wireParam1},
        uParam2:{value:P.wireParam2},
        uParam3:{value:P.wireParam3},
        uParam4:{value:P.wireParam4},
        uParam5:{value:P.wireParam5},
        uParam6:{value:P.wireParam6},
        uParam7:{value:P.wireParam7},
        uParam8:{value:P.wireParam8},
        uParam9:{value:P.wireParam9},
      },
      vertexShader:VERT_SHARED,
      fragmentShader:FRAG_EFFECTS[effectKey]||FRAG_EFFECTS.fbmWireframe,
      transparent:true,
      depthWrite:false,
      side:THREE.DoubleSide,
    });
  }

  function switchHoverEffect(key){
    if(!window._wireGroup)return;
    P.wireEffect=key;
    wireRevealMat=createHoverShaderMat(key);
    window._wireGroup.children.forEach(function(wm){
      wm.material=wireRevealMat;
    });
  }

  // Raycaster for shoe hover detection
  var shoeRaycaster=new THREE.Raycaster();
  var shoeMouseNDC=new THREE.Vector2();
  var shoeHoverFirstTime=true;

  function onShoeMouseMove(e){
    if(!model||!camera||gridMode||!P.wireEnabled)return;
    var c=document.getElementById('hero-canvas');
    if(!c)return;
    var rect=c.getBoundingClientRect();
    shoeMouseNDC.x=((e.clientX-rect.left)/rect.width)*2-1;
    shoeMouseNDC.y=-((e.clientY-rect.top)/rect.height)*2+1;
    shoeRaycaster.setFromCamera(shoeMouseNDC,camera);
    var hits=shoeRaycaster.intersectObjects(modelMeshes,true);
    if(hits.length>0){
      wireHitPointTarget.copy(hits[0].point);
      if(!wireHovering){
        wireHitPoint.copy(hits[0].point);
        wireHovering=true;
        if(window._onShoeHover)window._onShoeHover(true);
        if(shoeHoverFirstTime){
          shoeHoverFirstTime=false;
          if(window._showRotateHint)window._showRotateHint();
        }
      }
      wireRadius.target=P.wireRadius;
    }else{
      if(wireHovering){
        wireHovering=false;
        wireRadius.target=0;
        if(window._onShoeHover)window._onShoeHover(false);
      }
    }
  }

  // ── Room ──
  function buildRoom(){
    wallMeshes.forEach(function(m){scene.remove(m);});wallMeshes=[];
    var w=P.roomWidth,d=P.roomDepth,fy=P.roomFloorY,cy=P.roomCeilingY,my=(fy+cy)/2,wh=cy-fy;
    wallMat.map=genWallTex();wallMat.emissive=new THREE.Color(P.wallEmissive);wallMat.emissiveIntensity=P.wallEmissiveIntensity;wallMat.side=THREE[P.wallSide];
    [{g:[w,d],p:[0,fy,0],r:[-Math.PI/2,0,0]},{g:[w,d],p:[0,cy,0],r:[Math.PI/2,0,0]},{g:[w,wh],p:[0,my,-d/2],r:[0,0,0]},{g:[w,wh],p:[0,my,d/2],r:[0,Math.PI,0]},{g:[d,wh],p:[-w/2,my,0],r:[0,Math.PI/2,0]},{g:[d,wh],p:[w/2,my,0],r:[0,-Math.PI/2,0]}].forEach(function(f){
      var m=new THREE.Mesh(new THREE.PlaneGeometry(f.g[0],f.g[1]),wallMat);
      m.position.set(f.p[0],f.p[1],f.p[2]);m.rotation.set(f.r[0],f.r[1],f.r[2]);m.receiveShadow=true;
      scene.add(m);wallMeshes.push(m);
    });
  }

  function updateModelMats(){
    modelMeshes.forEach(function(mesh){var m=mesh.material;if(!m)return;
      if(P.objColorEnabled)m.color.set(P.objColor);if(P.objRoughness>=0)m.roughness=P.objRoughness;if(P.objMetalness>=0)m.metalness=P.objMetalness;
      m.emissive=new THREE.Color(P.objEmissive);m.emissiveIntensity=P.objEmissiveIntensity;m.wireframe=P.objWireframe;
      m.opacity=P.objOpacity;m.transparent=P.objTransparent||P.objOpacity<1;m.flatShading=P.objFlatShading;m.side=THREE[P.objSide];m.needsUpdate=true;
      mesh.castShadow=P.objCastShadow;mesh.receiveShadow=P.objReceiveShadow;
    });
  }

  /* ══════════════════════════════════════
     HEAD TRACKING — Face Mesh parallax camera
     Uses MediaPipe Face Mesh to detect head position and offset camera
     for 3D parallax effect (looking "into" the room)
     ══════════════════════════════════════ */
  var mpFaceMesh=null;
  var headX=0,headY=0; // normalized [-1,1] offsets from center
  var sHeadX=null,sHeadY=null;
  var sHeadZoom=null; // Smooothy for depth/zoom based on face size
  var headZoomBaseline=0; // calibrated eye distance at "neutral" position
  var headZoomCalibrated=false;

  function startHandTracking(){
    if(!window.FaceMesh||!window.Camera){console.warn('MediaPipe FaceMesh not loaded');return;}
    sHeadX=new Smooothy(0,P.headSmoothing);
    sHeadY=new Smooothy(0,P.headSmoothing);
    sHeadZoom=new Smooothy(0,P.headSmoothing*0.6); // slower for zoom (subtler)
    headZoomBaseline=0;headZoomCalibrated=false;
    handVideoEl=document.createElement('video');handVideoEl.setAttribute('playsinline','');
    handVideoEl.style.cssText='position:fixed;bottom:16px;right:16px;width:160px;height:120px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);z-index:150;transform:scaleX(-1);opacity:0.7;pointer-events:none;';
    if(!P.showWebcamPIP)handVideoEl.style.display='none';
    document.body.appendChild(handVideoEl);
    mpFaceMesh=new FaceMesh({locateFile:function(f){return'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/'+f;}});
    mpFaceMesh.setOptions({maxNumFaces:1,refineLandmarks:false,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
    mpFaceMesh.onResults(onFaceResults);
    mpCamera=new Camera(handVideoEl,{onFrame:function(){return mpFaceMesh.send({image:handVideoEl});},width:640,height:480});
    mpCamera.start();
  }

  function stopHandTracking(){
    if(mpCamera){mpCamera.stop();mpCamera=null;}
    if(mpFaceMesh){mpFaceMesh.close();mpFaceMesh=null;}
    if(handVideoEl){handVideoEl.remove();handVideoEl=null;}
    sHeadX=null;sHeadY=null;sHeadZoom=null;headX=0;headY=0;
    headZoomBaseline=0;headZoomCalibrated=false;
  }

  function onFaceResults(results){
    if(sHeadX){sHeadX.speed=P.headSmoothing;sHeadY.speed=P.headSmoothing;}
    if(sHeadZoom)sHeadZoom.speed=P.headSmoothing*0.6;
    if(!results.multiFaceLandmarks||results.multiFaceLandmarks.length===0){
      if(sHeadX)sHeadX.set(0);
      if(sHeadY)sHeadY.set(0);
      if(sHeadZoom)sHeadZoom.set(0);
      return;
    }
    var lm=results.multiFaceLandmarks[0];
    // Landmark 1 = nose tip (stable, center of face)
    var nose=lm[1];
    // Mirror X so head-left moves scene left
    var nx=(1-nose.x)*2-1; // [-1,1]
    var ny=(nose.y)*2-1;
    // Apply deadzone
    if(Math.abs(nx)<P.headDeadzone)nx=0;
    if(Math.abs(ny)<P.headDeadzone)ny=0;
    if(sHeadX){sHeadX.set(nx);sHeadY.set(ny);}

    // Depth: measure inter-eye distance (landmarks 33=left eye outer, 263=right eye outer)
    // Larger distance = face closer to screen
    var le=lm[33],re=lm[263];
    var eyeDist=Math.sqrt(Math.pow(le.x-re.x,2)+Math.pow(le.y-re.y,2));
    // Calibrate baseline on first few stable frames
    if(!headZoomCalibrated){
      headZoomBaseline=eyeDist;
      headZoomCalibrated=true;
    }
    // Ratio: >1 = closer, <1 = farther. Clamp to subtle range.
    var ratio=eyeDist/headZoomBaseline;
    var zoomOffset=(ratio-1)*P.headZoomStrength; // positive = closer = zoom in
    zoomOffset=Math.max(-0.15,Math.min(0.15,zoomOffset)); // hard clamp for subtlety
    if(sHeadZoom)sHeadZoom.set(zoomOffset);
  }

  /* ══════════════════════════════════════
     INIT
     ══════════════════════════════════════ */
  function init(){
    var container=document.getElementById('hero-canvas');
    if(!container)return;destroy();syncCSS();

    scene=new THREE.Scene();scene.background=new THREE.Color(P.sceneBgColor);
    camera=new THREE.PerspectiveCamera(P.cameraFOV,window.innerWidth/window.innerHeight,0.1,100);
    camera.position.set(P.cameraPosX,P.cameraPosY,P.cameraZoom);

    renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.shadowMap.enabled=P.enableShadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ReinhardToneMapping;renderer.toneMappingExposure=P.toneMappingExposure;
    container.appendChild(renderer.domElement);

    // Post chain
    composer=new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene,camera));
    bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),P.bloomStrength,P.bloomRadius,P.bloomThreshold);
    bloomPass.enabled=P.enableBloom;composer.addPass(bloomPass);
    vignettePass=mkVignettePass();vignettePass.enabled=P.enableVignette;composer.addPass(vignettePass);
    filmPass=mkFilmPass();filmPass.enabled=P.enableFilmGrain;composer.addPass(filmPass);
    rgbShiftPass=mkRGBPass();rgbShiftPass.enabled=P.enableRGBShift;composer.addPass(rgbShiftPass);

    // Lights
    ambientLight=new THREE.AmbientLight(P.ambientColor,P.ambientIntensity);scene.add(ambientLight);
    spotLights=[];
    for(var i=1;i<=3;i++){(function(n){
      var s=new THREE.SpotLight(P['spot'+n+'Color'],P['spot'+n+'Intensity']);
      s.position.set(P['spot'+n+'X'],P['spot'+n+'Y'],P['spot'+n+'Z']);
      s.castShadow=true;s.penumbra=P['spot'+n+'Penumbra'];s.angle=P['spot'+n+'Angle'];
      s.decay=P['spot'+n+'Decay'];s.distance=P['spot'+n+'Distance'];
      scene.add(s);spotLights.push(s);
    })(i);}

    // Room
    wallMat=new THREE.MeshStandardMaterial({map:genWallTex(),roughness:P.roughness,metalness:P.metalness});
    buildRoom();

    // Logo — emissive mesh on back wall
    logoMaterial=new THREE.MeshStandardMaterial({
      map:createSVGTexture(), transparent:true, depthWrite:false,
      emissive:new THREE.Color(P.logoColor), emissiveIntensity:P.logoEmission,
      opacity:P.logoOpacity,
    });
    logoMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),logoMaterial);
    logoMesh.position.set(P.logoX,P.logoY,P.logoZ);
    logoMesh.scale.set(P.logoScale,P.logoScale,1);logoMesh.visible=P.logoVisible;
    scene.add(logoMesh);

    // Model
    rotation.x=0;rotation.y=0;smoothRotation.x=P.easeBackTargetX;smoothRotation.y=P.easeBackTargetY;
    var loader=new THREE.GLTFLoader();
    loader.load('https://raw.githubusercontent.com/eettoree/gltf/2659eb9112e8c45f325ad69b185d99c71cd553f3/Placeholder.glb',function(gltf){
      model=gltf.scene;model.scale.set(P.modelScale,P.modelScale,P.modelScale);
      var box=new THREE.Box3().setFromObject(model);var center=box.getCenter(new THREE.Vector3());
      model.position.sub(center);modelMeshes=[];
      model.traverse(function(n){if(n.isMesh){n.castShadow=true;modelMeshes.push(n);}});
      // Only start invisible if preloader is still running (first load)
      if(window._onShoeLabReady){
        model.scale.set(0,0,0);
        currentScale=0;
      }else{
        model.scale.set(P.modelScale,P.modelScale,P.modelScale);
        currentScale=P.modelScale;
      }
      scene.add(model);spotLights.forEach(function(s){s.target=model;});
      // ── Hover shader v4.0: surface grid mask, preserves PBR, no discard ──
      // Approach:
      // 1) Clone each mesh material, keep full PBR pipeline intact
      // 2) onBeforeCompile injects: world pos + tangent space varyings,
      //    FBM noise functions, and a final color modification that
      //    overlays an animated grid (in tangent space) modulated by a
      //    smooth distance mask from the hover hit point.
      // 3) The shoe stays solid (no discard, no see-through).
      if(P.wireEnabled){
        wireOrigMats=[];

        var FBM_GLSL=[
          'vec3 _mh(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return-1.0+2.0*fract(sin(p)*43758.5453);}',
          'float _mn(vec3 p){vec3 i=floor(p);vec3 f=fract(p);vec3 u=f*f*(3.0-2.0*f);return mix(mix(mix(dot(_mh(i),f),dot(_mh(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(_mh(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(_mh(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),mix(mix(dot(_mh(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(_mh(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(_mh(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(_mh(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}',
          'float _mfbm(vec3 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*_mn(p);p*=2.0;a*=0.5;}return v;}',
          // tangent-space basis from world pos derivatives (no UVs needed)
          'mat3 _basisFromPos(vec3 p,vec3 n){vec3 dx=dFdx(p);vec3 dy=dFdy(p);vec3 t=normalize(dx-n*dot(n,dx));vec3 b=cross(n,t);return mat3(t,b,n);}',
        ].join('\n');

        model.traverse(function(n){
          if(n.isMesh){
            wireOrigMats.push({mesh:n,orig:n.material});
            var mat=n.material.clone();
            (function(meshNode){
              mat.onBeforeCompile=function(shader){
                shader.uniforms.uMaskHit={value:wireHitPoint};
                shader.uniforms.uMaskRadius={value:0};
                shader.uniforms.uMaskSoft={value:P.wireEdgeSoftness};
                shader.uniforms.uMaskTime={value:0};
                shader.uniforms.uMaskScale={value:P.wireFbmScale};
                shader.uniforms.uMaskSpeed={value:P.wireFbmSpeed};
                shader.uniforms.uMaskStrength={value:P.wireFbmStrength};
                shader.uniforms.uGridScale={value:P.wireGridScale};
                shader.uniforms.uGridLineW={value:P.wireGridLineWidth};
                shader.uniforms.uGridInt={value:P.wireGridIntensity};
                shader.uniforms.uFbmDistort={value:P.wireFbmDistort};
                shader.uniforms.uFbmEdge={value:P.wireFbmEdge};
                shader.uniforms.uFbmRipple={value:P.wireFbmRipple};
                shader.uniforms.uMaskInner={value:P.wireMaskInner};
                shader.uniforms.uMaskFalloff={value:P.wireMaskFalloff};
                shader.uniforms.uDarken={value:P.wireDarken};
                shader.uniforms.uGlowColor={value:new THREE.Color(P.wireGlowColor)};
                shader.uniforms.uGlowBoost={value:P.wireGlowBoost};
                shader.uniforms.uSubGrid={value:P.wireSecondaryGrid};
                shader.uniforms.uFollowFaces={value:P.wireFollowFaces?1.0:0.0};
                meshNode.userData.maskShader=shader;

                // Vertex: world pos varying via begin_vertex chunk
                shader.vertexShader='varying vec3 vMaskWPos;\nvarying vec3 vMaskN;\n'+shader.vertexShader;
                shader.vertexShader=shader.vertexShader.replace(
                  '#include <begin_vertex>',
                  '#include <begin_vertex>\nvMaskWPos=(modelMatrix*vec4(transformed,1.0)).xyz;\nvMaskN=normalize(mat3(modelMatrix)*normal);'
                );

                // Fragment: prepend uniforms + helpers
                shader.fragmentShader='#extension GL_OES_standard_derivatives : enable\n'+[
                  'varying vec3 vMaskWPos;',
                  'varying vec3 vMaskN;',
                  'uniform vec3 uMaskHit;uniform float uMaskRadius;uniform float uMaskSoft;',
                  'uniform float uMaskTime;uniform float uMaskScale;uniform float uMaskSpeed;uniform float uMaskStrength;',
                  'uniform float uGridScale;uniform float uGridLineW;uniform float uGridInt;',
                  'uniform float uFbmDistort;uniform float uFbmEdge;uniform float uFbmRipple;',
                  'uniform float uMaskInner;uniform float uMaskFalloff;uniform float uDarken;',
                  'uniform vec3 uGlowColor;uniform float uGlowBoost;uniform float uSubGrid;',
                  'uniform float uFollowFaces;',
                  FBM_GLSL,
                ].join('\n')+'\n'+shader.fragmentShader;

                // Inject the grid overlay AFTER the PBR color is computed
                // (right before the final dithering step)
                shader.fragmentShader=shader.fragmentShader.replace(
                  '#include <dithering_fragment>',
                  [
                    '// ── v4.0 hover surface grid mask ──',
                    'float _md=length(vMaskWPos-uMaskHit);',
                    '// edge noise: warps the radius for organic falloff',
                    'float _ne=_mfbm(vMaskWPos*uMaskScale*0.6+uMaskTime*uMaskSpeed*0.4)*uFbmEdge;',
                    'float _nr=_mfbm(vMaskWPos*uMaskScale*1.7+uMaskTime*uMaskSpeed*0.7)*uFbmRipple;',
                    'float _shaped=_md+_ne*0.4+_nr*0.15;',
                    'float _mask=1.0-smoothstep(uMaskRadius-uMaskSoft,uMaskRadius+uMaskSoft,_shaped);',
                    '_mask=pow(clamp(_mask,0.0,1.0),uMaskFalloff);',
                    '_mask=clamp(_mask+uMaskInner*(1.0-smoothstep(0.0,uMaskRadius*0.5,_md)),0.0,1.0);',
                    'if(_mask>0.005){',
                    '  // Tangent-space coords from screen-space derivatives — grid follows surface',
                    '  vec3 _N=normalize(vMaskN);',
                    '  mat3 _bas=_basisFromPos(vMaskWPos,_N);',
                    '  vec3 _local=vMaskWPos;',
                    '  if(uFollowFaces>0.5){_local=transpose(_bas)*vMaskWPos;}',
                    '  // FBM distortion of the grid uvs',
                    '  float _dn=_mfbm(_local*uMaskScale*0.5+uMaskTime*uMaskSpeed*0.3);',
                    '  vec2 _guv=_local.xy*uGridScale+vec2(_dn*uFbmDistort);',
                    '  // Primary grid via abs(fract - 0.5) trick',
                    '  vec2 _g=abs(fract(_guv)-0.5);',
                    '  float _gd=min(_g.x,_g.y);',
                    '  float _gline=1.0-smoothstep(uGridLineW*0.5,uGridLineW*0.5+0.01,_gd);',
                    '  // Secondary finer grid',
                    '  vec2 _g2=abs(fract(_guv*2.0)-0.5);',
                    '  float _gd2=min(_g2.x,_g2.y);',
                    '  float _gline2=(1.0-smoothstep(uGridLineW*0.25,uGridLineW*0.25+0.005,_gd2))*uSubGrid;',
                    '  float _grid=clamp(_gline+_gline2*0.5,0.0,1.0)*uGridInt;',
                    '  // Pulse traveling outward from hit',
                    '  float _pulse=sin(_md*8.0-uMaskTime*uMaskSpeed*4.0)*0.5+0.5;',
                    '  _pulse=smoothstep(0.7,1.0,_pulse)*0.4;',
                    '  // Mix grid into the final color',
                    '  vec3 _baseCol=gl_FragColor.rgb;',
                    '  vec3 _darkened=_baseCol*(1.0-uDarken*_mask*0.5);',
                    '  vec3 _gridCol=uGlowColor*uGlowBoost*(_grid+_pulse);',
                    '  gl_FragColor.rgb=mix(_darkened,_darkened+_gridCol,_grid*_mask);',
                    '  // Brighten the mask edge slightly',
                    '  float _edge=1.0-smoothstep(0.0,uMaskSoft*1.5,abs(_shaped-uMaskRadius));',
                    '  gl_FragColor.rgb+=uGlowColor*_edge*_mask*0.6;',
                    '}',
                    '#include <dithering_fragment>',
                  ].join('\n')
                );
              };
            })(n);
            mat.needsUpdate=true;
            n.material=mat;
          }
        });
      }
      initGUI();
      if(window._onShoeLabReady)window._onShoeLabReady();
    });

    container.addEventListener('wheel',onGridWheel,{passive:true});
    container.addEventListener('mousemove',onShoeMouseMove);
    container.addEventListener('mousedown',onMD);
    container.addEventListener('touchstart',onTD,{passive:true});
    container.addEventListener('click',onGridClick);
    container.addEventListener('mousemove',onGridMouseMove);
    container.addEventListener('pointerdown',onGridPointerDown);
    window.addEventListener('pointermove',onGridPointerMove);
    window.addEventListener('pointerup',onGridPointerUp);
    window.addEventListener('pointercancel',onGridPointerUp);
    window.addEventListener('mouseup',onMU);window.addEventListener('mousemove',onMM);
    window.addEventListener('touchmove',onTM,{passive:true});window.addEventListener('touchend',onTU);
    window.addEventListener('resize',onRS);
    gridTargetCamZ=P.cameraZoom;
    animate();
  }

  function onMD(){isDragging=true;lastInteractionTime=performance.now()/1000;velocity.x=0;velocity.y=0;}
  function onMU(){
    if(isDragging){
      velocity.x*=P.throwMultiplier;velocity.y*=P.throwMultiplier;
    }
    isDragging=false;
  }
  function onMM(e){
    mouseNorm.x=(e.clientX/window.innerWidth)*2-1;mouseNorm.y=-(e.clientY/window.innerHeight)*2+1;
    var container=document.getElementById('hero-canvas');isHovering=container&&container.contains(e.target);
    if(isDragging&&model){
      lastInteractionTime=performance.now()/1000;
      var mv=P.maxVelocity,ds=P.dragSensitivity;
      if(P.dragAxisY)velocity.y=Math.max(-mv,Math.min(mv,e.movementX*ds));
      if(P.dragAxisX)velocity.x=Math.max(-mv,Math.min(mv,e.movementY*ds));
    }
  }
  // Touch equivalents for shoe drag on mobile
  var lastTouchX=0,lastTouchY=0;
  function onTD(e){
    if(e.touches.length!==1)return;
    isDragging=true;lastInteractionTime=performance.now()/1000;velocity.x=0;velocity.y=0;
    lastTouchX=e.touches[0].clientX;lastTouchY=e.touches[0].clientY;
  }
  function onTM(e){
    if(!isDragging||!model||e.touches.length!==1)return;
    var t=e.touches[0];
    var dx=t.clientX-lastTouchX;var dy=t.clientY-lastTouchY;
    lastTouchX=t.clientX;lastTouchY=t.clientY;
    lastInteractionTime=performance.now()/1000;
    var mv=P.maxVelocity,ds=P.dragSensitivity;
    if(P.dragAxisY)velocity.y=Math.max(-mv,Math.min(mv,dx*ds));
    if(P.dragAxisX)velocity.x=Math.max(-mv,Math.min(mv,dy*ds));
  }
  function onTU(){
    if(isDragging){velocity.x*=P.throwMultiplier;velocity.y*=P.throwMultiplier;}
    isDragging=false;
  }

  function onRS(){
    if(!camera||!renderer||!composer)return;
    camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);composer.setSize(window.innerWidth,window.innerHeight);
  }

  /* ══════════════════════════════════════
     GUI — Physics + Hand Tracking + Logo
     ══════════════════════════════════════ */
  function initGUI(){
    // Set defaults
    if(!window.titleAnim){
      window.titleAnim={
        duration:1.5,stagger:0.035,startY:120,startRotation:0,
        delay:500,subDelay:550,ease:'quint.out',
      };
    }
    if(!window.electricBtn){
      window.electricBtn={
        enabled:true,color:'#f0feff',speed:0.45,chaos:0.01,
        thickness:2,borderRadius:32,position:'around',
      };
    }

    // Control panel
    if(window.lil){
      if(guiInstance)guiInstance.destroy();
      var gui=new lil.GUI({title:'Showroom Controls',width:280});guiInstance=gui;gui.close();

      var fT=gui.addFolder('Transition');
      fT.add(GS,'cameraZ',5,120,0.5).name('Zoom Out Z').onChange(function(){if(gridMode&&gridActiveId===null)gridTargetCamZ=GS.cameraZ;});
      fT.add(GS,'cameraLerp',0.005,0.5,0.005).name('Camera Ease');
      fT.add(GS,'lightMul',0,2,0.01).name('Light Mul').onChange(function(){if(gridMode)gridTargetLightMul=GS.lightMul;});
      fT.add(GS,'opacityLerp',0.005,0.5,0.005).name('Shoe Fade Ease');

      var fF=gui.addFolder('Focus (Tile Select)');
      fF.add(GS,'focusZoomZ',5,60,0.5).name('Focus Zoom Z');
      fF.add(GS,'focusZoomLerp',0.005,0.2,0.005).name('Focus Zoom Ease');
      fF.add(GS,'activeScale',0.5,3,0.05).name('Active Scale');
      fF.add(GS,'activeOpacity',0,1,0.01).name('Active Opacity');
      fF.add(GS,'dimScale',0.1,1,0.05).name('Dim Scale');
      fF.add(GS,'dimOpacity',0,1,0.01).name('Dim Opacity');
      fF.add(GS,'allowReselect').name('Allow Reselect');

      var fFlat=gui.addFolder('Flat Snap Mode');
      fFlat.add(GS,'flatZoomZ',5,40,0.5).name('Flat Zoom Z');
      fFlat.add(GS,'flatCurvature',0,0.1,0.002).name('Flat Curvature');
      fFlat.add(GS,'flatSnapThreshold',10,100,5).name('Snap Threshold (px)');
      fFlat.add(GS,'flatSnapLerp',0.01,0.2,0.005).name('Snap Lerp');
      fFlat.add({exit:function(){exitFlatMode();}},'exit').name('◀ Exit Flat Mode');

      var fG=gui.addFolder('Grid Layout');
      fG.add(GS,'cols',3,20,1).name('Columns').onFinishChange(rebuildGrid);
      fG.add(GS,'spacingX',1,10,0.05).name('Spacing X').onFinishChange(rebuildGrid);
      fG.add(GS,'spacingY',1,10,0.05).name('Spacing Y').onFinishChange(rebuildGrid);
      fG.add(GS,'tileW',0.5,8,0.05).name('Tile Width').onFinishChange(rebuildGrid);
      fG.add(GS,'tileH',0.5,8,0.05).name('Tile Height').onFinishChange(rebuildGrid);
      fG.add(GS,'groupZ',-10,20,0.1).name('Depth Z').onChange(function(){if(gridGroup)gridGroup.position.z=GS.groupZ;});
      fG.add(GS,'defaultTileOpacity',0,1,0.01).name('Default Opacity');

      var fC=gui.addFolder('Curvature & Rotation');
      fC.add(GS,'curvature',0,0.2,0.002).name('Curvature');
      fC.add(GS,'rotation',0,2,0.05).name('Rotation');

      var fD=gui.addFolder('Drag / Pan');
      fD.add(GS,'dragEnabled').name('Enabled');
      fD.add(GS,'dragSpeed',0.1,6,0.1).name('Speed');
      fD.add(GS,'dampFactor',0.01,0.5,0.005).name('Damping');
      fD.add(GS,'tiltFactor',0,0.3,0.005).name('Tilt');
      fD.add(GS,'dragResistance',0,1,0.01).name('Edge Resistance');

      var fE=gui.addFolder('Enter / Exit');
      fE.add(GS,'introDuration',0.1,3,0.05).name('Intro Duration');
      fE.add(GS,'introDelayFactor',0,0.2,0.002).name('Intro Stagger');
      fE.add(GS,'enterStartZ',-120,0,1).name('Enter Start Z');
      fE.add(GS,'exitEndZ',0,120,1).name('Exit End Z');
      fE.add(GS,'tileLerp',0.01,0.5,0.005).name('Tile Ease');
      fE.add(GS,'transitionZLerp',0.01,0.5,0.005).name('Z Ease');
      fE.add(GS,'transitionYLerp',0.01,0.5,0.005).name('Y Ease');
    }

    // ── Hover Shader FX v4.0 panel ──
    if(window.lil){
      var hg=new lil.GUI({title:'Hover Shader FX v4.0',width:320});hg.close();
      window._hoverShaderGUI=hg;

      hg.add(P,'wireEnabled').name('Enabled');

      var hMask=hg.addFolder('Mask');
      hMask.add(P,'wireRadius',0,5,0.01).name('Radius');
      hMask.add(P,'wireRadiusLerp',0.01,0.3,0.005).name('Radius Ease');
      hMask.add(P,'wireEdgeSoftness',0,2,0.01).name('Edge Softness');
      hMask.add(P,'wireMaskInner',0,1,0.01).name('Inner Boost');
      hMask.add(P,'wireMaskFalloff',0.1,3,0.05).name('Falloff Power');
      hMask.add(P,'wireMomentum',0.02,1,0.01).name('Cursor Momentum');

      var hGrid=hg.addFolder('Grid');
      hGrid.add(P,'wireGridScale',0.5,30,0.1).name('Grid Scale');
      hGrid.add(P,'wireGridLineWidth',0.005,0.3,0.005).name('Line Width');
      hGrid.add(P,'wireGridIntensity',0,3,0.01).name('Grid Intensity');
      hGrid.add(P,'wireSecondaryGrid',0,2,0.01).name('Sub-Grid');
      hGrid.add(P,'wireFollowFaces').name('Follow Surface');

      var hFbm=hg.addFolder('FBM Noise');
      hFbm.add(P,'wireFbmScale',0.1,15,0.05).name('FBM Scale');
      hFbm.add(P,'wireFbmSpeed',0,3,0.01).name('FBM Speed');
      hFbm.add(P,'wireFbmStrength',0,2,0.01).name('FBM Strength');
      hFbm.add(P,'wireFbmDistort',0,1,0.005).name('UV Distort');
      hFbm.add(P,'wireFbmEdge',0,2,0.01).name('Edge Ripple');
      hFbm.add(P,'wireFbmRipple',0,2,0.01).name('Detail Ripple');

      var hLook=hg.addFolder('Look');
      hLook.addColor(P,'wireGlowColor').name('Glow Color');
      hLook.add(P,'wireGlowBoost',0,5,0.05).name('Glow Boost');
      hLook.add(P,'wireDarken',0,1.5,0.01).name('Surface Darken');

      var hPresets=hg.addFolder('Presets');
      function applyPreset(p){Object.keys(p).forEach(function(k){P[k]=p[k];});hg.controllersRecursive().forEach(function(c){c.updateDisplay();});}
      hPresets.add({a:function(){applyPreset({wireRadius:1.4,wireEdgeSoftness:0.5,wireMomentum:0.15,wireGridScale:8,wireGridLineWidth:0.05,wireGridIntensity:1.2,wireFbmDistort:0.15,wireFbmEdge:0.4,wireFbmRipple:0.3,wireMaskFalloff:1,wireDarken:0.5,wireGlowBoost:1.8,wireGlowColor:'#ffffff',wireSecondaryGrid:0.6,wireFollowFaces:true});}},'a').name('→ Architect');
      hPresets.add({a:function(){applyPreset({wireRadius:1.6,wireEdgeSoftness:0.8,wireMomentum:0.1,wireGridScale:14,wireGridLineWidth:0.03,wireGridIntensity:1.5,wireFbmDistort:0.3,wireFbmEdge:0.6,wireFbmRipple:0.5,wireMaskFalloff:0.8,wireDarken:0.3,wireGlowBoost:2.5,wireGlowColor:'#00ffea',wireSecondaryGrid:0.8,wireFollowFaces:true});}},'a').name('→ Cyber');
      hPresets.add({a:function(){applyPreset({wireRadius:2,wireEdgeSoftness:1.2,wireMomentum:0.08,wireGridScale:4,wireGridLineWidth:0.08,wireGridIntensity:0.8,wireFbmDistort:0.5,wireFbmEdge:1,wireFbmRipple:0.6,wireMaskFalloff:1.5,wireDarken:0.7,wireGlowBoost:1.2,wireGlowColor:'#ff6633',wireSecondaryGrid:0.3,wireFollowFaces:true});}},'a').name('→ Organic');
      hPresets.add({a:function(){applyPreset({wireRadius:1.2,wireEdgeSoftness:0.4,wireMomentum:0.25,wireGridScale:20,wireGridLineWidth:0.02,wireGridIntensity:2,wireFbmDistort:0.05,wireFbmEdge:0.2,wireFbmRipple:0.1,wireMaskFalloff:0.6,wireDarken:0.2,wireGlowBoost:3,wireGlowColor:'#ffffff',wireSecondaryGrid:1,wireFollowFaces:true});}},'a').name('→ Tech');
      hPresets.add({a:function(){applyPreset({wireRadius:1.8,wireEdgeSoftness:0.7,wireMomentum:0.18,wireGridScale:10,wireGridLineWidth:0.04,wireGridIntensity:1.6,wireFbmDistort:0.2,wireFbmEdge:0.5,wireFbmRipple:0.4,wireMaskFalloff:1,wireDarken:0.4,wireGlowBoost:2,wireGlowColor:'#aaffcc',wireSecondaryGrid:0.7,wireFollowFaces:true});}},'a').name('→ Awwward');
    }
  }

  /* ══════════════════════════════════════
     ANIMATE — Smooth physics + ease-back
     ══════════════════════════════════════ */
  function animate(){
    animId=requestAnimationFrame(animate);
    if(!model){if(composer)composer.render();return;}

    var now=performance.now()/1000;
    var interacting=isDragging;

    if(interacting)lastInteractionTime=now;

    // Air friction when not interacting
    if(!interacting){
      velocity.x*=P.physicsFriction;
      velocity.y*=P.physicsFriction;
      if(Math.abs(velocity.x)<0.0001)velocity.x=0;
      if(Math.abs(velocity.y)<0.0001)velocity.y=0;
    }

    // Add velocity to rotation
    rotation.x+=velocity.x;
    rotation.y+=velocity.y;

    // Clamp rotation within limits
    if(P.rotLimitEnabled){
      rotation.x=Math.max(-P.rotMaxX,Math.min(P.rotMaxX,rotation.x));
      rotation.y=Math.max(-P.rotMaxY,Math.min(P.rotMaxY,rotation.y));
    }

    // Auto rotate
    if(P.autoRotateEnabled&&!interacting){
      rotation.y+=P.autoRotateSpeedY;rotation.x+=P.autoRotateSpeedX;
    }

    // Ease-back: smooth return to default after idle
    var idleTime=now-lastInteractionTime;
    if(idleTime>P.easeBackDelay&&!interacting){
      var t=Math.min((idleTime-P.easeBackDelay)*0.5,1);
      var easeFactor=t*t*(3-2*t);
      var speed=P.easeBackSpeed*easeFactor;
      rotation.x+=(P.easeBackTargetX-P.modelRotOffsetX-rotation.x)*speed;
      rotation.y+=(P.easeBackTargetY-P.modelRotOffsetY-rotation.y)*speed;
      velocity.x*=0.95;velocity.y*=0.95;
    }

    // Smooth rotation
    var lerpFactor=isDragging?0.45:P.physicsSmoothing;
    smoothRotation.x+=(rotation.x-smoothRotation.x)*lerpFactor;
    smoothRotation.y+=(rotation.y-smoothRotation.y)*lerpFactor;

    // Head parallax — offset camera based on face position + depth zoom
    if(sHeadX&&sHeadY){
      var hx=sHeadX.update();var hy=sHeadY.update();
      var hz=sHeadZoom?sHeadZoom.update():0;
      camera.position.x=P.cameraPosX+hx*P.headParallaxX;
      camera.position.y=P.cameraPosY-hy*P.headParallaxY;
      camera.position.z=P.cameraZoom-Math.abs(hx)*P.headParallaxZ-Math.abs(hy)*P.headParallaxZ-hz;
      camera.lookAt(0,P.cameraPosY,0);
    }

    // Hover parallax
    var px=0,py=0;
    if(P.hoverParallaxEnabled&&!interacting){
      px=mouseNorm.x*P.hoverParallaxStrengthX;py=mouseNorm.y*P.hoverParallaxStrengthY;
    }

    // Apply to model
    model.rotation.x=smoothRotation.x+P.modelRotOffsetX+py;
    model.rotation.y=smoothRotation.y+P.modelRotOffsetY+px;
    model.rotation.z=P.modelRotOffsetZ;

    // Scale (don't override during animateShoeIn)
    if(currentScale>=P.modelScale-0.01){
      model.scale.set(P.modelScale,P.modelScale,P.modelScale);
    }

    // Idle animation
    if(P.idleEnabled){
      var t2=performance.now();
      model.position.y=P.modelY+Math.sin(t2*P.idleBobSpeed)*P.idleBobAmplitude;
      model.position.x=P.modelX+Math.cos(t2*P.idleSwaySpeed)*P.idleSwayAmplitude;
    }else{model.position.y=P.modelY;model.position.x=P.modelX;}

    if(filmPass&&filmPass.enabled)filmPass.uniforms.time.value=now*P.filmGrainSpeed;

    // ── Hover mask v4.0: smoothed hit point + per-mesh uniforms ──
    if(P.wireEnabled){
      wireRadius.value+=(wireRadius.target-wireRadius.value)*P.wireRadiusLerp;
      // Momentum: lerp smoothed hit point toward target (gives that "sticky" feel)
      wireHitPoint.lerp(wireHitPointTarget,P.wireMomentum);

      modelMeshes.forEach(function(mesh){
        var s=mesh.userData.maskShader;
        if(s&&s.uniforms.uMaskRadius){
          s.uniforms.uMaskHit.value.copy(wireHitPoint);
          s.uniforms.uMaskRadius.value=wireRadius.value;
          s.uniforms.uMaskSoft.value=P.wireEdgeSoftness;
          s.uniforms.uMaskTime.value=now;
          s.uniforms.uMaskScale.value=P.wireFbmScale;
          s.uniforms.uMaskSpeed.value=P.wireFbmSpeed;
          s.uniforms.uMaskStrength.value=P.wireFbmStrength;
          s.uniforms.uGridScale.value=P.wireGridScale;
          s.uniforms.uGridLineW.value=P.wireGridLineWidth;
          s.uniforms.uGridInt.value=P.wireGridIntensity;
          s.uniforms.uFbmDistort.value=P.wireFbmDistort;
          s.uniforms.uFbmEdge.value=P.wireFbmEdge;
          s.uniforms.uFbmRipple.value=P.wireFbmRipple;
          s.uniforms.uMaskInner.value=P.wireMaskInner;
          s.uniforms.uMaskFalloff.value=P.wireMaskFalloff;
          s.uniforms.uDarken.value=P.wireDarken;
          s.uniforms.uGlowColor.value.set(P.wireGlowColor);
          s.uniforms.uGlowBoost.value=P.wireGlowBoost;
          s.uniforms.uSubGrid.value=P.wireSecondaryGrid;
          s.uniforms.uFollowFaces.value=P.wireFollowFaces?1.0:0.0;
        }
      });
    }

    // Showroom grid update
    updateGrid();

    composer.render();
  }

  /* ── DESTROY ── */
  function destroy(){
    if(animId)cancelAnimationFrame(animId);animId=null;stopHandTracking();
    var c=document.getElementById('hero-canvas');
    if(guiInstance){guiInstance.destroy();guiInstance=null;}
    if(renderer&&c){try{c.removeChild(renderer.domElement);}catch(e){}renderer.dispose();renderer=null;}
    window.removeEventListener('mouseup',onMU);window.removeEventListener('mousemove',onMM);window.removeEventListener('resize',onRS);
    window.removeEventListener('touchmove',onTM);window.removeEventListener('touchend',onTU);
    window.removeEventListener('pointermove',onGridPointerMove);window.removeEventListener('pointerup',onGridPointerUp);window.removeEventListener('pointercancel',onGridPointerUp);
    if(c){c.removeEventListener('mousedown',onMD);c.removeEventListener('touchstart',onTD);c.removeEventListener('click',onGridClick);c.removeEventListener('mousemove',onGridMouseMove);c.removeEventListener('mousemove',onShoeMouseMove);c.removeEventListener('wheel',onGridWheel);c.removeEventListener('pointerdown',onGridPointerDown);}
    wallMeshes=[];modelMeshes=[];model=null;scene=null;camera=null;composer=null;spotLights=[];
    gridGroup=null;gridTiles=[];gridMode=false;
  }

  /* ══════════════════════════════════════
     SHOWROOM GRID (60 shoe images as planes)
     ══════════════════════════════════════ */
  var GRID_COUNT=60;
  var GRID_SHOE_BASE='https://raw.githubusercontent.com/MatthewGreenberg/shoe-finder/main/public/shoes/';

  // Tunable showroom + grid params (exposed via GUI)
  // Defaults ported from MatthewGreenberg/shoe-finder gridConfig.js
  var GS={
    // Transition
    cameraZ:_isMobile?48:34.5,
    cameraLerp:0.04,
    lightLerp:0.025,
    opacityLerp:0.035,
    lightMul:0,
    heroOpacity:0,
    heroOpacityDefault:1,
    exitFadeMs:2000,
    // Grid layout
    cols:8,
    spacingX:5.3,
    spacingY:5.05,
    tileW:4.1,
    tileH:2.2,
    groupZ:-4.5,
    // Intro stagger
    introDuration:0.45,
    introDelayFactor:0.028,
    // Per-tile base opacity
    defaultTileOpacity:0.49,
    // Active/dim states (click focus)
    activeScale:1.35,
    dimScale:0.4,
    activeOpacity:0.69,
    dimOpacity:0.35,
    tileLerp:0.05,
    // Hover (desktop only)
    hoverScale:1.08,        // scale on hover
    hoverZ:0.6,             // Z lift on hover
    hoverLerp:0.15,         // lerp speed for hover effect
    // Focus zoom (camera Z when a tile is selected)
    focusZoomZ:22,
    focusZoomLerp:0.04,
    allowReselect:true,
    // Flat snap mode (swipe between products)
    flatZoomZ:14,           // closer zoom in flat mode
    flatCurvature:0,        // no curvature in flat mode
    flatSnapThreshold:40,   // px drag threshold to snap to next
    flatSnapLerp:0.06,      // pan lerp speed in flat mode
    // 3D curvature
    curvature:0.046,
    rotation:0.2,
    // Enter/exit flight
    enterStartZ:-120,
    exitEndZ:10,
    enterSpreadY:1,
    exitSpreadY:0.5,
    transitionZLerp:0.26,
    transitionYLerp:0.07,
    // ── Drag / Pan (shoe-finder Rig) ──
    dragEnabled:true,
    dragSpeed:0.9,
    dampFactor:0.04,
    tiltFactor:0.17,
    clickThreshold:5,
    dragResistance:0.19,
    // ── Zoom (shoe-finder) ──
    zoomIn:12,
    zoomDamp:0.25,
    // ── Culling ──
    cullDistance:32,
    // ── Fog ──
    fogEnabled:false,
    fogNear:19,
    fogFar:100,
    fogColor:'#050505',
  };

  // Grid rig state (pan/drag in showroom mode)
  var gridRig={
    targetX:0,targetY:0,
    currentX:0,currentY:0,
    velX:0,velY:0,
    prevX:0,prevY:0,
    isDragging:false,
    startMX:0,startMY:0,
    startRigX:0,startRigY:0,
    maxDragDist:0,
  };
  var gridFog=null;

  // ── Flat snap mode (swipe between products) ──
  var flatMode=false;
  var flatCurrentIdx=0;
  var flatSnapLerp=0.08;

  function enterFlatMode(){
    flatMode=true;
    flatCurrentIdx=gridActiveId||0;
    // Flatten: remove curvature, zoom in closer, expand spacing
    gridTargetCamZ=GS.flatZoomZ;
    centerOnTile(flatCurrentIdx);
    if(window._onShoeSelect)window._onShoeSelect(flatCurrentIdx);
  }

  function exitFlatMode(){
    flatMode=false;
    gridActiveId=null;
    gridTargetCamZ=GS.cameraZ;
    gridRig.targetX=0;gridRig.targetY=0;
    if(window._onShoeDeselect)window._onShoeDeselect();
  }

  function centerOnTile(idx){
    if(idx<0||idx>=gridTiles.length)return;
    var bp=gridTiles[idx].userData.basePos;
    gridRig.targetX=-bp.x;
    gridRig.targetY=-bp.y;
    gridActiveId=idx;
  }

  function snapToNearest(dir){
    // dir: -1 = left/up, +1 = right/down
    var next=flatCurrentIdx+dir;
    if(next<0)next=0;
    if(next>=GRID_COUNT)next=GRID_COUNT-1;
    flatCurrentIdx=next;
    centerOnTile(next);
    if(window._onShoeSelect)window._onShoeSelect(next);
  }

  function buildGrid(){
    if(gridGroup)return;
    gridGroup=new THREE.Group();
    gridGroup.position.set(0,0,GS.groupZ);
    gridGroup.visible=false;
    scene.add(gridGroup);

    gridTiles=[];
    var cols=GS.cols;
    var rows=Math.ceil(GRID_COUNT/cols);
    var loader=new THREE.TextureLoader();

    for(var i=0;i<GRID_COUNT;i++){
      var col=i%cols;
      var row=Math.floor(i/cols);
      var x=(col-(cols-1)/2)*GS.spacingX;
      var y=-(row-(rows-1)/2)*GS.spacingY;
      var url=GRID_SHOE_BASE+'shoe-'+String(i).padStart(3,'0')+'.png';
      var mat=new THREE.MeshBasicMaterial({
        transparent:true,opacity:0,alphaTest:0.02,
        depthWrite:false,depthTest:false,toneMapped:false,fog:false,
      });
      loader.load(url,function(m){return function(t){
        t.colorSpace=THREE.SRGBColorSpace;
        m.map=t;m.needsUpdate=true;
      };}(mat));
      var geo=new THREE.PlaneGeometry(GS.tileW,GS.tileH);
      var mesh=new THREE.Mesh(geo,mat);
      mesh.position.set(x,y,0);
      // Always render on top of the room (bloom + walls)
      mesh.renderOrder=10;
      mesh.userData.basePos={x:x,y:y};
      mesh.userData.index=i;
      // Per-tile animated state (shoe-finder style)
      mesh.userData.tz=GS.enterStartZ; // transition Z
      mesh.userData.ty=0;              // transition Y spread
      mesh.userData.cz=0;              // curvature Z
      mesh.userData.rx=0;              // rotation X
      mesh.userData.ry=0;              // rotation Y
      gridGroup.add(mesh);
      gridTiles.push(mesh);
    }
  }

  function rebuildGrid(){
    if(gridGroup){
      gridTiles.forEach(function(t){
        if(t.geometry)t.geometry.dispose();
        if(t.material){if(t.material.map)t.material.map.dispose();t.material.dispose();}
      });
      scene.remove(gridGroup);
      gridGroup=null;gridTiles=[];
    }
    buildGrid();
    if(gridMode&&gridGroup){
      gridGroup.visible=true;
      gridIntroStart=performance.now();
    }
  }

  function enterShowroom(){
    if(!scene)return;
    buildGrid();
    gridMode=true;
    gridIntroStart=performance.now();
    gridGroup.visible=true;
    // Reset per-tile flight state so they re-enter from enterStartZ
    gridTiles.forEach(function(t){
      t.userData.tz=GS.enterStartZ;
      t.userData.ty=0;
    });
    // Reset rig pan
    gridRig.targetX=0;gridRig.targetY=0;
    gridRig.currentX=0;gridRig.currentY=0;
    gridRig.prevX=0;gridRig.prevY=0;
    gridTargetCamZ=GS.cameraZ;
    gridTargetLightMul=GS.lightMul;
    gridTargetShoeOpacity=GS.heroOpacity;
  }

  function exitShowroom(){
    gridMode=false;
    gridActiveId=null;
    gridTargetCamZ=P.cameraZoom;
    gridTargetLightMul=1;
    gridTargetShoeOpacity=GS.heroOpacityDefault;
    // Let per-tile loop fade + fly out; then hide group
    setTimeout(function(){if(gridGroup&&!gridMode)gridGroup.visible=false;},GS.exitFadeMs);
  }

  function onGridClick(e){
    if(!gridMode||!gridGroup||!camera)return;
    // Ignore if was a drag gesture (use generous threshold)
    if(gridRig.maxDragDist>GS.clickThreshold)return;
    var c=document.getElementById('hero-canvas');
    if(!c)return;
    var rect=c.getBoundingClientRect();
    gridMouse.x=((e.clientX-rect.left)/rect.width)*2-1;
    gridMouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
    gridRaycaster.setFromCamera(gridMouse,camera);
    // Raycast ALL tiles (including dimmed ones)
    var hits=gridRaycaster.intersectObjects(gridTiles);
    // Filter only visible tiles with some opacity
    var validHit=null;
    for(var hi=0;hi<hits.length;hi++){
      var h=hits[hi];
      if(h.object.visible&&h.object.material&&h.object.material.opacity>0.05){
        validHit=h;break;
      }
    }
    if(validHit){
      var idx=validHit.object.userData.index;
      if(gridActiveId===idx){
        // Deselect: click same tile → go to flat snap mode
        enterFlatMode();
      }else{
        // Select (or reselect another tile)
        gridActiveId=idx;
        var bp=validHit.object.userData.basePos;
        gridRig.targetX=-bp.x;
        gridRig.targetY=-bp.y;
        gridTargetCamZ=GS.focusZoomZ;
        if(window._onShoeSelect)window._onShoeSelect(idx);
      }
    }else{
      if(gridActiveId!==null){
        gridActiveId=null;
        gridTargetCamZ=GS.cameraZ;
        gridRig.targetX=0;gridRig.targetY=0;
        flatMode=false;
        if(window._onShoeDeselect)window._onShoeDeselect();
      }
    }
  }

  // ── Grid hover (desktop only) ──
  function onGridMouseMove(e){
    if(!gridMode||!gridGroup||!camera||_isMobile)return;
    var c=document.getElementById('hero-canvas');
    if(!c)return;
    var rect=c.getBoundingClientRect();
    gridMouse.x=((e.clientX-rect.left)/rect.width)*2-1;
    gridMouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
    gridRaycaster.setFromCamera(gridMouse,camera);
    var hits=gridRaycaster.intersectObjects(gridTiles);
    gridHoverId=hits.length>0?hits[0].object.userData.index:-1;
  }

  // ── Grid wheel snap (flat mode) ──
  var wheelCooldown=false;
  function onGridWheel(e){
    if(!flatMode||wheelCooldown)return;
    wheelCooldown=true;
    setTimeout(function(){wheelCooldown=false;},300);
    if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){
      snapToNearest(e.deltaX>0?1:-1);
    }else{
      snapToNearest(e.deltaY>0?GS.cols:-GS.cols);
    }
  }

  // ── Grid drag/pan handlers ──
  function onGridPointerDown(e){
    if(!gridMode||!GS.dragEnabled)return;
    gridRig.isDragging=true;
    gridRig.startMX=e.clientX;gridRig.startMY=e.clientY;
    gridRig.startRigX=gridRig.targetX;gridRig.startRigY=gridRig.targetY;
    gridRig.maxDragDist=0;
  }
  function onGridPointerMove(e){
    if(!gridRig.isDragging||!gridMode)return;
    var dx=e.clientX-gridRig.startMX;
    var dy=e.clientY-gridRig.startMY;
    var dist=Math.sqrt(dx*dx+dy*dy);
    gridRig.maxDragDist=Math.max(gridRig.maxDragDist,dist);
    // Sensitivity scales with camera distance
    var camZ=camera?camera.position.z:GS.cameraZ;
    var sens=(camZ/20)*GS.dragSpeed*(1/window.devicePixelRatio);
    var rawX=gridRig.startRigX+dx*sens*0.05;
    var rawY=gridRig.startRigY-dy*sens*0.05;
    // Grid bounds
    var cols=GS.cols;var rows=Math.ceil(GRID_COUNT/cols);
    var halfW=(cols-1)*GS.spacingX/2+4;
    var halfH=(rows-1)*GS.spacingY/2+4;
    // Rubber-band resistance at edges
    if(rawX>halfW)rawX=halfW+(rawX-halfW)*GS.dragResistance;
    if(rawX<-halfW)rawX=-halfW+(rawX+halfW)*GS.dragResistance;
    if(rawY>halfH)rawY=halfH+(rawY-halfH)*GS.dragResistance;
    if(rawY<-halfH)rawY=-halfH+(rawY+halfH)*GS.dragResistance;
    gridRig.targetX=rawX;gridRig.targetY=rawY;
  }
  function onGridPointerUp(){
    if(!gridRig.isDragging)return;
    gridRig.isDragging=false;

    if(flatMode){
      // Snap to nearest tile based on drag direction
      var dx=gridRig.targetX-gridRig.startRigX;
      var dy=gridRig.targetY-gridRig.startRigY;
      // Determine primary axis
      if(Math.abs(dx)>Math.abs(dy)){
        // Horizontal drag
        if(Math.abs(dx)>GS.flatSnapThreshold/camera.position.z*5){
          snapToNearest(dx>0?-1:1); // drag right = prev, drag left = next
        }else{
          centerOnTile(flatCurrentIdx); // snap back
        }
      }else{
        // Vertical drag
        var colCount=GS.cols;
        if(Math.abs(dy)>GS.flatSnapThreshold/camera.position.z*5){
          snapToNearest(dy>0?-colCount:colCount); // drag up = next row, drag down = prev row
        }else{
          centerOnTile(flatCurrentIdx);
        }
      }
      return;
    }

    // Normal mode: snap back if zoomed out
    if(!gridActiveId){
      var cols=GS.cols;var rows=Math.ceil(GRID_COUNT/cols);
      var halfW=(cols-1)*GS.spacingX/2;
      var halfH=(rows-1)*GS.spacingY/2;
      gridRig.targetX=Math.max(-halfW,Math.min(halfW,gridRig.targetX));
      gridRig.targetY=Math.max(-halfH,Math.min(halfH,gridRig.targetY));
    }
  }

  function updateGrid(){
    // Hero shoe opacity lerp (runs always, so GUI live-edit works in home)
    if(model){
      modelMeshes.forEach(function(mesh){
        if(mesh.material){
          mesh.material.transparent=true;
          mesh.material.opacity+=(gridTargetShoeOpacity-mesh.material.opacity)*GS.opacityLerp;
        }
      });
    }
    if(!gridGroup)return;
    // Lerp camera z — use focusZoomLerp when a tile is selected for smoother zoom
    var zLerp=gridActiveId!==null?GS.focusZoomLerp:GS.cameraLerp;
    camera.position.z+=(gridTargetCamZ-camera.position.z)*zLerp;
    // Lerp light intensity
    if(ambientLight){
      ambientLight.intensity+=(P.ambientIntensity*gridTargetLightMul-ambientLight.intensity)*GS.lightLerp;
    }
    spotLights.forEach(function(s,i){
      var base=P['spot'+(i+1)+'Intensity'];
      s.intensity+=(base*gridTargetLightMul-s.intensity)*GS.lightLerp;
    });

    if(!gridGroup.visible)return;

    // ── Grid rig: smooth drag/pan (faster in flat mode) ──
    var rigLerp=flatMode?GS.flatSnapLerp:GS.dampFactor;
    gridRig.currentX+=(gridRig.targetX-gridRig.currentX)*rigLerp;
    gridRig.currentY+=(gridRig.targetY-gridRig.currentY)*rigLerp;
    gridRig.velX=gridRig.currentX-gridRig.prevX;
    gridRig.velY=gridRig.currentY-gridRig.prevY;
    gridRig.prevX=gridRig.currentX;gridRig.prevY=gridRig.currentY;

    // Camera tilt based on drag velocity (shoe-finder style)
    if(camera&&gridMode){
      var tiltX=gridRig.velY*GS.tiltFactor;
      var tiltY=-gridRig.velX*GS.tiltFactor;
      camera.rotation.x+=(tiltX-camera.rotation.x)*0.2;
      camera.rotation.y+=(tiltY-camera.rotation.y)*0.2;
    }

    // Grid height (for normalized Y spread — mirrors shoe-finder)
    var rows=Math.ceil(GRID_COUNT/GS.cols);
    var gridHeight=rows*GS.spacingY;
    var halfH=gridHeight/2||1;

    // Tile animations
    var now=performance.now();
    var elapsed=(now-gridIntroStart)/1000;
    gridTiles.forEach(function(tile){
      var bp=tile.userData.basePos;
      var distSq=bp.x*bp.x+bp.y*bp.y;
      var dist=Math.sqrt(distSq);
      var introDelay=dist*GS.introDelayFactor;
      var introT=Math.max(0,Math.min(1,(elapsed-introDelay)/GS.introDuration));
      var introEase=Math.sqrt(1-Math.pow(introT-1,2)); // circ.out
      var canTransition=introT>0;
      var normalizedY=bp.y/halfH;

      var idx=tile.userData.index;
      var isActive=gridActiveId===idx;
      var isHovered=gridHoverId===idx&&!_isMobile;
      var someActive=gridActiveId!==null;
      var baseScale,baseOp;
      if(flatMode){
        // Flat mode: active tile larger, others normal (not dimmed)
        baseScale=isActive?GS.activeScale:1;
        baseOp=isActive?1:GS.defaultTileOpacity;
      }else{
        baseScale=isActive?GS.activeScale:someActive?GS.dimScale:(isHovered?GS.hoverScale:1);
        baseOp=isActive?GS.activeOpacity:someActive?GS.dimOpacity:GS.defaultTileOpacity;
      }

      // --- Targets for transition Z / Y spread (enter vs exit) ---
      var targetTz, targetTy;
      if(gridMode){
        // Entering: start at enterStartZ + enterSpreadY, settle to 0
        targetTz=canTransition?0:GS.enterStartZ;
        targetTy=canTransition?0:normalizedY*GS.enterSpreadY;
      }else{
        // Exiting: fly to exitEndZ + exitSpreadY
        targetTz=GS.exitEndZ;
        targetTy=normalizedY*GS.exitSpreadY;
      }
      tile.userData.tz+=(targetTz-tile.userData.tz)*GS.transitionZLerp;
      tile.userData.ty+=(targetTy-tile.userData.ty)*GS.transitionYLerp;

      // --- Curvature: bend tiles back (disabled in flat mode) ---
      var curv=flatMode?GS.flatCurvature:GS.curvature;
      var targetCz=-distSq*curv;
      tile.userData.cz+=(targetCz-tile.userData.cz)*0.2;

      // --- Tile rotation to face center ---
      var rotIntensity=Math.min(dist*0.4,2.0);
      var targetRx=bp.y*curv*GS.rotation*rotIntensity;
      var targetRy=-bp.x*curv*GS.rotation*rotIntensity;
      tile.userData.rx+=(targetRx-tile.userData.rx)*0.2;
      tile.userData.ry+=(targetRy-tile.userData.ry)*0.2;

      // Apply position (basePos + rig offset + curve + enter/exit Z, Y spread)
      var finalX=bp.x+gridRig.currentX;
      var finalY=bp.y+gridRig.currentY+tile.userData.ty;

      // Culling: hide tiles far from camera center
      var cullDist=GS.cullDistance*(camera?camera.position.z/8:1);
      if(Math.abs(finalX)>cullDist||Math.abs(finalY)>cullDist){
        tile.visible=false;
        return; // skip rest for perf
      }
      tile.visible=true;

      // Hover Z lift (desktop only)
      var targetHz=isHovered?GS.hoverZ:0;
      if(!tile.userData.hz)tile.userData.hz=0;
      tile.userData.hz+=(targetHz-tile.userData.hz)*GS.hoverLerp;

      tile.position.x=finalX;
      tile.position.y=finalY;
      tile.position.z=tile.userData.cz+tile.userData.tz+tile.userData.hz;
      tile.rotation.x=tile.userData.rx;
      tile.rotation.y=tile.userData.ry;

      // Opacity: multiply base by introEase while entering; exit fade handled by targetOp=0
      var targetScale=baseScale*introEase*(gridMode?1:0);
      var targetOp=baseOp*introEase*(gridMode?1:0);

      tile.scale.x+=(targetScale-tile.scale.x)*GS.tileLerp;
      tile.scale.y+=(targetScale-tile.scale.y)*GS.tileLerp;
      if(tile.material){
        tile.material.opacity+=(targetOp-tile.material.opacity)*GS.tileLerp;
      }
    });
  }

  window.enterShowroom=enterShowroom;
  window._deselectShoe=function(){exitFlatMode();};
  window.exitShowroom=exitShowroom;

  window.initShoeLab=init;
  window.destroyShoeLab=destroy;
  window.shoeLabP=P;
  window.toggleShoeLabGUI=function(visible){
    if(guiInstance){guiInstance.domElement.style.display=visible?'':'none';}
  };
  window.toggleHandTracking=function(active){if(active)startHandTracking();else stopHandTracking();};
  window.animateShoeIn=function(){
    if(!model)return;
    currentScale=0;
    var target=P.modelScale;
    var dur=1600;var start=performance.now();
    function tick(){
      var t=Math.min((performance.now()-start)/dur,1);
      // circ.out: sqrt(1 - (t-1)^2)
      var p=Math.sqrt(1-Math.pow(t-1,2));
      currentScale=target*p;
      model.scale.set(currentScale,currentScale,currentScale);
      if(t<1)requestAnimationFrame(tick);
    }
    tick();
  };
})();
