import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { typeDefs } from '../../../lib/graphql/schema';
import { resolvers } from '../../../lib/graphql/resolvers';
import { NextRequest } from 'next/server';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => {
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

export { handler as GET, handler as POST };
