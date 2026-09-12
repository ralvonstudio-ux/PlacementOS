import { IntentDefinition } from './intent-router';
import { tpoAssistantData } from './tpo-assistant.data';
import { AuthContext } from '../../lib/auth-context';

// Each intent maps a natural-language question shape to the narrowest backend fetch that can
// answer it. Scoped to attendance only, per PlacementOS's TPO Assistant scope.
export const attendanceIntents: IntentDefinition<AuthContext, unknown>[] = [
  {
    id: 'ATTENDANCE_SUMMARY',
    description: "A full overview of today's attendance — e.g. \"today's attendance\", \"attendance summary\", \"give me today's attendance report\".",
    fetchData: tpoAssistantData.getFullSummary,
  },
  {
    id: 'CANDIDATE_PRESENT_COUNT',
    description: 'How many candidates are present today.',
    fetchData: tpoAssistantData.getCandidateCounts,
  },
  {
    id: 'CANDIDATE_ABSENT_COUNT',
    description: 'How many candidates are absent today.',
    fetchData: tpoAssistantData.getCandidateCounts,
  },
  {
    id: 'ATTENDANCE_PERCENTAGE',
    description: "Today's overall candidate attendance percentage/rate.",
    fetchData: tpoAssistantData.getCandidateCounts,
  },
  {
    id: 'FACULTY_ATTENDANCE',
    description: "Today's faculty attendance overview (present/total).",
    fetchData: tpoAssistantData.getFacultyCounts,
  },
  {
    id: 'FACULTY_ABSENT_COUNT',
    description: 'How many faculty members are absent today.',
    fetchData: tpoAssistantData.getFacultyCounts,
  },
  {
    id: 'HIGHEST_ATTENDANCE_BATCH',
    description: 'Which batch/track has the highest attendance today (e.g. "best attendance").',
    fetchData: tpoAssistantData.getBatchTrackExtremes,
  },
  {
    id: 'LOWEST_ATTENDANCE_BATCH',
    description: 'Which batch/track has the lowest attendance today.',
    fetchData: tpoAssistantData.getBatchTrackExtremes,
  },
];
