import { Department } from './department';

export type GenderType = 'Male' | 'Female';
export type StressLevelType = "Stress" | "Not Stress" | "Not Measured Yet";

export interface Employee {
  id: string;
  name: string;
  age: number;
  department: Department;
  gender: GenderType;
  photo?: string;
  stressLevel: StressLevelType;
}
