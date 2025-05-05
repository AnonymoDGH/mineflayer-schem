const Vec3 = require('vec3');
const facingData = require('./facing.json');
const { getShapeFaceCenters } = require('./shapes.js');
const { promisify } = require('util');

class Build {
    constructor(schematic, world, at, area = null) {
        this.schematic = schematic;
        this.world = world;
        this.at = at;
        this.isPaused = false;
        this.isCancelled = false;
        this.version = world.version;
        this.buildErrors = [];

        this.min = at.plus(schematic.offset || new Vec3(0, 0, 0));
        this.max = this.min.plus(schematic.size);

        if (area) {
            this.min = this.min.plus(area.min);
            this.max = this.min.plus(area.max);
        }

        this.actions = [];
        this.completedActions = [];
        this.statistics = {
            startTime: Date.now(),
            endTime: null,
            blocksPlaced: 0,
            blocksFailed: 0,
            retryCount: 0,
            pauseTime: 0,
            lastPauseTime: null
        };

        this.initializeBlocks();
    }

    async initializeBlocks() {
        try {
            const Block = require('prismarine-block')(this.version);
            const mcData = require('minecraft-data')(this.version);
            this.blocks = {};
            this.properties = {};
            this.items = {};
            this.stateMap = new Map();

            for (const stateId of this.schematic.palette || []) {
                try {
                    const block = Block.fromStateId(stateId, 0);
                    this.blocks[stateId] = block;
                    this.properties[stateId] = block.getProperties() || {};
                    this.items[stateId] = mcData.itemsByName[block.name] || null;
                    
                    if (block.name.includes(':')) {
                        const [namespace, name] = block.name.split(':');
                        if (!this.items[stateId] && mcData.itemsByName[name]) {
                            this.items[stateId] = mcData.itemsByName[name];
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to initialize block state ${stateId}:`, error.message);
                    this.buildErrors.push({
                        type: 'block_init',
                        stateId,
                        error: error.message
                    });
                }
            }

            this.updateActions();
        } catch (error) {
            console.error('Failed to initialize blocks:', error);
            throw new Error('Block initialization failed');
        }
    }

    updateActions() {
        this.actions = [];
        const cursor = new Vec3(0, 0, 0);
        
        for (cursor.y = this.min.y; cursor.y < this.max.y; cursor.y++) {
            for (cursor.z = this.min.z; cursor.z < this.max.z; cursor.z++) {
                for (cursor.x = this.min.x; cursor.x < this.max.x; cursor.x++) {
                    try {
                        const stateInWorld = this.world.getBlockStateId(cursor);
                        const relativePos = cursor.minus(this.at);
                        const wantedState = this.schematic.getBlockStateId(relativePos);

                        if (stateInWorld !== wantedState) {
                            if (wantedState === 0) {
                                this.actions.push({
                                    type: 'dig',
                                    pos: cursor.clone(),
                                    originalState: stateInWorld
                                });
                            } else {
                                this.actions.push({
                                    type: 'place',
                                    pos: cursor.clone(),
                                    state: wantedState,
                                    originalState: stateInWorld
                                });
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to process block at ${cursor}:`, error.message);
                    }
                }
            }
        }

        this.sortActionsByPriority();
    }

    sortActionsByPriority() {
        const getWeight = (action) => {
            if (action.type === 'dig') return 0;
            const block = this.blocks[action.state];
            if (!block) return 1;
            
            if (block.material === 'plant') return 4;
            if (block.name.includes('slab') || block.name.includes('stairs')) return 3;
            if (block.material === 'wood' || block.material === 'stone') return 2;
            return 1;
        };

        this.actions.sort((a, b) => {
            const weightA = getWeight(a);
            const weightB = getWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            
            return a.pos.y - b.pos.y || 
                   a.pos.x - b.pos.x || 
                   a.pos.z - b.pos.z;
        });
    }

