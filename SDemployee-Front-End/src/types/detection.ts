export interface DetectionData {
  id: string;
  employeeId: string;
  bloodVolumePulse: number;
  electrodermalActivity: number;
  bodyTemperature: number;
  movementActivity: string;
  result: string;
  advice?: string;   
  timestamp: string;
}

export interface DetectionInput {
  bloodVolumePulse: string;
  electrodermalActivity: string;
  bodyTemperature: string;
  movementActivity: string;
}