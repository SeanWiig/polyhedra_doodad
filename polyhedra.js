import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const vertexShader = `
varying vec3 view_normal_vector;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  // pass normal vector to fragment shaders
  view_normal_vector = normalMatrix * normalize(normal);
}
`;

const fragmentSolidShader = `
uniform float uOpacity;
uniform float uBright;

varying vec3 view_normal_vector;

// precompute this at compile time
const float cos30 = cos(radians(30.));

// colors to use
const vec3 col1 = vec3(1.0,1.0,0.0);
const vec3 col2 = vec3(0.5,0.0,0.6);
const vec3 col3 = vec3(0.0,0.4,0.4);
const vec3 col4 = vec3(0.6,0.3,0.8);

void main() {
  vec3 nv = normalize(view_normal_vector);
  vec3 nv_color = vec3(0.,0.,0.);
  
  // apply color gradients in three directions and at center
  vec3 nv_tripoint = max(vec3(nv.y,cos30 * nv.x - 0.5 * nv.y,-cos30 * nv.x - 0.5 * nv.y),0.);
  nv_color += col1 * nv_tripoint.r;
  nv_color += col2 * nv_tripoint.g;
  nv_color += col3 * nv_tripoint.b;
  nv_color += col4 * nv.z * nv.z;

  // saturate slightly
  float c_min = min(nv_color.r,min(nv_color.g,nv_color.b));
  nv_color -= 0.4 * c_min;
  nv_color = normalize(nv_color);

  // add edge glint
  float dist = min(1.,1.0*length(nv.xy));
  float rim = 1.-sqrt(sqrt(1. - dist * dist));
  nv_color += rim;

  // apply brightness value
  nv_color += uBright;

  // apply opacity value
  gl_FragColor = vec4(nv_color,uOpacity);
}
`;

const fragmentSphereShader = `
varying vec3 view_normal_vector;
uniform float uOpacity;
void main() {
  vec3 nv = normalize(view_normal_vector);
  vec3 nv_color = nv * 0.5 + 0.5;

  // opacity fades to zero when normal faces camera
  float opacity = uOpacity * (1.-nv.z);

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
    vertexShader,
    fragmentShader: fragmentSolidShader,
    transparent: true
  }));

  g.sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: .5 } },
      vertexShader,
      fragmentShader: fragmentSphereShader,
      transparent: true,
      depthWrite: false
    })
  )

  g.wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh), 
    new THREE.LineBasicMaterial({
      color: 0x664455,
      transparent: true
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

  function render(time) {
    time = time * 0.001;
    t = time - 5;
    t1 = t * 0.2 % 1;
    t2 = (t1 + 0.5) % 1;

    setScale(cube.solid, Math.pow(3,cubeFitOffset+scaleOffset+t2-0.5));
    setScale(cube.wire, 0.97*Math.pow(3,cubeFitOffset+scaleOffset+t1));
    setScale(cube.sphere, Math.pow(3,cubeFitOffset+scaleOffset+t1));
    setScale(octa.solid, Math.pow(3,scaleOffset+t1-1));
    setScale(octa.wire, 0.98* Math.pow(3,scaleOffset+t2-0.5));
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
    cube.sphere.material.uniforms.uOpacity.value = Math.min(t1*0.3,0.15-t1*0.2);
    cube.wire.material.opacity = Math.min(1,2-2*t1);
    
    octa.solid.material.uniforms.uOpacity.value = Math.min(1,2-2*t1);
    octa.solid.material.uniforms.uBright.value = Math.max(0.,Math.min(1,1-2*t1));
    octa.sphere.material.uniforms.uOpacity.value = Math.min(t2*0.3,0.15-t2*0.2);
    octa.wire.material.opacity = Math.min(1,2-2*t2);

    if (t < 3) {
      octa.wire.material.opacity = 0;
    }
    if (t< 2) {
      octa.sphere.material.uniforms.uOpacity.value = 0;
    }
    if (t < 0) {
      setScale(cube.wire,0.1)
    }
    tDelay1 = Math.max(0, time - 2.5);
    tDelay2 = Math.max(0, time - 10);
    tSlowStart1 = tDelay1 / (1 + 20/tDelay1);
    tSlowStart2 = tDelay2 / (1 + 70/tDelay2);
    rotator.rotation.x = -0.9553 + tSlowStart2;
    rotator.rotation.y =  tSlowStart2/3;
    rotator.rotation.z = Math.PI/4 + tSlowStart2 / 2;
    camera.rotation.z = tSlowStart1 / (1+(tDelay1*tDelay1*0.01));

    setScale(rotator, 1-(1/(1+(time))));

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

export default main;