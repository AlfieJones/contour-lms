import { z } from "zod";
import { publicProcedure } from "#procedures";
import { userRouter } from "#routers/user";
import { adminRouter, consultationRouter } from "#routers/consultation";
import { adminUserRouter } from "#routers/admin-user";
import { enrolmentRouter } from "#routers/enrolment";

export const router = {
  health: publicProcedure
    .output(z.object({ status: z.literal("ok") }))
    .handler(() => ({ status: "ok" })),
  user: userRouter,
  consultation: consultationRouter,
  enrolment: enrolmentRouter,
  admin: { ...adminRouter, users: adminUserRouter },
};

export type Router = typeof router;
