import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`
});

export async function createAnalysis(idea, region) {
  const { data } = await api.post('/analyses', { idea, region });
  return data.analysis;
}

export async function getAnalysis(id) {
  const { data } = await api.get(`/analyses/${id}`);
  return data.analysis;
}

export async function listAnalyses() {
  const { data } = await api.get('/analyses');
  return data.analyses;
}
