'use client';

import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';

export default function ManagerSignInPage() {
  const { login, loading, error } = useAuth();
  const [managerCode, setManagerCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MANAGER_CODE = 'MANAGER2025';

  const handleManagerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (managerCode !== MANAGER_CODE) {
      alert('Invalid manager code. Please contact administration.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Store manager intent in session storage
      sessionStorage.setItem('managerIntent', 'true');
      login(); // This will redirect to Auth0 login
    } catch (err) {
      console.error('Error initiating manager sign-in:', err);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Manager Sign In
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the manager code to access administrative features
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        <Card className="p-6">
          <form onSubmit={handleManagerSignIn} className="space-y-6">
            <div>
              <label htmlFor="managerCode" className="block text-sm font-medium text-gray-700">
                Manager Code
              </label>
              <div className="mt-1">
                <Input
                  id="managerCode"
                  name="managerCode"
                  type="password"
                  required
                  value={managerCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManagerCode(e.target.value)}
                  placeholder="Enter manager code"
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                disabled={isSubmitting || !managerCode.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? 'Verifying...' : 'Continue to Auth0 Sign In'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/auth/login"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Back to regular sign in
            </a>
          </div>
        </Card>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            For administrative access only. Contact your system administrator if you need help.
          </p>
        </div>
      </div>
    </div>
  );
}
