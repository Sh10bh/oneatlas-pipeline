export type RepairStrategy =
  | 'structural_repair'
  | 'field_repair'
  | 'consistency_repair';

export type RepairOutcome = 'repaired' | 'escalated' | 'failed';

export interface RepairLog {
  id: string;
  stage: string;
  strategy: RepairStrategy;
  errorInput: string;
  outcome: RepairOutcome;
  attemptedAt: number;
  details: string;
}