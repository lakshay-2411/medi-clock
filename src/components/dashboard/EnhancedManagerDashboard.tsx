'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import RealTimeDashboard from '../RealTimeDashboard';
import { format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement
);

interface DashboardStats {
  totalStaff: number;
  currentlyClocked: number;
  todayShifts: number;
  averageHours: number;
}

interface StaffAnalytics {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  totalHours: number;
  averageDailyHours: number;
  totalShifts: number;
  weeklyHours: number;
}

interface DailyStats {
  date: string;
  clockInCount: number;
  totalHours: number;
  averageHours: number;
}

interface CurrentShift {
  id: string;
  clockInTime: string;
  clockInNote?: string;
  clockInLat: number;
  clockInLng: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Shift {
  id: string;
  clockInTime: string;
  clockOutTime?: string;
  clockInNote?: string;
  clockOutNote?: string;
  totalHours?: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const EnhancedManagerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staffAnalytics, setStaffAnalytics] = useState<StaffAnalytics[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [currentlyClocked, setCurrentlyClocked] = useState<CurrentShift[]>([]);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [staffFilter, setStaffFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Organization perimeter settings
  const [organization, setOrganization] = useState<any>(null);
  const [perimeterForm, setPerimeterForm] = useState({
    locationLat: 0,
    locationLng: 0,
    perimeterRadius: 100
  });

  useEffect(() => {
    if (user?.auth0Id) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user?.auth0Id) return;
    
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      const [
        statsResponse,
        staffResponse,
        clockedResponse,
        staffAnalyticsResponse,
        dailyStatsResponse,
        organizationResponse
      ] = await Promise.all([
        fetch('/api/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `
              query DashboardStatsByAuth0Id($auth0Id: String!) {
                dashboardStatsByAuth0Id(auth0Id: $auth0Id) {
                  totalStaff
                  currentlyClocked
                  todayShifts
                  averageHours
                }
              }
            `,
            variables: { auth0Id: user.auth0Id },
          }),
        }),
        fetch('/api/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `
              query AllStaffByAuth0Id($auth0Id: String!) {
                allStaffByAuth0Id(auth0Id: $auth0Id) {
                  id
                  name
                  email
                  role
                  shifts {
                    id
                    clockInTime
                    clockOutTime
                  }
                }
              }
            `,
            variables: { auth0Id: user.auth0Id },
          }),
        }),
        fetch('/api/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `
              query CurrentlyClockedByAuth0Id($auth0Id: String!) {
                currentlyClockedByAuth0Id(auth0Id: $auth0Id) {
                  id
                  clockInTime
                  clockInNote
                  clockInLat
                  clockInLng
                  user {
                    id
                    name
                    email
                  }
                }
              }
            `,
            variables: { auth0Id: user.auth0Id },
          }),
        }),
        fetch('/api/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `
              query StaffAnalyticsByAuth0Id($auth0Id: String!) {
                staffAnalyticsByAuth0Id(auth0Id: $auth0Id) {
                  userId
                  user {
                    id
                    name
                    email
                  }
                  totalHours
                  averageDailyHours
                  totalShifts
                  weeklyHours
                }
              }
            `,
            variables: { auth0Id: user.auth0Id },
          }),
        }),
        fetch('/api/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `
              query DailyStatsByAuth0Id($auth0Id: String!) {
                dailyStatsByAuth0Id(auth0Id: $auth0Id, days: 7) {
                  date
                  clockInCount
                  totalHours
                  averageHours
                }
              }
            `,
            variables: { auth0Id: user.auth0Id },
          }),
        }),
        fetch('/api/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `
              query OrganizationByAuth0Id($auth0Id: String!) {
                organizationByAuth0Id(auth0Id: $auth0Id) {
                  id
                  name
                  locationLat
                  locationLng
                  perimeterRadius
                }
              }
            `,
            variables: { auth0Id: user.auth0Id },
          }),
        }),
      ]);

      const [statsResult, staffResult, clockedResult, staffAnalyticsResult, dailyResult, orgResult] = await Promise.all([
        statsResponse.json(),
        staffResponse.json(),
        clockedResponse.json(),
        staffAnalyticsResponse.json(),
        dailyStatsResponse.json(),
        organizationResponse.json(),
      ]);

      if (statsResult.data?.dashboardStatsByAuth0Id) {
        setStats(statsResult.data.dashboardStatsByAuth0Id);
      }

      if (staffResult.data?.allStaffByAuth0Id) {
        setAllStaff(staffResult.data.allStaffByAuth0Id);
      }

      if (clockedResult.data?.currentlyClockedByAuth0Id) {
        setCurrentlyClocked(clockedResult.data.currentlyClockedByAuth0Id);
      }

      if (staffAnalyticsResult.data?.staffAnalyticsByAuth0Id) {
        setStaffAnalytics(staffAnalyticsResult.data.staffAnalyticsByAuth0Id);
      }

      if (dailyResult.data?.dailyStatsByAuth0Id) {
        setDailyStats(dailyResult.data.dailyStatsByAuth0Id);
      }

      if (orgResult.data?.organizationByAuth0Id) {
        const org = orgResult.data.organizationByAuth0Id;
        setOrganization(org);
        setPerimeterForm({
          locationLat: org.locationLat,
          locationLng: org.locationLng,
          perimeterRadius: org.perimeterRadius
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftHistory = async () => {
    if (!user?.auth0Id) return;
    
    try {
      const filter: any = {};
      if (selectedUserId) filter.userId = selectedUserId;
      if (dateRange.start) filter.startDate = new Date(dateRange.start).toISOString();
      if (dateRange.end) filter.endDate = new Date(dateRange.end).toISOString();

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query ShiftHistoryByAuth0Id($auth0Id: String!, $filter: ShiftHistoryFilter) {
              shiftHistoryByAuth0Id(auth0Id: $auth0Id, filter: $filter) {
                id
                clockInTime
                clockOutTime
                clockInNote
                clockOutNote
                totalHours
                user {
                  id
                  name
                  email
                }
              }
            }
          `,
          variables: { auth0Id: user.auth0Id, filter },
        }),
      });

      const result = await response.json();
      if (result.data?.shiftHistoryByAuth0Id) {
        setShiftHistory(result.data.shiftHistoryByAuth0Id);
      }
    } catch (error) {
      console.error('Error fetching shift history:', error);
    }
  };

