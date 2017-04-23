import JTreeEntity from './JTreeEntity';
import ThirdPersonController from './thirdpersoncontroller';
import * as THREE from 'three';
import Vox from './lib/vox';

declare var vox: any;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
let jtree = new JTreeEntity();
const character = new THREE.Object3D();
let controls = new ThirdPersonController(camera, character, jtree.jtree);
let clock = new THREE.Clock();

camera.position.z = 5;
var geometry = new THREE.BoxBufferGeometry( 1, 1, 1 );
let uniforms = {
    color: {value: new THREE.Vector4(0, 1, 0, 1)}
};

var material = new THREE.MeshPhongMaterial( {color: 0x00ff00} );


jtree.generateJTree();
jtree.spawnCubes(pos =>{    
    var cube = new THREE.Mesh( geometry, material );
    cube.position.copy(new THREE.Vector3(pos.x, pos.y, pos.z));
    scene.add( cube );
    //console.log('hit ' + pos);
});

scene.add(character);
scene.add(new THREE.DirectionalLight());
scene.add(new THREE.AmbientLight());

let direction = 1;

var render = function () {
    const delta = clock.getDelta();
    requestAnimationFrame(render);
    controls.tick(delta);

    renderer.render(scene, camera);
};

render();