    pause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.statistics.lastPauseTime = Date.now();
        }
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            if (this.statistics.lastPauseTime) {
                this.statistics.pauseTime += Date.now() - this.statistics.lastPauseTime;
                this.statistics.lastPauseTime = null;
            }
        }
    }

    cancel() {
        this.isCancelled = true;
        this.statistics.endTime = Date.now();
    }

    getProgress() {
        const now = Date.now();
        const activeTime = now - this.statistics.startTime - this.statistics.pauseTime;
        const blocksPerSecond = this.statistics.blocksPlaced / (activeTime / 1000);

        return {
            total: this.actions.length + this.completedActions.length,
            completed: this.completedActions.length,
            remaining: this.actions.length,
            statistics: {
                ...this.statistics,
                activeTime,
                blocksPerSecond,
                successRate: (this.statistics.blocksPlaced / 
                    (this.statistics.blocksPlaced + this.statistics.blocksFailed)) * 100,
                estimatedTimeRemaining: this.actions.length / blocksPerSecond
            }
        };
    }

    markActionComplete(action) {
        const index = this.actions.indexOf(action);
        if (index !== -1) {
            const completedAction = this.actions.splice(index, 1)[0];
            this.completedActions.push(completedAction);
            this.statistics.blocksPlaced++;
        }
    }

    markActionFailed(action, error) {
        this.statistics.blocksFailed++;
        this.buildErrors.push({
            type: 'placement_failed',
            action,
            error: error.message
        });
    }

    getItemForState(stateId) {
        return this.items[stateId];
    }

    getFacing(stateId, facing) {
        if (!facing) return { facing: null, is3D: false };
        
        const block = this.blocks[stateId];
        if (!block) return { facing: null, is3D: false };

        const data = facingData[block.name] || { inverted: false, is3D: false };
        
        if (data.inverted) {
            const opposites = {
                'up': 'down',
                'down': 'up',
                'north': 'south',
                'south': 'north',
                'west': 'east',
                'east': 'west'
            };
            facing = opposites[facing] || facing;
        }

        return { facing, is3D: data.is3D };
    }

    getPossibleDirections(stateId, pos) {
        const faces = [true, true, true, true, true, true];
        const properties = this.properties[stateId] || {};
        const block = this.blocks[stateId];
        
        if (!block) return [];

        if (properties.axis) {
            if (properties.axis === 'x') faces[0] = faces[1] = faces[2] = faces[3] = false;
            if (properties.axis === 'y') faces[2] = faces[3] = faces[4] = faces[5] = false;
            if (properties.axis === 'z') faces[0] = faces[1] = faces[4] = faces[5] = false;
        }

        if (properties.half === 'upper') return [];
        if (properties.half === 'top' || properties.type === 'top') faces[0] = faces[1] = false;
        if (properties.half === 'bottom' || properties.type === 'bottom') faces[0] = faces[1] = false;

        if (properties.facing) {
            const { facing, is3D } = this.getFacing(stateId, properties.facing);
            if (!is3D) {
                const faceMap = {
                    'north': [0, 1, 2, 4, 5],
                    'south': [0, 1, 3, 4, 5],
                    'west': [0, 1, 2, 3, 4],
                    'east': [0, 1, 2, 3, 5],
                    'up': [1, 2, 3, 4, 5],
                    'down': [0, 2, 3, 4, 5]
                };
                
                const blockedFaces = faceMap[facing] || [];
                blockedFaces.forEach(index => faces[index] = false);
            }
        }

        if (properties.hanging) faces[0] = faces[2] = faces[3] = faces[4] = faces[5] = false;
        if (block.material === 'plant') faces[1] = faces[2] = faces[3] = faces[4] = faces[5] = false;

        const directions = [];
        const faceDirections = [
            new Vec3(0, -1, 0),
            new Vec3(0, 1, 0),
            new Vec3(0, 0, -1),
            new Vec3(0, 0, 1),
            new Vec3(-1, 0, 0),
            new Vec3(1, 0, 0)
        ];

        for (let i = 0; i < faces.length; i++) {
            if (faces[i]) {
                const targetPos = pos.plus(faceDirections[i]);
                const targetBlock = this.world.getBlock(targetPos);
                
                if (this.canPlaceAgainst(targetBlock, faceDirections[i].scaled(-1), properties)) {
                    directions.push(faceDirections[i]);
                }
            }
        }

        return directions;
    }

    canPlaceAgainst(block, face, properties) {
        if (!block || !block.shapes) return false;
        const half = properties.half || properties.type;
        return getShapeFaceCenters(block.shapes, face, half).length > 0;
    }

    removeAction(action) {
        const index = this.actions.indexOf(action);
        if (index !== -1) {
            this.actions.splice(index, 1);
        }
    }

    getAvailableActions() {
        if (this.isPaused || this.isCancelled) return [];

        return this.actions.filter(action => {
            if (action.type === 'dig') return true;
            return this.getPossibleDirections(action.state, action.pos).length > 0;
        });
    }

    isComplete() {
        return this.actions.length === 0;
    }

    getBuildErrors() {
        return this.buildErrors;
    }
}

module.exports = Build;
