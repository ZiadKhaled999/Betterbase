import path from 'path';
import { mkdir } from 'fs/promises';
import pino from 'pino';

/**
 * Setup file logging for production
 * 
 * Creates daily rotating log files in logs/ directory
 * 
 * @returns Pino destination stream
 */
export async function setupFileLogging(): Promise<pino.DestinationStream> {
  const logsDir = path.join(process.cwd(), 'logs');
  
  // Create logs directory if it doesn't exist
  await mkdir(logsDir, { recursive: true });
  
  // Create log file with today's date
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(logsDir, `betterbase-${date}.log`);
  
  return pino.destination({
    dest: logFile,
    sync: false, // Async for better performance
    mkdir: true,
  });
}
