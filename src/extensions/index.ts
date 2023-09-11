import { Request } from 'express';
import {generateFetch} from "express-solid-auth-wrapper"

export interface TokenSession {
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  info: info
}

interface info {
  webId: string,
  isLoggedIn: boolean
}
 
declare global {
  namespace Express { 
    interface Request {
      auth: {
        webId: string;
        clientId: string;
      };
      fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    }
  }
  function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  var session: any
} 