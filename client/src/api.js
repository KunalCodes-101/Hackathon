import axios from 'axios';

const getDefaultApiUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};

export const API_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();
const FALLBACK_API_URL =
  typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'http://127.0.0.1:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`
});

const fallbackApi = axios.create({
  baseURL: `${FALLBACK_API_URL}/api`
});

for (const client of [api, fallbackApi]) {
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('founderos-token') || '';
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

async function requestWithLocalFallback(request) {
  try {
    const { data } = await request(api);
    return data;
  } catch (error) {
    const canRetry = !error.response && API_URL !== FALLBACK_API_URL;
    if (!canRetry) throw error;
    const { data } = await request(fallbackApi);
    return data;
  }
}

export async function createAnalysis(idea, region, budget = 0, ownsPlace = false) {
  const data = await requestWithLocalFallback((client) => client.post('/analyses', { idea, region, budget, ownsPlace }));
  return data.analysis;
}

export async function getAnalysis(id) {
  const data = await requestWithLocalFallback((client) => client.get(`/analyses/${id}`));
  return data.analysis;
}

export async function listAnalyses() {
  const data = await requestWithLocalFallback((client) => client.get('/analyses'));
  return data.analyses;
}

export async function signup(payload) {
  return requestWithLocalFallback((client) => client.post('/auth/signup', payload));
}

export async function signin(payload) {
  return requestWithLocalFallback((client) => client.post('/auth/signin', payload));
}

export async function getMe() {
  const data = await requestWithLocalFallback((client) => client.get('/auth/me'));
  return data.user;
}

export async function approveStartup(id) {
  const data = await requestWithLocalFallback((client) => client.post(`/analyses/${id}/approve`));
  return data;
}

export async function listJobs(region = '') {
  const data = await requestWithLocalFallback((client) => client.get('/jobs', { params: region ? { region } : {} }));
  return data;
}

export async function applyForJob(id, note = '') {
  return requestWithLocalFallback((client) => client.post(`/jobs/${id}/apply`, { note }));
}
