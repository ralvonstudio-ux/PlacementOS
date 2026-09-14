/**
 * Local demo bootstrap — NOT for production use.
 *
 * Spins up an ephemeral in-memory MongoDB (mongodb-memory-server), seeds one
 * institute plus a login for every role (admin/tpo/faculty/candidate), points
 * this process at that database, and then starts the real Express app.
 *
 * All data lives only in this process's memory and is lost when it exits.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';

const DEMO_PASSWORD = 'Demo@1234';
const SALT_ROUNDS = 12;

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'placementos_demo' } });
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
  process.env.PORT = process.env.PORT ?? '5050';
  process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  process.env.INSTITUTE_NAME = process.env.INSTITUTE_NAME ?? 'Training & Placement Cell';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-only-access-secret-do-not-use-in-prod';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-only-refresh-secret-do-not-use-in-prod';

  // eslint-disable-next-line no-console
  console.log(`[demo] in-memory MongoDB started at ${uri}`);

  // Import AFTER env vars are set, since env.ts reads process.env at import time.
  const mongoose = (await import('mongoose')).default;
  const { connectDatabase } = await import('../config/database');
  const { Institute } = await import('../features/institutes/institute.model');
  const { User } = await import('../features/users/user.model');
  const { Faculty } = await import('../features/faculty/faculty.model');
  const { Candidate } = await import('../features/candidates/candidate.model');
  const { PeriodSlot } = await import('../features/training-schedule/training-schedule.period.model');
  const { TrainingScheduleEntry } = await import('../features/training-schedule/training-schedule.model');

  await connectDatabase();

  const institute = await Institute.create({
    name: 'Training & Placement Cell — Demo',
    code: 'DEMO',
    contactEmail: 'tpo@demo.edu',
  });
  const instituteId = String(institute._id);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const admin = await User.create({
    firstName: 'Ada',
    lastName: 'Admin',
    email: 'admin@demo.edu',
    passwordHash,
    role: 'admin',
    instituteId,
  });
  const adminId = String(admin._id);

  await User.create({
    firstName: 'Priya',
    lastName: 'TPO',
    email: 'tpo@demo.edu',
    passwordHash,
    role: 'tpo',
    instituteId,
  });

  const faculty = await Faculty.create({
    fullName: 'Rahul Faculty',
    gender: 'male',
    employeeId: 'FAC-001',
    phone: '9000000001',
    email: 'rahul.faculty@demo.edu',
    loginEmail: 'faculty@demo.edu',
    department: 'Placement Training',
    tracks: ['Aptitude', 'DSA'],
    assignedBatches: ['2026-CSE'],
    employmentStatus: 'active',
    instituteId,
  });
  await User.create({
    firstName: 'Rahul',
    lastName: 'Faculty',
    email: 'faculty@demo.edu',
    passwordHash,
    role: 'faculty',
    instituteId,
    employeeId: faculty.employeeId,
  });

  await Candidate.create({
    instituteId,
    fullName: 'Simran Candidate',
    rollNumber: 'CSE-2026-001',
    batch: '2026-CSE',
    department: 'Computer Science',
    email: 'simran.candidate@demo.edu',
    loginEmail: 'candidate@demo.edu',
    placementYear: '2026',
    status: 'active',
  });

  await User.create({
    firstName: 'Simran',
    lastName: 'Candidate',
    email: 'candidate@demo.edu',
    passwordHash,
    role: 'candidate',
    instituteId,
  });

  const slotDefs = [
    { name: 'Period 1', startTime: '09:00', endTime: '10:00' },
    { name: 'Period 2', startTime: '10:00', endTime: '11:00' },
    { name: 'Break', startTime: '11:00', endTime: '11:15', isBreak: true },
    { name: 'Period 3', startTime: '11:15', endTime: '12:15' },
    { name: 'Period 4', startTime: '12:15', endTime: '13:15' },
  ];
  const slots = await Promise.all(
    slotDefs.map((s, orderIndex) =>
      PeriodSlot.create({ instituteId, orderIndex, daysApplicable: [1, 2, 3, 4, 5, 6], createdBy: adminId, ...s })
    )
  );

  const facultyId = String(faculty._id);
  await TrainingScheduleEntry.create([
    { instituteId, batch: '2026-CSE', track: 'DSA', facultyId, dayOfWeek: 1, startTime: '09:00', endTime: '10:00', room: 'Lab 1', placementYear: '2026', slotId: String(slots[0]._id), createdBy: adminId },
    { instituteId, batch: '2026-CSE', track: 'Aptitude', facultyId, dayOfWeek: 1, startTime: '10:00', endTime: '11:00', room: 'Room 204', placementYear: '2026', slotId: String(slots[1]._id), createdBy: adminId },
    { instituteId, batch: '2026-CSE', track: 'DSA', facultyId, dayOfWeek: 3, startTime: '11:15', endTime: '12:15', room: 'Lab 1', placementYear: '2026', slotId: String(slots[3]._id), createdBy: adminId },
  ]);

  // eslint-disable-next-line no-console
  console.log('[demo] seeded institute + 4 logins (admin/tpo/faculty/candidate), password for all: ' + DEMO_PASSWORD);

  await import('../server');

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    await mongod.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[demo] failed to start', err);
  process.exit(1);
});
