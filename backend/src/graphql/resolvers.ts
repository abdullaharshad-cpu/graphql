// backend/src/graphql/resolvers.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface GraphQLContext {
  userId: number | null;
  res: any; // Express Response object passed from index.ts
}

export const resolvers = {
  Query: {
    // Fetches the profile of the currently authenticated session user
    me: async (_parent: any, _args: any, context: GraphQLContext) => {
      if (!context.userId) return null;
      
      try {
        return await prisma.user.findUnique({
          where: { id: context.userId }
        });
      } catch (error) {
        console.error("Error matching user session:", error);
        return null;
      }
    },
  },

  Mutation: {
    // Registration Pipeline
    signup: async (_parent: any, { name, email, password }: any) => {
      try {
        // 1. Verify uniqueness
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return { success: false, message: "Email is already registered." };
        }

        // 2. Hash raw password with salt internally
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Save instance to local SQLite DB
        const newUser = await prisma.user.create({
          data: { 
            name, 
            email, 
            password: hashedPassword 
          },
        });

        return {
          success: true,
          message: "Account created successfully!",
          user: newUser,
        };
      } catch (error) {
        console.error("Signup tracking failure:", error);
        return { success: false, message: "Server error during registration." };
      }
    },

    // Authentication & Session Cookie Pipeline
    login: async (_parent: any, { email, password }: any, { res }: GraphQLContext) => {
      try {
        // 1. Find the target record
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return { success: false, message: "Invalid email or password." };
        }

        // 2. Validate cryptographic password matching
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return { success: false, message: "Invalid email or password." };
        }

        // 3. Mount secure, client-hidden HTTP-Only Session Cookie
        res.cookie('session_id', user.id.toString(), {
          httpOnly: true,                                 // Prevents malicious script tracking/XSS theft
          secure: process.env.NODE_ENV === 'production',         // Mandates HTTPS protocol on live environments
          sameSite: 'lax',                                // Default CSRF cross-site protection context
          maxAge: 1000 * 60 * 60 * 24 * 7,                // Active lifespan: 7 days
        });

        return {
          success: true,
          message: "Login successful!",
          user,
        };
      } catch (error) {
        console.error("Login tracking failure:", error);
        return { success: false, message: "Server error during login." };
      }
    },

    // Termination Pipeline
    logout: async (_parent: any, _args: any, { res }: GraphQLContext) => {
      try {
        // Purge session identifier cookie instantly from client storage
        res.clearCookie('session_id');
        return { success: true, message: "Logged out successfully." };
      } catch (error) {
        return { success: false, message: "Failed to properly wipe login session state." };
      }
    },
  },
};