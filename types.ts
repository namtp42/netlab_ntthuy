
export type DeviceType = 'pc' | 'switch' | 'router' | 'modem' | 'isp' | 'access_point' | 'laptop' | 'mobile' | 'tablet' | 'watch';

export interface Device {
  id: string;
  type: DeviceType;
  x: number;
  y: number;
  name: string;
  ip?: string;
  mac: string;
  ports: number;
  ssid?: string;
  password?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface Log {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error';
}

export enum ToolMode {
  MOVE = 'move',
  CABLE = 'cable',
  DELETE = 'delete'
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
