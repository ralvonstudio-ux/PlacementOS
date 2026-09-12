import { TrainingModuleRecord, ITrainingModuleRecord, ITopicNode, ModuleExtractionStatus } from './training-module-record.model';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Same tolerance approach SchoolOS used for chapter names — AI vision extraction misreads a
// module title slightly often enough that strict equality would spawn duplicate module rows for
// what a faculty member would call the same one.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export const trainingModuleRecordRepository = {
  async findAll(instituteId: string, batch: string, track: string): Promise<ITrainingModuleRecord[]> {
    return TrainingModuleRecord.find({ instituteId, batch, track }).sort({ order: 1, moduleName: 1 }).lean<ITrainingModuleRecord[]>();
  },

  async findByIds(instituteId: string, ids: string[]): Promise<ITrainingModuleRecord[]> {
    return TrainingModuleRecord.find({ instituteId, _id: { $in: ids } }).lean<ITrainingModuleRecord[]>();
  },

  /** Every training-module record in the institute, across every batch/track — backs the TPO's
   *  materials overview, which needs the whole catalog at once. */
  async findAllForInstitute(instituteId: string): Promise<ITrainingModuleRecord[]> {
    return TrainingModuleRecord.find({ instituteId }).lean<ITrainingModuleRecord[]>();
  },

  /** Fuzzy-matches moduleName against existing modules for this batch+track, creating one if none matches closely enough. */
  async findOrCreate(instituteId: string, batch: string, track: string, moduleName: string, topic?: string): Promise<ITrainingModuleRecord> {
    const existing = await TrainingModuleRecord.find({ instituteId, batch, track }).lean<ITrainingModuleRecord[]>();
    const nameKey = normalize(moduleName);
    const maxDistance = nameKey.length <= 10 ? 1 : 3;

    let best: ITrainingModuleRecord | undefined;
    let bestDistance = maxDistance + 1;
    for (const module_ of existing) {
      const distance = levenshtein(nameKey, normalize(module_.moduleName));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = module_;
      }
    }

    if (best && bestDistance <= maxDistance) {
      if (topic && !best.topics.some((t) => normalize(t) === normalize(topic))) {
        await TrainingModuleRecord.updateOne({ _id: best._id }, { $addToSet: { topics: topic } });
        best.topics.push(topic);
      }
      return best;
    }

    return TrainingModuleRecord.create({
      instituteId,
      batch,
      track,
      moduleName: moduleName.trim(),
      topics: topic ? [topic] : [],
    });
  },

  async markExtractionStatus(id: string, instituteId: string, status: ModuleExtractionStatus): Promise<void> {
    await TrainingModuleRecord.updateOne({ _id: id, instituteId }, { $set: { extractionStatus: status } });
  },

  async markProcessed(id: string, instituteId: string, data: { sourceContentHash: string; topicTree?: ITopicNode[] }): Promise<void> {
    const $set: Record<string, unknown> = { extractionStatus: 'processed', sourceContentHash: data.sourceContentHash };
    if (data.topicTree) $set.topicTree = data.topicTree;
    await TrainingModuleRecord.updateOne({ _id: id, instituteId }, { $set });
  },
};
