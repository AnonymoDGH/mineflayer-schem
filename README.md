# mineflayer-builder

A simple builder plugin for Mineflayer that allows bots to build structures using schematics.

## Installation

```bash
npm install mineflayer-builder
```

## Usage

```js
const mineflayer = require('mineflayer')
const builderPlugin = require('mineflayer-builder')
const { Schematic } = require('prismarine-schematic')
const fs = require('fs')

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'Builder'
})

bot.loadPlugin(builderPlugin)

// Load schematic
let schematic
async function loadSchematic() {
  const schematicData = fs.readFileSync('path/to/your/schematic.schem')
  schematic = await Schematic.read(schematicData)
}

// Listen to chat commands
bot.on('chat', async (username, message) => {
  if (username === bot.username) return
  
  if (message === 'build') {
    if (!schematic) await loadSchematic()
    bot.builder.build(schematic)
  }
})

// Load schematic when bot spawns
bot.once('spawn', () => {
  loadSchematic()
})
```

## Features

- Build structures from schematic files (.schem format)
- Automatic block placement following schematic pattern
- Path finding to reach building locations
- Chat command control

## Chat Commands

In Minecraft chat:
- `build` - Starts building the loaded schematic
- `cancel` - Cancels current building task (WIP)

## API

### bot.builder.build(schematic)

Starts the building process using the provided schematic.
- `schematic`: A prismarine-schematic object containing the structure to build

### bot.builder.getBlockPlace()

Internal function that handles block placement logic according to the schematic.

### bot.builder.findPath()

Internal function for pathfinding to build locations.

## Dependencies

- mineflayer
- mineflayer-pathfinder
- prismarine-block
- prismarine-schematic
- vec3

## Notes

This plugin is currently in development. Some features like material collection and build cancellation are work in progress.

## Required Files

You need a .schem file (Schematic) of the structure you want to build. These can be created using tools like WorldEdit.

## Contributing

Feel free to open issues and pull requests!

## License

MIT
