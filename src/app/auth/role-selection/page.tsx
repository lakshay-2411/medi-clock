'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { UserRole } from '../../../types';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';

const MOCK_ORGANIZATION = {
  id: 'org_1',
  name: 'HealthCare Plus',
  locationLat: 40.7128,
  locationLng: -74.0060,
  perimeterRadius: 100,
};

export default function RoleSelectionPage() {
  const { updateUserRole, loading, error } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManagerIntent, setIsManagerIntent] = useState(false);

  useEffect(() => {
    const managerIntent = sessionStorage.getItem('managerIntent');
    if (managerIntent === 'true') {
      setIsManagerIntent(true);
      sessionStorage.removeItem('managerIntent');
    }
  }, []);

  const handleRoleSelection = async (role: UserRole) => {
    if (role === UserRole.MANAGER) {
      // Check if manager already exists
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query CheckManagerExists($organizationId: String!) {
                checkManagerExists(organizationId: $organizationId)
              }
            `,
            variables: { organizationId: MOCK_ORGANIZATION.id },
          }),
        });

        const result = await response.json();
        
        if (result.data?.checkManagerExists) {
          alert('A manager already exists for this organization. Please contact administration.');
          return;
        }
      } catch (err) {
        console.error('Error checking manager:', err);
        alert('Error checking manager status. Please try again.');
        return;
      }
    }

    setSelectedRole(role);
    setIsSubmitting(true);
    
    try {
      await updateUserRole(role, MOCK_ORGANIZATION.id);
    } catch (err) {
      console.error('Error updating user role:', err);
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
            {isManagerIntent ? 'Complete Manager Setup' : 'Select Your Role'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isManagerIntent 
              ? 'Setting up your manager account...' 
              : 'Choose your role to get started with MediClock'
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Manager</h3>
              <p className="text-sm text-gray-600 mb-4">
                Manage staff, view analytics, and oversee operations
              </p>
              <Button
                onClick={() => handleRoleSelection(UserRole.MANAGER)}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting && selectedRole === UserRole.MANAGER ? 'Setting up...' : 'Select Manager'}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Care Worker</h3>
              <p className="text-sm text-gray-600 mb-4">
                Clock in/out, track shifts, and manage your schedule
              </p>
              <Button
                onClick={() => handleRoleSelection(UserRole.CARE_WORKER)}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting && selectedRole === UserRole.CARE_WORKER ? 'Setting up...' : 'Select Care Worker'}
              </Button>
            </div>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Organization: {MOCK_ORGANIZATION.name}
          </p>
        </div>
      </div>
    </div>
  );
}
