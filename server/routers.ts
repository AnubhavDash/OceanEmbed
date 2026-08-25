import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getLatestPersistedOceanRun } from "./db";
import { materializeCuratedBaseline } from "./materializeBaseline";
import { getReferenceScene } from "./oceanembed";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  oceanembed: router({
    /** A clearly marked reference fixture used to exercise the product UI before data credentials are configured. */
    referenceScene: publicProcedure.query(() => getReferenceScene()),
    persistedLatest: publicProcedure.query(() => getLatestPersistedOceanRun()),
    materializeCuratedBaseline: adminProcedure.mutation(() => materializeCuratedBaseline()),
  }),

});

export type AppRouter = typeof appRouter;
