
# Mineflayer Builder Plugin

A plugin for Mineflayer that allows bots to build structures from schematic files.

[![npm version](https://badge.fury.io/js/mineflayer-schem.svg)](https://www.npmjs.com/package/mineflayer-schem@1.3.4)

## Installation

```sh
npm install mineflayer-schem
```

## Usage

```javascript
const mineflayer = require('mineflayer');
const { builder, Build } = require('mineflayer-schem');
const builderPlugin = require('mineflayer-schem').builder;

const bot = mineflayer.createBot({
  // Your bot configuration here
});

bot.loadPlugin(builderPlugin);

// Example of building a structure
const schematic = { /* Your schematic data */ };
const position = bot.entity.position.offset(10, 0, 10); // Position where to build
const build = new Build(schematic, bot.world, position);

const options = {
  buildSpeed: 1.0, // 1.0 is normal speed, 0.5 is half speed, etc.
  useTools: true,
  onError: 'pause', // 'pause', 'cancel', or 'continue'
  bots: [bot] // Array of_bots_to_collaborate
};

bot.builder.build(build, options);
```

## API

### Builder Methods

#### bot.builder.build(build, options)
Starts building the specified structure.
- `build`: Build object created from a schematic.
- `options`: Configuration options for the build process.
  - `buildSpeed`: Speed of_building (1.0 is normal speed, 0.5 is half speed, etc.)
  - `useTools`: Whether to use tools for building (default: `true`).
  - `onError`: Action to take on error (`'pause'`, `'cancel'`, or `'continue'`).
  - `bots`: Array of bots to collaborate in the build process (default: `[bot]`).

#### bot.builder.pause()
Pauses the current building process.

#### bot.builder.resume()
Resumes a paused building process.

#### bot.builder.cancel()
Cancels the current building process.

#### bot.builder.getProgress()
Returns the current building progress.
- Returns: `{ completed: number, total: number }`

#### bot.builder.equipItem(id)
Equips the specified item.
- `id`: Item ID to equip.

### Events

#### builder_progress
Emitted when building progress updates.
```javascript
bot.on('builder_progress', (progress) => {
  // progress = { completed: number, total: number }
});
```

#### builder_finished
Emitted when building completes successfully.

#### builder_cancelled
Emitted when building is cancelled.

#### builder_error
Emitted when an error occurs during building.
```javascript
bot.on('builder_error', (error) => {
  console.log('Building error:', error);
});
```

#### builder_paused
Emitted when building is paused.

#### builder_resumed
Emitted when building is resumed.

#### builder_action_completed
Emitted when an action is completed.
```javascript
bot.on('builder_action_completed', (action) => {
  console.log(`Action completed: ${action.type} at ${action.pos.x}, ${action.pos.y}, ${action.pos.z}`);
});
```

### Build Class

#### new Build(schematic, world, position, area = null)
Creates a new Build instance.
- `schematic`: Schematic object.
- `world`: Bot's world.
- `position`: Vec3 position where to build.
- `area`: Optional area to build a part of the schematic.

#### Properties
- `actions`: Array of pending building actions.
- `properties`: Block state properties.
- `isPaused`: Boolean indicating if build is paused.
- `isCancelled`: Boolean indicating if build is cancelled.

#### Methods
- `getAvailableActions()`: Returns an array of available actions.
- `removeAction(action)`: Removes a completed action.
- `pause()`: Pauses the build.
- `resume()`: Resumes the build.
- `cancel()`: Cancels the build.
- `getProgress()`: Returns the current build_progress.
- `markActionComplete(action)`: Marks an action as complete.
- `updateBlock(pos)`: Updates the block at the specified position.
- `getItemForState(stateId)`: Gets the item for a given state ID.
- `getFacing(stateId, facing)`: Gets the facing direction for a given state ID.
- `getPossibleDirections(stateId, pos)`: Gets possible directions for placing a block at a given position.

### Example

```javascript
const path = require('path');
const fs = require('fs').promises;
const { builder, Build } = require('mineflayer-schem');
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
```

### New Features in Version 1.3.3

- **Multiplayer Support**: Multiple bots can now collaborate on building a structure. This is configured using the `bots` option in the `build` method.
- **Configuration Options**: The `build` method now accepts an `options` object to configure the build process, including `buildSpeed`, `useTools`, and `onError`.
- **Optimized Route Calculation**: The plugin now optimizes the route for placing blocks to minimize travel distance.
- **Additional Events**: New events such as `builder_paused`, `builder_resumed`, `builder_cancelled`, and `builder_action_completed` provide more detailed feedback on the build process.

### Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue or submit a pull request.

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
