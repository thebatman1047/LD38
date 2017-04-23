import {Uint64, JoshuaTree} from './lib/joshuatree';
import * as THREE from 'three';

const maxNum: Uint64 = new Uint64([0xFFFFFFFF, 0xFFFFFFFF]);
const zeroNum: Uint64 = new Uint64([0, 0]);
const highBit: number = 0x800000;

const maxDepth = 3;

// [TODO] refactor jtree to use RTT to detect leaf nodes instead of max depth
// [TODO] add defines for common 64 bit ints to Uint64
export class JTreeIterationData {
       position: THREE.Vector3;
       extent: number;
       treeNode: JoshuaTree;

       constructor() {
           this.position = new THREE.Vector3();
       }
}

export default class JTreeEntity extends THREE.Object3D {

    material: THREE.Material;
    mergedGeometry: THREE.Geometry;// for mesh combininb impl
    jtree: JoshuaTree;

    constructor(material: THREE.Material) {
        super();

        this.material = material;

        // bind self to spawn functions, since they are passed around
        this.spawnMergeCubes = this.spawnMergeCubes.bind(this);
    }

    generateJTree() {
        this.jtree = new JoshuaTree();
        this.generateJTree_internal(this.jtree, 0);
    }
    generateJTree_internal(root: JoshuaTree, depth: number) {
        if(depth > maxDepth) {
            return;
        }

        for(let i = 0; i < 64; ++i) {
            if(i%2 === 1) {
                const jchild = new JoshuaTree();
                root.Add(i, jchild);
                this.generateJTree_internal(jchild, depth + 1);
            }
        }
    }

    generateJTreeSphere(center: THREE.Vector3, radius: number) {
        this.jtree = new JoshuaTree();
        this.generateJTreeSphere_internal(center, radius, this.jtree, new THREE.Vector3(0, 0, 0), 0);
    }
    pointWithinSphere(center: THREE.Vector3, radius: number, point: THREE.Vector3): boolean {
        let dvec = new THREE.Vector3().copy(point);
        dvec = dvec.sub(center);
        const distance = dvec.length();

        return distance <= radius;
    }
    calculateCorners(corner: THREE.Vector3, extent: number): THREE.Vector3[] {
        const corners = [];

        const center = new THREE.Vector3().copy(corner).add(new THREE.Vector3(extent, extent, extent));

        const cornerRUF = new THREE.Vector3().copy(center);
        cornerRUF.add(new THREE.Vector3(extent, extent, extent));
        corners.push(cornerRUF);
        const cornerLUF = new THREE.Vector3().copy(center);
        cornerLUF.add(new THREE.Vector3(-extent, extent, extent));
        corners.push(cornerLUF);
        const cornerRDF = new THREE.Vector3().copy(center);
        cornerRDF.add(new THREE.Vector3(extent, -extent, extent));
        corners.push(cornerRDF);
        const cornerLDF = new THREE.Vector3().copy(center);
        cornerLDF.add(new THREE.Vector3(-extent, -extent, extent));
        corners.push(cornerLDF);
        const cornerRUB = new THREE.Vector3().copy(center);
        cornerRUB.add(new THREE.Vector3(extent, extent, -extent));
        corners.push(cornerRUB);
        const cornerLUB = new THREE.Vector3().copy(center);
        cornerLUB.add(new THREE.Vector3(-extent, extent, -extent));
        corners.push(cornerLUB);
        const cornerRDB = new THREE.Vector3().copy(center);
        cornerRDB.add(new THREE.Vector3(extent, -extent, -extent));
        corners.push(cornerRDB);
        const cornerLDB = new THREE.Vector3().copy(center);
        cornerLDB.add(new THREE.Vector3(-extent, -extent, -extent));
        corners.push(cornerLDB);

        return corners;
    }
    generateJTreeSphere_internal(center: THREE.Vector3, radius: number, root: JoshuaTree,
                                 rootPosition: THREE.Vector3, depth: number) {
        const childVoxExtent = this.getScaledExtent(depth + 1);

        if(depth > maxDepth) {
            return;
        }

        for(let i = 0; i < 64; ++i) {
            const voxCorner = new THREE.Vector3().copy(rootPosition).add(this.indexToScaledRelativePosition(i, depth));
            const corners = this.calculateCorners(voxCorner, childVoxExtent);
            const voxCenter = new THREE.Vector3().copy(voxCorner);
            voxCenter.add(new THREE.Vector3(childVoxExtent, childVoxExtent, childVoxExtent));

            let totallyWithinSphere = true;
            let totallyOutsideSphere = true;
            corners.forEach((currentValue: THREE.Vector3, index: number, array: THREE.Vector3[]) => {
                if(this.pointWithinSphere(center, radius, currentValue)) {
                    totallyOutsideSphere = false;
                }else {
                    totallyWithinSphere = false;
                }
            });

            // [TODO] Check if the sphere is within the vox

            if(!totallyOutsideSphere) {
                if(totallyWithinSphere) {
                    const jchild = new JoshuaTree();
                    jchild.Copy(maxNum);
                    root.Add(i, jchild);
                } else {

                    const jchild = new JoshuaTree();
                    root.Add(i, jchild);

                    this.generateJTreeSphere_internal(center, radius, jchild, voxCorner, depth + 1);
                }
            }
        }
    }

