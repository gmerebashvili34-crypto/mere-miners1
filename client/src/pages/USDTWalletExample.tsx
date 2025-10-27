import { useState } from 'react';

export default function USDTWalletExample() {
  const [connected, setConnected] = useState(false);
  const [tronAddr, setTronAddr] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [dest, setDest] = useState('');
  const [amount, setAmount] = useState('');

  const connectTronLink = async () => {
    try {
      // @ts-ignore
      if (window.tronLink) {
        // @ts-ignore
        const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
        // @ts-ignore
        const addr = window?.tronWeb?.defaultAddress?.base58 || null;
        setTronAddr(addr);
        setConnected(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createWallet = async () => {
    const token = prompt('Admin JWT?');
    if (!token) return;
    const res = await fetch(`/api/admin/create-wallet?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    alert(await res.text());
  };

  const queueWithdraw = async () => {
    const token = prompt('User JWT?');
    if (!token) return;
    const res = await fetch('/api/usdt/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId, destination_address: dest, amount }),
    });
    alert(await res.text());
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">USDT Wallet Example</h1>
      <button className="border px-2 py-1" onClick={connectTronLink}>
        {connected ? `Connected: ${tronAddr}` : 'Connect TronLink'}
      </button>

      <div className="space-y-2">
        <div>
          <label>User ID</label>
          <input className="border ml-2 px-2" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <button className="border px-2 py-1" onClick={createWallet}>Admin: Create Wallet</button>
      </div>

      <div className="space-y-2">
        <div>
          <label>Destination</label>
          <input className="border ml-2 px-2" value={dest} onChange={(e) => setDest(e.target.value)} />
        </div>
        <div>
          <label>Amount (USDT)</label>
          <input className="border ml-2 px-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button className="border px-2 py-1" onClick={queueWithdraw}>User: Queue Withdraw</button>
      </div>
    </div>
  );
}
