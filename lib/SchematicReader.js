const nbt = require('prismarine-nbt');
const Vec3 = require('vec3');
const { promisify } = require('util');
const parseNBT = promisify(nbt.parse);

class SchematicReader {
    constructor(version) {
        this.version = version;
        this.supportedFormats = ['schematic', 'schem', 'litematic', 'nbt'];
    }

    async read(buffer) {
        const parsedNBT = await parseNBT(buffer);
        const data = parsedNBT.value;

        if (data.SchematicaMapping) {
            return this.readLitematicFormat(data);
        } else if (data.Schematic) {
            return this.readSpongeFormat(data.Schematic);
        } else if (data.Version) {
            return this.readModernFormat(data);
        } else {
            return this.readClassicFormat(data);
        }
    }

    async readModernFormat(data) {
        const palette = new Map();
        const blockData = [];
        const metadata = {
            version: data.Version || this.version,
            author: data.Author || 'Unknown',
            date: data.Date || new Date().toISOString()
        };

        for (const [key, value] of Object.entries(data.Palette || {})) {
            const blockState = this.parseBlockState(key);
            palette.set(value, blockState);
        }

        const size = new Vec3(
            data.Width || data.width || 0,
            data.Height || data.height || 0,
            data.Length || data.length || 0
        );

        const blocks = data.Blocks || data.BlockData || [];
        const blockStates = data.BlockStates || [];

        if (blockStates.length > 0) {
            for (let i = 0; i < blocks.length; i++) {
                const state = blockStates[i];
                const block = palette.get(state) || { name: 'air' };
                blockData.push({
                    x: i % size.x,
                    y: Math.floor(i / (size.x * size.z)),
                    z: Math.floor(i / size.x) % size.z,
                    state: block,
                    metadata: {}
                });
            }
        } else {
            for (let i = 0; i < blocks.length; i++) {
                const block = palette.get(blocks[i]) || { name: 'air' };
                blockData.push({
                    x: i % size.x,
                    y: Math.floor(i / (size.x * size.z)),
                    z: Math.floor(i / size.x) % size.z,
                    state: block,
                    metadata: {}
                });
            }
        }

        return {
            version: metadata.version,
            size,
            offset: new Vec3(
                data.WEOffsetX || 0,
                data.WEOffsetY || 0,
                data.WEOffsetZ || 0
            ),
            blocks: blockData,
            palette,
            metadata
        };
    }

    readSpongeFormat(data) {
        const palette = new Map();
        const blockData = [];
        const metadata = {
            version: data.Version || this.version,
            author: data.Author || 'Unknown',
            date: data.Date || new Date().toISOString()
        };

        const size = new Vec3(
            data.Width.value,
            data.Height.value,
            data.Length.value
        );

        for (const [id, block] of Object.entries(data.Palette.value)) {
            palette.set(parseInt(id), this.parseBlockState(block.value));
        }

        const blocks = data.BlockData.value;
        for (let i = 0; i < blocks.length; i++) {
            const block = palette.get(blocks[i]) || { name: 'air' };
            blockData.push({
                x: i % size.x,
                y: Math.floor(i / (size.x * size.z)),
                z: Math.floor(i / size.x) % size.z,
                state: block,
                metadata: {}
            });
        }

        return {
            version: metadata.version,
            size,
            offset: new Vec3(
                data.Offset ? data.Offset.value[0] : 0,
                data.Offset ? data.Offset.value[1] : 0,
                data.Offset ? data.Offset.value[2] : 0
            ),
            blocks: blockData,
            palette,
            metadata
        };
    }

