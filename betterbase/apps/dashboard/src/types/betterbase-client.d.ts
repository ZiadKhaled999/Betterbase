declare module '@betterbase/client' {
  export function createClient(config: { url: string; key?: string; schema?: string }): {
    auth: {
      getUser: () => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
}
