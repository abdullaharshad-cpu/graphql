import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';
import { swaggerSpec } from './swagger.js';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(cookieParser());
  app.use(express.json());

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: 'http://localhost:3000',
      credentials: true,
    }),
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        const sessionToken = req.cookies?.session_id;
        return {
          userId: sessionToken ? parseInt(sessionToken, 10) : null,
          res,
        };
      },
    })
  );

  app.get('/health', (_req, res) => {
    res.send('Server status: OK');
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  const PORT = process.env.PORT || 4000;
  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`🚀 Server fully operational at http://localhost:${PORT}/graphql`);
  console.log(`📘 Swagger docs available at http://localhost:${PORT}/api-docs`);
}

startServer().catch((err) => {
  console.error('❌ Failed to ignite server backend container:', err);
});