const { goals, Movements } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');
const Build = require('./lib/build.js');
const interactable = require('./lib/interactable.json');
const facing = require('./lib/facing.json');

function wait(ms) { 
    return new Promise(resolve => setTimeout(resolve, ms)); 
}

function inject(bot, options = {}) {
    if (!bot.pathfinder) {
        throw new Error('mineflayer-pathfinder must be loaded before mineflayer-schem');
    }

    const mcData = require('minecraft-data')(bot.version);
    const Item = require('prismarine-item')(bot.version);

    const defaultOptions = {
        buildSpeed: 1.0,
        onError: 'skip',
        clearArea: false,
        maxRetries: 3,
        digCost: 10,
        maxDropDown: 256,
        searchRadius: 10
    };

    const settings = { ...defaultOptions, ...options };

    const movements = new Movements(bot, mcData);
    movements.digCost = settings.digCost;
    movements.maxDropDown = settings.maxDropDown;
    movements.canDig = false;
    movements.allow1by1towers = false;
    
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.searchRadius = settings.searchRadius;

    bot.builder = {};
    let currentBuild = null;

    function getPossibleDirections(pos) {
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

    function isInteractable(blockName) {
        return interactable.includes(blockName);
    }

    function hasLineOfSight(fromPos, toPos) {
        const direction = toPos.minus(fromPos);
        const distance = direction.norm();
        
        if (distance > 5) return false;
        
        const step = direction.scaled(1 / distance);
        let current = fromPos.clone();
        
        for (let i = 0; i < distance; i++) {
            current = current.plus(step);
            const block = bot.blockAt(current.floored());
            
            if (block && block.name !== 'air' && !block.position.equals(toPos.floored())) {
                return false;
            }
        }
        
        return true;
    }

    function getBlockFacing(metadata, blockName) {
        if (blockName.includes('stairs')) {
            const direction = metadata & 0x3;
            const upsideDown = (metadata & 0x4) !== 0;
            
            const facings = [
                new Vec3(0, 0, 1),
                new Vec3(0, 0, -1),
                new Vec3(1, 0, 0),
                new Vec3(-1, 0, 0)
            ];
            
            return { facing: facings[direction], half: upsideDown ? 'top' : 'bottom' };
        }
        
        if (blockName.includes('trapdoor')) {
            const direction = metadata & 0x3;
            const isOpen = (metadata & 0x4) !== 0;
            const isTop = (metadata & 0x8) !== 0;
            
            const facings = [
                new Vec3(0, 0, -1),
                new Vec3(0, 0, 1),
                new Vec3(-1, 0, 0),
                new Vec3(1, 0, 0)
            ];
            
            return { facing: facings[direction], half: isTop ? 'top' : 'bottom', open: isOpen };
        }
        
        if (blockName.includes('door')) {
            const direction = metadata & 0x3;
            const isOpen = (metadata & 0x4) !== 0;
            const isTop = (metadata & 0x8) !== 0;
            
            const facings = [
                new Vec3(1, 0, 0),
                new Vec3(0, 0, 1),
                new Vec3(-1, 0, 0),
                new Vec3(0, 0, -1)
            ];
            
            return { facing: facings[direction], half: isTop ? 'upper' : 'lower', open: isOpen };
        }
        
        if (blockName.includes('log') || blockName.includes('pillar')) {
            const axis = metadata & 0xC;
            if (axis === 0x4) return { axis: 'x' };
            if (axis === 0x8) return { axis: 'z' };
            return { axis: 'y' };
        }
        
        return null;
    }

    bot.builder.equipItem = async function(itemId) {
        try {
            if (bot.inventory.items().length > 30) {
                await bot.chat('/clear');
                await wait(100);
            }

            let item = bot.inventory.items().find(i => i.type === itemId);

            if (!item && bot.game && bot.game.gameMode === 'creative') {
                const emptySlot = bot.inventory.firstEmptyInventorySlot();
                const slot = emptySlot !== null ? emptySlot : 36;
                
                const newItem = new Item(itemId, 64, 0);
                await bot.creative.setInventorySlot(slot, newItem);
                await wait(50);
                
                item = bot.inventory.items().find(i => i.type === itemId);
            }

            if (!item) {
                throw new Error(`Could not get item ${itemId}`);
            }

            await bot.equip(item, 'hand');
            return item;
        } catch (error) {
            throw new Error(`Error equipping item: ${error.message}`);
        }
    };

    bot.builder.clearArea = async function(build) {
        console.log('🧹 Clearing build area...');
        const blocksToRemove = [];
        
        for (let y = build.min.y; y < build.max.y; y++) {
            for (let x = build.min.x; x < build.max.x; x++) {
                for (let z = build.min.z; z < build.max.z; z++) {
                    const pos = new Vec3(x, y, z);
                    const block = bot.blockAt(pos);
                    if (block && block.name !== 'air' && block.diggable) {
                        blocksToRemove.push(pos);
                    }
                }
            }
        }
        
        console.log(`🧹 Blocks to remove: ${blocksToRemove.length}`);
        
        let removed = 0;
        let failed = 0;
        
        for (const pos of blocksToRemove) {
            try {
                const block = bot.blockAt(pos);
                if (!block || block.name === 'air') continue;
                
                const distance = bot.entity.position.distanceTo(pos);
                if (distance > 4.5) {
                    try {
                        await bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, 3));
                    } catch (pathError) {
                        failed++;
                        continue;
                    }
                }
                
                await bot.dig(block);
                removed++;
                await wait(50);
            } catch (e) {
                failed++;
            }
        }
        
        console.log(`✅ Area cleared: ${removed} blocks removed, ${failed} failed`);
    };

    bot.builder.build = async function(build) {
        currentBuild = build;

        try {
            if (settings.clearArea) {
                await bot.builder.clearArea(build);
            }
            
            console.log(`🏗️  Starting build of ${build.actions.length} blocks...`);
            console.log(`⚡ Speed: ${settings.buildSpeed} blocks/second`);
            
            let consecutiveFailures = 0;
            const maxConsecutiveFailures = 10;
            
            while (build.actions.length > 0) {
                if (build.isCancelled) {
                    bot.emit('builder_cancelled');
                    break;
                }

                if (build.isPaused) {
                    await wait(1000);
                    continue;
                }

                const availableActions = build.actions.filter(action => {
                    const directions = getPossibleDirections(action.pos);
                    return directions.length > 0;
                });

                if (availableActions.length === 0) {
                    console.warn('⚠️  No available actions');
                    await wait(2000);
                    
                    const toMove = Math.min(20, build.actions.length);
                    for (let i = 0; i < toMove; i++) {
                        const action = build.actions.shift();
                        build.actions.push(action);
                    }
                    continue;
                }

                availableActions.sort((a, b) => {
                    const distA = a.pos.offset(0.5, 0.5, 0.5).distanceSquared(bot.entity.position);
                    const distB = b.pos.offset(0.5, 0.5, 0.5).distanceSquared(bot.entity.position);
                    return distA - distB;
                });

                const action = availableActions[0];
                
                try {
                    if (action.type === 'place') {
                        const item = build.getItemForState(action.state);
                        
                        if (!item) {
                            build.actions = build.actions.filter(a => a !== action);
                            continue;
                        }

                        const targetBlock = bot.blockAt(action.pos);
                        if (targetBlock && targetBlock.name === item.name) {
                            build.actions = build.actions.filter(a => a !== action);
                            build.markActionComplete(action);
                            bot.emit('builder_progress', build.getProgress());
                            consecutiveFailures = 0;
                            continue;
                        }

                        if (targetBlock && targetBlock.name !== 'air') {
                            try {
                                const distance = bot.entity.position.distanceTo(action.pos);
                                if (distance > 4.5) {
                                    await bot.pathfinder.goto(new goals.GoalNear(action.pos.x, action.pos.y, action.pos.z, 3));
                                }
                                await bot.dig(targetBlock);
                                await wait(200);
                            } catch (e) {
                            }
                        }

                        const directions = getPossibleDirections(action.pos);
                        
                        if (directions.length === 0) {
                            if (!action.retryCount) action.retryCount = 0;
                            action.retryCount++;
                            
                            if (action.retryCount > settings.maxRetries) {
                                build.actions = build.actions.filter(a => a !== action);
                                build.statistics.blocksFailed++;
                                consecutiveFailures++;
                            } else {
                                build.actions = build.actions.filter(a => a !== action);
                                build.actions.push(action);
                                consecutiveFailures++;
                            }
                            continue;
                        }

                        let selectedDirection = null;
                        for (const dir of directions) {
                            const faceCenter = dir.refPos.offset(0.5, 0.5, 0.5);
                            if (hasLineOfSight(bot.entity.position.offset(0, 1.6, 0), faceCenter)) {
                                selectedDirection = dir;
                                break;
                            }
                        }
                        
                        if (!selectedDirection) {
                            selectedDirection = directions[0];
                        }
                        
                        const { block: refBlock, face } = selectedDirection;

                        const distance = bot.entity.position.distanceTo(action.pos);
                        if (distance > 4.5) {
                            try {
                                await bot.pathfinder.goto(new goals.GoalNear(action.pos.x, action.pos.y, action.pos.z, 3));
                            } catch (e) {
                                build.actions = build.actions.filter(a => a !== action);
                                build.statistics.blocksFailed++;
                                consecutiveFailures++;
                                continue;
                            }
                        }

                        await bot.builder.equipItem(item.id);
                        
                        const blockFacing = getBlockFacing(action.metadata, action.blockName);
                        
                        const faceCenter = refBlock.position.offset(0.5, 0.5, 0.5).plus(face.scaled(0.5));
                        await bot.lookAt(faceCenter);
                        
                        if (blockFacing && blockFacing.facing) {
                            const targetLook = action.pos.offset(0.5, 0.5, 0.5).plus(blockFacing.facing.scaled(0.3));
                            await bot.lookAt(targetLook);
                        }

                        const shouldSneak = isInteractable(refBlock.name);
                        if (shouldSneak) {
                            bot.setControlState('sneak', true);
                        }

                        try {
                            await bot.placeBlock(refBlock, face);
                            
                            if (shouldSneak) {
                                bot.setControlState('sneak', false);
                            }

                            await wait(100);
                            const placedBlock = bot.blockAt(action.pos);
                            
                            if (placedBlock && placedBlock.name !== 'air') {
                                let orientationCorrect = true;
                                
                                if (blockFacing) {
                                    if (blockFacing.half && placedBlock.getProperties) {
                                        const props = placedBlock.getProperties();
                                        if (props.half && props.half !== blockFacing.half) {
                                            orientationCorrect = false;
                                        }
                                    }
                                }
                                
                                if (orientationCorrect) {
                                    build.markActionComplete(action);
                                    consecutiveFailures = 0;
                                } else {
                                    if (!action.orientationRetries) action.orientationRetries = 0;
                                    action.orientationRetries++;
                                    
                                    if (action.orientationRetries < 2) {
                                        build.actions.push(action);
                                    } else {
                                        build.markActionComplete(action);
                                    }
                                    consecutiveFailures = 0;
                                }
                            } else {
                                build.statistics.blocksFailed++;
                                consecutiveFailures++;
                            }
                        } catch (e) {
                            if (shouldSneak) {
                                bot.setControlState('sneak', false);
                            }
                            build.statistics.blocksFailed++;
                            consecutiveFailures++;
                        }

                        build.actions = build.actions.filter(a => a !== action);
                        bot.emit('builder_progress', build.getProgress());
                    }

                    if (consecutiveFailures >= maxConsecutiveFailures) {
                        console.warn(`⚠️  Reorganizing queue...`);
                        const toMove = Math.min(20, build.actions.length);
                        for (let i = 0; i < toMove; i++) {
                            const action = build.actions.shift();
                            build.actions.push(action);
                        }
                        consecutiveFailures = 0;
                        await wait(2000);
                    }

                    await wait(1000 / settings.buildSpeed);
                    
                } catch (e) {
                    console.error('❌ Error:', e.message);
                    bot.emit('builder_error', e);
                    consecutiveFailures++;
                    
                    if (settings.onError === 'pause') {
                        build.pause();
                        bot.emit('builder_paused');
                        break;
                    } else if (settings.onError === 'skip') {
                        build.actions = build.actions.filter(a => a !== action);
                    } else if (settings.onError === 'cancel') {
                        build.cancel();
                        break;
                    }
                }
            }

            if (!build.isCancelled && build.actions.length === 0) {
                bot.emit('builder_finished');
            }
            
        } catch (e) {
            bot.emit('builder_error', e);
        } finally {
            currentBuild = null;
        }
    };

    bot.builder.pause = () => {
        if (currentBuild) {
            currentBuild.pause();
            bot.emit('builder_paused');
        }
    };

    bot.builder.resume = () => {
        if (currentBuild) {
            currentBuild.resume();
            bot.emit('builder_resumed');
        }
    };

    bot.builder.cancel = () => {
        if (currentBuild) {
            currentBuild.cancel();
        }
    };

    bot.builder.getProgress = () => {
        if (currentBuild) {
            return currentBuild.getProgress();
        }
        return null;
    };
}

module.exports = {
    Build: Build,
    builder: inject,
};
