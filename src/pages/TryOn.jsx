import React, { useState, useRef, useEffect } from 'react';
import { Camera, Shirt, Upload, Move3d, Layers, AlertCircle, Heart, ShoppingBag, Download, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import { captureFrameFromVideo, virtualTryOn, fetchModelImageAsBase64 } from '../lib/virtualTryOnApi';
import { useCartStore, useUserStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const ALIGNMENT_HINTS = {
  clothes: 'Align your upper body in frame',
  jewellery: 'Show neck, ear, or hands clearly',
  watches: 'Hold your wrist toward the camera',
  default: 'Stand with full body visible',
};

export const TryOn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const product = location.state?.product;
  const addItem = useCartStore((state) => state.addItem);
  const { user, wishlist, toggleWishlist } = useUserStore();

  const [mode, setMode] = useState('camera');
  const [cameraError, setCameraError] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [tryOnResult, setTryOnResult] = useState(null);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnProgress, setTryOnProgress] = useState('');
  const [tryOnError, setTryOnError] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [modelImageIndex, setModelImageIndex] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const categorySlug = product?.categorySlug || 'clothes';
  const alignmentHint = ALIGNMENT_HINTS[categorySlug] || ALIGNMENT_HINTS.default;
  const isInWishlist = product ? wishlist.includes(product.id) : false;

  useEffect(() => {
    if (mode !== 'camera') return;

    const startCamera = async () => {
      setCameraError(null);
      setCameraLoading(true);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported');
        if (!window.isSecureContext) throw new Error('Camera requires HTTPS or localhost');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.warn);
        }
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('Camera blocked. Allow access in browser settings, then refresh.');
          setMode('upload');
        } else if (err.name === 'NotFoundError') {
          setCameraError('No camera found.');
          setMode('upload');
        } else {
          setCameraError(err.message || 'Camera failed.');
          setMode('upload');
        }
      } finally {
        setCameraLoading(false);
      }
    };

    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [mode]);

  const runTryOn = async (personBase64) => {
    if (!product) {
      setTryOnError('Select a product first.');
      return;
    }
    setTryOnError(null);
    setTryOnResult(null);
    setTryOnLoading(true);
    setTryOnProgress('Starting...');

    try {
      const result = await virtualTryOn(personBase64, product, categorySlug, (msg) => setTryOnProgress(msg));
      setTryOnResult(result);
      setTryOnProgress('');

      if (user) {
        try {
          await supabase.from('tryon_sessions').insert({
            user_id: user.id,
            status: 'Completed',
          });
        } catch {
          // RLS may block; optional save
        }
      }
    } catch (err) {
      setTryOnError(err.message || 'Try-on failed. Please try again.');
      setTryOnProgress('');
    } finally {
      setTryOnLoading(false);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !streamRef.current) {
      setTryOnError('Camera not ready.');
      return;
    }
    const base64 = captureFrameFromVideo(videoRef.current);
    if (!base64) {
      setTryOnError('Could not capture.');
      return;
    }
    runTryOn(base64);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(',')[1];
      setUploadedImage(reader.result);
      runTryOn(b64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleModelTryOn = async () => {
    setTryOnProgress('Loading model...');
    try {
      const base64 = await fetchModelImageAsBase64(modelImageIndex);
      runTryOn(base64);
    } catch {
      setTryOnError('Could not load model image.');
    }
  };

  const handleRetry = () => {
    setTryOnResult(null);
    setTryOnError(null);
    setUploadedImage(null);
  };

  const handleSaveImage = () => {
    if (!tryOnResult) return;
    const link = document.createElement('a');
    link.href = tryOnResult;
    link.download = `tryon-${product?.name || 'result'}.png`;
    link.click();
  };

  const handleAddToWishlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (product) toggleWishlist(product.id);
    try {
      if (isInWishlist) {
        await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', product.id);
      } else {
        await supabase.from('wishlists').insert({ user_id: user.id, product_id: product.id });
      }
    } catch {
      toggleWishlist(product.id);
    }
  };

  const handleAddToCart = () => {
    if (product) addItem(product);
    navigate('/cart');
  };

  const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );

  return (
    <div className="h-screen bg-black flex flex-col text-white overflow-hidden">
      {/* Viewport */}
      <div className="flex-1 relative rounded-b-[40px] overflow-hidden">
        <div className="absolute inset-0">
          {/* Live camera */}
          {mode === 'camera' && (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}

          {/* Photo upload preview or placeholder */}
          {mode === 'upload' && !tryOnResult && (
            uploadedImage ? (
              <img src={uploadedImage} alt="Uploaded" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                <div className="text-center p-8">
                  <Upload size={64} className="mx-auto mb-4 text-violet-500 opacity-60" />
                  <p className="text-neutral-400 mb-1">Upload a full-body photo</p>
                  <p className="text-neutral-500 text-sm">Tap Choose Photo below</p>
                </div>
              </div>
            )
          )}

          {/* Model mode placeholder */}
          {mode === 'model' && !tryOnResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
              <img
                src={modelImageIndex === 0
                  ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80'
                  : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'}
                alt="Model"
                className="max-h-full object-contain opacity-80"
              />
            </div>
          )}

          {/* Loading overlay */}
          {(cameraLoading || tryOnLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30">
              <div className="text-center p-8">
                <div className="w-14 h-14 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white font-medium">{tryOnLoading ? tryOnProgress || 'Processing...' : 'Starting camera...'}</p>
                {tryOnLoading && <p className="text-neutral-400 text-sm mt-2">This may take 15-30 seconds</p>}
              </div>
            </div>
          )}

          {/* Camera error */}
          {cameraError && mode === 'camera' && !cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/95 z-20">
              <div className="text-center max-w-sm">
                <AlertCircle size={48} className="mx-auto mb-4 text-amber-500" />
                <p className="text-amber-200 font-medium mb-2">Camera Unavailable</p>
                <p className="text-neutral-400 text-sm mb-4">{cameraError}</p>
                <p className="text-neutral-500 text-xs mb-4">Switched to Photo Upload mode</p>
                <Button size="sm" onClick={() => setMode('upload')} className="bg-violet-600">
                  Use Photo Upload
                </Button>
              </div>
            </div>
          )}

          {/* Try-on result */}
          {tryOnResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 flex flex-col bg-black"
            >
              <img src={tryOnResult} alt="Try-on result" className="flex-1 w-full h-full object-contain" />
            </motion.div>
          )}

          {/* Alignment hint overlay */}
          {!tryOnResult && !tryOnLoading && !cameraError && product && (
            <div className="absolute bottom-4 left-4 right-4 text-center z-10">
              <p className="text-white/90 text-sm font-medium drop-shadow-lg">{alignmentHint}</p>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
        </div>

        {/* Header */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-black/40 backdrop-blur rounded-full">
            <XIcon />
          </button>
          <div className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold border border-white/10">
            AI Magic Mirror
          </div>
          <button className="p-2 bg-black/40 backdrop-blur rounded-full">
            <Move3d size={20} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black p-4 pb-safe flex flex-col gap-4 max-h-[45vh] overflow-y-auto">
        {/* Mode toggle */}
        <div className="flex justify-center">
          <div className="bg-neutral-900 p-1 rounded-full flex gap-1 border border-white/10">
            {[
              { id: 'camera', label: 'Live', icon: Camera },
              { id: 'upload', label: 'Photo', icon: Upload },
              { id: 'model', label: 'Model', icon: Shirt },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                    mode === m.id ? 'bg-violet-600 text-white' : 'bg-transparent text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  <Icon size={16} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {tryOnError && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/20 border border-amber-500/30">
            <AlertCircle size={20} className="text-amber-400 shrink-0" />
            <p className="text-amber-200 text-sm flex-1">{tryOnError}</p>
            <button onClick={() => setTryOnError(null)} className="text-amber-400 text-xs font-bold">Dismiss</button>
          </div>
        )}

        {!product ? (
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 text-center">
            <p className="text-neutral-400 text-sm mb-3">Select a product to try on</p>
            <Button size="sm" onClick={() => navigate('/')} className="bg-violet-600">
              Browse Products
            </Button>
          </div>
        ) : tryOnResult ? (
          <div className="flex flex-wrap gap-2 justify-center">
            <Button size="sm" variant="secondary" onClick={handleRetry} className="gap-2">
              <RotateCcw size={16} />
              Try Another
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSaveImage} className="gap-2">
              <Download size={16} />
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={handleAddToWishlist} className="gap-2">
              <Heart size={16} className={isInWishlist ? 'fill-red-500' : ''} />
              {isInWishlist ? 'Wishlisted' : 'Wishlist'}
            </Button>
            <Button size="sm" onClick={handleAddToCart} className="gap-2 bg-violet-600">
              <ShoppingBag size={16} />
              Add to Cart
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/')}>
              Try Another Product
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-3 items-center bg-neutral-900 p-3 rounded-2xl border border-white/10">
              <img src={product.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-white" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{product.name}</p>
                <p className="text-neutral-400 text-xs">{alignmentHint}</p>
              </div>
              <button className="p-2 bg-white text-black rounded-full">
                <Layers size={18} />
              </button>
            </div>

            <div className="flex items-center justify-center gap-8">
              {mode === 'upload' && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={tryOnLoading}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center">
                      <Upload size={24} />
                    </div>
                    <span className="text-xs text-neutral-400">Choose Photo</span>
                  </button>
                </>
              )}

              {mode === 'model' && (
                <>
                  <button
                    onClick={() => setModelImageIndex((i) => (i + 1) % 2)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center border border-white/10">
                      <Shirt size={24} className="text-neutral-400" />
                    </div>
                    <span className="text-xs text-neutral-400">Switch Model</span>
                  </button>
                  <button
                    onClick={handleModelTryOn}
                    disabled={tryOnLoading}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10"
                  >
                    <div className="w-16 h-16 bg-white rounded-full" />
                  </button>
                </>
              )}

              {mode === 'camera' && (
                <button
                  onClick={handleCapture}
                  disabled={tryOnLoading || cameraLoading}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50"
                >
                  <div className="w-16 h-16 bg-white rounded-full" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
