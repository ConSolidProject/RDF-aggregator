import {v4} from "uuid"
import {fetch} from "cross-fetch"

async function generateFetch(email: string, password: string, idp: string) {
    try {
  
        if (!idp.endsWith("/")) idp += '/'
        const response = await fetch(`${idp}idp/credentials/`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password, name: v4() }),
        });
    
        const {id, secret}= await response.json();
    
        const tokenUrl = `${idp}.oidc/token`;
        const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
  
        const r = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                // The header needs to be in base64 encoding.
                authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
                'content-type': 'application/x-www-form-urlencoded',
                // dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
            },
            body: 'grant_type=client_credentials&scope=webid',
        });
        const {access_token} = await r.json();
        const bearer = `Bearer ${access_token}`

        const defaultFetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
          const headers: any = init?.headers || {};
          headers['Authorization'] = bearer;
  
          const updatedInit: RequestInit = {
            ...init,
            headers,
          };
  
          return fetch(input, updatedInit);
        };
  
        return {authFetch: defaultFetch, bearer}
  
    } catch (error) {
        console.log('error', error)
        throw error
    }
  }

export {generateFetch}