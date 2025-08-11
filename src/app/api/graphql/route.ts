import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { typeDefs } from '../../../lib/graphql/schema';
import { resolvers } from '../../../lib/graphql/resolvers';
import { NextRequest, NextResponse } from 'next/server';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (req: NextRequest) => {
    // Convert Headers object to plain object for GraphQL context
    const headersObj: { [key: string]: string } = {};
    if (req.headers instanceof Headers) {
      req.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
    }
    
    return { 
      req,
      request: req,
      headers: headersObj
    };
  },
});

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
