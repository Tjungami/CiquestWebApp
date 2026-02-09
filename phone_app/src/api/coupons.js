import client from './client';

export async function useCoupon(payload) {
  const response = await client.post('/api/user-coupons/use/', payload);
  return response.data;
}

export async function fetchUserCouponHistory() {
  const response = await client.get('/api/user-coupons/history/');
  return Array.isArray(response.data) ? response.data : [];
}
