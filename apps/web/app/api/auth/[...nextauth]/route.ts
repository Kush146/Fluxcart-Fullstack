import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

function makeTransport() {
  const host = process.env.EMAIL_SERVER!;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER!;
  const pass = process.env.EMAIL_PASSWORD!;

  if (!host || !user || !pass) {
    throw new Error("SMTP env missing: EMAIL_SERVER/USER/PASSWORD");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // TLS on 587, SSL on 465
    auth: { user, pass },
  });
}

export const authOptions: NextAuthOptions = {
  debug: true,
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "database" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      // Custom sender so we can log SMTP failures
      async sendVerificationRequest({ identifier, url }) {
        const from = process.env.EMAIL_FROM!;
        if (!from) throw new Error("EMAIL_FROM not set");

        const transport = makeTransport();
        try {
          const info = await transport.sendMail({
            to: identifier,
            from,
            subject: "Sign in to FluxCart",
            text: `Sign in link:\n${url}\n`,
            html: `
              <div style="font-family:Inter,system-ui,Arial,sans-serif;line-height:1.5">
                <h2>Sign in to FluxCart</h2>
                <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;border-radius:8px;text-decoration:none">Sign in</a></p>
                <p style="color:#555">If the button doesn't work, paste this URL:<br>${url}</p>
              </div>
            `,
          });
          console.log("📧 SMTP accepted:", info?.response || info);
        } catch (err: any) {
          console.error("❌ SMTP send failed:", err?.message || err);
          // Re-throw so NextAuth returns 500 with a useful message in server logs
          throw err;
        }
      },
      maxAge: 30 * 60,
    }),
  ],
  pages: { signIn: "/auth/email" },
  callbacks: {
    async session({ session, user }) {
      if (session?.user) (session.user as any).id = user.id;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
