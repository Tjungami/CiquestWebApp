import client from './client';

export async function fetchUserBadges() {
  const response = await client.get('/api/user-badges/');
  return response.data;
}
