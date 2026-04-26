export type SettingType = "string" | "integer" | "boolean" | "json";

export interface SettingItem {
  key: string;
  value: string;
  type: SettingType | string;
  description: string | null;
  updated_at: string | null;
}

export type SettingsByPrefix = Record<string, SettingItem>;
