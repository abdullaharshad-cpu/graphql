import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GraphQL Posts API',
      version: '1.0.0',
      description: 'Swagger documentation for the GraphQL backend with authentication, posts, and comments.',
    },
    servers: [{ url: 'http://localhost:4000' }],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          responses: {
            200: { description: 'API is healthy' },
          },
        },
      },
      '/graphql': {
        post: {
          summary: 'GraphQL endpoint',
          description: 'Use this endpoint to run GraphQL queries and mutations for auth, posts, and comments.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                    variables: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'GraphQL response' },
          },
        },
      },
    },
  },
  apis: ['./src/**/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
