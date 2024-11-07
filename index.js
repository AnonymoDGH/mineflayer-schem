const { goals, Movements } = require('mineflayer-pathfinder')
const interactable = require('./lib/interactable.json')
const Build = require('./lib/Build')

function inject (bot) {
  if (!bot.pathfinder) {
    throw new Error('pathfinder must be loaded before builder')
  }

  const mcData = require('minecraft-data')(bot.version)
  const Item = require('prismarine-item')(bot.version)

  bot.builder = {}

  const movements = new Movements(bot, mcData)
  movements.digCost = 10
  movements.maxDropDown = 256
  bot.pathfinder.searchRadius = 10

  async function equipItem (id) {
    if (bot.isCreative()) {
      if (bot.inventory.items().length > 30) {
        await bot.chat('/clear')
        await bot.waitForTicks(20) // Wait for 1 second
      }
      if (!bot.inventory.items().find(x => x.type === id)) {
        const slot = bot.inventory.firstEmptyInventorySlot()
        await bot.creative.setInventorySlot(slot !== null ? slot : 36, new Item(id, 1))
      }
    } else {
      // In survival mode, we need to find the item in the inventory
      const item = bot.inventory.items().find(x => x.type === id)
      if (!item) {
        throw new Error(`Item with id ${id} not found in inventory`)
      }
    }
    const item = bot.inventory.items().find(x => x.type === id)
    await bot.equip(item, 'hand')
  }

  bot.builder.equipItem = equipItem

  bot.builder.build = async (build) => {
    while (build.actions.length > 0) {
      const actions = build.getAvailableActions()
      console.log(`${actions.length} available actions`)
      if (actions.length === 0) {
        console.log('No actions to perform')
        break
      }
      actions.sort((a, b) => {
        const dA = a.pos.offset(0.5, 0.5, 0.5).distanceSquared(bot.entity.position)
        const dB = b.pos.offset(0.5, 0.5, 0.5).distanceSquared(bot.entity.position)
        return dA - dB
      })
      const action = actions[0]
      console.log('action', action)

      try {
        if (action.type === 'place') {
          await placeBlock(bot, build, action)
        } else if (action.type === 'dig') {
          await digBlock(bot, action)
        }
      } catch (e) {
        console.error(`Error performing action: ${e.message}`)
      }

      build.removeAction(action)
    }
  }

  async function placeBlock (bot, build, action) {
    const item = build.getItemForState(action.state)
    console.log('Selecting ' + item.displayName)

    const properties = build.properties[action.state]
    const half = properties.half ? properties.half : properties.type

    const faces = build.getPossibleDirections(action.state, action.pos)
    for (const face of faces) {
      const block = bot.blockAt(action.pos.plus(face))
      console.log(face, action.pos.plus(face), block.name)
    }

    const { facing, is3D } = build.getFacing(action.state, properties.facing)
    const goal = new goals.GoalPlaceBlock(action.pos, bot.world, {
      faces,
      facing: facing,
      facing3D: is3D,
      half
    })

    if (!goal.isEnd(bot.entity.position.floored())) {
      console.log('pathfinding')
      bot.pathfinder.setMovements(movements)
      await bot.pathfinder.goto(goal)
    }

    await equipItem(item.id)

    const faceAndRef = goal.getFaceAndRef(bot.entity.position.floored().offset(0.5, 1.6, 0.5))
    if (!faceAndRef) {
      throw new Error('no face and ref')
    }

    bot.lookAt(faceAndRef.to, true)

    const refBlock = bot.blockAt(faceAndRef.ref)
    const sneak = interactable.indexOf(refBlock.name) > 0
    const delta = faceAndRef.to.minus(faceAndRef.ref)
    if (sneak) bot.setControlState('sneak', true)
    await bot._placeBlockWithOptions(refBlock, faceAndRef.face.scaled(-1), { half, delta })
    if (sneak) bot.setControlState('sneak', false)

    const block = bot.world.getBlock(action.pos)
    if (block.stateId !== action.state) {
      console.log('expected', properties)
      console.log('got', block.getProperties())
    }
  }

  async function digBlock (bot, action) {
    const block = bot.blockAt(action.pos)
    if (block.type === 0) return // Air, no need to dig

    const goal = new goals.GoalBreakBlock(action.pos, bot.world)
    
    if (!goal.isEnd(bot.entity.position.floored())) {
      console.log('pathfinding to dig')
      bot.pathfinder.setMovements(movements)
      await bot.pathfinder.goto(goal)
    }

    await bot.dig(block)
  }
}

module.exports = {
  Build,
  builder: inject
}
