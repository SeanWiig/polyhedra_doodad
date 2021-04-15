import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const vertexSolidShader = `
uniform float uOpacity;
uniform float uBright;

varying vec4 fragColor;

// colors to use
const mat4 cols = mat4(
  1.0,1.0,0.0,0.0,
  0.5,0.0,0.6,0.0,
  0.0,0.4,0.4,0.0,
  0.6,0.3,0.8,0.0
);

const mat3 trig_consts = mat3(
  0.0,sqrt(.75),-sqrt(.75),
  1.0, -0.5, -0.5,
  0.0, 0.0, 0.0
);

const vec3 ones = vec3(1.0);

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  vec3 nv = normalize(normalMatrix * normalize(normal));
  
  // apply color gradients in three directions and at center
  vec4 nv_tripoint = max(vec4(trig_consts * nv, nv.z*nv.z), 0.);

  vec3 nv_color = (cols * nv_tripoint).rgb;

  // saturate slightly
  float c_min = min(nv_color.r,min(nv_color.g,nv_color.b));
  nv_color -= 0.3 * c_min;
  nv_color = normalize(nv_color);

  // add edge glint
  nv_color += 1.-sqrt(nv.z);

  // apply brightness value
  nv_color = mix(nv_color, ones, uBright);

  // apply opacity value
  fragColor.rgba = vec4(nv_color.xyz,uOpacity);
}
`;

const fragmentSolidShader = `
varying vec4 fragColor;

void main() {
  // all colors are calculated in vertex shader because the colors of faces of solids should be unvarying
  gl_FragColor = fragColor;
}
`;


const vertexSphereShader = `
varying vec3 view_normal_vector;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  // pass normal vector to fragment shader
  view_normal_vector = normalMatrix * normalize(normal);
}
`;

const fragmentSphereShader = `
varying vec3 view_normal_vector;
uniform float uOpacity;

// consts for computing triangular angles from x, y coords
const mat3 trig_consts = mat3(
  0.0,sqrt(.75),-sqrt(.75),
  1.0, -0.5, -0.5,
  0.0, 0.0, 0.0
);
void main() {
  vec3 nv = normalize(view_normal_vector);

  // apply color gradients in three directions and at center
  vec3 nv_color = trig_consts * nv * 0.5 + 0.5;

  // opacity fades to zero when normal faces camera
  float opacity = uOpacity * (1.0-nv.z);

  gl_FragColor = vec4(nv_color,opacity);
}
`;

function group(mesh, radius) {
  const g = new THREE.Group();

  g.solid = new THREE.Mesh(mesh, new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.5 },
      uBright: { value: 0.5 }
    },
    vertexShader: vertexSolidShader,
    fragmentShader: fragmentSolidShader,
    transparent: true
  }));

  g.sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 1.0 } },
      vertexShader: vertexSphereShader,
      fragmentShader: fragmentSphereShader,
      transparent: true,
      depthWrite: false
    })
  )

  g.wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh), 
    new THREE.LineBasicMaterial({
      color: 0x664455,
      transparent: true,
      depthWrite: false
    })
  );

  g.add(g.solid);
  g.add(g.sphere);
  g.add(g.wire);
  return g;
};

function main() {
  const canvas = document.querySelector('#c');
  canvas.width = canvas.height;
  const renderer = new THREE.WebGLRenderer({canvas});
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  renderer.setSize(width,height, false);

  const camera = new THREE.OrthographicCamera(-7,7,7,-7,0.1,100);
  camera.position.z = 50;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x442233);

  const octa = group(new THREE.OctahedronGeometry(1),1);
  const cube = group(new THREE.BoxGeometry(1,1,1),Math.sqrt(3)/2);

  const rotator = new THREE.Group();
  rotator.add(cube);
  rotator.add(octa);
  scene.add(rotator);

  let t = 0;
  let t1 = 0;
  let t2 = 0;
  let state = 0;
  let tSlowStart1 = 0;
  let tSlowStart2 = 0;
  let tDelay1 = 0;
  let tDelay2 = 0;

  const cubeFitOffset = (Math.log(2/3) / Math.log(3));
  const scaleOffset = 1.5;

  function setScale(obj, scale) {
    obj.scale.fromArray([scale,scale,scale])
  };

  const period = 8.0;
  const freq = 1.0 / period;

  function render(time) {
    time = time * 0.001;
    t = time - 5;
    t1 = t * freq % 1;
    t2 = (t1 + 0.5) % 1;

    setScale(cube.solid, Math.pow(3,cubeFitOffset+scaleOffset+t2-0.5));
    setScale(cube.wire, Math.pow(3,cubeFitOffset+scaleOffset+t1));
    setScale(cube.sphere, Math.pow(3,cubeFitOffset+scaleOffset+t1));
    setScale(octa.solid, Math.pow(3,scaleOffset+t1-1));
    setScale(octa.wire, Math.pow(3,scaleOffset+t2-0.5));
    setScale(octa.sphere, Math.pow(3,scaleOffset+t2-0.5));
    
    state = t1 < 0.5;
    cube.solid.renderOrder = 1+2*state;
    cube.wire.renderOrder = 2+2*!state;
    octa.solid.renderOrder = 1+2*!state;
    octa.wire.renderOrder = 2+2*state;
    cube.sphere.renderOrder = 0;
    octa.sphere.renderOrder = 0;
    
    cube.solid.material.uniforms.uOpacity.value = Math.min(1,2-2*t2);
    cube.solid.material.uniforms.uBright.value = Math.max(0.,Math.min(1,1-2*t2));
    cube.sphere.material.uniforms.uOpacity.value = Math.min(t1*0.3,0.2-t1*0.25);
    cube.wire.material.opacity = Math.min(2*t1,2-2*t1);
    
    octa.solid.material.uniforms.uOpacity.value = Math.min(1,2-2*t1);
    octa.solid.material.uniforms.uBright.value = Math.max(0.,Math.min(1,1-2*t1));
    octa.sphere.material.uniforms.uOpacity.value = Math.min(t2*0.3,0.2-t2*0.25);
    octa.wire.material.opacity = Math.min(2*t2,2-2*t2);

    if (t < period * 0.5) {
      octa.wire.material.opacity = 0;
      octa.sphere.material.uniforms.uOpacity.value = 0;
    }
    tDelay1 = Math.max(0, time - 2.5);
    tDelay2 = Math.max(0, time - 10);
    tSlowStart1 = tDelay1 / (1 + 20./tDelay1 + tDelay1/5.);
    tSlowStart2 = tDelay2 / (1 + 70/tDelay2);
    rotator.rotation.x = -0.9553 + tSlowStart2 * 0.4;
    rotator.rotation.y =  tSlowStart2 * 0.41;
    rotator.rotation.z = Math.PI/4 + tSlowStart2 * 0.1;
    camera.rotation.z = tSlowStart1;

    setScale(rotator, 1-(1/(1+(time))));

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

export default main;