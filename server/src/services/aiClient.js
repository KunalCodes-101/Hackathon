import axios from 'axios';
import { config } from '../config.js';

const client = axios.create({
  baseURL: config.aiServiceUrl,
  timeout: 120000
});

export async function runAgent({ idea, region, budget, ownsPlace, agent, context }) {
  const { data } = await client.post('/agent/run', {
    idea,
    region,
    budget,
    ownsPlace,
    agent,
    context
  });
  return data;
}
