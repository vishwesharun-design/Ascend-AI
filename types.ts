
export interface Milestone {
  title: string;
  description: string;
  timeline: string;
  status: 'pending' | 'completed';
}

export interface MarketInsight {
  title: string;
  description: string;
  sourceUrl: string;
}

export interface SuccessBlueprint {
  goalTitle: string;
  visionStatement: string;
  strategyRoadmap: Milestone[];
  marketAnalysis: MarketInsight[];
  coreFocus: string[];
}

export interface SavedBlueprint {
  id: string;
  blueprint: SuccessBlueprint;
  timestamp: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  VIEWING_BLUEPRINT = 'VIEWING_BLUEPRINT',
  ERROR = 'ERROR'
}

export enum ActiveModal {
  NONE = 'NONE',
  PHILOSOPHY = 'PHILOSOPHY',
  STORIES = 'STORIES',
  COMMUNITY = 'COMMUNITY',
  CHAT = 'CHAT',
  VAULT = 'VAULT',
  UPGRADE = 'UPGRADE'
}

export enum ArchitectMode {
  STANDARD = 'Standard',
  DETAILED = 'Detailed',
  SPEED = 'Rapid',
  MARKET = 'Market Intel'
}
