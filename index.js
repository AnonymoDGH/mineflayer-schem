const { goals, Movements } = require('mineflayer-pathfinder');
const interactable = require('./lib/interactable.json');
const Vec3 = require('vec3');
const toolPlugin = require('mineflayer-tool').plugin;
const ChestManager = require('./lib/ChestManager');

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function inject(bot, options = {}) {
    if (!bot.pathfinder) {
        throw new Error('pathfinder must be loaded before builder');
    }

    const mcData = require('minecraft-data')(bot.version);
    const Item = require('prismarine-item')(bot.version);

    const defaultOptions = {
        buildSpeed: 1.0,
        onError: 'pause',
        retryCount: 3,
        useNearestChest: true,
        bots: [bot],
    };

    const settings = { ...defaultOptions, ...options };

    const movements = new Movements(bot, {
        maxDropDown: 256,
        maxClimbUp: 256,
    });

    bot.pathfinder.setMovements(movements);
    bot.pathfinder.searchRadius = 16;

    bot.loadPlugin(toolPlugin);
    bot.chestManager = new ChestManager(bot);

    bot.builder = {};
    let currentBuild = null;

    bot.builder.build = async (build) => {
        currentBuild = build;

        try {
            while (build.actions.length > 0) {
                if (build.isCancelled) {
                    bot.emit('builder_cancelled');
                    break;
                }

                if (build.isPaused) {
                    await wait(1000);
                    continue;
                }

                const availableActions = build.getAvailableActions();
                if (availableActions.length === 0) break;

                const bots = settings.bots.filter(b => b.pathfinder && b.pathfinder.movements);
                for (const bot of bots) {
                    if (build.actions.length === 0) break;

                    const action = build.actions[0];
                    try {
                        if (action.type === 'place') {
                            const item = build.getItemForState(action.state);
                            await ensureHasItem(bot, item, build);

                            const properties = build.properties[action.state];
                            const half = properties.half || properties.type;
                            const faces = build.getPossibleDirections(action.state, action.pos);

                            const { facing, is3D } = build.getFacing(action.state, properties.facing);
                            const goal = new goals.GoalPlaceBlock(action.pos, bot.world, {
                                faces,
                                facing,
                                facing3D: is3D,
                                half,
                            });

                            if (!goal.isEnd(bot.entity.position.floored())) {
                                bot.pathfinder.setMovements(movements);
                                await bot.pathfinder.goto(goal);
                            }

                            await equipToolForAction(action, item);

                            const faceAndRef = goal.getFaceAndRef(bot.entity.position.floored().offset(0.5, 1.6, 0.5));
                            if (!faceAndRef) throw new Error('no face and ref');

                            bot.lookAt(faceAndRef.to, true);

                            const refBlock = bot.blockAt(faceAndRef.ref);
                            const sneak = interactable.indexOf(refBlock.name) > 0;
                            if (sneak) bot.setControlState('sneak', true);
                            
                            await bot._placeBlockWithOptions(refBlock, faceAndRef.face.scaled(-1), {
                                half,
                                delta: faceAndRef.to.minus(faceAndRef.ref)
                            });
                            
                            if (sneak) bot.setControlState('sneak', false);

                            const block = bot.world.getBlock(action.pos);
                            if (block.stateId !== action.state) {
                                throw new Error('Block placement failed');
                            }
                        } else if (action.type === 'dig') {
                            const block = bot.blockAt(action.pos);
                            await bot.dig(block);
                        }

                        build.markActionComplete(action);
                        build.removeAction(action);
                        bot.emit('builder_progress', build.getProgress());
                        await wait(1000 / settings.buildSpeed);
                    } catch (e) {
                        bot.emit('builder_error', e);
                        if (settings.onError === 'pause') {
                            build.pause();
                            bot.emit('builder_paused');
                            break;
                        } else if (settings.onError === 'cancel') {
                            build.cancel();
                            bot.emit('builder_cancelled');
                            break;
                        }
                    }
                }
            }

            if (!build.isCancelled) {
                bot.emit('builder_finished');
            }
        } catch (e) {
            bot.emit('builder_error', e);
        } finally {
            currentBuild = null;
        }
    };

    async function ensureHasItem(bot, item, build) {
        if (!item) return;

        const inventory = bot.inventory.items().find(i => i.name === item.name);
        if (!inventory && settings.useNearestChest) {
            const nearestChest = await bot.chestManager.findNearestChest([item]);
            if (nearestChest) {
                await bot.pathfinder.goto(new goals.GoalBlock(
                    nearestChest.x,
                    nearestChest.y,
                    nearestChest.z
                ));
                await bot.chestManager.withdrawRequiredItems(nearestChest, [item]);
            }
        }
    }

    async function equipToolForAction(action, item) {
        const block = bot.blockAt(action.pos);
        if (item && block) {
            await bot.tool.equipForBlock(block, {});
        }
    }

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
    Build: require('./lib/build.js'),
    builder: inject,
};
