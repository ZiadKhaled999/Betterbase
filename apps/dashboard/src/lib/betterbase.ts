import { createClient } from '@betterbase/client';

const BETTERBASE_URL = process.env.NEXT_PUBLIC_BETTERBASE_URL || 'http://localhost:3000';

export const betterbase = createClient({
  url: BETTERBASE_URL,
});
