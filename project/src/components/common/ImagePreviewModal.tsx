import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar, MapPin, Tag, Info } from 'lucide-react';

interface ImageData {
  url: string | null;
  metadata?: {
    petri_code?: string;
    gasifier_code?: string;
    created_at?: string;
    placement?: string;
    observation_id?: string;
    type?: 'petri' | 'gasifier';
    program_name?: string;
    site_name?: string;
    global_submission_id?: number;
  };
}

interface ImagePreviewModalProps {
  isVisible: boolean;
  onClose: () => void;
  images: ImageData[];
  title?: string;
  initialIndex?: number;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isVisible,
  onClose,
  images,
  title = "Observation Image Preview",
  initialIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Reset state when modal opens or initialIndex changes
  useEffect(() => {
    if (isVisible) {
      console.log('🖼️ ImagePreviewModal opening:', {
        totalImages: images.length,
        initialIndex,
        imageUrls: images.map((img, i) => `${i}: ${img.url?.substring(0, 50)}...`)
      });
      setCurrentIndex(initialIndex);
      setImageLoading(true);
      setImageError(false);
    }
  }, [isVisible, initialIndex]);

  // Handle escape key
  useEffect(() => {
    if (!isVisible) return;
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!isVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const modal = document.querySelector('[data-modal="image-preview"]');
      
      if (modal && !modal.contains(target)) {
        onClose();
      }
    };
    
    // Add event listener after a brief delay to prevent immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible || !images.length) return null;

  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;
  
  console.log('🎯 Current image state:', {
    currentIndex,
    totalImages: images.length,
    currentImageUrl: currentImage?.url?.substring(0, 50) + '...',
    imageLoading,
    imageError
  });

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setImageLoading(true);
    setImageError(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setImageLoading(true);
    setImageError(false);
  };

  const handleImageLoad = () => {
    console.log('✅ Image loaded successfully:', currentImage?.url?.substring(0, 50) + '...');
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    console.log('❌ Image failed to load:', currentImage?.url?.substring(0, 50) + '...');
    setImageLoading(false);
    setImageError(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getImageTitle = (image: ImageData) => {
    const { metadata } = image;
    if (metadata?.petri_code) return `Petri: ${metadata.petri_code}`;
    if (metadata?.gasifier_code) return `Gasifier: ${metadata.gasifier_code}`;
    if (metadata?.observation_id) return `Observation: ${metadata.observation_id.slice(0, 8)}...`;
    return 'Observation Image';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div 
        data-modal="image-preview"
        className="bg-white rounded-lg shadow-2xl max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {hasMultipleImages && (
              <p className="text-sm text-gray-600">
                Image {currentIndex + 1} of {images.length}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Image Container */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 relative min-h-0">
          {currentImage.url && !imageError ? (
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}
              <img
                src={currentImage.url}
                alt={getImageTitle(currentImage)}
                onLoad={handleImageLoad}
                onError={handleImageError}
                className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${
                  imageLoading ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ maxHeight: 'calc(90vh - 200px)' }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500 p-8">
              <Info size={48} className="mb-4 text-gray-400" />
              <p className="text-lg font-medium">Image not available</p>
              <p className="text-sm text-gray-400 mt-2">
                {imageError ? 'Failed to load image' : 'No image URL provided'}
              </p>
            </div>
          )}

          {/* Navigation Arrows */}
          {hasMultipleImages && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        {/* Metadata Panel */}
        {currentImage.metadata && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <Info size={16} className="mr-2" />
              {getImageTitle(currentImage)}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {currentImage.metadata.created_at && (
                <div className="flex items-center text-gray-600">
                  <Calendar size={14} className="mr-2 text-gray-400" />
                  <span className="font-medium mr-2">Captured:</span>
                  <span>{formatDate(currentImage.metadata.created_at)}</span>
                </div>
              )}
              {currentImage.metadata.placement && (
                <div className="flex items-center text-gray-600">
                  <MapPin size={14} className="mr-2 text-gray-400" />
                  <span className="font-medium mr-2">Placement:</span>
                  <span>{currentImage.metadata.placement}</span>
                </div>
              )}
              {currentImage.metadata.type && (
                <div className="flex items-center text-gray-600">
                  <Tag size={14} className="mr-2 text-gray-400" />
                  <span className="font-medium mr-2">Type:</span>
                  <span className="capitalize">{currentImage.metadata.type}</span>
                </div>
              )}
            </div>
            
            {/* Related Context Information */}
            {(currentImage.metadata.program_name || currentImage.metadata.site_name || currentImage.metadata.global_submission_id) && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {currentImage.metadata.program_name && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium mr-2">Program:</span>
                      <span>{currentImage.metadata.program_name}</span>
                    </div>
                  )}
                  {currentImage.metadata.site_name && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium mr-2">Site:</span>
                      <span>{currentImage.metadata.site_name}</span>
                    </div>
                  )}
                  {currentImage.metadata.global_submission_id && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium mr-2">Submission:</span>
                      <span>{currentImage.metadata.global_submission_id}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image Indicators for Multiple Images */}
        {hasMultipleImages && (
          <div className="bg-white px-6 py-3 border-t border-gray-200 flex justify-center flex-shrink-0">
            <div className="flex space-x-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setImageLoading(true);
                    setImageError(false);
                  }}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentIndex
                      ? 'bg-blue-600'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};