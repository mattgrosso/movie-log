import axios from 'axios';
import { getAuth } from 'firebase/auth';

// Every call behind VUE_APP_AI_API_URL costs real money per request, and that
// URL is baked into the public client bundle — so the endpoint verifies a
// Firebase ID token and rate-limits per user (see aws-lambda/claude-ai.js).
// This is the one place that attaches the token, so no caller can forget.
//
// Throws if there's no signed-in user rather than firing a request that would
// come back 401 anyway. Callers already treat a failure as "no suggestions".
export async function postToAi (route, payload) {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('Not signed in — AI features need an authenticated user.');
  }

  // Firebase refreshes this automatically when it's close to expiring, so this
  // is cheap to call per request and always returns something valid.
  const idToken = await user.getIdToken();

  return axios.post(`${process.env.VUE_APP_AI_API_URL}${route}`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    }
  });
}
