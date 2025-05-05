const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { Build, builder } = require('mineflayer-schem');
const { Schematic } = require('prismarine-schematic');
const fs = require('fs').promises;
const path = require('path');

const bot = mineflayer.createBot({
    host: process.argv[2] || 'localhost',
    port: parseInt(process.argv[3]) || 25565,
    username: process.argv[4] || 'Builder',
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(builder);

async function startBuilding() {
    try {
        const schematic = await Schematic.read(
            await fs.readFile(path.resolve(__dirname, './schematic/house.schem')), 
            bot.version
        );
        
        while (!bot.entity.onGround) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const buildPosition = bot.entity.position.floored();
        console.log('Starting build at:', buildPosition);

        const build = new Build(schematic, bot.world, buildPosition);
        
        const options = {
            buildSpeed: 1.0,
            onError: 'pause',
            retryCount: 3,
            useNearestChest: true,
            bots: [bot],
        };

        bot.on('builder_progress', (progress) => {
            const percentage = Math.floor((progress.completed / progress.total) * 100);
            console.log(`Building progress: ${percentage}% (${progress.completed}/${progress.total})`);
        });

        bot.on('builder_error', (error) => {
            console.error('Building error:', error.message);
        });

        bot.on('builder_finished', () => {
            console.log('Building completed!');
        });

        await bot.builder.build(build, options);
    } catch (error) {
        console.error('Error:', error);
    }
}

bot.once('spawn', () => {
    console.log('Bot spawned, starting build process...');
    startBuilding().catch(console.error);
});
