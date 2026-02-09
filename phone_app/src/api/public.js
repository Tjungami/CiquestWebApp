import client from './client';

export async function fetchStores(params = {}) {
  const response = await client.get('/api/stores/', { params });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchCoupons(params = {}) {
  const response = await client.get('/api/coupons/', { params });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchChallenges(params = {}) {
  const response = await client.get('/api/challenges/', { params });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchStampSetting(params = {}) {
  const response = await client.get('/api/stamp-settings/', { params });
  return response.data || null;
}

export async function fetchNotices(params = {}) {
  const response = await client.get('/api/notices/', { params });
  return Array.isArray(response.data) ? response.data : [];
}
