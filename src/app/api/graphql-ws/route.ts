import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { GraphQLSchema } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../../../lib/graphql/schema';
import { resolvers } from '../../../lib/graphql/resolvers';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

let schema: GraphQLSchema;

export default async function handler(req: any, res: any) {
  if (!schema) {
    schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
  }

  if (req.method === 'GET') {
    if (req.headers.upgrade === 'websocket') {
      const server = createServer();
      const wsServer = new WebSocketServer({
        server,
        path: '/api/graphql-ws',
      });

      useServer(
        {
          schema,
          context: async (ctx: any, msg: any, args: any) => {
            return {
              connectionParams: ctx.connectionParams,
              user: ctx.connectionParams?.auth0Id,
            };
          },
          onConnect: async (ctx: any) => {
            console.log('Client connected to WebSocket');
            return { connectionParams: ctx.connectionParams };
          },
          onDisconnect: (ctx: any, code: any, reason: any) => {
            console.log('Client disconnected from WebSocket', code, reason);
          },
        },
        wsServer
      );

      server.on('upgrade', (request, socket, head) => {
        wsServer.handleUpgrade(request, socket, head, (ws) => {
          wsServer.emit('connection', ws, request);
        });
      });

      res.status(426).json({ error: 'Upgrade Required' });
      return;
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