  const updatePerimeter = async () => {
    if (!user?.auth0Id) return;
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation UpdatePerimeterByAuth0Id($auth0Id: String!, $input: UpdatePerimeterInput!) {
              updatePerimeterByAuth0Id(auth0Id: $auth0Id, input: $input) {
                id
                locationLat
                locationLng
                perimeterRadius
              }
            }
          `,
          variables: { auth0Id: user.auth0Id, input: perimeterForm },
        }),
      });

      const result = await response.json();
      if (result.data?.updatePerimeterByAuth0Id) {
        setOrganization(result.data.updatePerimeterByAuth0Id);
        alert('Perimeter updated successfully!');
      }
    } catch (error) {
      console.error('Error updating perimeter:', error);
      alert('Error updating perimeter');
    }
  };

  const exportData = () => {
    const data = {
      stats,
      staffAnalytics,
      dailyStats,
      currentlyClocked,
      shiftHistory,
      generatedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medi-clock-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (timeString: string) => {
    return format(new Date(timeString), 'h:mm a');
  };

  const calculateHoursWorked = (clockInTime: string) => {
    const now = new Date();
    const clockIn = new Date(clockInTime);
    const hours = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  const filteredStaff = staffAnalytics.filter(staff =>
    staff.user.name.toLowerCase().includes(staffFilter.toLowerCase()) ||
    staff.user.email.toLowerCase().includes(staffFilter.toLowerCase())
  );

  // Chart data
  const dailyChartData = {
    labels: dailyStats.map(day => format(new Date(day.date), 'MMM dd')),
    datasets: [
      {
        label: 'Clock-ins',
        data: dailyStats.map(day => day.clockInCount),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const hoursChartData = {
    labels: dailyStats.map(day => format(new Date(day.date), 'MMM dd')),
    datasets: [
      {
        label: 'Total Hours',
        data: dailyStats.map(day => day.totalHours),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const staffHoursData = {
    labels: filteredStaff.map(staff => staff.user.name.split(' ')[0]),
    datasets: [
      {
        label: 'Weekly Hours',
        data: filteredStaff.map(staff => staff.weeklyHours),
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 1,
      },
    ],
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
              <p className="text-gray-600">Welcome, {user?.name}</p>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={exportData}>
                Export Data
              </Button>
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: 'Overview' },
                { id: 'realtime', name: 'Real-Time Tracking' },
                { id: 'analytics', name: 'Analytics' },
                { id: 'staff', name: 'Staff Management' },
                { id: 'shifts', name: 'Shift History' },
                { id: 'settings', name: 'Settings' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">{stats.totalStaff}</p>
                    <p className="text-gray-600">Total Staff</p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{stats.currentlyClocked}</p>
                    <p className="text-gray-600">Currently Clocked In</p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-600">{stats.todayShifts}</p>
                    <p className="text-gray-600">Today's Shifts</p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-600">{stats.averageHours.toFixed(1)}h</p>
                    <p className="text-gray-600">Average Hours</p>
                  </div>
                </Card>
              </div>
            )}

            {/* Currently Clocked In Staff */}
            <Card>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Currently Clocked In</h2>
                  <Button onClick={fetchDashboardData} variant="outline" size="sm">
                    Refresh
                  </Button>
                </div>

                {currentlyClocked.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No staff currently clocked in</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Staff Member
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Clock In Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Hours Worked
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Note
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentlyClocked.map((shift) => (
                          <tr key={shift.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {shift.user.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {shift.user.email}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatTime(shift.clockInTime)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {calculateHoursWorked(shift.clockInTime)}h
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {shift.clockInLat.toFixed(4)}, {shift.clockInLng.toFixed(4)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {shift.clockInNote || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Real-Time Tracking Tab */}
        {activeTab === 'realtime' && (
          <div className="space-y-6">
            <RealTimeDashboard organizationId={organization?.id || 'default'} />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <h3 className="text-lg font-semibold mb-4">Daily Clock-ins (Last 7 Days)</h3>
                <Bar data={dailyChartData} />
              </Card>
              <Card>
                <h3 className="text-lg font-semibold mb-4">Daily Hours Worked</h3>
                <Line data={hoursChartData} />
              </Card>
            </div>
            <Card>
              <h3 className="text-lg font-semibold mb-4">Staff Weekly Hours</h3>
              <Bar data={staffHoursData} />
            </Card>
          </div>
        )}

        {/* Staff Management Tab */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <Card>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Staff Analytics</h2>
                  <Input
                    placeholder="Search staff..."
                    value={staffFilter}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStaffFilter(e.target.value)}
                    className="w-64"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Staff Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Hours
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Daily Hours
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Weekly Hours
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Shifts
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStaff.map((staff) => (
                        <tr key={staff.userId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {staff.user.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {staff.user.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.totalHours}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.averageDailyHours}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.weeklyHours}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {staff.totalShifts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Shift History Tab */}
        {activeTab === 'shifts' && (
          <div className="space-y-6">
            <Card>
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Shift History</h2>
                
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">All Staff</option>
                    {staffAnalytics.map((staff) => (
                      <option key={staff.userId} value={staff.userId}>
                        {staff.user.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <Button onClick={fetchShiftHistory}>
                    Search
                  </Button>
                </div>

                {/* Shift History Table */}
                {shiftHistory.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Staff Member
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Clock In
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Clock Out
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Hours
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {shiftHistory.map((shift) => (
                          <tr key={shift.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {shift.user.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {format(new Date(shift.clockInTime), 'MMM dd, yyyy h:mm a')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {shift.clockOutTime ? format(new Date(shift.clockOutTime), 'MMM dd, yyyy h:mm a') : 'Still clocked in'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {shift.totalHours ? `${shift.totalHours}h` : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div>
                                {shift.clockInNote && <div><strong>In:</strong> {shift.clockInNote}</div>}
                                {shift.clockOutNote && <div><strong>Out:</strong> {shift.clockOutNote}</div>}
                                {!shift.clockInNote && !shift.clockOutNote && '-'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <Card>
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Location Perimeter Settings</h2>
                
                {organization && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={perimeterForm.locationLat}
                        onChange={(e) => setPerimeterForm(prev => ({ ...prev, locationLat: parseFloat(e.target.value) }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={perimeterForm.locationLng}
                        onChange={(e) => setPerimeterForm(prev => ({ ...prev, locationLng: parseFloat(e.target.value) }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Perimeter Radius (meters)</label>
                      <input
                        type="number"
                        value={perimeterForm.perimeterRadius}
                        onChange={(e) => setPerimeterForm(prev => ({ ...prev, perimeterRadius: parseInt(e.target.value) }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-4">
                  <Button onClick={updatePerimeter}>
                    Update Perimeter
                  </Button>
                  <Button variant="outline" onClick={() => window.open('file:///c:/Users/laksh/OneDrive/Desktop/medi-clock/get-location.html', '_blank')}>
                    Get Current Location
                  </Button>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    <strong>Current Perimeter:</strong> Workers can only clock in within {organization?.perimeterRadius || 0} meters 
                    of coordinates ({organization?.locationLat || 0}, {organization?.locationLng || 0})
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedManagerDashboard;
