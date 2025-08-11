'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';
import { AuthUser, UserRole } from '../types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: () => void;
  logout: () => void;
  updateUserRole: (role: UserRole, organizationId: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: auth0User, error: auth0Error, isLoading } = useUser();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function syncUserWithDatabase() {
      if (auth0User && !isLoading) {
        try {
          // Check if user exists in our database
          const response = await fetch('/api/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                query GetUserByAuth0Id($auth0Id: String!) {
                  getUserByAuth0Id(auth0Id: $auth0Id) {
                    id
                    email
                    name
                    role
                    organizationId
                    auth0Id
                    picture
                  }
                }
              `,
              variables: { auth0Id: auth0User.sub },
            }),
          });

          const result = await response.json();
          
          if (result.data?.getUserByAuth0Id) {
            // User exists in database
            setUser(result.data.getUserByAuth0Id);
            
            // Redirect based on role
            const userRole = result.data.getUserByAuth0Id.role;
            if (userRole === 'MANAGER') {
              router.push('/dashboard');
            } else {
              router.push('/clock');
            }
          } else {
            // User doesn't exist in database, redirect to role selection
            router.push('/auth/role-selection');
          }
        } catch (err) {
          setError('Failed to sync user data');
          console.error('Error syncing user:', err);
        }
        setLoading(false);
      } else if (!isLoading && !auth0User) {
        setLoading(false);
        setUser(null);
      }
    }

    syncUserWithDatabase();
  }, [auth0User, isLoading, router]);

  useEffect(() => {
    if (auth0Error) {
      setError(auth0Error.message);
    }
  }, [auth0Error]);

  const login = () => {
    window.location.href = '/api/auth/login';
  };

  const logout = () => {
    setUser(null);
    window.location.href = '/api/auth/logout';
  };

  const updateUserRole = async (role: UserRole, organizationId: string) => {
    if (!auth0User) {
      throw new Error('No authenticated user');
    }

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation CreateOrUpdateUser($input: CreateUserInput!) {
              createOrUpdateUser(input: $input) {
                id
                email
                name
                role
                organizationId
                auth0Id
                picture
              }
            }
          `,
          variables: {
            input: {
              auth0Id: auth0User.sub,
              email: auth0User.email,
              name: auth0User.name || auth0User.email,
              picture: auth0User.picture,
              role,
              organizationId,
            },
          },
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const updatedUser = result.data.createOrUpdateUser;
      setUser(updatedUser);
      
      // Redirect based on role
      if (role === 'MANAGER') {
        router.push('/dashboard');
      } else {
        router.push('/clock');
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!auth0User && !!user,
        login,
        logout,
        updateUserRole,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
