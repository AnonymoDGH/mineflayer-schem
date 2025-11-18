const nbt = require('prismarine-nbt');

class SchematicReader {
    static async read(buffer) {
        try {
            const { parsed, type } = await nbt.parse(buffer);
            
            console.log('📦 NBT Type:', type);
            console.log('📦 Keys found:', Object.keys(parsed.value || parsed));

            const data = parsed.value || parsed;

            if (!data.Width || !data.Height || !data.Length || !data.Blocks) {
                console.error('❌ Schematic structure:');
                console.error(JSON.stringify(Object.keys(data), null, 2));
                throw new Error('The schematic does not have the expected format (MCEdit/WorldEdit)');
            }

            const schematic = {
                width: data.Width.value,
                height: data.Height.value,
                length: data.Length.value,
                blocks: Array.from(data.Blocks.value),
                data: data.Data ? Array.from(data.Data.value) : [],
                materials: data.Materials ? data.Materials.value : 'Alpha'
            };

            console.log('✅ Schematic parsed:');
            console.log(`   Dimensions: ${schematic.width}x${schematic.height}x${schematic.length}`);
            console.log(`   Blocks: ${schematic.blocks.length}`);
            console.log(`   Material: ${schematic.materials}`);

            return schematic;

        } catch (error) {
            console.error('❌ Detailed error:', error);
            throw new Error(`Error reading schematic: ${error.message}`);
        }
    }
}

module.exports = SchematicReader;
