const Vec3 = require('vec3');

function getShapeFaceCenters(shapes, face, half = null) {
    if (!shapes || shapes.length === 0) return [];

    const centers = [];
    const faceAxis = getFaceAxis(face);
    const faceValue = face[faceAxis];

    for (const shape of shapes) {
        const center = getShapeCenter(shape, faceAxis, faceValue, half);
        if (center) centers.push(center);
    }

    return centers;
}

function getFaceAxis(face) {
    if (face.x !== 0) return 'x';
    if (face.y !== 0) return 'y';
    if (face.z !== 0) return 'z';
    return null;
}

function getShapeCenter(shape, axis, value, half) {
    const [min, max] = shape;
    
    if (axis === null) return null;

    if (half) {
        const isUpperHalf = half === 'top' || half === 'upper';
        const isInCorrectHalf = isUpperHalf ? 
            (min[1] >= 0.5) : (max[1] <= 0.5);
        
        if (!isInCorrectHalf) return null;
    }

    const epsilon = 0.001;
    if (value > 0) {
        if (Math.abs(max[getAxisIndex(axis)] - 1) > epsilon) return null;
    } else {
        if (Math.abs(min[getAxisIndex(axis)]) > epsilon) return null;
    }

    const center = new Vec3(
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        (min[2] + max[2]) / 2
    );

    if (value > 0) {
        center[axis] = 1;
    } else {
        center[axis] = 0;
    }

    return center;
}

function getAxisIndex(axis) {
    return { x: 0, y: 1, z: 2 }[axis];
}

function adjustShapeForStairs(shape, facing, half) {
    const adjusted = [...shape];
    
    if (half === 'top') {
        adjusted[0][1] += 0.5;
        adjusted[1][1] += 0.5;
    }

    switch (facing) {
        case 'north':
            adjusted[1][2] = 0.5;
            break;
        case 'south':
            adjusted[0][2] = 0.5;
            break;
        case 'west':
            adjusted[1][0] = 0.5;
            break;
        case 'east':
            adjusted[0][0] = 0.5;
            break;
    }

    return adjusted;
}

function getFullBlockShapes() {
    return [[[0, 0, 0], [1, 1, 1]]];
}

function getStairShapes(facing, half) {
    const baseShape = [[0, 0, 0], [1, 0.5, 1]];
    const topShape = [[0, 0.5, 0], [1, 1, 1]];

    if (half === 'top') {
        return [
            adjustShapeForStairs(baseShape, facing, 'top'),
            adjustShapeForStairs(topShape, facing, 'top')
        ];
    }

    return [
        adjustShapeForStairs(baseShape, facing, 'bottom'),
        adjustShapeForStairs(topShape, facing, 'bottom')
    ];
}

function getSlabShapes(half) {
    if (half === 'top') {
        return [[[0, 0.5, 0], [1, 1, 1]]];
    }
    return [[[0, 0, 0], [1, 0.5, 1]]];
}

module.exports = {
    getShapeFaceCenters,
    getFullBlockShapes,
    getStairShapes,
    getSlabShapes,
    adjustShapeForStairs
};
