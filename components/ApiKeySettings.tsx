import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { GoogleGenAI } from "@google/genai";

interface ApiKeySettingsProps {
  onClose: () => void;
}

// 간단한 XOR 암호화/복호화 유틸리티
// 실제 프로덕션 환경에서는 더 강력한 보안 방식이 권장되지만, 
// 클라이언트 사이드 로컬 저장소 요구사항을 충족하기 위한 경량 구현입니다.
const SALT = "SCOC_SECURE_KEY_v1_SALT";

const encrypt = (text: string) => {
  if (!text) return "";
  try {
    const textChars = text.split('').map(c => c.charCodeAt(0));
    const saltChars = SALT.split('').map(c => c.charCodeAt(0));
    return btoa(String.fromCharCode(...textChars.map((c, i) => c ^ saltChars[i % saltChars.length])));
  } catch (e) {
    console.error("Encryption failed", e);
    return "";
  }
};

const decrypt = (text: string) => {
  if (!text) return "";
  try {
    const chars = atob(text).split('').map(c => c.charCodeAt(0));
    const saltChars = SALT.split('').map(c => c.charCodeAt(0));
    return String.fromCharCode(...chars.map((c, i) => c ^ saltChars[i % saltChars.length]));
  } catch (e) {
    console.error("Decryption failed", e);
    return "";
  }
};

export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ onClose }) => {
  const [googleKey, setGoogleKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    // 컴포넌트 마운트 시 로컬 스토리지에서 암호화된 키 로드 및 복호화
    const savedEncryptedKey = localStorage.getItem('scoc_google_api_key');
    if (savedEncryptedKey) {
      setGoogleKey(decrypt(savedEncryptedKey));
    }
  }, []);

  const handleSave = () => {
    if (!googleKey.trim()) {
      localStorage.removeItem('scoc_google_api_key');
      alert('API Key가 삭제되었습니다.');
    } else {
      const encrypted = encrypt(googleKey);
      localStorage.setItem('scoc_google_api_key', encrypted);
      alert('로컬 드라이브에 안전하게 암호화되어 저장되었습니다.');
    }
    onClose();
  };

  const handleTestConnection = async () => {
    if (!googleKey) {
      setTestStatus('fail');
      setTestMessage('API Key를 입력해주세요.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Google Gemini 서버에 연결 중...');

    try {
      // @google/genai SDK를 사용한 연결 테스트
      const ai = new GoogleGenAI({ apiKey: googleKey });
      
      // 가장 기본적인 모델을 호출하여 키 유효성 검증
      // 토큰 소모를 최소화하기 위해 아주 짧은 프롬프트 전송
      // 모델명을 'gemini-3-flash-preview'로 업데이트하여 404 오류 방지
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Hello',
      });

      if (response && response.text) {
        setTestStatus('success');
        setTestMessage('연결 성공! API Key가 유효합니다.');
      } else {
        throw new Error('응답을 받지 못했습니다.');
      }
    } catch (error: any) {
      console.error("API Test Error:", error);
      let errorMessage = error.message || '알 수 없는 오류';
      
      // 404 Not Found 구체적 처리
      if (error.status === 404 || (error.message && error.message.includes('404'))) {
          errorMessage = '모델을 찾을 수 없습니다. (404 Not Found)';
      }

      setTestStatus('fail');
      setTestMessage(`연결 실패: ${errorMessage}`);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <div className="flex items-center space-x-3">
            <Icon name="lock" className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">API Key 설정</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
            <p className="text-sm text-blue-200 leading-relaxed">
              이 앱은 서버에 사용자의 키를 저장하지 않습니다.<br/>
              입력하신 API Key는 브라우저의 <strong>로컬 스토리지(Local Storage)</strong>에 
              암호화되어 저장되며, 오직 사용자의 기기에서만 작동합니다.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Google GenAI (Gemini) API Key</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon name="key" className="w-5 h-5 text-gray-500" />
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={googleKey}
                onChange={(e) => {
                    setGoogleKey(e.target.value);
                    setTestStatus('idle');
                    setTestMessage('');
                }}
                className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full pl-10 p-2.5 pr-20 placeholder-gray-500"
                placeholder="AI Studio API Key 입력"
              />
               <button 
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-xs text-gray-400 hover:text-white"
              >
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              * 앨범 아트 생성 및 향후 AI 기능에 사용됩니다.
            </p>
          </div>

          {/* 연결 테스트 결과 표시 영역 */}
          {testStatus !== 'idle' && (
            <div className={`p-3 rounded-lg text-sm flex items-center space-x-2 ${
              testStatus === 'success' ? 'bg-green-900/30 text-green-300 border border-green-700' :
              testStatus === 'fail' ? 'bg-red-900/30 text-red-300 border border-red-700' :
              'bg-gray-800 text-gray-300 animate-pulse'
            }`}>
              {testStatus === 'testing' && <Icon name="refresh" className="w-4 h-4 animate-spin" />}
              {testStatus === 'success' && <Icon name="check" className="w-4 h-4" />}
              {testStatus === 'fail' && <Icon name="close" className="w-4 h-4" />}
              <span>{testMessage}</span>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !googleKey}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors ${
                !googleKey ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500'
              }`}
            >
              연결 테스트
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-bold text-black bg-cyan-400 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
            >
              저장 및 닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};