# Mineflayer-Schem

A plugin for Mineflayer to build structures from schematic files in Minecraft.

## Features

- Build structures from schematic files
- Automatic item collection from nearby chests
- Multi-bot support for collaborative building
- Intelligent block placement with proper facing and orientation
- Advanced error handling and recovery
- Progress tracking and event system
- Configurable build speed and behavior

## Installation

```bash
npm install mineflayer-schem
```

## Usage

```javascript
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { Build, builder } = require('mineflayer-schem');

const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Builder'
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(builder);

async function startBuild() {
    const schematic = await Schematic.read(/* your schematic file */);
    const build = new Build(schematic, bot.world, bot.entity.position.floored());
    
    const options = {
        buildSpeed: 1.0,
        onError: 'pause',
        retryCount: 3,
        useNearestChest: true,
        bots: [bot]
    };
    
    await bot.builder.build(build, options);
}
```

## API Documentation

### Injection

#### builder(bot, options)
Injects the builder plugin into the bot.

Options:
- `buildSpeed`: Build speed multiplier (default: 1.0)
- `onError`: Error handling strategy ('pause', 'cancel', 'retry') (default: 'pause')
- `retryCount`: Number of retries on failure (default: 3)
- `useNearestChest`: Automatically use nearby chests for items (default: true)
- `bots`: Array of bots for collaborative building (default: [bot])

### Classes

#### new Build(schematic, world, position, area = null)
Creates a new Build instance.
- `schematic`: Schematic object
- `world`: Bot's world
- `position`: Vec3 position where to build
- `area`: Optional area to build a part of the schematic

#### Properties
- `actions`: Array of pending building actions
- `properties`: Block state properties
- `isPaused`: Boolean indicating if build is paused
- `isCancelled`: Boolean indicating if build is cancelled

#### Methods
- `getAvailableActions()`: Returns array of available actions
- `removeAction(action)`: Removes a completed action
- `pause()`: Pauses the build
- `resume()`: Resumes the build
- `cancel()`: Cancels the build
- `getProgress()`: Returns current build progress
- `markActionComplete(action)`: Marks an action as complete
- `updateBlock(pos)`: Updates block at specified position
- `getItemForState(stateId)`: Gets item for state ID
- `getFacing(stateId, facing)`: Gets facing direction
- `getPossibleDirections(stateId, pos)`: Gets possible placement directions

### Events

- `builder_progress`: Emitted with build progress updates
- `builder_error`: Emitted when an error occurs
- `builder_paused`: Emitted when build is paused
- `builder_resumed`: Emitted when build is resumed
- `builder_cancelled`: Emitted when build is cancelled
- `builder_finished`: Emitted when build completes

### Advanced Features

#### Automatic Item Collection
The plugin automatically searches for and collects items from nearby chests when needed:
```javascript
const options = {
    useNearestChest: true,
    // other options...
};
```

#### Multi-Bot Building
Multiple bots can work together on the same structure:
```javascript
const options = {
    bots: [mainBot, helperBot1, helperBot2],
    // other options...
};
```

## Example

See the `example` folder for a complete working example.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Changelog

### 1.4.0
- Added automatic nearest chest detection and item collection
- Improved multi-bot coordination
- Enhanced error handling and recovery
- Added build progress statistics
- Optimized block placement logic

### 1.3.6
- Added basic chest item retrieval
- Added multiplayer support
- Added configuration options
- Improved route calculation
- Added new events
