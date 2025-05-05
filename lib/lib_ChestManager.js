const Vec3 = require('vec3');

class ChestManager {
    constructor(bot) {
        this.bot = bot;
        this.knownChests = new Map();
        this.lastChecked = new Map();
        this.checkInterval = 30000;
    }

    async findNearestChest(requiredItems) {
        await this.updateKnownChests();
        const botPos = this.bot.entity.position;
        let nearestChest = null;
        let minDistance = Infinity;

        for (const [posKey, items] of this.knownChests.entries()) {
            const [x, y, z] = posKey.split(',').map(Number);
            const chestPos = new Vec3(x, y, z);
            const distance = botPos.distanceTo(chestPos);

            if (distance < minDistance && this.hasRequiredItems(items, requiredItems)) {
                minDistance = distance;
                nearestChest = chestPos;
            }
        }

        return nearestChest;
    }

    async updateKnownChests() {
        const botPos = this.bot.entity.position;
        const radius = 16;

        for (let x = -radius; x <= radius; x++) {
            for (let y = -4; y <= 4; y++) {
                for (let z = -radius; z <= radius; z++) {
                    const pos = botPos.offset(x, y, z).floored();
                    const block = this.bot.blockAt(pos);

                    if (block && block.name === 'chest') {
                        const posKey = `${pos.x},${pos.y},${pos.z}`;
                        const lastCheck = this.lastChecked.get(posKey) || 0;

                        if (Date.now() - lastCheck > this.checkInterval) {
                            try {
                                const chest = await this.bot.openChest(block);
                                const items = await this.getChestItems(chest);
                                this.knownChests.set(posKey, items);
                                this.lastChecked.set(posKey, Date.now());
                                await chest.close();
                            } catch (error) {
                                continue;
                            }
                        }
                    }
                }
            }
        }
    }

    async getChestItems(chest) {
        return chest.items().reduce((acc, item) => {
            if (item) {
                acc[item.name] = (acc[item.name] || 0) + item.count;
            }
            return acc;
        }, {});
    }

    hasRequiredItems(chestItems, requiredItems) {
        return requiredItems.every(item => 
            chestItems[item.name] && chestItems[item.name] >= 1
        );
    }

    async withdrawRequiredItems(chestPos, requiredItems) {
        const block = this.bot.blockAt(chestPos);
        if (!block || block.name !== 'chest') return false;

        try {
            const chest = await this.bot.openChest(block);
            for (const item of requiredItems) {
                const chestItem = chest.items().find(i => i.name === item.name);
                if (chestItem) {
                    await chest.withdraw(chestItem.type, null, 
                        Math.min(chestItem.count, item.count || 1));
                }
            }
            await chest.close();
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = ChestManager;