// Firebase Auth throws errors carrying opaque codes like `auth/wrong-password`.
// Showing those raw to a user is useless, so this maps the ones a real person
// can actually hit to plain language. Pure and store-free so it can be unit
// tested without touching Firebase.

const MESSAGES = {
  'auth/invalid-email': 'That doesn\'t look like a valid email address.',
  'auth/user-disabled': 'That account has been disabled.',
  'auth/user-not-found': 'No account found with that email. Try creating one instead.',
  'auth/wrong-password': 'Incorrect password. Try again, or reset it below.',
  // Newer Firebase versions collapse user-not-found and wrong-password into
  // this single code on purpose, so an attacker can't probe which emails are
  // registered. The message has to stay vague for the same reason.
  'auth/invalid-credential': 'That email and password don\'t match an account.',
  'auth/email-already-in-use': 'An account already exists with that email. Try signing in instead.',
  'auth/weak-password': 'Please choose a password at least 6 characters long.',
  'auth/missing-password': 'Please enter a password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Couldn\'t reach the server. Check your connection and try again.',
  // The user closed the Google/Apple popup themselves — not worth an alarming
  // error, but the form still needs to come out of its loading state.
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
  'auth/operation-not-allowed': 'That sign-in method isn\'t enabled for this app yet.',
  'auth/account-exists-with-different-credential': 'You already have an account with that email, but it uses a different sign-in method. Sign in that way instead.'
};

export const CANCELLED_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

export function friendlyAuthError (error) {
  const code = error?.code;

  if (code && MESSAGES[code]) {
    return MESSAGES[code];
  }

  // Non-Firebase errors thrown by our own code (e.g. a provider that returned
  // no email address) carry a real message worth surfacing as-is.
  if (error?.message && !code) {
    return error.message;
  }

  return 'Something went wrong signing in. Please try again.';
}
