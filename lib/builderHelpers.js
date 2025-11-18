const Vec3 = require('vec3');

function getPossibleDirections(bot, pos) {
    const directions = [];
    const offsets = [
        { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },
        { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },
        { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) },
        { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },
        { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },
        { offset: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) }
    ];

    for (const { offset, face } of offsets) {
        const refPos = pos.plus(offset);
        const block = bot.blockAt(refPos);
        
        if (block && block.name !== 'air' && block.boundingBox !== 'empty') {
            directions.push({ block, face, refPos });
        }
    }
    
    return directions;
}

function isInteractable(blockName, interactableList) {
    return interactableList.includes(blockName);
}

module.exports = {
    getPossibleDirections,
    isInteractable
};
