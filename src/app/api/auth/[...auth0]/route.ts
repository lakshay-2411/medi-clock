import { handleAuth, handleLogin, handleLogout, handleCallback } from '@auth0/nextjs-auth0';
import { NextRequest } from 'next/server';

export const GET = handleAuth({
  login: handleLogin({
    returnTo: '/auth/role-selection'
  }),
  logout: handleLogout({
    returnTo: '/'
  }),
  callback: handleCallback({
    afterCallback: async (req: NextRequest, session: any) => {
      // This will be called after successful authentication
      return session;
    }
  })
});
