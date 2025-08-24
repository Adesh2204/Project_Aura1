import React, { useState } from 'react';
import { Mic, MapPin, Users, AlertTriangle } from 'lucide-react';

interface PermissionPromptProps {
  onComplete: () => void;
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({ onComplete }) => {
  const [permissions, setPermissions] = useState({
    microphone: false,
    location: false
  });
  const [isChecking, setIsChecking] = useState(false);

  const requestPermissions = async () => {
    setIsChecking(true);
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissions(prev => ({ ...prev, microphone: true }));
      
      // Request location permission
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setPermissions(prev => ({ ...prev, location: true }));
            resolve();
          },
          reject,
          { enableHighAccuracy: false, timeout: 5000 }
        );
      });
      
      // Short delay to show success state
      setTimeout(onComplete, 1000);
    } catch (error) {
      console.error('Permission denied:', error);
      alert('Permissions are required for Aura to work properly. Please grant access and try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const allPermissionsGranted = permissions.microphone && permissions.location;

  return (
    <div className="min-h-screen bg-aura-background flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-aura-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Aura</h1>
          <p className="text-gray-600">
            Your personal safety companion with voice activation needs a few permissions to protect you effectively.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              permissions.microphone ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium">Microphone Access</h3>
              <p className="text-sm text-gray-500">Required for voice activation with "Help Aura" trigger phrase</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              permissions.location ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium">Location Access</h3>
              <p className="text-sm text-gray-500">To share your location in emergency alerts</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium">Emergency Contacts</h3>
              <p className="text-sm text-gray-500">Add contacts to notify during emergencies</p>
            </div>
          </div>
        </div>

        <button
          onClick={requestPermissions}
          disabled={isChecking || allPermissionsGranted}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            allPermissionsGranted
              ? 'bg-green-600 text-white'
              : isChecking
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-aura-primary text-white hover:bg-indigo-600'
          }`}
        >
          {allPermissionsGranted 
            ? '✓ Ready to Protect You' 
            : isChecking 
            ? 'Checking Permissions...' 
            : 'Grant Permissions'
          }
        </button>

        {allPermissionsGranted && (
          <p className="text-center text-sm text-green-600 mt-3">
            All permissions granted! Setting up your safety profile...
          </p>
        )}
      </div>
    </div>
  );
};