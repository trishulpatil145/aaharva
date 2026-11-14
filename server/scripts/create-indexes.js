import mongoose from 'mongoose';
import '../src/models/index.js';
import { connectDatabase, closeDatabase } from '../src/config/database.js';

async function main() {
  await connectDatabase();
  const models = Object.values(mongoose.models);
  for (const model of models) {
    await model.createIndexes();
    console.info(`[aaharva] Ensured indexes for ${model.modelName}.`);
  }
  console.info(`[aaharva] Index creation complete for ${models.length} models.`);
}

main().catch(err => {
  console.error(`[aaharva] Index setup failed: ${err.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await closeDatabase().catch(() => {});
});
