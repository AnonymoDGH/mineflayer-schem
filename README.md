# mineflayer-schem

This plugin extends [mineflayer](https://github.com/PrismarineJS/mineflayer) to build structures from schematic files, supporting both modern and legacy formats, recent Minecraft versions, and advanced inventory/chest management.

## Features

- Support for schematic files (`.schematic`, `.schem`, `.litematic`, NBT), both modern and legacy formats.
- Compatible with the latest Minecraft versions (1.8–1.20+).
- Automatic construction with single or multiple bots.
- Automatic item retrieval from the nearest chest.
- Advanced handling of directional blocks, stairs, slabs, and special blocks.
- Detailed progress tracking and events.
- Configurable speed and error handling options.
- Construction statistics and error logging.

## Installation

```bash
npm install mineflayer-schem
```

## Example Usage

```javascript
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { Build, builder } = require('mineflayer-schem');
const { Schematic } = require('prismarine-schematic');
const fs = require('fs').promises;
const path = require('path');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'BuilderBot',
  version: '1.20.4' // Change according to your server
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(builder);

bot.once('spawn', async () => {
  const schematic = await Schematic.read(
    await fs.readFile(path.resolve(__dirname, './schematic/house.schem')),
    bot.version
  );

  while (!bot.entity.onGround) await new Promise(r => setTimeout(r, 100));

  const build = new Build(schematic, bot.world, bot.entity.position.floored());

  const options = {
    buildSpeed: 1.0,
    onError: 'pause',
    retryCount: 3,
    useNearestChest: true,
    bots: [bot]
  };

  bot.on('builder_progress', (progress) => {
    const percent = Math.floor((progress.completed / progress.total) * 100);
    console.log(`Progress: ${percent}% (${progress.completed}/${progress.total})`);
  });

  bot.on('builder_error', (error) => {
    console.error('Error:', error.message);
  });

  bot.on('builder_finished', () => {
    console.log('Build finished!');
  });

  await bot.builder.build(build, options);
});
```

## API

### builder(bot, options)
Injects the builder plugin into the bot.

- `buildSpeed`: Build speed multiplier (default: 1.0)
- `onError`: Error strategy ('pause', 'cancel', 'retry', 'skip')
- `retryCount`: Number of retries on failure (default: 3)
- `useNearestChest`: Automatically use nearby chests for items (default: true)
- `bots`: Bots collaborating on the build (default: [bot])

### Build

#### new Build(schematic, world, position, area = null)
Creates a new build instance.
- `schematic`: Schematic object.
- `world`: Bot's world.
- `position`: Vec3 where to build.
- `area`: Optional area for partial builds.

#### Properties
- `actions`: Pending actions.
- `completedActions`: Completed actions.
- `properties`: Block properties.
- `isPaused`: If build is paused.
- `isCancelled`: If build is cancelled.

#### Methods
- `getAvailableActions()`
- `removeAction(action)`
- `pause()`
- `resume()`
- `cancel()`
- `getProgress()`
- `markActionComplete(action)`
- `getItemForState(stateId)`
- `getFacing(stateId, facing)`
- `getPossibleDirections(stateId, pos)`
- `getBuildErrors()`

### Events

- `builder_progress`
- `builder_error`
- `builder_paused`
- `builder_resumed`
- `builder_cancelled`
- `builder_finished`

## Supported Formats

- `.schematic` classic (MCEdit)
- `.schem` modern (WorldEdit/Minecraft 1.13+)
- `.litematic` (Litematica)
- Raw NBT

## Advanced

### Automatic Chest Support
The bot detects and retrieves items from the nearest chests as needed for the schematic.

### Multi-bot
Multiple bots can collaborate on the same build using the `bots` option.

### Statistics and Errors
Get detailed metrics and errors during the process with `getProgress()` and `getBuildErrors()`.

## Contributing

Pull requests and suggestions are welcome!

## License

MIT

## Recent Changes

### 1.5.0
- Support for modern and legacy schematic formats
- Automatic detection and usage of the nearest chest
- Improved error handling and statistics
- Support for latest Minecraft blocks and properties
- Performance improvements and multi-bot support

### 1.4.x
- Route optimization and new configuration options
- Basic chest support
