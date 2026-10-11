import { useEffect, useState } from 'react';
import { biometricEnrolled, checkPin, unlockWithBiometric } from '../lib/lock';
import { Icon } from '../components/Icon';

export default function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (biometricEnrolled()) unlockWithBiometric().then((ok) => ok && onUnlock());
  }, [onUnlock]);

  async function press(d: string) {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setWrong(false);
    if (next.length === 4) {
      if (await checkPin(next)) onUnlock();
      else {
        setWrong(true);
        setPin('');
      }
    }
  }

  return (
    <div className="lock-screen">
      <Icon name="lock" size={36} stroke="var(--brass)" />
      <span className="lbl brass">Enter passcode</span>
      <div className="pin" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'f' : ''} />)}
      </div>
      {wrong && <span className="small" style={{ color: 'var(--urge-text)' }} role="alert">Wrong passcode</span>}
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        {biometricEnrolled()
          ? <button aria-label="Use Face ID" onClick={() => unlockWithBiometric().then((ok) => ok && onUnlock())} style={{ fontSize: 14 }}>Face ID</button>
          : <span />}
        <button onClick={() => press('0')}>0</button>
        <button aria-label="Delete digit" onClick={() => setPin((p) => p.slice(0, -1))} style={{ fontSize: 18 }}>⌫</button>
      </div>
    </div>
  );
}
