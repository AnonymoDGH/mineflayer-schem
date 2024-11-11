const path = require('path')
const fs = require('fs').promises
const { builder, Build } = require('mineflayer-builder')
const { Schematic } = require('prismarine-schematic')
const { pathfinder } = require('mineflayer-pathfinder')
const mineflayer = require('mineflayer')
const mineflayerViewer = require('prismarine-viewer').mineflayer

const bot = mineflayer.createBot({
  host: process.argv[2] || 'localhost',
  port: parseInt(process.argv[3]) || 25565,
  username: process.argv[4] || 'andy',
  password: process.argv[5]
})

bot.loadPlugin(pathfinder)
bot.loadPlugin(builder)

function wait (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

bot.once('spawn', async () => {
  mineflayerViewer(bot, { port: 3000 })

  bot.on('path_update', (r) => {
    const path = [bot.entity.position.offset(0, 0.5, 0)]
    for (const node of r.path) {
      path.push({ x: node.x, y: node.y + 0.5, z: node.z })
    }
    bot.viewer.drawLine('path', path, 0xff00ff)
  })

  const schematic = await Schematic.read(await fs.readFile(path.resolve(__dirname, '../example/schematic/smallhouse1.schem')), bot.version)
  while (!bot.entity.onGround) {
    await wait(100)
  }
  const at = bot.entity.position.floored()
  console.log('Building at ', schematic)
  const build = new Build(schematic, bot.world, at)
  bot.builder.build(build)
})

bot.on('builder_progress', (progress) => {
  console.log(`Build progress: ${progress.total} blocks placed`)
})

bot.on('builder_finished', () => {
  console.log('Build completed successfully!')
})
