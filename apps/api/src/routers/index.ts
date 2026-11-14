import { healthRouter } from "#routers/health";
import { userRouter } from "#routers/user";
import { adminRouter, consultationRouter } from "#routers/consultation";
import { adminUserRouter } from "#routers/admin-user";
import { enrolmentRouter } from "#routers/enrolment";

export const router = {
  health: healthRouter,
  user: userRouter,
  consultation: consultationRouter,
  enrolment: enrolmentRouter,
  admin: { ...adminRouter, users: adminUserRouter },
};

export type Router = typeof router;
