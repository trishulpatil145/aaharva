import mongoose from 'mongoose';
import { getConfig } from './env.js';

const config = getConfig();

export async function connectDatabase() {
  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    dbName: config.mongoDbName,
    serverSelectionTimeoutMS: 5000,
    autoIndex: config.nodeEnv !== 'production'
  });
  return mongoose.connection;
}

export function databaseStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return { state: states[mongoose.connection.readyState] || 'unknown', connected: mongoose.connection.readyState === 1, database: mongoose.connection.name || config.mongoDbName };
}

export async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
