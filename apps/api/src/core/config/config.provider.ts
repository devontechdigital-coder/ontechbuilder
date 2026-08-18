import { loadConfig, type AppConfig } from "./config.js";

export const APP_CONFIG = Symbol("APP_CONFIG");

export const configProvider = {
  provide: APP_CONFIG,
  useFactory: (): AppConfig => loadConfig(),
};
