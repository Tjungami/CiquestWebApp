import client from './client';

export async function scanStoreStamp(payload) {
  const response = await client.post('/api/stamps/scan/', payload);
  return response.data;
}

export function isStampCooldownError(error) {
  const message = String(error?.message || '');
  return message.includes('Already stamped within 4 hours');
}
