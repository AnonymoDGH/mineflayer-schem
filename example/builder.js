const mineflayer = require('mineflayer')
const { Schematic } = require('prismarine-schematic')
const fs = require('fs').promises
const path = require('path')
const builderPlugin = require('mineflayer-builder')

// Create the bot
const bot = mineflayer.createBot({
  host: process.argv[2] || 'localhost',
  port: parseInt(process.argv[3]) || 25565,
  username: process.argv[4] || 'builder',
  password: process.argv[5]
})

// Load the plugin
bot.loadPlugin(builderPlugin)

// Wait function
function wait (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

bot.once('spawn', async () => {
  // Load the schematic
  // Note: Users will need to provide their own .schem file
  const schematicPath = path.resolve(__dirname, 'example_schematic.schem')
  console.log(`Attempting to load schematic from: ${schematicPath}`)
  
  try {
    const schematicData = await fs.readFile(schematicPath)
    const schematic = await Schematic.read(schematicData, bot.version)

    // Wait for the bot to be on the ground
    while (!bot.entity.onGround) {
      await wait(100)
    }

    const buildPosition = bot.entity.position.floored()
    console.log('Starting build at', buildPosition)

    // Start building
    bot.builder.build(schematic, buildPosition)
  } catch (error) {
    console.error('Error loading or building schematic:', error)
  }
})

// Handle chat commands
bot.on('chat', (username, message) => {
  if (username === bot.username) return

  switch (message) {
    case 'build':
      bot.chat('Starting build...')
      // Here you could restart the build if needed
      break
    case 'cancel':
      bot.builder.cancel()
      bot.chat('Build cancelled')
      break
  }
})

// Error handling
bot.on('error', (err) => console.error('Error:', err))

console.log('Bot started. Use "build" in chat to start building and "cancel" to stop.')

// Additional event listeners for build progress (optional)
bot.on('builder_progress', (progress) => {
  console.log(`Build progress: ${progress.current}/${progress.total} blocks placed`)
})

bot.on('builder_finished', () => {
  console.log('Build completed successfully!')
})

bot.on('builder_error', (error) => {
  console.error('Build error:', error)
})
