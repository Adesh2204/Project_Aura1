import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
// Removed AuraButton import
import { EmergencyVoiceButton } from './Components/EmergencyVoiceButton';
import { VoiceStatusIndicator } from './Components/VoiceStatusIndicator';
import { FakeCallScreen } from './Components/FakeCallScreen';
import { StatusDisplay } from './Components/StatusDisplay';
import { Settings as SettingsComponent } from './Components/Settings';
import { PermissionPrompt } from './Components/PermissionPrompt';
import { AlertConfirmationScreen } from './Components/AlertConfirmationScreen';
import { useAuraState } from './hooks/useAuraState';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useLocation } from './hooks/useLocation';
import { useVoiceActivation } from './hooks/useVoiceActivation';
import { apiService } from './services/apiService';
import { storageService } from './services/storageService';
import { UserProfile, AuraState } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'settings' | 'permissions' | 'sos-confirmation' | 'fake-call'>('permissions');
  const [userProfile, setUserProfile] = useState<UserProfile>({
    ...storageService.getUserProfile(),
    voiceActivationEnabled: storageService.getUserProfile().voiceActivationEnabled ?? false,
    voiceActivationLanguage: storageService.getUserProfile().voiceActivationLanguage ?? 'en-US'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [sosProcessing, setSOSProcessing] = useState(false);
  const [emergencyVoiceActive, setEmergencyVoiceActive] = useState(false);

  const aura = useAuraState();
  const audio = useAudioCapture();
  const location = useLocation();
  
  // Define handleSOSActivate function
  const handleSOSActivate = async () => {
    setSOSProcessing(true);
    
    try {
      // Trigger SOS state immediately for UI feedback
      aura.triggerSOS();
      
      // Get current location
      const currentLocation = await location.getCurrentLocation();
      
      // Send SOS alert
      const result = await apiService.triggerSOSAlert(userProfile.id, currentLocation);
      
      // Update SOS result
      aura.updateSOSResult(result);
      
      // Navigate to confirmation screen
      setCurrentView('sos-confirmation');
    } catch (error) {
      console.error('Error sending SOS alert:', error);
      // Still show confirmation screen with error state
      aura.updateSOSResult({
        success: false,
        message: 'Error sending alert, but emergency contacts may have been notified',
        data: { contactsNotified: 0, timestamp: new Date().toISOString() }
      });
      setCurrentView('sos-confirmation');
    } finally {
      setSOSProcessing(false);
    }
  };
  
  // Initialize voice activation
  const voice = useVoiceActivation({
    triggerPhrase: 'Help Aura',
    onActivate: handleSOSActivate,
    enabled: userProfile.voiceActivationEnabled,
    language: userProfile.voiceActivationLanguage
  });

  // Check if onboarding is complete and handle voice activation changes
  useEffect(() => {
    if (storageService.isOnboardingComplete()) {
      setCurrentView('home');
    }
    
    // Request microphone permission if voice activation is enabled
    if (userProfile.voiceActivationEnabled && voice.permissionStatus === 'prompt') {
      voice.requestPermission();
    }
  }, [userProfile.voiceActivationEnabled]);

  // Handle audio processing workflow
  useEffect(() => {
    const processAudio = async () => {
      if (audio.audioBlob && aura.isListening) {
        setIsProcessing(true);
        
        try {
          // Process audio through the complete workflow
          const result = await apiService.processAudioWorkflow(audio.audioBlob);
          
          // Update transcription and AI response
          aura.updateTranscription(result.transcription);
          aura.updateAiResponse(result.ai_response);
          
          // Play the AI response
          await apiService.playAudioResponse(result.ai_response);
          
          // Handle threat detection
          if (result.threat_detected) {
            aura.triggerAlert();
            
            // Get location and send alert
            try {
              const currentLocation = await location.getCurrentLocation();
              await apiService.triggerSmsAlert(userProfile.id, currentLocation);
            } catch (locationError) {
              console.error('Error getting location for alert:', locationError);
              // Still send alert without precise location
              await apiService.triggerSmsAlert(userProfile.id, { latitude: 0, longitude: 0 });
            }
          }
          
          // Clear the processed audio
          audio.clearAudio();
        } catch (error) {
          console.error('Error processing audio:', error);
        } finally {
          setIsProcessing(false);
        }
      }
    };

    processAudio();
  }, [audio.audioBlob, aura.isListening]);

  const handleAuraActivate = async () => {
    try {
      aura.activateAura();
      await audio.startRecording();
    } catch (error) {
      console.error('Error activating Aura:', error);
      alert('Unable to access microphone. Please check permissions and try again.');
      aura.deactivateAura();
    }
  };

  const handleAuraDeactivate = () => {
    aura.deactivateAura();
    audio.stopRecording();
  };

  // handleSOSActivate function is defined above

  const handleEmergencyVoiceActivate = async () => {
    try {
      // Trigger emergency voice state
      aura.triggerEmergencyVoice();
      setEmergencyVoiceActive(true);
      
      // Navigate to fake call screen
      setCurrentView('fake-call');
      
      // Send silent location alert to emergency contacts
      const currentLocation = await location.getCurrentLocation();
      await apiService.triggerSmsAlert(userProfile.id, currentLocation);
    } catch (error) {
      console.error('Error activating emergency voice:', error);
    }
  };

  const handleCallAnswered = async () => {
    try {
      // Start playing emergency warnings
      await apiService.playEmergencyWarnings();
    } catch (error) {
      console.error('Error playing emergency warnings:', error);
    }
  };

  const handleEndCall = () => {
    // Stop any ongoing warnings
    apiService.stopEmergencyWarnings();
    
    // Reset state and return to home
    aura.resetToIdle();
    setEmergencyVoiceActive(false);
    setCurrentView('home');
  };

  const handleAllClear = async () => {
    try {
      // Send all-clear message to contacts
      const currentLocation = await location.getCurrentLocation();
      await apiService.triggerSmsAlert(userProfile.id, currentLocation);
      
      // Reset to home
      aura.resetToIdle();
      setCurrentView('home');
    } catch (error) {
      console.error('Error sending all-clear:', error);
      // Still return to home
      aura.resetToIdle();
      setCurrentView('home');
    }
  };

  const handleProfileUpdate = (updates: Partial<UserProfile>) => {
    const updatedProfile = { ...userProfile, ...updates };
    setUserProfile(updatedProfile);
    storageService.saveUserProfile(updatedProfile);
    
    // Update emergency contacts separately
    if (updates.emergencyContacts) {
      storageService.saveEmergencyContacts(updates.emergencyContacts);
    }
  };

  const handlePermissionsComplete = () => {
    if (storageService.isOnboardingComplete()) {
      setCurrentView('home');
    } else {
      setCurrentView('settings');
    }
  };

  // Render permission prompt
  if (currentView === 'permissions') {
    return <PermissionPrompt onComplete={handlePermissionsComplete} />;
  }

  // Render settings
  if (currentView === 'settings') {
    return (
      <SettingsComponent
        userProfile={userProfile}
        onProfileUpdate={handleProfileUpdate}
        onBack={() => setCurrentView('home')}
      />
    );
  }

  // Render SOS confirmation screen
  if (currentView === 'sos-confirmation') {
    return (
      <AlertConfirmationScreen
        alertResult={aura.sosAlertResult}
        userLocation={location.location}
        onBack={() => setCurrentView('home')}
        onAllClear={handleAllClear}
      />
    );
  }

  // Render fake call screen
  if (currentView === 'fake-call') {
    return (
      <FakeCallScreen
        callerName="Dad"
        onEndCall={handleEndCall}
        onCallAnswered={handleCallAnswered}
      />
    );
  }

  // Render main home screen
  return (
    <div className="min-h-screen bg-aura-background">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Aura</h1>
              <p className="text-sm text-gray-600">Personal Safety AI</p>
            </div>
            <button
              onClick={() => setCurrentView('settings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Status Display */}
          <StatusDisplay
            state={aura.state}
            transcription={aura.transcription}
            aiResponse={aura.aiResponse}
            isListening={aura.isListening}
          />

          {/* Voice Status Indicator */}
          <VoiceStatusIndicator
            isListening={voice.isListening}
            permissionStatus={voice.permissionStatus}
            error={voice.error}
            onRequestPermission={voice.requestPermission}
          />

          {/* Emergency AI Assistant Voice Button */}
          {aura.state === AuraState.IDLE && (
            <div className="flex justify-center">
              <EmergencyVoiceButton
                onActivate={handleEmergencyVoiceActivate}
                disabled={isProcessing || sosProcessing || emergencyVoiceActive}
              />
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-center space-x-2 text-aura-primary">
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                <span className="text-sm">Processing audio...</span>
              </div>
            </div>
          )}

          {/* Safety Reminder */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-500 text-center">
              Aura is a safety deterrent. In real emergencies, always call 911.
              <br />
              Your conversations are processed securely and not stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}