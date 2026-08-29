import { useState, useRef } from 'react';
import { Camera, Upload, Shield, CheckCircle, XCircle, Cpu, Zap, Globe } from 'lucide-react';

export default function LandingPage({ onVerified }) {
  const [step, setStep] = useState('upload'); // upload, processing, success, error
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setStep('processing');
        setTimeout(() => {
          setStep('success');
          setTimeout(() => onVerified(), 1500);
        }, 2000);
      };
      reader.readAsDataURL(file);
    } else {
      setError('Please upload a valid image file');
      setStep('error');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setStep('processing');
        setTimeout(() => {
          setStep('success');
          setTimeout(() => onVerified(), 1500);
        }, 2000);
      };
      reader.readAsDataURL(file);
    } else {
      setError('Please upload a valid image file');
      setStep('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-frc-blue/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-frc-red/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-frc-yellow/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <div className="max-w-2xl w-full relative z-10">
        {/* Header with animated icons */}
        <div className="text-center mb-8">
          <div className="flex justify-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-frc-blue to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 transform hover:scale-110 transition-transform">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <div className="w-20 h-20 bg-gradient-to-br from-frc-red to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30 transform hover:scale-110 transition-transform">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-frc-yellow to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/30 transform hover:scale-110 transition-transform">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 via-white to-blue-400 bg-clip-text text-transparent">
              MCHS Robotics
            </span>
          </h1>
          <div className="flex items-center justify-center gap-3">
            <Globe className="w-6 h-6 text-frc-yellow" />
            <p className="text-2xl text-blue-200 font-medium">FRC FIRST Chapter</p>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 relative overflow-hidden">
          {/* Glow effect */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-64 h-64 bg-frc-blue/30 rounded-full blur-3xl -translate-y-1/2" />

          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-2 text-center">Identity Verification</h2>
            <p className="text-blue-200 mb-8 text-center">Upload a photo to verify your identity and access the team chat</p>

            {step === 'upload' && (
              <div
                className="border-2 border-dashed border-blue-400/50 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-white/5 transition-all group"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
                  <Camera className="w-10 h-10 text-white" />
                </div>
                <p className="text-white font-semibold text-lg mb-2">Click or drag to upload photo</p>
                <p className="text-blue-300 text-sm">Supports JPG, PNG, WebP</p>
              </div>
            )}

            {step === 'processing' && (
              <div className="text-center py-12">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 border-4 border-blue-400/30 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-transparent border-t-blue-400 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Shield className="w-10 h-10 text-blue-400 animate-pulse" />
                  </div>
                </div>
                <p className="text-white font-semibold text-xl mb-2">Verifying identity...</p>
                <p className="text-blue-300 text-sm">This may take a moment</p>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
                <p className="text-white font-semibold text-2xl mb-2">Verification Successful!</p>
                <p className="text-green-300 text-sm">Redirecting to chat...</p>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
                  <XCircle className="w-12 h-12 text-white" />
                </div>
                <p className="text-white font-semibold text-2xl mb-2">Verification Failed</p>
                <p className="text-red-300 text-sm mb-6">{error}</p>
                <button
                  onClick={() => {
                    setStep('upload');
                    setError('');
                    setPreview(null);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-frc-blue to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-lg shadow-blue-500/30"
                >
                  Try Again
                </button>
              </div>
            )}

            {preview && step !== 'error' && (
              <div className="mt-8">
                <p className="text-blue-200 text-sm mb-3 font-medium">Preview:</p>
                <div className="relative rounded-xl overflow-hidden shadow-2xl">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-56 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-300 text-sm mb-2">
            <Shield className="w-4 h-4" />
            <p>Protected by secure verification system</p>
          </div>
          <p className="text-blue-400/60 text-xs">© 2026 MCHS Robotics - FRC Team</p>
        </div>
      </div>
    </div>
  );
}
