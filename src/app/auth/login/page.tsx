'use client';

import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';

export default function LoginPage() {
  const { login, loading } = useAuth();

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
            Sign in to MediClock
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Secure time tracking for healthcare workers
          </p>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Care Worker</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Clock in/out and track your shifts
                </p>
                <Button
                  onClick={login}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Sign In with Auth0
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Manager</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Access administrative features and analytics
                </p>
                <Button
                  onClick={() => window.location.href = '/auth/manager-signin'}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Manager Sign In
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Powered by Auth0 for secure authentication
          </p>
        </div>
      </div>
    </div>
  );
}
