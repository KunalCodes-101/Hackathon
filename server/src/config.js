import dotenv from 'dotenv';

dotenv.config();

const splitList = (value) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) || [];

export const config = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/founderos',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  clientUrls: splitList(process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173'),
  port: Number(process.env.SERVER_PORT || 5000),
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000'
};
