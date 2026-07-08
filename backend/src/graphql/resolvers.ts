import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface GraphQLContext {
  userId: number | null;
  res: any;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
};

const serializeUser = (user: any) => ({
  ...user,
  createdAt: user.createdAt.toISOString(),
});

const serializePost = (post: any) => ({
  ...post,
  createdAt: post.createdAt.toISOString(),
  author: serializeUser(post.author),
  comments: post.comments.map((comment: any) => serializeComment(comment)),
});

const serializeComment = (comment: any) => ({
  ...comment,
  createdAt: comment.createdAt.toISOString(),
  user: serializeUser(comment.user),
  post: {
    id: comment.post.id,
    title: comment.post.title,
    author: comment.post.author ? serializeUser(comment.post.author) : null,
    comments: [],
    createdAt: comment.post.createdAt.toISOString(),
  },
});

const requireSession = async (context: GraphQLContext) => {
  if (!context.userId) {
    throw new Error('You must be logged in to perform this action.');
  }

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: userSelect,
  });

  if (!user) {
    throw new Error('Your session is invalid. Please log in again.');
  }

  return user;
};

export const resolvers = {
  Query: {
    me: async (_parent: any, _args: any, context: GraphQLContext) => {
      try {
        const user = await requireSession(context);
        return serializeUser(user);
      } catch (error) {
        console.error('Error matching user session:', error);
        throw error;
      }
    },

    post: async (_parent: any, { id }: any) => {
      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          author: { select: userSelect },
          comments: {
            include: {
              user: { select: userSelect },
              post: {
                include: {
                  author: { select: userSelect },
                },
              },
            },
          },
        },
      });

      if (!post) {
        throw new Error('Post not found.');
      }

      return serializePost(post);
    },

    posts: async () => {
      const posts = await prisma.post.findMany({
        include: {
          author: { select: userSelect },
          comments: {
            include: {
              user: { select: userSelect },
              post: {
                include: {
                  author: { select: userSelect },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return posts.map(serializePost);
    },

    comment: async (_parent: any, { id }: any) => {
      const comment = await prisma.comment.findUnique({
        where: { id },
        include: {
          user: { select: userSelect },
          post: {
            include: {
              author: { select: userSelect },
            },
          },
        },
      });

      if (!comment) {
        throw new Error('Comment not found.');
      }

      return serializeComment(comment);
    },

    comments: async (_parent: any, { postId }: any) => {
      const comments = await prisma.comment.findMany({
        where: { postId },
        include: {
          user: { select: userSelect },
          post: {
            include: {
              author: { select: userSelect },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return comments.map(serializeComment);
    },
  },

  Mutation: {
    signup: async (_parent: any, { name, email, password }: any) => {
      try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return { success: false, message: 'Email is already registered.' };
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
          },
          select: userSelect,
        });

        return {
          success: true,
          message: 'Account created successfully!',
          user: serializeUser(newUser),
        };
      } catch (error) {
        console.error('Signup tracking failure:', error);
        return { success: false, message: 'Server error during registration.' };
      }
    },

    login: async (_parent: any, { email, password }: any, { res }: GraphQLContext) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return { success: false, message: 'Invalid email or password.' };
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return { success: false, message: 'Invalid email or password.' };
        }

        res.cookie('session_id', user.id.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });

        return {
          success: true,
          message: 'Login successful!',
          user: serializeUser({ ...user, createdAt: user.createdAt }),
        };
      } catch (error) {
        console.error('Login tracking failure:', error);
        return { success: false, message: 'Server error during login.' };
      }
    },

    logout: async (_parent: any, _args: any, { res }: GraphQLContext) => {
      try {
        res.clearCookie('session_id');
        return { success: true, message: 'Logged out successfully.' };
      } catch (error) {
        return { success: false, message: 'Failed to properly wipe login session state.' };
      }
    },

    createPost: async (_parent: any, { title }: any, context: GraphQLContext) => {
      const user = await requireSession(context);

      const post = await prisma.post.create({
        data: {
          title,
          authorId: user.id,
        },
        include: {
          author: { select: userSelect },
          comments: {
            include: {
              user: { select: userSelect },
              post: {
                include: {
                  author: { select: userSelect },
                },
              },
            },
          },
        },
      });

      return serializePost(post);
    },

    createComment: async (_parent: any, { postId, comment }: any, context: GraphQLContext) => {
      const user = await requireSession(context);

      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post) {
        throw new Error('Post not found.');
      }

      const newComment = await prisma.comment.create({
        data: {
          comment,
          postId,
          userId: user.id,
        },
        include: {
          user: { select: userSelect },
          post: {
            include: {
              author: { select: userSelect },
            },
          },
        },
      });

      return serializeComment(newComment);
    },
  },
};