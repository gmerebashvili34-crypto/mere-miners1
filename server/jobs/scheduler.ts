import { startDepositScanner } from '../workers/depositScanner';
import { startWithdrawWorker } from '../workers/withdrawWorker';
import { startSweeper } from '../workers/sweeper';

export function startJobs() {
  startDepositScanner();
  startWithdrawWorker();
  startSweeper();
}
