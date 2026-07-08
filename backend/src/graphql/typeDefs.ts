export const typeDefs = `#graphql
  type User {
    id: Int!
    name: String!
    email: String!
    createdAt: String!
  }

  type Post {
    id: Int!
    title: String!
    author: User!
    comments: [Comment!]!
    createdAt: String!
  }

  type Comment {
    id: Int!
    comment: String!
    user: User!
    post: Post!
    createdAt: String!
  }

  type AuthResponse {
    success: Boolean!
    message: String!
    user: User
  }

  type Query {
    me: User
    post(id: Int!): Post
    posts: [Post!]!
    comment(id: Int!): Comment
    comments(postId: Int!): [Comment!]!
  }

  type Mutation {
    signup(name: String!, email: String!, password: String!): AuthResponse!
    login(email: String!, password: String!): AuthResponse!
    logout: AuthResponse!
    createPost(title: String!): Post!
    createComment(postId: Int!, comment: String!): Comment!
  }
`;