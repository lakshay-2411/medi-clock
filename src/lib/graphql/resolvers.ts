import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';
import { prisma } from '../prisma';
import { generateToken, verifyToken, hashPassword, comparePassword, extractTokenFromHeader } from '../../utils/auth';
import { isWithinPerimeter } from '../../utils/location';
import { UserRole } from '../../types';
import { PubSub, withFilter } from 'graphql-subscriptions';

const pubsub = new PubSub();

// Subscription event constants
const SHIFT_UPDATED = 'SHIFT_UPDATED';
const STAFF_STATUS_CHANGED = 'STAFF_STATUS_CHANGED';
const LOCATION_UPDATE = 'LOCATION_UPDATE';
const GEOFENCE_ALERT = 'GEOFENCE_ALERT';
const REAL_TIME_STATS = 'REAL_TIME_STATS';

// Custom DateTime scalar
const DateTimeResolver = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type',
  serialize(value: any) {
    return value instanceof Date ? value.toISOString() : value;
  },
  parseValue(value: any) {
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

// Helper function to get user from context (JWT only - for backward compatibility)
async function getUser(context: any) {
  try {
    // Use JWT token for authentication
    const authHeader = context.req?.headers?.authorization || 
                      context.request?.headers?.authorization ||
                      context.headers?.authorization;
    
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      throw new Error('Authentication required');
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { organization: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw new Error('Authentication required');
  }
}

// Helper function to calculate shift duration
function calculateShiftHours(clockIn: Date, clockOut?: Date): number {
  const endTime = clockOut || new Date();
  const hours = (endTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

export const resolvers = {
  DateTime: DateTimeResolver,

  Query: {
    me: async (_: any, __: any, context: any) => {
      return await getUser(context);
    },

    getUserByAuth0Id: async (_: any, { auth0Id }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });

      return user;
    },

    checkManagerExists: async (_: any, { organizationId }: any) => {
      const manager = await prisma.user.findFirst({
        where: {
          organizationId,
          role: UserRole.MANAGER,
        },
      });

      return !!manager;
    },

    currentShiftByAuth0Id: async (_: any, { auth0Id }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
      });

      if (!user) {
        throw new Error('User not found');
      }
      
      const shift = await prisma.shift.findFirst({
        where: {
          userId: user.id,
          clockOutTime: null,
        },
        include: { user: true },
      });

      return shift;
    },

    myShiftsByAuth0Id: async (_: any, { auth0Id, limit = 10, offset = 0 }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
      });

      if (!user) {
        throw new Error('User not found');
      }
      
      const shifts = await prisma.shift.findMany({
        where: { userId: user.id },
        include: { user: true },
        orderBy: { clockInTime: 'desc' },
        take: limit,
        skip: offset,
      });

      return shifts;
    },

    currentShift: async (_: any, __: any, context: any) => {
      const user = await getUser(context);
      
      const shift = await prisma.shift.findFirst({
        where: {
          userId: user.id,
          clockOutTime: null,
        },
        include: { user: true },
      });

      return shift;
    },

    myShifts: async (_: any, { limit = 10, offset = 0 }: any, context: any) => {
      const user = await getUser(context);
      
      const shifts = await prisma.shift.findMany({
        where: { userId: user.id },
        include: { user: true },
        orderBy: { clockInTime: 'desc' },
        take: limit,
        skip: offset,
      });

      return shifts;
    },

    allStaff: async (_: any, __: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const staff = await prisma.user.findMany({
        where: { organizationId: user.organizationId },
        include: { organization: true, shifts: true },
      });

      return staff;
    },

    allStaffByAuth0Id: async (_: any, { auth0Id }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
      });

      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const staff = await prisma.user.findMany({
        where: { organizationId: user.organizationId },
        include: { organization: true, shifts: true },
      });

      return staff;
    },

    dashboardStatsByAuth0Id: async (_: any, { auth0Id }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
      });

      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const totalStaff = await prisma.user.count({
        where: { organizationId: user.organizationId },
      });

      const currentlyClocked = await prisma.shift.count({
        where: {
          user: { organizationId: user.organizationId },
          clockOutTime: null,
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayShifts = await prisma.shift.count({
        where: {
          user: { organizationId: user.organizationId },
          clockInTime: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      // Calculate average hours from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentShifts = await prisma.shift.findMany({
        where: {
          user: { organizationId: user.organizationId },
          clockInTime: { gte: thirtyDaysAgo },
          totalHours: { not: null },
        },
        select: { totalHours: true },
      });

      const averageHours = recentShifts.length > 0
        ? recentShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0) / recentShifts.length
        : 0;

      return {
        totalStaff,
        currentlyClocked,
        todayShifts,
        averageHours: Math.round(averageHours * 100) / 100,
      };
    },

    currentlyClocked: async (_: any, __: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const currentShifts = await prisma.shift.findMany({
        where: {
          user: { organizationId: user.organizationId },
          clockOutTime: null,
        },
        include: { user: true },
        orderBy: { clockInTime: 'desc' },
      });

      return currentShifts;
    },

    currentlyClockedByAuth0Id: async (_: any, { auth0Id }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });
      
      if (!user || user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const currentShifts = await prisma.shift.findMany({
        where: {
          user: { organizationId: user.organizationId },
          clockOutTime: null,
        },
        include: { user: true },
        orderBy: { clockInTime: 'desc' },
      });

      return currentShifts;
    },

    shiftHistory: async (_: any, { filter }: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER && filter?.userId && filter.userId !== user.id) {
        throw new Error('Access denied: Can only view own shifts');
      }

      const targetUserId = filter?.userId || user.id;
      const limit = filter?.limit || 20;
      const offset = filter?.offset || 0;
      
      const whereClause: any = { userId: targetUserId };
      
      if (filter?.startDate) {
        whereClause.clockInTime = { ...whereClause.clockInTime, gte: filter.startDate };
      }
      
      if (filter?.endDate) {
        whereClause.clockInTime = { ...whereClause.clockInTime, lte: filter.endDate };
      }
      
      const shifts = await prisma.shift.findMany({
        where: whereClause,
        include: { user: true },
        orderBy: { clockInTime: 'desc' },
        take: limit,
        skip: offset,
      });

      return shifts;
    },

    shiftHistoryByAuth0Id: async (_: any, { auth0Id, filter }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
      });
      
      if (!user || user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const targetUserId = filter?.userId || user.id;
      const limit = filter?.limit || 20;
      const offset = filter?.offset || 0;
      
      const whereClause: any = { userId: targetUserId };
      
      if (filter?.startDate) {
        whereClause.clockInTime = { ...whereClause.clockInTime, gte: filter.startDate };
      }
      
      if (filter?.endDate) {
        whereClause.clockInTime = { ...whereClause.clockInTime, lte: filter.endDate };
      }
      
      const shifts = await prisma.shift.findMany({
        where: whereClause,
        include: { user: true },
        orderBy: { clockInTime: 'desc' },
        take: limit,
        skip: offset,
      });

      return shifts;
    },

    weeklyReport: async (_: any, __: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Get staff analytics
      const staffUsers = await prisma.user.findMany({
        where: { 
          organizationId: user.organizationId,
          role: UserRole.CARE_WORKER 
        },
        include: {
          shifts: {
            where: {
              clockInTime: { gte: weekAgo },
              clockOutTime: { not: null },
              totalHours: { not: null }
            }
          }
        }
      });

      const staffAnalytics = staffUsers.map(staff => {
        const totalHours = staff.shifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);
        const totalShifts = staff.shifts.length;
        const averageDailyHours = totalShifts > 0 ? totalHours / 7 : 0;

        return {
          userId: staff.id,
          user: staff,
          totalHours: Math.round(totalHours * 100) / 100,
          averageDailyHours: Math.round(averageDailyHours * 100) / 100,
          totalShifts,
          weeklyHours: Math.round(totalHours * 100) / 100
        };
      });

      // Get daily stats for the past week
      const dailyStats = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dayShifts = await prisma.shift.findMany({
          where: {
            user: { organizationId: user.organizationId },
            clockInTime: { gte: startOfDay, lte: endOfDay }
          }
        });

        const completedShifts = dayShifts.filter(shift => shift.totalHours);
        const totalHours = completedShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);

        dailyStats.push({
          date: date.toISOString().split('T')[0],
          clockInCount: dayShifts.length,
          totalHours: Math.round(totalHours * 100) / 100,
          averageHours: completedShifts.length > 0 ? Math.round((totalHours / completedShifts.length) * 100) / 100 : 0
        });
      }

      // Get overall stats
      const overallStats = await prisma.user.count({
        where: { organizationId: user.organizationId, role: UserRole.CARE_WORKER }
      });

      const currentlyClocked = await prisma.shift.count({
        where: {
          user: { organizationId: user.organizationId },
          clockOutTime: null
        }
      });

      const todayShifts = await prisma.shift.count({
        where: {
          user: { organizationId: user.organizationId },
          clockInTime: { 
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      const allWeeklyHours = staffAnalytics.reduce((sum, staff) => sum + staff.totalHours, 0);
      const averageHours = staffAnalytics.length > 0 ? allWeeklyHours / staffAnalytics.length : 0;

      return {
        staffAnalytics,
        dailyStats,
        overallStats: {
          totalStaff: overallStats,
          currentlyClocked,
          todayShifts,
          averageHours: Math.round(averageHours * 100) / 100
        }
      };
    },

    staffAnalytics: async (_: any, __: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const staffUsers = await prisma.user.findMany({
        where: { 
          organizationId: user.organizationId,
          role: UserRole.CARE_WORKER 
        },
        include: {
          shifts: {
            where: {
              clockOutTime: { not: null },
              totalHours: { not: null }
            }
          }
        }
      });

      return staffUsers.map(staff => {
        const allTimeHours = staff.shifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);
        const weeklyShifts = staff.shifts.filter(shift => 
          shift.clockInTime >= weekAgo
        );
        const weeklyHours = weeklyShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);
        const totalShifts = staff.shifts.length;
        const averageDailyHours = totalShifts > 0 ? allTimeHours / Math.max(totalShifts, 1) : 0;

        return {
          userId: staff.id,
          user: staff,
          totalHours: Math.round(allTimeHours * 100) / 100,
          averageDailyHours: Math.round(averageDailyHours * 100) / 100,
          totalShifts,
          weeklyHours: Math.round(weeklyHours * 100) / 100
        };
      });
    },

    staffAnalyticsByAuth0Id: async (_: any, { auth0Id }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });
      
      if (!user || user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const staffUsers = await prisma.user.findMany({
        where: { 
          organizationId: user.organizationId,
          role: UserRole.CARE_WORKER 
        },
        include: {
          shifts: {
            where: {
              clockOutTime: { not: null },
              totalHours: { not: null }
            }
          }
        }
      });

      return staffUsers.map(staff => {
        const allTimeHours = staff.shifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);
        const weeklyShifts = staff.shifts.filter(shift => 
          shift.clockInTime >= weekAgo
        );
        const weeklyHours = weeklyShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);
        const totalShifts = staff.shifts.length;
        const averageDailyHours = totalShifts > 0 ? allTimeHours / Math.max(totalShifts, 1) : 0;

        return {
          userId: staff.id,
          user: staff,
          totalHours: Math.round(allTimeHours * 100) / 100,
          averageDailyHours: Math.round(averageDailyHours * 100) / 100,
          totalShifts,
          weeklyHours: Math.round(weeklyHours * 100) / 100
        };
      });
    },

    dailyStats: async (_: any, { days = 7 }: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const dailyStats = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dayShifts = await prisma.shift.findMany({
          where: {
            user: { organizationId: user.organizationId },
            clockInTime: { gte: startOfDay, lte: endOfDay }
          }
        });

        const completedShifts = dayShifts.filter(shift => shift.totalHours);
        const totalHours = completedShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);

        dailyStats.push({
          date: date.toISOString().split('T')[0],
          clockInCount: dayShifts.length,
          totalHours: Math.round(totalHours * 100) / 100,
          averageHours: completedShifts.length > 0 ? Math.round((totalHours / completedShifts.length) * 100) / 100 : 0
        });
      }

      return dailyStats;
    },

    dailyStatsByAuth0Id: async (_: any, { auth0Id, days = 7 }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });
      
      if (!user || user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const dailyStats = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dayShifts = await prisma.shift.findMany({
          where: {
            user: { organizationId: user.organizationId },
            clockInTime: { gte: startOfDay, lte: endOfDay }
          }
        });

        const completedShifts = dayShifts.filter(shift => shift.totalHours);
        const totalHours = completedShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);

        dailyStats.push({
          date: date.toISOString().split('T')[0],
          clockInCount: dayShifts.length,
          totalHours: Math.round(totalHours * 100) / 100,
          averageHours: completedShifts.length > 0 ? Math.round((totalHours / completedShifts.length) * 100) / 100 : 0
        });
      }

      return dailyStats;
    },

    dashboardStats: async (_: any, __: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [totalStaff, currentlyClocked, todayShifts, recentShifts] = await Promise.all([
        prisma.user.count({
          where: { organizationId: user.organizationId, role: UserRole.CARE_WORKER },
        }),
        prisma.shift.count({
          where: {
            user: { organizationId: user.organizationId },
            clockOutTime: null,
          },
        }),
        prisma.shift.count({
          where: {
            user: { organizationId: user.organizationId },
            clockInTime: { gte: today, lt: tomorrow },
          },
        }),
        prisma.shift.findMany({
          where: {
            user: { organizationId: user.organizationId },
            clockOutTime: { not: null },
            totalHours: { not: null },
          },
          select: { totalHours: true },
          take: 100,
        }),
      ]);

      const averageHours = recentShifts.length > 0 
        ? recentShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0) / recentShifts.length
        : 0;

      return {
        totalStaff,
        currentlyClocked,
        todayShifts,
        averageHours: Math.round(averageHours * 100) / 100,
      };
    },

    organization: async (_: any, __: any, context: any) => {
      const user = await getUser(context);
      return user.organization;
    },

    organizationByAuth0Id: async (_: any, { auth0Id }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });
      
      if (!user) {
        throw new Error('User not found');
      }

      return user.organization;
    },
  },

  Mutation: {
    createOrUpdateUser: async (_: any, { input }: any) => {
      const { auth0Id, email, name, picture, role, organizationId } = input;
      
      // Check if organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if manager role is being assigned and if manager already exists
      if (role === UserRole.MANAGER) {
        const existingManager = await prisma.user.findFirst({
          where: {
            organizationId,
            role: UserRole.MANAGER,
            auth0Id: { not: auth0Id }, // Exclude current user
          },
        });

        if (existingManager) {
          throw new Error('A manager already exists for this organization');
        }
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { auth0Id },
      });

      let user;
      if (existingUser) {
        // Update existing user
        user = await prisma.user.update({
          where: { auth0Id },
          data: {
            email,
            name,
            picture,
            role,
            organizationId,
          },
          include: { organization: true },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            auth0Id,
            email,
            name,
            picture,
            role,
            organizationId,
          },
          include: { organization: true },
        });
      }

      return user;
    },

    clockInByAuth0Id: async (_: any, { auth0Id, input }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check if user already has an active shift
      const existingShift = await prisma.shift.findFirst({
        where: {
          userId: user.id,
          clockOutTime: null,
        },
      });

      if (existingShift) {
        throw new Error('You are already clocked in');
      }

      // Check if user is within perimeter
      const isWithin = isWithinPerimeter(
        input.lat,
        input.lng,
        user.organization.locationLat,
        user.organization.locationLng,
        user.organization.perimeterRadius
      );

      if (!isWithin) {
        throw new Error('You must be within the organization perimeter to clock in');
      }

      const shift = await prisma.shift.create({
        data: {
          userId: user.id,
          clockInTime: new Date(),
          clockInLat: input.lat,
          clockInLng: input.lng,
          clockInNote: input.note,
        },
        include: { user: true },
      });

      // Publish real-time update
      pubsub.publish('SHIFT_UPDATED', { shiftUpdated: shift });
      pubsub.publish('STAFF_STATUS_CHANGED', { staffStatusChanged: user });

      return shift;
    },

    clockOutByAuth0Id: async (_: any, { auth0Id, input }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const shift = await prisma.shift.findFirst({
        where: {
          userId: user.id,
          clockOutTime: null,
        },
      });

      if (!shift) {
        throw new Error('No active shift found');
      }

      // Check if user is within perimeter
      const isWithin = isWithinPerimeter(
        input.lat,
        input.lng,
        user.organization.locationLat,
        user.organization.locationLng,
        user.organization.perimeterRadius
      );

      if (!isWithin) {
        throw new Error('You must be within the organization perimeter to clock out');
      }

      const clockOutTime = new Date();
      const totalHours = calculateShiftHours(shift.clockInTime, clockOutTime);

      const updatedShift = await prisma.shift.update({
        where: { id: shift.id },
        data: {
          clockOutTime,
          clockOutLat: input.lat,
          clockOutLng: input.lng,
          clockOutNote: input.note,
          totalHours,
        },
        include: { user: true },
      });

      // Publish real-time update
      pubsub.publish('SHIFT_UPDATED', { shiftUpdated: updatedShift });
      pubsub.publish('STAFF_STATUS_CHANGED', { staffStatusChanged: user });

      return updatedShift;
    },

    login: async (_: any, { input }: any) => {
      const { email, password } = input;
      
      const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true },
      });

      if (!user || !user.password) {
        throw new Error('Invalid credentials');
      }

      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      if (!user.role || !user.organizationId) {
        throw new Error('User profile incomplete');
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      return { token, user };
    },

    register: async (_: any, { input }: any) => {
      const { email, password, name, role, organizationId } = input;
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Check if organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new Error('Organization not found');
      }

      const hashedPassword = await hashPassword(password);
      
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
          organizationId,
        },
        include: { organization: true },
      });

      if (!user.role || !user.organizationId) {
        throw new Error('User creation failed - incomplete profile');
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      return { token, user };
    },

    clockIn: async (_: any, { input }: any, context: any) => {
      const user = await getUser(context);
      const { lat, lng, note } = input;

      if (user.role !== UserRole.CARE_WORKER) {
        throw new Error('Only care workers can clock in');
      }

      // Check if user is already clocked in
      const existingShift = await prisma.shift.findFirst({
        where: {
          userId: user.id,
          clockOutTime: null,
        },
      });

      if (existingShift) {
        throw new Error('You are already clocked in');
      }

      if (!user.organization) {
        throw new Error('Organization not found for user');
      }

      // Check if user is within perimeter
      const isWithinBounds = isWithinPerimeter(
        lat,
        lng,
        user.organization.locationLat,
        user.organization.locationLng,
        user.organization.perimeterRadius
      );

      if (!isWithinBounds) {
        throw new Error('You must be within the facility perimeter to clock in');
      }

      const shift = await prisma.shift.create({
        data: {
          userId: user.id,
          clockInTime: new Date(),
          clockInLat: lat,
          clockInLng: lng,
          clockInNote: note,
        },
        include: { user: true },
      });

      // Publish real-time update
      pubsub.publish('SHIFT_UPDATED', { shiftUpdated: shift });
      pubsub.publish('STAFF_STATUS_CHANGED', { staffStatusChanged: user });

      return shift;
    },

    clockOut: async (_: any, { input }: any, context: any) => {
      const user = await getUser(context);
      const { lat, lng, note } = input;

      if (user.role !== UserRole.CARE_WORKER) {
        throw new Error('Only care workers can clock out');
      }

      // Find the current shift
      const currentShift = await prisma.shift.findFirst({
        where: {
          userId: user.id,
          clockOutTime: null,
        },
      });

      if (!currentShift) {
        throw new Error('You are not currently clocked in');
      }

      if (!user.organization) {
        throw new Error('Organization not found for user');
      }

      // Check if user is within perimeter
      const isWithinBounds = isWithinPerimeter(
        lat,
        lng,
        user.organization.locationLat,
        user.organization.locationLng,
        user.organization.perimeterRadius
      );

      if (!isWithinBounds) {
        throw new Error('You must be within the facility perimeter to clock out');
      }

      const clockOutTime = new Date();
      const totalHours = calculateShiftHours(currentShift.clockInTime, clockOutTime);

      const shift = await prisma.shift.update({
        where: { id: currentShift.id },
        data: {
          clockOutTime,
          clockOutLat: lat,
          clockOutLng: lng,
          clockOutNote: note,
          totalHours,
        },
        include: { user: true },
      });

      // Publish real-time update
      pubsub.publish('SHIFT_UPDATED', { shiftUpdated: shift });
      pubsub.publish('STAFF_STATUS_CHANGED', { staffStatusChanged: user });

      return shift;
    },

    updatePerimeter: async (_: any, { input }: any, context: any) => {
      const user = await getUser(context);
      
      if (user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      if (!user.organizationId) {
        throw new Error('User has no organization assigned');
      }

      const { locationLat, locationLng, perimeterRadius } = input;
      
      const organization = await prisma.organization.update({
        where: { id: user.organizationId },
        data: {
          locationLat,
          locationLng,
          perimeterRadius,
        },
      });

      return organization;
    },

    updatePerimeterByAuth0Id: async (_: any, { auth0Id, input }: any) => {
      const user = await prisma.user.findUnique({
        where: { auth0Id },
        include: { organization: true },
      });
      
      if (!user || user.role !== UserRole.MANAGER) {
        throw new Error('Access denied: Manager role required');
      }

      if (!user.organizationId) {
        throw new Error('User has no organization assigned');
      }

      const { locationLat, locationLng, perimeterRadius } = input;
      
      const organization = await prisma.organization.update({
        where: { id: user.organizationId },
        data: {
          locationLat,
          locationLng,
          perimeterRadius,
        },
      });

      return organization;
    },
  },

  Subscription: {
    shiftUpdated: {
      subscribe: () => pubsub.asyncIterableIterator([SHIFT_UPDATED]),
    },
    staffStatusChanged: {
      subscribe: () => pubsub.asyncIterableIterator([STAFF_STATUS_CHANGED]),
    },
    locationUpdate: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([LOCATION_UPDATE]),
        (payload, variables) => {
          // Only send location updates to managers or the user themselves
          return payload.locationUpdate.userId === variables.userId || variables.isManager;
        }
      ),
    },
    geofenceAlert: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([GEOFENCE_ALERT]),
        (payload, variables) => {
          // Only send geofence alerts to managers
          return variables.isManager;
        }
      ),
    },
    realTimeStats: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([REAL_TIME_STATS]),
        (payload, variables) => {
          // Only send stats to managers of the same organization
          return payload.realTimeStats.organizationId === variables.organizationId && variables.isManager;
        }
      ),
    },
  },
};
