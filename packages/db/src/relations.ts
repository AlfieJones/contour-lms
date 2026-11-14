import { defineRelations } from "drizzle-orm";

import { authUsers } from "#auth-schema";
import * as schema from "#schema";

export const relations = defineRelations({ ...schema, authUsers }, (r) => ({
  authUsers: {
    role: r.one.userRoles({ from: r.authUsers.id, to: r.userRoles.userId }),
    studentConsultations: r.many.consultations({
      from: r.authUsers.id,
      to: r.consultations.studentId,
    }),
    teacherConsultations: r.many.consultations({
      from: r.authUsers.id,
      to: r.consultations.teacherId,
    }),
    studentEnrolments: r.many.enrolments({ from: r.authUsers.id, to: r.enrolments.studentId }),
    teacherEnrolments: r.many.enrolments({ from: r.authUsers.id, to: r.enrolments.teacherId }),
    availability: r.many.teacherAvailability({
      from: r.authUsers.id,
      to: r.teacherAvailability.teacherId,
    }),
  },
  userRoles: {
    user: r.one.authUsers({ from: r.userRoles.userId, to: r.authUsers.id, optional: false }),
  },
  consultations: {
    student: r.one.authUsers({ from: r.consultations.studentId, to: r.authUsers.id }),
    teacher: r.one.authUsers({ from: r.consultations.teacherId, to: r.authUsers.id }),
    emails: r.many.consultationEmails({
      from: r.consultations.id,
      to: r.consultationEmails.consultationId,
    }),
  },
  consultationEmails: {
    consultation: r.one.consultations({
      from: r.consultationEmails.consultationId,
      to: r.consultations.id,
      optional: false,
    }),
  },
  enrolments: {
    student: r.one.authUsers({ from: r.enrolments.studentId, to: r.authUsers.id }),
    teacher: r.one.authUsers({
      from: r.enrolments.teacherId,
      to: r.authUsers.id,
      optional: false,
    }),
  },
  teacherAvailability: {
    teacher: r.one.authUsers({
      from: r.teacherAvailability.teacherId,
      to: r.authUsers.id,
      optional: false,
    }),
  },
}));
