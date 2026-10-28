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
const DEMO_TEST_ACCESS_CODE = 'DEMO42';

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
  // Public, keyless Judge0 instance — fine for a local demo of Run / Submit code, not for real exams.
  process.env.JUDGE0_API_URL = process.env.JUDGE0_API_URL ?? 'https://ce.judge0.com';

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
    cgpa: 8.4,
    activeBacklogs: 0,
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

  // A ready-to-take proctored test: the 10 MCQ + 5 coding sample, approved and sent to the demo
  // candidate's batch with a known access code.
  const { Test, TestAssignment } = await import('../features/tests/test.model');
  const { SAMPLE_TEST_TEMPLATE } = await import('../features/tests/sample-test.template');
  const { paperTotalMarks } = await import('../features/tests/test-paper');
  const facultyUserId = String((await User.findOne({ email: 'faculty@demo.edu' }))!._id);
  const sampleTest = await Test.create({
    ...SAMPLE_TEST_TEMPLATE,
    totalMarks: paperTotalMarks(SAMPLE_TEST_TEMPLATE.questions, SAMPLE_TEST_TEMPLATE.sections),
    status: 'approved',
    reviewedBy: adminId,
    reviewedAt: new Date(),
    instituteId,
    createdBy: facultyUserId,
  });
  await TestAssignment.create({
    instituteId,
    testId: String(sampleTest._id),
    targetType: 'batch',
    batch: '2026-CSE',
    accessCodeHash: await bcrypt.hash(DEMO_TEST_ACCESS_CODE, 10),
    accessCodeIssuedAt: new Date(),
    status: 'active',
    createdBy: facultyUserId,
  });

  // Placement drives: a few classmates with academic records, one open drive the demo candidate
  // can apply to, and one finished drive with offers so the placement report has numbers.
  const classmates = await Candidate.create([
    { instituteId, fullName: 'Aarav Mehta', rollNumber: 'CSE-2026-002', batch: '2026-CSE', department: 'Computer Science', placementYear: '2026', status: 'active', cgpa: 9.1, activeBacklogs: 0 },
    { instituteId, fullName: 'Isha Rao', rollNumber: 'CSE-2026-003', batch: '2026-CSE', department: 'Computer Science', placementYear: '2026', status: 'active', cgpa: 7.2, activeBacklogs: 1 },
    { instituteId, fullName: 'Kabir Singh', rollNumber: 'ECE-2026-001', batch: '2026-ECE', department: 'Electronics', placementYear: '2026', status: 'active', cgpa: 7.9, activeBacklogs: 0 },
    { instituteId, fullName: 'Neha Verma', rollNumber: 'ECE-2026-002', batch: '2026-ECE', department: 'Electronics', placementYear: '2026', status: 'active', cgpa: 6.4, activeBacklogs: 2 },
  ]);
  const { PlacementDrive, DriveApplication } = await import('../features/placement-drives/placement-drive.model');
  const tpoUserId = String((await User.findOne({ email: 'tpo@demo.edu' }))!._id);
  const day = 24 * 60 * 60 * 1000;
  await PlacementDrive.create({
    instituteId,
    companyName: 'Infosys',
    roleTitle: 'Systems Engineer',
    description: 'Campus hiring for the Systems Engineer role. Training at Mysuru campus followed by project allocation.',
    jobType: 'full_time',
    ctcLpa: 3.6,
    location: 'Pan India',
    eligibility: { minCgpa: 6, maxBacklogs: 0, departments: ['Computer Science', 'Electronics'], batches: [], placementYears: ['2026'], excludePlaced: true },
    rounds: [
      { name: 'Online Assessment', type: 'aptitude', scheduledAt: new Date(Date.now() + 7 * day) },
      { name: 'Technical Interview', type: 'interview', scheduledAt: new Date(Date.now() + 9 * day) },
      { name: 'HR Interview', type: 'hr', scheduledAt: new Date(Date.now() + 9 * day) },
    ],
    applicationDeadline: new Date(Date.now() + 5 * day),
    driveDate: new Date(Date.now() + 7 * day),
    status: 'open',
    announcedAt: new Date(),
    createdBy: tpoUserId,
  });
  const tcs = await PlacementDrive.create({
    instituteId,
    companyName: 'TCS',
    roleTitle: 'Digital Engineer',
    jobType: 'full_time',
    ctcLpa: 7,
    location: 'Bengaluru',
    eligibility: { minCgpa: 7, maxBacklogs: 0, departments: [], batches: [], placementYears: ['2026'], excludePlaced: true },
    rounds: [
      { name: 'NQT', type: 'aptitude' },
      { name: 'Technical + HR', type: 'interview' },
    ],
    status: 'completed',
    announcedAt: new Date(Date.now() - 30 * day),
    createdBy: tpoUserId,
  });
  const cleared = (n: number) => Array.from({ length: n }, (_, roundIndex) => ({ roundIndex, result: 'cleared', updatedAt: new Date() }));
  await DriveApplication.create([
    { instituteId, driveId: String(tcs._id), candidateId: String(classmates[0]._id), status: 'selected', roundResults: cleared(2), offerCtcLpa: 7, appliedAt: new Date(Date.now() - 25 * day) },
    { instituteId, driveId: String(tcs._id), candidateId: String(classmates[2]._id), status: 'rejected', roundResults: [...cleared(1), { roundIndex: 1, result: 'rejected', updatedAt: new Date() }], appliedAt: new Date(Date.now() - 25 * day) },
  ]);
  await Candidate.updateOne({ _id: classmates[0]._id }, { $set: { status: 'placed' } });

  // eslint-disable-next-line no-console
  console.log('[demo] seeded institute + 4 logins (admin/tpo/faculty/candidate), password for all: ' + DEMO_PASSWORD);
  // eslint-disable-next-line no-console
  console.log(`[demo] seeded "${sampleTest.title}" for batch 2026-CSE — access code ${DEMO_TEST_ACCESS_CODE}`);

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
