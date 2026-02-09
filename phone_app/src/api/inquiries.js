import client from './client';

export async function submitInquiry(payload) {
  const response = await client.post('/api/inquiries/', payload);
  return response.data;
}
