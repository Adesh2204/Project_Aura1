import { } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';

interface VoiceStatusIndicatorProps {
  isListening: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unsupported';
  error: string | null;
  onRequestPermission: () => Promise<boolean>;
}

export const VoiceStatusIndicator: React.FC<VoiceStatusIndicatorProps> = ({
  isListening,
  permissionStatus,
  error,
  onRequestPermission
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 max-w-md mx-auto">
      <div className="flex flex-col items-center space-y-3">
        {/* Voice Status Icon */}
        <div 
          className={`
            w-16 h-16 rounded-full flex items-center justify-center
            ${isListening ? 'bg-aura-primary animate-pulse' : 'bg-gray-100'}
            transition-all duration-300
          `}
        >
          {isListening ? (
            <Mic className="w-8 h-8 text-white" />
          ) : (
            <MicOff className="w-8 h-8 text-gray-400" />
          )}
        </div>
        
        {/* Status Text */}
        <div className="text-center">
          <p className="font-medium text-gray-800">
            {isListening ? 'Listening for "Help Aura"' : 'Voice activation ready'}
          </p>
          <p className="text-sm text-gray-500">
            {isListening 
              ? 'Say "Help Aura" to activate emergency mode' 
              : permissionStatus === 'granted' 
                ? 'Voice monitoring is paused' 
                : 'Voice monitoring requires microphone permission'}
          </p>
        </div>
        
        {/* Permission Status */}
        {permissionStatus !== 'granted' && (
          <div className="w-full">
            {permissionStatus === 'denied' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Microphone access denied</p>
                  <p>Please enable microphone access in your browser settings to use voice activation.</p>
                </div>
              </div>
            ) : permissionStatus === 'unsupported' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-600 flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Browser not supported</p>
                  <p>Voice activation is not supported in this browser. Please use Chrome, Edge, or Safari.</p>
                </div>
              </div>
            ) : (
              <button
                onClick={onRequestPermission}
                className="w-full bg-aura-primary hover:bg-indigo-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Enable Voice Activation
              </button>
            )}
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};