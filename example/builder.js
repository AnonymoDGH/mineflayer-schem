const path = require('path');
const fs = require('fs').promises;
const { builder, Build } = require('mineflayer-builder');
const { Schematic } = require('prismarine-schematic');
const { pathfinder } = require('mineflayer-pathfinder');
const mineflayer = require('mineflayer');
const mineflayerViewer = require('prismarine-viewer').mineflayer;

const bot = mineflayer.createBot({
  host: process.argv[2] || 'localhost',
  port: parseInt(process.argv[3]) || 25565,
  username: process.argv[4] || 'andy',
  password: process.argv[5]
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(builder);

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

bot.once('spawn', async () => {
  mineflayerViewer(bot, { port: 3000 });

  bot.on('path_update', (r) => {
    const path = [bot.entity.position.offset(0, 0.5, 0)];
    for (const node of r.path) {
      path.push({ x: node.x, y: node.y + 0.5, z: node.z });
    }
    bot.viewer.drawLine('path', path, 0xff00ff);
  });

  const schematic = await Schematic.read(await fs.readFile(path.resolve(__dirname, '../example/schematic/smallhouse1.schem')), bot.version);
  while (!bot.entity.onGround) {
    await wait(100);
  }
  const at = bot.entity.position.floored();
  console.log('Building at ', at);

  const build = new Build(schematic, bot.world, at);

  const options = {
    buildSpeed: 1.0, // 1.0 is normal speed, 0.5 is half speed, etc.
    useTools: true,
    onError: 'pause', // 'pause', 'cancel', or 'continue'
    bots: [bot] // Array of bots to collaborate
  };

  bot.builder.build(build, options);
});

bot.on('builder_progress', (progress) => {
  console.log(`Build progress: ${progress.completed} / ${progress.total} blocks placed`);
});

bot.on('builder_finished', () => {
  console.log('Build completed successfully!');
});

bot.on('builder_error', (error) => {
  console.error('Builder error:', error);
});

bot.on('builder_paused', () => {
  console.log('Build paused.');
});

bot.on('builder_resumed', () => {
  console.log('Build resumed.');
});

bot.on('builder_cancelled', () => {
  console.log('Build cancelled.');
});

bot.on('builder_action_completed', (action) => {
  console.log(`Action completed: ${action.type} at ${action.pos.x}, ${action.pos.y}, ${action.pos.z}`);
});
