import client from './client';

export async function clearUserChallenge(payload) {
  const response = await client.post('/api/user-challenges/clear/', payload);
  return response.data;
}
