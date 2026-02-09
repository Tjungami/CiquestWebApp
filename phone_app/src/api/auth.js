import client from './client';

const LOGIN_PATH = '/api/login/';
const GOOGLE_LOGIN_PATH = '/api/login/google/';
const REGISTER_PATH = '/api/users/';

export async function loginUser({ email, password }) {
  const response = await client.post(LOGIN_PATH, { email, password });
  return response.data;
}

export async function loginWithGoogle({ idToken, accessToken }) {
  const payload = {
    ...(idToken ? { id_token: idToken } : {}),
    ...(accessToken ? { access_token: accessToken } : {}),
  };
  const response = await client.post(GOOGLE_LOGIN_PATH, payload);
  return response.data;
}

export async function registerUser({ username, email, password }) {
  const response = await client.post(REGISTER_PATH, { username, email, password });
  return response.data;
}
