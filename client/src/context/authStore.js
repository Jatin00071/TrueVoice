import { createContext } from 'react';

export const AuthContext = createContext(null);

let latestAuth = null;

export function getAuthContext() {
  return latestAuth;
}

export function setAuthContext(value) {
  latestAuth = value;
}