    readLitematicFormat(data) {
        const regions = data.Regions.value;
        const mainRegion = regions[Object.keys(regions)[0]];
        
        const size = new Vec3(
            mainRegion.Size.value[0],
            mainRegion.Size.value[1],
            mainRegion.Size.value[2]
        );

        const palette = new Map();
        const blockData = [];
        
        for (const [id, blockState] of Object.entries(mainRegion.BlockStatePalette.value)) {
            palette.set(parseInt(id), this.parseBlockState(blockState.value));
        }

        const blocks = mainRegion.BlockStates.value;
        const bitsPerBlock = Math.ceil(Math.log2(palette.size));
        const blocksPerLong = Math.floor(64 / bitsPerBlock);
        const mask = (1n << BigInt(bitsPerBlock)) - 1n;

        let blockIndex = 0;
        for (let i = 0; i < blocks.length; i++) {
            let bits = BigInt(blocks[i]);
            for (let j = 0; j < blocksPerLong && blockIndex < size.x * size.y * size.z; j++) {
                const stateId = Number(bits & mask);
                const block = palette.get(stateId) || { name: 'air' };
                
                blockData.push({
                    x: blockIndex % size.x,
                    y: Math.floor(blockIndex / (size.x * size.z)),
                    z: Math.floor(blockIndex / size.x) % size.z,
                    state: block,
                    metadata: {}
                });

                bits = bits >> BigInt(bitsPerBlock);
                blockIndex++;
            }
        }

        return {
            version: this.version,
            size,
            offset: new Vec3(
                mainRegion.Position ? mainRegion.Position.value[0] : 0,
                mainRegion.Position ? mainRegion.Position.value[1] : 0,
                mainRegion.Position ? mainRegion.Position.value[2] : 0
            ),
            blocks: blockData,
            palette,
            metadata: {
                author: data.Author || 'Unknown',
                description: data.Description || '',
                name: data.Name || 'Unnamed'
            }
        };
    }

    readClassicFormat(data) {
        const size = new Vec3(
            data.Width.value,
            data.Height.value,
            data.Length.value
        );

        const blocks = data.Blocks.value;
        const metadata = data.Data ? data.Data.value : new Array(blocks.length).fill(0);
        const blockData = [];
        const palette = new Map();

        for (let i = 0; i < blocks.length; i++) {
            const id = blocks[i];
            const meta = metadata[i];
            const blockState = this.createClassicBlockState(id, meta);
            
            if (!palette.has(id)) {
                palette.set(id, blockState);
            }

            blockData.push({
                x: i % size.x,
                y: Math.floor(i / (size.x * size.z)),
                z: Math.floor(i / size.x) % size.z,
                state: blockState,
                metadata: { data: meta }
            });
        }

        return {
            version: this.version,
            size,
            offset: new Vec3(
                data.WEOffsetX ? data.WEOffsetX.value : 0,
                data.WEOffsetY ? data.WEOffsetY.value : 0,
                data.WEOffsetZ ? data.WEOffsetZ.value : 0
            ),
            blocks: blockData,
            palette,
            metadata: {
                materials: data.Materials ? data.Materials.value : 'Alpha',
                author: 'Unknown',
                date: new Date().toISOString()
            }
        };
    }

    parseBlockState(state) {
        if (typeof state === 'string') {
            const [name, ...properties] = state.split('[');
            const blockState = { name };

            if (properties.length > 0) {
                const props = properties[0].slice(0, -1).split(',');
                props.forEach(prop => {
                    const [key, value] = prop.split('=');
                    blockState[key.trim()] = value.trim();
                });
            }

            return blockState;
        }
        return state;
    }

    createClassicBlockState(id, meta) {
        return {
            name: this.getClassicBlockName(id),
            metadata: meta
        };
    }

    getClassicBlockName(id) {
        // This would need a complete mapping of classic block IDs to modern names
        const classicBlocks = {
            0: 'air',
            1: 'stone',
            2: 'grass_block',
            3: 'dirt',
            // Add more mappings as needed
        };
        return classicBlocks[id] || 'unknown';
    }

    detectFormat(buffer) {
        try {
            const signature = buffer.slice(0, 2).toString('hex');
            if (signature === '1f8b') return 'schem'; // Gzipped
            if (buffer.slice(0, 4).toString() === 'SCHM') return 'litematic';
            return 'schematic'; // Default format
        } catch (error) {
            return 'unknown';
        }
    }
}

module.exports = SchematicReader;