    // take a depth, give back the scaled extent for that level
    // and since we have cubes, a single extent will do
    // extents are the distance from the center to a side
    // ASSUMPTION, the deepest depth of the tree has an extent of 0.5
    getScaledExtent(depth: number) {
        const scalePower = (maxDepth + 1) - depth;
        return Math.pow(4, scalePower) / 2;
    }

    // take the index of which bit a voxel is in
    // returns an un-scaled position (doesn't account for depth)
    indexToRelativePosition(index: number) {
        return new THREE.Vector3(index % 4, Math.floor(index / 4) % 4, Math.floor(index / 16));
    }

    indexToScaledRelativePosition(index: number, depth: number): THREE.Vector3 {
        const scalePower = maxDepth - depth;
        const relPos = this.indexToRelativePosition(index);

        relPos.x *= Math.pow(4, scalePower);
        relPos.y *= Math.pow(4, scalePower);
        relPos.z *= Math.pow(4, scalePower);

        return relPos;
    }

    // [TODO] refactor this function to use a foreach loop only over existing elements
    leafLoop(fn: (data: JTreeIterationData) => void ,node: JoshuaTree, offset: THREE.Vector3) {
        for(let i = 0; i < 64; ++i) {
            const bitFlag = new Uint64();
            bitFlag.Set(i);

            // extents of maxdepths children
            const minExtent = this.getScaledExtent(maxDepth + 1);

            if(!node.And(bitFlag).Empty()) {
                const data = new JTreeIterationData();
                data.position.copy(offset);
                data.position.add(this.indexToRelativePosition(i));
                data.position.add(new THREE.Vector3(minExtent, minExtent, minExtent));
                data.extent = minExtent;
                data.treeNode = node;
                fn(data);
            }
        }
    }

    depthLoop(fn: (data: JTreeIterationData) => void,
              node: JoshuaTree, depth: number, offset: THREE.Vector3) {
        if(depth > maxDepth) {
            return;
        }

        const voxExtent = this.getScaledExtent(depth);

        if(node.Equals(maxNum)) {
            // Render a large cube
            const data = new JTreeIterationData();
            data.position.copy(offset);
            data.position.add(new THREE.Vector3(voxExtent, voxExtent, voxExtent));
            data.extent = voxExtent;
            data.treeNode = node;
            fn(data);
        } else if(node.Equals(zeroNum) ) {
            // Skip this branch
        } else {
            // Recurse or render leaf loop
            if(depth === maxDepth ) {
                this.leafLoop(fn, node, offset);
            } else {
                // Call depth node on each child
                Object.keys(node.children).forEach((childKey: string) => {
                    const child = node.children[childKey];
                    if(child instanceof JoshuaTree) {
                        const toff = new THREE.Vector3().copy(offset);
                        const keynum = parseInt(childKey, 10);

                        this.depthLoop(fn, child, depth + 1,
                         toff.add(this.indexToScaledRelativePosition(keynum, depth)));
                    }
                });
            }
        }
    }

    spawnMergeCubes(data: JTreeIterationData) {
        const newGeometry = new THREE.BoxGeometry( data.extent * 2, data.extent * 2, data.extent * 2);
        const newGeomTransform = new THREE.Matrix4().makeTranslation(data.position.x, data.position.y, data.position.z);
        this.mergedGeometry.merge(newGeometry, newGeomTransform);
    }

    spawnCubes() {
        this.mergedGeometry = new THREE.Geometry();

        this.depthLoop(this.spawnMergeCubes, this.jtree, 0, new THREE.Vector3(0, 0, 0));

        const mergedMesh = new THREE.Mesh(this.mergedGeometry, this.material);
        this.add(mergedMesh);
    }

    calculateCenterOfMass(): THREE.Vector3 {
        const centerOfMass = new THREE.Vector3(0, 0, 0);
        let totalMass = 0;
        this.depthLoop((data: JTreeIterationData)=> {
            // Calculate mass assuming uniform density
            // [IDEA] give voxels non-uniform density values,
            //      and manipulate them when explosions 'n stuff happen
            const density = 1;
            const sideLen = data.extent * 2;
            const volume = sideLen * sideLen * sideLen;
            const mass = density * volume;

            const weightedPos = new THREE.Vector3().copy(data.position).multiplyScalar(mass);
            centerOfMass.add(weightedPos);
            totalMass += mass;
        }, this.jtree, 0, this.position);

        // normalize weights of vectors
        centerOfMass.divideScalar(totalMass);

        return centerOfMass;
    }

    detachSubtreeSphere(center: THREE.Vector3, radius: number): void {
        // [TODO] separate a subtree and return it
        //      [ITR1] destroy the subtree
        //      [ITR2] separate subtree, destroy it
        //      [ITR3] separate subtree, give it a velocity and spin
        //      [ITR4] separate subtree, fragment it (sub- separations)

        this.depthLoop((data: JTreeIterationData)=> {
            const localCenter = new THREE.Vector3().copy(data.position);
            const deltaVec = localCenter.sub(center);

            const distance = deltaVec.length();

            if(distance <= radius) {
                // [TODO] remove this node
                console.log('destroyed a thing!');
            }

        }, this.jtree, 0, this.position);
    }
}
