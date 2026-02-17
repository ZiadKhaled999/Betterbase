export interface BetterBaseConfig {
  aiContext: {
    enabled: boolean;
    outputFile: string;
  };
  database: {
    provider: 'sqlite' | 'postgres';
  };
}

export const betterbaseConfig: BetterBaseConfig = {
  aiContext: {
    enabled: true,
    outputFile: '.betterbase-context.json',
  },
  database: {
    provider: 'sqlite',
  },
};
