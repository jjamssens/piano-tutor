import { useMidiStore } from '../stores/useMidiStore';
import { midiService } from '../services/MidiService';


/**
 * ConnectionStatus
 *
 * Displays live device connection state.
 * Provides a "Retry" escape hatch for cases where onstatechange
 * doesn't fire after USB reconnect (known Chromium edge case).
 */
export function ConnectionStatus() {
  const device        = useMidiStore((s) => s.device);
  const keyboardRange = useMidiStore((s) => s.keyboardRange);


  const keyCount = keyboardRange.max - keyboardRange.min + 1;
  // Count white keys to get the standard size label
  const whiteKeys = Array.from({ length: keyCount }, (_, i) => keyboardRange.min + i)
    .filter((n) => ![1,3,6,8,10].includes(n % 12)).length;
  const sizeLabel =
    whiteKeys <= 15 ? '25-key' :
    whiteKeys <= 22 ? '37-key' :
    whiteKeys <= 29 ? '49-key' :
    whiteKeys <= 36 ? '61-key' :
    whiteKeys <= 44 ? '76-key' :
                      '88-key';

  const handleRetry = () => {
    midiService.initialize();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700">
      {/* Status dot */}
      <span
        className={`w-3 h-3 rounded-full ${
          device.isConnected ? 'bg-green-400' : 'bg-red-500'
        }`}
      />

      <div className="flex flex-col">
        <span className="text-sm font-medium text-white">
          {device.isConnected
            ? `Connected: ${device.inputName}`
            : 'No keyboard detected'}
        </span>
        {device.isConnected && midiService.deviceBrand && (
          <span className="text-xs text-gray-400">
            {midiService.deviceBrand} · {sizeLabel}
            {midiService.hasLighting
              ? ' · LED lighting enabled'
              : ' · no LED lighting'}
          </span>
        )}
        {device.lastError && (
          <span className="text-xs text-red-400">{device.lastError}</span>
        )}
      </div>

      {!device.isConnected && (
        <button
          onClick={handleRetry}
          className="ml-auto text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
